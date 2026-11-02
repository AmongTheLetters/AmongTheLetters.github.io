#!/usr/bin/env python3
"""
ATL Reading Directory crawler v2 (Among The Letters).

Builds a directory of reading websites (magazines, journals, libraries,
presses, bookstores, audiobook sites, web fiction platforms, newsletters...).

Phases, all resumable (progress lives in output/):
  1. Discovery  - seeds.txt (Wikipedia lists/categories, Wikidata SPARQL,
                  OpenStreetMap, public directory pages, curated sites)
                  -> output/candidates.jsonl
  2. Search     - queries.txt run through Wikipedia search (always, no key)
                  and, only when keys are in .env, Marginalia / Brave search
                  APIs and the Gemini API. Every result is only a candidate.
  3. Profiling  - one polite visit to each site's homepage (robots.txt obeyed)
                  -> output/profiles.jsonl
  4. Evidence   - for sites we could not read (robots-blocked, offline...) or
                  whose access is unclear: Wikidata claims, Wikipedia intro,
                  the listing that pointed to the site -> output/evidence.jsonl
Then writes output/reading_directory.csv and output/reading_directory.jsonl.

Polite by design: obeys robots.txt (never fetches a disallowed page), honest
User-Agent, per-site spacing, no logins, no paywall bypass, HTML only, and it
never stores page body text (only titles, meta descriptions and tags).
"""
import argparse, csv, json, os, re, socket, sys, threading, time, warnings
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urljoin, urlparse, unquote
from urllib import robotparser

try:
    import requests
    from requests.adapters import HTTPAdapter
    from bs4 import BeautifulSoup
except ImportError:
    print("Missing packages. Run:  pip install -r requirements.txt")
    sys.exit(1)

try:
    from bs4 import XMLParsedAsHTMLWarning
    warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)
except ImportError:
    pass

try:
    import lxml  # noqa: F401
    PARSER = "lxml"
except ImportError:
    PARSER = "html.parser"

VERSION = "2.0"
UA = f"ATLReadingDirectoryBot/{VERSION} (+https://amongtheletters.com)"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "output")
CAND = os.path.join(OUT, "candidates.jsonl")
PROF = os.path.join(OUT, "profiles.jsonl")
EVID = os.path.join(OUT, "evidence.jsonl")
DISC_DONE = os.path.join(OUT, "discovery_done_seeds.txt")
SEARCH_DONE = os.path.join(OUT, "search_done.txt")
USAGE = os.path.join(OUT, "api_usage.json")

CONNECT_TIMEOUT = 5      # seconds to open a connection
READ_TIMEOUT = 10        # seconds to wait for data
MAX_BYTES = 200_000      # read at most ~200 KB of a homepage
HOST_DELAY = 1.0         # minimum gap between two requests to the same site
MAX_TRANSIENT_TRIES = 3  # a site that is unreachable this many runs in a row is left alone

# Domains that are never "reading sites" themselves (link hubs, social, infra).
SKIP_DOMAINS = {
    "wikipedia.org", "wikidata.org", "wikimedia.org", "wikimediafoundation.org", "mediawiki.org",
    "wiktionary.org", "wikiquote.org", "wikibooks.org", "wikinews.org", "wikiversity.org", "wikivoyage.org",
    "facebook.com", "twitter.com", "x.com", "instagram.com", "youtube.com", "youtu.be", "linkedin.com",
    "pinterest.com", "tiktok.com", "reddit.com", "threads.net", "bsky.app", "t.co", "bit.ly",
    "google.com", "goo.gl", "doi.org", "dx.doi.org", "worldcat.org", "viaf.org", "isni.org", "orcid.org",
    "jstor.org", "issn.org", "portal.issn.org", "loc.gov", "id.loc.gov", "bnf.fr", "d-nb.info", "nla.gov.au",
    "web.archive.org", "archive.is", "archive.ph", "webcitation.org", "books.google.com", "toolforge.org",
    "wmflabs.org", "creativecommons.org", "schema.org", "w3.org", "openstreetmap.org", "osm.org",
    "apple.com", "microsoft.com", "github.com", "gitlab.com", "cloudflare.com", "addtoany.com", "sharethis.com",
    "nytimes.com", "theguardian.com", "bbc.co.uk", "bbc.com", "cnn.com", "washingtonpost.com", "latimes.com",
    "imdb.com", "discogs.com", "musicbrainz.org", "spotify.com", "soundcloud.com", "vimeo.com", "flickr.com",
    "europeana.eu", "scholar.google.com", "semanticscholar.org", "researchgate.net", "yelp.com", "yelp.ca",
    "tripadvisor.com", "tripadvisor.ca", "mapquest.com", "linktr.ee",
    "academia.edu", "crossref.org", "pubmed.ncbi.nlm.nih.gov", "ncbi.nlm.nih.gov", "mailto",
    "wildapricot.com", "constantcontact.com", "mailchimp.com", "list-manage.com", "eventbrite.com",
    "iubenda.com", "donorperfect.net", "paypal.com", "gofundme.com",
}
FILE_EXT = re.compile(r"\.(pdf|jpe?g|png|gif|svg|webp|mp3|mp4|zip|epub|mobi|docx?|xlsx?|pptx?)(\?|$)", re.I)


# ---------------------------------------------------------------- settings
def load_env(path=os.path.join(HERE, ".env")):
    """Tiny .env reader (KEY=value per line, # comments). Real environment wins."""
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8-sig") as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            k, v = k.strip(), v.strip().strip('"').strip("'")
            if k and v and k not in os.environ:
                os.environ[k] = v


def env(name, default=""):
    return os.environ.get(name, default).strip()


def env_int(name, default):
    try:
        return int(env(name, str(default)))
    except ValueError:
        return default


# ---------------------------------------------------------------- network
_tls = threading.local()


def sess():
    """One keep-alive session per worker thread (connections are reused)."""
    s = getattr(_tls, "s", None)
    if s is None:
        s = requests.Session()
        ad = HTTPAdapter(pool_connections=8, pool_maxsize=8, max_retries=0)
        s.mount("http://", ad)
        s.mount("https://", ad)
        s.headers.update({"User-Agent": UA, "Accept-Language": "en;q=0.9,*;q=0.5",
                          "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5"})
        _tls.s = s
    return s


RETRY_STATUS = {429, 500, 502, 503, 504}


def retry_after(r, attempt, cap=60.0):
    """Seconds to wait: honour Retry-After when given, else exponential backoff (2, 4, 8...)."""
    ra = (r.headers.get("Retry-After", "") if r is not None else "").strip()
    if ra.isdigit():
        return min(float(ra), cap)
    return min(2.0 * (2 ** attempt), cap)


# Polite JSON APIs (Wikipedia, Wikidata, SPARQL, Overpass, search APIs): one
# request at a time per API host across all threads, spaced out, with retries
# when throttled.
_api_lock = threading.Lock()
_api_next = {}
API_DELAY = {"overpass-api.de": 5.0, "query.wikidata.org": 1.5}


class ApiError(Exception):
    pass


class QuotaError(ApiError):
    pass


def api_json(url, params=None, tries=5, timeout=30, headers=None, data=None, json_body=None, delay=None):
    host = urlparse(url).netloc
    gap = delay if delay is not None else API_DELAY.get(host, 1.0)
    last = ""
    for attempt in range(tries):
        with _api_lock:
            now = time.time()
            start = max(now, _api_next.get(host, 0))
            _api_next[host] = start + gap
        if start > now:
            time.sleep(start - now)
        r = None
        try:
            method = "POST" if (data is not None or json_body is not None) else "GET"
            r = sess().request(method, url, params=params, data=data, json=json_body,
                               timeout=(10, timeout), headers=headers or {})
            ctype = r.headers.get("Content-Type", "").lower()
            if r.status_code == 200 and "json" in ctype:
                try:
                    return r.json()
                except ValueError:
                    last = "bad JSON"
            elif r.status_code == 200:
                last = f"non-JSON reply ({ctype or 'no content-type'})"
            else:
                last = f"HTTP {r.status_code}"
                if r.status_code in (401, 403):
                    raise ApiError(last + " (check the key)")
                if r.status_code not in RETRY_STATUS:
                    raise ApiError(last)
        except requests.RequestException as e:
            last = type(e).__name__
        if attempt < tries - 1:
            pause = retry_after(r, attempt + 1, 120.0)
            with _api_lock:
                _api_next[host] = max(_api_next.get(host, 0), time.time() + pause)
            time.sleep(pause)
    if last.startswith("HTTP 429"):
        raise QuotaError(last)
    raise ApiError(f"{last} after {tries} tries")


def norm_domain(url):
    try:
        host = urlparse(url if "//" in url else "http://" + url).hostname or ""
    except ValueError:
        return ""
    host = host.lower().strip(".")
    if host.startswith("www."):
        host = host[4:]
    return host


def skipped(domain):
    if not domain or "." not in domain:
        return True
    parts = domain.split(".")
    for i in range(len(parts) - 1):
        if ".".join(parts[i:]) in SKIP_DOMAINS:
            return True
    return False


def read_jsonl(path):
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            try:
                yield json.loads(line)
            except Exception:
                pass


def load_usage():
    try:
        with open(USAGE, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def save_usage(u):
    with open(USAGE, "w", encoding="utf-8") as f:
        json.dump(u, f, indent=1)


# ---------------------------------------------------------------- discovery
class Collector:
    """Candidate sites, one line per domain. Extra notes for a domain we already
    have (another listing, a search snippet) are appended as 'extra' lines and
    merged on read, so the file is never rewritten."""

    def __init__(self):
        self.lock = threading.Lock()
        self.seen = set()
        for c in read_jsonl(CAND):
            if c.get("domain"):
                self.seen.add(c["domain"])
        self.fh = open(CAND, "a", encoding="utf-8")

    def add(self, url, source, name="", desc="", hint="", force=False, qid="", ctx="", note=""):
        if not url or not url.lower().startswith(("http://", "https://")) or FILE_EXT.search(url):
            return False
        d = norm_domain(url)
        if not d or (not force and skipped(d)):
            return False
        rec = {"domain": d, "url": url, "name": name, "wd_desc": desc, "hint": hint, "source": source}
        if qid:
            rec["qid"] = qid
        if ctx:
            rec["ctx"] = ctx[:300]
        if note:
            rec["note"] = note[:200]
        with self.lock:
            if d in self.seen:
                if ctx or note or qid:
                    rec["extra"] = True
                    self.fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
                    self.fh.flush()
                return False
            self.seen.add(d)
            self.fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
            self.fh.flush()
        return True


def load_candidates():
    """domain -> merged candidate (first record wins; extras add qid/ctx/notes)."""
    cands = {}
    for c in read_jsonl(CAND):
        d = c.get("domain")
        if not d:
            continue
        if d not in cands:
            c = dict(c)
            c.pop("extra", None)
            c["ctxs"] = [c["ctx"]] if c.get("ctx") else []
            c["notes"] = [c["note"]] if c.get("note") else []
            cands[d] = c
        else:
            m = cands[d]
            if c.get("qid") and not m.get("qid"):
                m["qid"] = c["qid"]
            if c.get("ctx") and len(m["ctxs"]) < 5:
                m["ctxs"].append(c["ctx"])
            if c.get("note") and len(m["notes"]) < 5:
                m["notes"].append(c["note"])
    return cands


WP_API = "https://{lang}.wikipedia.org/w/api.php"
WD_API = "https://www.wikidata.org/w/api.php"
SPARQL = "https://query.wikidata.org/sparql"
OVERPASS = "https://overpass-api.de/api/interpreter"


def wp_query_all(lang, params, max_pages=50):
    params = dict(params, format="json", formatversion="2", action="query")
    for _ in range(max_pages):
        data = api_json(WP_API.format(lang=lang), params)
        yield data
        if "continue" not in data:
            break
        params.update(data["continue"])


READING_WORDS = re.compile(r"book|librar|magazine|journal|literar|poet|press|publish|novel|fiction|comic|manga|zine|"
                           r"writer|author|story|stories|reading|audiobook|archive|review|prize|award|festival", re.I)


def qids_to_sites(qids, col, source, hint, ctx="", must_match=False):
    """Fetch official website (P856) + label/description for Wikidata items.
    must_match: only keep items whose label/description sounds reading-related."""
    qids = list(dict.fromkeys(q for q in qids if q))
    added = 0
    for i in range(0, len(qids), 50):
        batch = qids[i:i + 50]
        data = api_json(WD_API, {"action": "wbgetentities", "ids": "|".join(batch), "format": "json",
                                 "props": "claims|labels|descriptions", "languages": "en"})
        for qid, ent in data.get("entities", {}).items():
            claims = ent.get("claims", {}).get("P856", [])
            label = ent.get("labels", {}).get("en", {}).get("value", "")
            desc = ent.get("descriptions", {}).get("en", {}).get("value", "")
            if must_match and not READING_WORDS.search(label + " " + desc):
                continue
            for c in claims[:1]:
                v = c.get("mainsnak", {}).get("datavalue", {}).get("value")
                if isinstance(v, str) and col.add(v, source, label, desc, hint, qid=qid, ctx=ctx):
                    added += 1
    return added


def seed_wp_list(lang, title, col, hint):
    """Wikipedia list page: linked articles -> Wikidata P856, plus direct external links."""
    qids, added = [], 0
    for data in wp_query_all(lang, {"titles": title, "generator": "links", "gplnamespace": 0,
                                    "gpllimit": "max", "prop": "pageprops", "ppprop": "wikibase_item"}):
        for p in data.get("query", {}).get("pages", []):
            q = p.get("pageprops", {}).get("wikibase_item")
            if q:
                qids.append(q)
    added += qids_to_sites(qids, col, f"wp:{title}", hint)
    for data in wp_query_all(lang, {"titles": title, "prop": "extlinks", "ellimit": "max"}):
        for p in data.get("query", {}).get("pages", []):
            for el in p.get("extlinks", []):
                if col.add(el.get("url", ""), f"wp:{title}", hint=hint):
                    added += 1
    return added


def seed_wp_cat(lang, cat, depth, col, hint, _seen=None):
    _seen = _seen if _seen is not None else set()
    if cat in _seen:
        return 0
    _seen.add(cat)
    qids, subcats = [], []
    for data in wp_query_all(lang, {"generator": "categorymembers", "gcmtitle": cat, "gcmlimit": "max",
                                    "gcmtype": "page|subcat", "prop": "pageprops", "ppprop": "wikibase_item"}):
        for p in data.get("query", {}).get("pages", []):
            if p.get("ns") == 14:
                subcats.append(p["title"])
            elif p.get("ns") == 0:
                q = p.get("pageprops", {}).get("wikibase_item")
                if q:
                    qids.append(q)
    added = qids_to_sites(qids, col, f"wpcat:{cat}", hint)
    if depth > 0:
        for sc in subcats:
            added += seed_wp_cat(lang, sc, depth - 1, col, hint, _seen)
    return added


def seed_sparql(spec, col, hint):
    """spec: 'Q1368848' or 'Q1368848 sub' (include subclasses) or 'Q2085381 countries=Q30,Q16'."""
    parts = spec.split()
    cls = parts[0]
    sub = "sub" in parts[1:]
    country = ""
    for p in parts[1:]:
        if p.startswith("countries="):
            vals = " ".join("wd:" + c for c in p.split("=", 1)[1].split(","))
            country = f"?item wdt:P17 ?c . VALUES ?c {{ {vals} }}"
    path = "wdt:P31/wdt:P279*" if sub else "wdt:P31"
    q = f"""SELECT ?item ?site ?itemLabel ?itemDescription WHERE {{
      ?item {path} wd:{cls} ; wdt:P856 ?site . {country}
      FILTER NOT EXISTS {{ ?item wdt:P576 ?dissolved }}
      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
    }} LIMIT 20000"""
    data = api_json(SPARQL, {"query": q, "format": "json"}, tries=4, timeout=90,
                    headers={"Accept": "application/sparql-results+json"})
    added = 0
    for b in data["results"]["bindings"]:
        qid = b["item"]["value"].rsplit("/", 1)[-1]
        if col.add(b["site"]["value"], f"wikidata:{cls}", b.get("itemLabel", {}).get("value", ""),
                   b.get("itemDescription", {}).get("value", ""), hint, qid=qid):
            added += 1
    return added


OSM_TAGS = {"books": '["shop"="books"]', "library": '["amenity"="library"]', "comics": '["shop"="comics"]'}


def seed_osm(spec, col, hint):
    """osm:books CA-ON -> OpenStreetMap bookshops (or libraries) that list a website,
    in an ISO 3166-2 region (CA-ON) or a country (GB). Data (c) OpenStreetMap
    contributors, ODbL. One query at a time, 5 s apart, as the Overpass rules ask."""
    kind, _, area = spec.partition(" ")
    tag = OSM_TAGS.get(kind.strip())
    area = area.strip()
    if not tag or not area:
        raise ApiError("bad osm seed")
    key = "ISO3166-2" if "-" in area else "ISO3166-1"
    q = (f'[out:json][timeout:120];area["{key}"="{area}"]->.a;'
         f'(nwr{tag}["website"](area.a);nwr{tag}["contact:website"](area.a););out tags;')
    data = api_json(OVERPASS, data={"data": q}, tries=4, timeout=150)
    added = 0
    for el in data.get("elements", []):
        t = el.get("tags", {})
        site = (t.get("website") or t.get("contact:website") or "").split(";")[0].strip()
        if site and "//" not in site:
            site = "http://" + site
        place = t.get("addr:city", "") or area
        ctx = f"OpenStreetMap {kind}: {t.get('name', '')}, {place}"
        if col.add(site, f"osm:{kind} {area}", t.get("name", ""), "", hint, ctx=ctx):
            added += 1
    return added


def seed_page(url, col, hint, pages=1):
    """A public list/directory page: collect its outbound links (robots.txt respected).
    'pages=N' follows the page's own Next link on the same site, up to N pages."""
    added = 0
    own = norm_domain(url)
    for _ in range(max(1, pages)):
        res, status = fetch_html(url, max_bytes=3_000_000)
        if res is None:
            if status == "robots":
                return added
            raise ApiError(f"page {status}")
        final_url, body = res
        soup = BeautifulSoup(body, PARSER)
        title = soup.title.get_text(" ", strip=True)[:80] if soup.title else own
        nxt = None
        for a in soup.find_all("a", href=True):
            href = urljoin(final_url, a["href"])
            d = norm_domain(href)
            txt = a.get_text(" ", strip=True)
            if d == own or d.endswith("." + own):
                rel = a.get("rel") or []
                if nxt is None and ("next" in rel or txt.lower().strip() in ("next", "next ›", "next »", "›", "»")):
                    nxt = href
                continue
            if d:
                p = urlparse(href)
                root = f"{p.scheme}://{p.netloc}/"
                parent = a.find_parent(["li", "tr", "p"])
                ptxt = " ".join(parent.get_text(" ", strip=True).split())[:220] if parent else txt
                if col.add(root, f"page:{url}", txt[:120], hint=hint, ctx=f"listed on {title}: {ptxt}"):
                    added += 1
        if not nxt or nxt == url:
            break
        url = nxt
    return added


def parse_seeds(path):
    seeds = []
    hint = ""
    with open(path, encoding="utf-8") as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("#"):
                if line.startswith("## hint:"):
                    hint = line.split(":", 1)[1].strip()
                continue
            seeds.append((line, hint))
    return seeds


def run_discovery(args, col):
    done = set()
    if os.path.exists(DISC_DONE):
        with open(DISC_DONE, encoding="utf-8") as f:
            done = set(f.read().splitlines())
    seeds = parse_seeds(args.seeds)
    todo = [(s, h) for s, h in seeds if s not in done]
    print(f"Discovery: {len(seeds)} seeds ({len(seeds) - len(todo)} already done), "
          f"{len(col.seen)} sites collected so far")
    dfh = open(DISC_DONE, "a", encoding="utf-8")
    lock = threading.Lock()

    def work(item):
        line, hint = item
        kind, _, rest = line.partition(":")
        rest = rest.strip()
        lang = "en"
        if kind in ("wp", "wpcat") and re.match(r"^[a-z]{2}\|", rest):
            lang, rest = rest[:2], rest[3:]
        if kind == "site":
            n = int(col.add(rest, "curated", hint=hint, force=True))
        elif kind == "wp":
            n = seed_wp_list(lang, rest, col, hint)
        elif kind == "wpcat":
            depth = 1
            m = re.match(r"^(.*?)\s*\|\s*depth=(\d+)$", rest)
            if m:
                rest, depth = m.group(1), int(m.group(2))
            n = seed_wp_cat(lang, rest, depth, col, hint)
        elif kind == "sparql":
            n = seed_sparql(rest, col, hint)
        elif kind == "osm":
            n = seed_osm(rest, col, hint)
        elif kind == "page":
            pages = 1
            m = re.match(r"^(.*?)\s*\|\s*pages=(\d+)$", rest)
            if m:
                rest, pages = m.group(1), int(m.group(2))
            n = seed_page(rest, col, hint, pages)
        else:
            n = seed_page(line, col, hint) if line.startswith("http") else 0
        return line, n

    site_lines = [t for t in todo if t[0].startswith("site:")]
    other = [t for t in todo if not t[0].startswith("site:")]
    for t in site_lines:
        work(t)
        dfh.write(t[0] + "\n")
    dfh.flush()
    failed = []
    with ThreadPoolExecutor(max_workers=4) as ex:
        futs = {ex.submit(work, t): t for t in other}
        for i, fut in enumerate(as_completed(futs), 1):
            line = futs[fut][0]
            try:
                _, n = fut.result()
                with lock:
                    dfh.write(line + "\n")
                    dfh.flush()
                print(f"  [{i}/{len(other)}] +{n:<5} {line[:90]}   (total {len(col.seen)})")
            except Exception as e:
                failed.append(line)
                print(f"  [{i}/{len(other)}] error {type(e).__name__} ({str(e)[:40]}): {line[:80]} (will retry next run)")
    dfh.close()
    print(f"Discovery finished: {len(col.seen)} candidate sites.")
    if failed:
        print(f"  {len(failed)} seeds could not be read this time. Run again later to retry just those.")
    print()


# ---------------------------------------------------------------- search sources
def read_sections(path):
    sec, data = None, defaultdict(list)
    if not os.path.exists(path):
        return data
    with open(path, encoding="utf-8") as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            m = re.match(r"^\[(\w+)\]$", line)
            if m:
                sec = m.group(1)
            elif sec:
                data[sec].append(line)
    return data


def parse_queries(path):
    """queries.txt -> [(query, hint)]: place_types x places, genre_templates x genres, extra."""
    data = read_sections(path)
    out = [(f"{t} {p}", t) for t in data["place_types"] for p in data["places"]]
    out += [(tpl.replace("{genre}", g), g) for tpl in data["genre_templates"] for g in data["genres"]]
    out += [(q, "") for q in data["extra"]]
    seen, uniq = set(), []
    for q, h in out:
        if q.lower() not in seen:
            seen.add(q.lower())
            uniq.append((q, h))
    return uniq


def gemini_prompts(path):
    data = read_sections(path)
    return [(c, r) for c in data["ai_categories"] for r in data["ai_regions"]]


def search_wikipedia(q, hint, col):
    """Wikipedia's own search API (free, no key): matching articles -> official websites."""
    data = api_json(WP_API.format(lang="en"), {"action": "query", "format": "json", "formatversion": "2",
                                               "generator": "search", "gsrsearch": q, "gsrlimit": 20,
                                               "prop": "pageprops", "ppprop": "wikibase_item"})
    qids = [p.get("pageprops", {}).get("wikibase_item") for p in data.get("query", {}).get("pages", [])]
    return qids_to_sites(qids, col, f"wpsearch:{q}", hint, must_match=True)


def search_marginalia(q, hint, col, key):
    """Marginalia Search API (free non-commercial key; results are CC-BY-NC-SA 4.0)."""
    data = api_json("https://api2.marginalia-search.com/search", {"query": q, "count": 50, "dc": 1},
                    headers={"API-Key": key}, delay=2.0, tries=3)
    added = 0
    for r in data.get("results", []):
        snippet = " ".join(f"{r.get('title', '')} - {r.get('description', '')}".split())[:250]
        u = r.get("url", "")
        p = urlparse(u)
        if p.scheme and p.netloc and col.add(f"{p.scheme}://{p.netloc}/", f"marginalia:{q}", hint=hint,
                                             ctx=f"search snippet (Marginalia): {snippet}"):
            added += 1
    return added


def search_brave(q, hint, col, key):
    """Brave Search API. Brave's terms forbid storing search results, so only the
    site's address is used, as a lead that our own check then verifies. Titles and
    snippets are never written to disk."""
    data = api_json("https://api.search.brave.com/res/v1/web/search",
                    {"q": q, "count": 20, "safesearch": "moderate"},
                    headers={"X-Subscription-Token": key, "Accept": "application/json"}, delay=1.1, tries=3)
    added = 0
    for r in data.get("web", {}).get("results", []):
        p = urlparse(r.get("url", ""))
        if p.scheme and p.netloc and col.add(f"{p.scheme}://{p.netloc}/", "search-lead", hint=hint):
            added += 1
    return added


GEMINI = "https://generativelanguage.googleapis.com/v1beta/models"


def pick_gemini_model(key):
    """GEMINI_MODEL from .env, or 'auto': the newest stable Flash-Lite model the key can use
    (Flash-Lite has the largest free daily allowance)."""
    want = env("GEMINI_MODEL")
    if want and want.lower() != "auto":
        return want
    data = api_json(GEMINI, {"pageSize": 200}, headers={"x-goog-api-key": key}, tries=2)
    names = [m["name"].split("/", 1)[-1] for m in data.get("models", [])
             if "generateContent" in m.get("supportedGenerationMethods", [])]
    names = [n for n in names if n.startswith("gemini")]
    if not names:
        raise ApiError("no Gemini model available for this key")

    def score(n):
        ver = re.findall(r"(\d+(?:\.\d+)?)", n)
        bad = any(b in n for b in ("preview", "exp", "image", "tts", "audio", "live", "embedding", "thinking"))
        return (not bad, 2 if "flash-lite" in n else (1 if "flash" in n else 0),
                float(ver[0]) if ver else 0.0, -len(n))
    return max(names, key=score)


def ask_gemini(category, region, col, key, model):
    prompt = (f"List up to 40 real, currently active websites that are {category}, for readers in {region}. "
              "Give each site's official homepage URL. Only include sites you are confident exist and "
              "do not invent URLs. For access, say free, paid, mixed or unknown.")
    body = {"contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json",
                                 "responseSchema": {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {
                                     "name": {"type": "STRING"}, "url": {"type": "STRING"},
                                     "access": {"type": "STRING"}}, "required": ["name", "url"]}}}}
    rpm = max(1, env_int("GEMINI_RPM", 8))
    data = api_json(f"{GEMINI}/{model}:generateContent", headers={"x-goog-api-key": key},
                    json_body=body, delay=60.0 / rpm, tries=2, timeout=120)
    try:
        items = json.loads(data["candidates"][0]["content"]["parts"][0]["text"])
    except Exception:
        return 0
    added = 0
    for it in items if isinstance(items, list) else []:
        if not isinstance(it, dict):
            continue
        u = (it.get("url") or "").strip()
        if u and "//" not in u:
            u = "https://" + u
        acc = (it.get("access") or "").lower().strip()
        note = f"Gemini suggestion: {acc}" if acc in ("free", "paid", "mixed") else ""
        if col.add(u, f"gemini:{category} | {region}", (it.get("name") or "")[:120], hint=category, note=note):
            added += 1
    return added


def run_search(args, col):
    queries = parse_queries(args.queries)
    done = set()
    if os.path.exists(SEARCH_DONE):
        with open(SEARCH_DONE, encoding="utf-8") as f:
            done = set(f.read().splitlines())
    sfh = open(SEARCH_DONE, "a", encoding="utf-8")
    usage = load_usage()
    month = time.strftime("%Y-%m")
    pacific_day = time.strftime("%Y-%m-%d", time.gmtime(time.time() - 8 * 3600))  # Gemini resets at Pacific midnight
    mk, bk, gk = env("MARGINALIA_API_KEY"), env("BRAVE_API_KEY"), env("GEMINI_API_KEY")
    backends = [("wikipedia", None, search_wikipedia, args.search_limit)]
    if mk:
        backends.append(("marginalia", mk, search_marginalia, args.search_limit))
    else:
        print("Search: no MARGINALIA_API_KEY in .env, so Marginalia is skipped (optional).")
    if bk:
        left = env_int("BRAVE_MONTHLY_LIMIT", 900) - usage.get(f"brave:{month}", 0)
        backends.append(("brave", bk, search_brave, max(0, min(left, args.search_limit))))
    else:
        print("Search: no BRAVE_API_KEY in .env, so Brave is skipped (optional).")
    for name, key, fn, cap in backends:
        before = sum(1 for q, _ in queries if f"{name}|{q}" in done)
        todo = [(q, h) for q, h in queries if f"{name}|{q}" not in done][:cap]
        if not todo:
            print(f"Search ({name}): nothing new to search this run.")
            continue
        print(f"Search ({name}): {len(todo)} queries this run ({before} of {len(queries)} done before)")
        n_added = 0
        for i, (q, h) in enumerate(todo, 1):
            try:
                n = fn(q, h, col) if key is None else fn(q, h, col, key)
            except QuotaError as e:
                print(f"\n  {name}: limit reached ({e}). The rest waits for the next run.")
                break
            except ApiError as e:
                print(f"\n  {name}: {e}. Stopping {name} for this run; the rest waits for the next run.")
                break
            n_added += n
            sfh.write(f"{name}|{q}\n")
            sfh.flush()
            if name == "brave":
                usage[f"brave:{month}"] = usage.get(f"brave:{month}", 0) + 1
                save_usage(usage)
            if i % 5 == 0 or i == len(todo):
                sys.stdout.write(f"\r  {i}/{len(todo)} searched | +{n_added} new sites (total {len(col.seen)})   ")
                sys.stdout.flush()
        print()
    # Gemini: AI suggestions. Every suggested site still has to pass the normal check.
    if not gk:
        print("Gemini: no GEMINI_API_KEY in .env, so AI suggestions are skipped (optional).")
    else:
        limit = env_int("GEMINI_DAILY_LIMIT", 200)
        left = limit - usage.get(f"gemini:{pacific_day}", 0)
        prompts = [p for p in gemini_prompts(args.queries) if f"gemini|{p[0]}|{p[1]}" not in done][:max(0, left)]
        model = ""
        if prompts:
            try:
                model = pick_gemini_model(gk)
            except ApiError as e:
                print(f"Gemini: could not find a model ({e}); skipping.")
                prompts = []
        if not prompts:
            print("Gemini: nothing left to ask today.")
        else:
            print(f"Gemini ({model}): {len(prompts)} questions this run (daily limit {limit})")
            n_added = 0
            for i, (c, r) in enumerate(prompts, 1):
                try:
                    n_added += ask_gemini(c, r, col, gk, model)
                except QuotaError:
                    print("\n  Gemini: free daily limit reached. The rest waits for tomorrow.")
                    break
                except ApiError as e:
                    print(f"\n  Gemini: {e}. Stopping Gemini for this run.")
                    break
                sfh.write(f"gemini|{c}|{r}\n")
                sfh.flush()
                usage[f"gemini:{pacific_day}"] = usage.get(f"gemini:{pacific_day}", 0) + 1
                save_usage(usage)
                sys.stdout.write(f"\r  {i}/{len(prompts)} asked | +{n_added} new sites (total {len(col.seen)})   ")
                sys.stdout.flush()
            print()
    sfh.close()
    print()


# ---------------------------------------------------------------- polite fetching
_robots = {}
_robots_lock = threading.Lock()
_host_next = {}
_host_lock = threading.Lock()


class RobotsUnavailable(Exception):
    pass


def host_wait(netloc, gap=HOST_DELAY):
    """Per-site spacing: only requests to the SAME site wait for each other,
    so different sites are checked fully in parallel."""
    with _host_lock:
        now = time.time()
        t = max(now, _host_next.get(netloc, 0))
        _host_next[netloc] = t + gap
    if t > now:
        time.sleep(t - now)


def get_robots(base):
    """robots.txt for scheme://host, cached per host. If the site cannot be reached
    at all, the error is cached too, so the homepage is not tried (saves a timeout)."""
    with _robots_lock:
        rp = _robots.get(base)
    if rp is not None:
        if isinstance(rp, Exception):
            raise rp
        return rp
    rp = robotparser.RobotFileParser()
    try:
        r = sess().get(base + "/robots.txt", timeout=(CONNECT_TIMEOUT, 8), stream=True, allow_redirects=True)
        if r.status_code in (401, 403):
            rp.disallow_all = True
        elif r.status_code == 429 or r.status_code >= 500:
            r.close()
            raise RobotsUnavailable(f"robots{r.status_code}")
        elif r.status_code >= 400:
            rp.allow_all = True       # no robots.txt: everything is allowed
        else:
            raw = r.raw.read(500_000, decode_content=True) or b""
            text = raw.decode(r.encoding or "utf-8", errors="ignore")
            if "<html" in text[:500].lower():
                rp.allow_all = True   # a web page instead of a robots file
            else:
                rp.parse(text.splitlines())
        r.close()
    except (RobotsUnavailable, requests.RequestException) as e:
        with _robots_lock:
            _robots[base] = e
        raise
    with _robots_lock:
        _robots[base] = rp
    return rp


def robots_ok(url):
    p = urlparse(url)
    rp = get_robots(f"{p.scheme}://{p.netloc}")
    return rp.can_fetch(UA, url), rp


def fetch_html(url, max_bytes=MAX_BYTES, redirects=5):
    """One GET of an HTML page. Redirects are followed by hand so robots.txt is
    checked for every hop. Returns ((final_url, body), "ok") or (None, status)."""
    for _ in range(redirects + 1):
        ok, rp = robots_ok(url)
        if not ok:
            return None, "robots"
        try:
            cd = float(rp.crawl_delay(UA) or 0)
        except Exception:
            cd = 0.0
        host_wait(urlparse(url).netloc, max(HOST_DELAY, min(cd, 30.0)))
        r = sess().get(url, stream=True, allow_redirects=False, timeout=(CONNECT_TIMEOUT, READ_TIMEOUT))
        if r.status_code in (301, 302, 303, 307, 308):
            loc = r.headers.get("Location", "")
            r.close()
            if not loc:
                return None, f"http{r.status_code}"
            url = urljoin(url, loc)
            continue
        ctype = r.headers.get("Content-Type", "")
        if r.status_code >= 400:
            r.close()
            return None, f"http{r.status_code}"
        if ctype and "html" not in ctype.lower():
            r.close()
            return None, "not-html"
        body = b""
        deadline = time.time() + READ_TIMEOUT * 2
        for chunk in r.iter_content(32768):
            body += chunk
            if len(body) >= max_bytes or time.time() > deadline:
                break
        r.close()
        return (url, body), "ok"
    return None, "error:TooManyRedirects"


# ---------------------------------------------------------------- address pre-check
DEAD_DNS = {-2, -5, 7, 8, 11001, 11004}   # "no such host" codes on Linux, macOS and Windows


def dns_status(host):
    """'ok', 'dead' (the name does not exist) or 'retry' (resolver hiccup)."""
    try:
        socket.getaddrinfo(host, 443, proto=socket.IPPROTO_TCP)
        return "ok"
    except socket.gaierror as e:
        return "dead" if e.errno in DEAD_DNS else "retry"
    except UnicodeError:
        return "dead"
    except Exception:
        return "retry"


def dns_precheck(cands, threads=64):
    """Look up every address first (tiny and fast) so sites that no longer exist
    drop out in seconds instead of each waiting for a timeout. Tries www. too."""
    def one(c):
        host = urlparse(c["url"]).hostname or c["domain"]
        st = dns_status(host)
        if st != "ok":
            alt = host[4:] if host.startswith("www.") else "www." + host
            st2 = dns_status(alt)
            if st2 == "ok":
                return c["domain"], "ok:" + alt
            if "retry" in (st, st2):
                st = "retry"
        return c["domain"], st
    with ThreadPoolExecutor(max_workers=threads) as ex:
        return dict(ex.map(one, cands))


# ---------------------------------------------------------------- profiling
KW = {
    "paid": ["subscribe", "subscription", "paywall", "members only", "become a member", "membership",
             "add to cart", "shopping cart", "checkout", "buy now", "price", "$", "£", "€", "purchase", "patreon"],
    "free": ["free to read", "read for free", "free online", "free ebooks", "free books", "open access",
             "public domain", "read online", "free audiobooks", "free fiction", "free stories", "free to all"],
    "fmt_web": ["read online", "read now", "read the issue", "current issue", "read the story", "read more",
                "chapter", "fiction", "poem", "poetry", "essay", "stories"],
    "fmt_ebook": ["ebook", "e-book", "epub", "kindle", "mobi", "pdf download", "digital edition"],
    "fmt_print": ["print edition", "paperback", "hardcover", "hardback", "print copy", "print issue",
                  "order a copy", "shipping", "back issues", "buy the book", "isbn"],
    "fmt_audio": ["audiobook", "audio book", "listen now", "narrated", "audible", "librivox", "audio edition"],
    "fmt_podcast": ["podcast", "episode", "apple podcasts", "listen on spotify"],
    "t_magazine": ["magazine", "journal", "issue", "quarterly", "review", "zine", "literary"],
    "t_library": ["library", "archive", "public domain", "digital collection", "catalog", "collection of"],
    "t_store": ["bookstore", "bookshop", "book shop", "add to cart", "shop now", "checkout", "free shipping"],
    "t_platform": ["sign up", "create an account", "write your story", "upload", "join our community",
                   "readers and writers", "publish your", "web novel", "serial"],
    "t_publisher": ["publisher", "publishing", "press", "our authors", "forthcoming", "new releases",
                    "imprint", "catalogue"],
    "t_newsletter": ["newsletter", "substack", "subscribe to our", "beehiiv", "buttondown", "weekly email"],
    "submissions": ["submissions open", "submit your", "submission guidelines", "we are open to submissions",
                    "now accepting submissions", "submittable", "call for submissions", "submissions"],
}
GENRES = {
    "poetry": ["poetry", "poem", "poems", "poet"],
    "fiction": ["fiction", "short story", "short stories", "novel"],
    "flash fiction": ["flash fiction", "microfiction", "micro fiction"],
    "science fiction": ["science fiction", "sci-fi", "scifi", "speculative"],
    "fantasy": ["fantasy"],
    "horror": ["horror", "dark fiction"],
    "mystery & crime": ["mystery", "crime fiction", "detective", "thriller"],
    "romance": ["romance"],
    "literary": ["literary fiction", "literary"],
    "nonfiction & essays": ["nonfiction", "non-fiction", "essay", "memoir", "creative nonfiction"],
    "children & YA": ["children's", "young adult", "picture book", " ya "],
    "comics": ["comic", "graphic novel", "manga", "webcomic"],
    "drama": ["playwright", "drama", "plays"],
    "translation": ["translation", "translated"],
    "classics": ["classic literature", "classics", "public domain"],
}


def count(text, words):
    return sum(text.count(w) for w in words)


def new_row(cand):
    return {"domain": cand["domain"], "url": cand["url"], "name": cand.get("name", ""),
            "description": "", "language": "", "access": "unknown", "formats": "", "type": "",
            "genres": "", "submissions_signal": "", "wikidata_description": cand.get("wd_desc", ""),
            "seed_hint": cand.get("hint", ""), "source": cand.get("source", ""), "status": "",
            "checked_at": time.strftime("%Y-%m-%d"), "access_evidence": ""}


def err_status(e):
    if isinstance(e, RobotsUnavailable):
        return "error:" + str(e)
    for cls, name in ((requests.exceptions.SSLError, "SSLError"),
                      (requests.exceptions.ConnectTimeout, "ConnectTimeout"),
                      (requests.exceptions.ReadTimeout, "ReadTimeout")):
        if isinstance(e, cls):
            return "error:" + name
    return "error:" + type(e).__name__


def analyse(row, body, final_url):
    """Tags from one homepage. Page text is used in memory only and never stored."""
    soup = BeautifulSoup(body, PARSER)

    def meta(*names):
        for n in names:
            t = soup.find("meta", attrs={"property": n}) or soup.find("meta", attrs={"name": n})
            if t and t.get("content"):
                return " ".join(t["content"].split())[:400]
        return ""

    title = soup.title.get_text(" ", strip=True)[:200] if soup.title else ""
    row["name"] = meta("og:site_name") or row["name"] or title
    row["description"] = meta("description", "og:description", "twitter:description")
    html_tag = soup.find("html")
    row["language"] = (html_tag.get("lang", "") if html_tag else "")[:10]
    links = soup.find_all("a", href=True)
    hrefs = " ".join(a.get("href", "").lower() for a in links)[:200000]
    about = next((urljoin(final_url, a["href"]) for a in links
                  if re.search(r"/(about|about-us|masthead|who-we-are)/?$", a["href"].lower())), None)
    for s in soup(["script", "style", "noscript"]):
        s.decompose()
    text = " " + " ".join(soup.get_text(" ").lower().split())[:300000] + " "
    return text, hrefs, about


def tag_row(row, text, hrefs):
    full = text + " " + hrefs + " " + (row["description"] + " " + row["wikidata_description"] +
                                       " " + row["seed_hint"]).lower()
    c = {k: count(full, v) for k, v in KW.items()}
    paid, free, web = c["paid"], c["free"], c["fmt_web"]
    if paid >= 3 and (free >= 1 or web >= 8):
        row["access"] = "mixed"
    elif paid >= 3:
        row["access"] = "paid"
    elif free >= 1 or web >= 3:
        row["access"] = "free"
    else:
        row["access"] = "unknown"
    row["access_evidence"] = "homepage wording" if row["access"] != "unknown" else ""
    fmts = [n for k, n in [("fmt_web", "web"), ("fmt_ebook", "ebook"), ("fmt_print", "print"),
                           ("fmt_audio", "audiobook"), ("fmt_podcast", "podcast")] if c[k] >= 2]
    row["formats"] = "; ".join(fmts)
    types = sorted(((c[k], n) for k, n in [("t_magazine", "magazine/journal"), ("t_library", "library/archive"),
                                           ("t_store", "store"), ("t_platform", "platform"),
                                           ("t_publisher", "publisher/press"), ("t_newsletter", "newsletter")]
                    if c[k] >= 3), reverse=True)
    row["type"] = "; ".join(n for _, n in types[:2])
    g = sorted(((count(full, w), n) for n, w in GENRES.items()), reverse=True)
    row["genres"] = "; ".join([n for k, n in g if k >= 3][:5])
    row["submissions_signal"] = "yes" if c["submissions"] >= 2 or "submittable.com" in hrefs else ""


def profile(cand, dns=None):
    url = cand["url"]
    p = urlparse(url)
    if not p.path:
        url += "/"
    row = new_row(cand)
    row["url"] = url
    if dns == "dead":
        row["status"] = "dns"
        return row
    if dns and dns.startswith("ok:"):          # only the www./bare variant resolves
        url = f"{p.scheme}://{dns[3:]}/"
    alt = ("https://" + url[7:]) if url.startswith("http://") else ("http://" + url[8:])
    res, status = None, ""
    for u in (url, alt):
        try:
            res, status = fetch_html(u)
            break
        except requests.exceptions.ConnectTimeout as e:
            status = err_status(e)
            break              # the host is not answering at all: don't knock twice
        except (requests.exceptions.SSLError, requests.exceptions.ConnectionError) as e:
            status = err_status(e)
            continue           # try the other scheme once (broken HTTPS, http-only sites)
        except Exception as e:
            status = err_status(e)
            break
    if res is None:
        row["status"] = status
        return row
    final_url, body = res
    row["url"] = final_url
    text, hrefs, about = analyse(row, body, final_url)
    # A second page only when the homepage told us almost nothing.
    if about and len(text) < 600 and not row["description"] and norm_domain(about) == norm_domain(final_url):
        try:
            res2, _ = fetch_html(about)
            if res2:
                s2 = BeautifulSoup(res2[1], PARSER)
                for s in s2(["script", "style", "noscript"]):
                    s.decompose()
                text += " " + " ".join(s2.get_text(" ").lower().split())[:150000]
        except Exception:
            pass
    tag_row(row, text, hrefs)
    row["status"] = "ok"
    return row


TRANSIENT = {"http429", "http500", "http502", "http503", "http504", "http520", "http521", "http522",
             "http523", "http524", "http525", "error:ConnectionError", "error:ConnectTimeout",
             "error:ReadTimeout", "error:Timeout", "error:ChunkedEncodingError", "error:dns-retry",
             "error:robots429", "error:robots500", "error:robots502", "error:robots503", "error:robots504",
             "error:ContentDecodingError"}


def run_profiling(args):
    cands = list(load_candidates().values())
    last, fails = {}, Counter()
    for r in read_jsonl(PROF):
        d = r.get("domain")
        if not d:
            continue
        st = r.get("status", "")
        last[d] = st
        fails[d] = fails[d] + 1 if st in TRANSIENT else 0
    # ok / robots / 404 etc. stay done. Temporary errors (busy, timeout) are retried,
    # but a site that failed MAX_TRANSIENT_TRIES runs in a row is left alone.
    done = {d for d, st in last.items() if st not in TRANSIENT or fails[d] >= MAX_TRANSIENT_TRIES}
    todo = [c for c in cands if c["domain"] not in done]
    retry = sum(1 for c in todo if c["domain"] in last)
    if args.limit:
        todo = todo[:args.limit]
    total = len(todo)
    print(f"Profiling: {len(cands)} candidates, {len(done)} already done, {total} to check now "
          f"(including {retry} retries) with {args.workers} workers.")
    if not total:
        return
    t0 = time.time()
    dns = dns_precheck(todo)
    nd = sum(1 for v in dns.values() if v == "dead")
    print(f"  Address check: {nd} sites no longer exist (kept in the list as offline), "
          f"{total - nd} to visit ({time.time() - t0:.0f}s)")
    fh = open(PROF, "a", encoding="utf-8")
    lock = threading.Lock()
    stats = Counter()
    start = time.time()

    def job(c):
        st = dns.get(c["domain"], "ok")
        if st == "retry":
            row = new_row(c)
            row["status"] = "error:dns-retry"
            return row
        return profile(c, st)

    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = [ex.submit(job, c) for c in todo]
        for i, fut in enumerate(as_completed(futs), 1):
            try:
                row = fut.result()
            except Exception:
                stats["not read"] += 1
                continue
            with lock:
                fh.write(json.dumps(row, ensure_ascii=False) + "\n")
                fh.flush()
            stats["ok" if row["status"] == "ok" else "not read"] += 1
            if i % 10 == 0 or i == total:
                el = time.time() - start
                eta = el / i * (total - i)
                sys.stdout.write(f"\r  {i}/{total} checked | ok {stats['ok']} | not read {stats['not read']} "
                                 f"| {el / 60:.1f} min, ~{eta / 60:.0f} min left | {i / max(el, 1e-6):.1f} sites/s   ")
                sys.stdout.flush()
    fh.close()
    print("\nProfiling finished. Sites that could not be read stay in the list; "
          "the next step looks for outside evidence about them.\n")


# ---------------------------------------------------------------- outside evidence
# (keyword in the evidence text, short label shown in access_evidence)
FREE_EV = [("open access", "open access"), ("free access", "free access"), ("free to read", "free to read"),
           ("freely available", "freely available"), ("free online", "free online"),
           ("public domain", "public domain"), ("free ebook", "free ebooks"), ("free e-book", "free ebooks"),
           ("free audiobook", "free audiobooks"), ("creative commons", "Creative Commons"),
           ("cc by", "Creative Commons"), ("cc-by", "Creative Commons"), ("digital library", "digital library"),
           ("online library", "online library"), ("public library", "public library"),
           ("online literary magazine", "online literary magazine"), ("online magazine", "online magazine"),
           ("online journal", "online journal"), ("webzine", "webzine"), ("e-zine", "e-zine"),
           ("web fiction", "web fiction"), ("webcomic", "webcomic"), ("web serial", "web serial"),
           ("fan fiction", "fan fiction"), ("no subscription", "no subscription"),
           ("free of charge", "free of charge")]
PAID_EV = [("subscription", "subscription"), ("paywall", "paywall"), ("subscriber", "subscribers"),
           ("bookstore", "bookstore"), ("bookshop", "bookshop"), ("book store", "bookstore"),
           ("book shop", "bookshop"), ("bookseller", "bookseller"), ("retailer", "retailer"),
           ("publishing company", "publishing company"), ("publishing house", "publishing house"),
           ("book publisher", "book publisher"), ("publisher", "publisher"), ("imprint", "imprint"),
           ("small press", "small press"), ("university press", "university press"),
           ("print magazine", "print magazine"), ("printed magazine", "print magazine"),
           ("ebook store", "ebook store"), ("ebook retailer", "ebook store"), ("e-book retailer", "ebook store")]
TYPE_EV = [("public library", "library/archive"), ("library", "library/archive"), ("archive", "library/archive"),
           ("bookstore", "store"), ("bookshop", "store"), ("book shop", "store"), ("bookseller", "store"),
           ("publisher", "publisher/press"), ("publishing", "publisher/press"), ("press", "publisher/press"),
           ("magazine", "magazine/journal"), ("journal", "magazine/journal"), ("zine", "magazine/journal"),
           ("review", "magazine/journal"), ("newsletter", "newsletter"), ("web fiction", "platform"),
           ("webcomic", "platform"), ("platform", "platform"), ("audiobook", "audiobooks"),
           ("award", "award/prize"), ("prize", "award/prize"), ("society", "organization"),
           ("association", "organization"), ("festival", "organization"), ("store", "store")]
HINT_ACCESS = {"bookstore": "paid", "independent bookstore": "paid", "online bookstore": "paid",
               "ebook store": "paid", "book publisher": "paid", "small press publisher": "paid",
               "university press publisher": "paid", "comics publisher": "paid", "audiobook publisher": "paid",
               "free library": "free", "digital library": "free", "online archive": "free",
               "public library": "free", "web fiction platform": "free", "online magazine": "free",
               "used bookstore": "paid", "comic book store": "paid", "small press": "paid"}


def judge(sources):
    """sources: [(label, text)] in order of trust. First source with a clear signal wins.
    Returns (access, evidence note)."""
    for label, text in sources:
        t = " " + " ".join((text or "").lower().split()) + " "
        if len(t) < 4:
            continue
        free = [n for k, n in FREE_EV if k in t]
        paid = [n for k, n in PAID_EV if k in t]
        if paid and free:
            return "mixed", f"{label}: '{free[0]}' and '{paid[0]}'"
        if free:
            return "free", f"{label}: '{free[0]}'"
        if paid:
            return "paid", f"{label}: '{paid[0]}'"
    return "unconfirmed", ""


def guess_type(text):
    t = (text or "").lower()
    for k, n in TYPE_EV:
        if k in t:
            return n
    return ""


IRI_BAD = re.compile(r'[\s<>"{}|\\^`]')


def wikidata_by_site(domain_urls):
    """{domain: url} -> {domain: info}, matching Wikidata 'official website' (P856):
    description, classes (P31), licence (P275), online access status (P6954), Wikipedia article."""
    vals, back = [], {}
    for d, u in domain_urls.items():
        variants = {f"{s}://{w}{d}{e}" for s in ("http", "https") for w in ("", "www.") for e in ("", "/")}
        variants.add(u)
        for v in variants:
            if v and not IRI_BAD.search(v):
                vals.append(f"<{v}>")
                back[v] = d
    q = f"""SELECT ?item ?site ?itemLabel ?itemDescription ?classLabel ?licLabel ?accLabel ?article WHERE {{
      VALUES ?site {{ {' '.join(vals)} }}
      ?item wdt:P856 ?site .
      OPTIONAL {{ ?item wdt:P31 ?class }}
      OPTIONAL {{ ?item wdt:P275 ?lic }}
      OPTIONAL {{ ?item wdt:P6954 ?acc }}
      OPTIONAL {{ ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }}
      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
    }}"""
    data = api_json(SPARQL, data={"query": q, "format": "json"}, tries=4, timeout=90,
                    headers={"Accept": "application/sparql-results+json"})
    info = {}
    for b in data["results"]["bindings"]:
        d = back.get(b["site"]["value"])
        if not d:
            continue
        g = lambda k: b.get(k, {}).get("value", "")
        i = info.setdefault(d, {"qid": g("item").rsplit("/", 1)[-1], "label": "", "desc": "",
                                "classes": set(), "licence": set(), "access": set(), "wp": ""})
        i["label"] = i["label"] or g("itemLabel")
        i["desc"] = i["desc"] or g("itemDescription")
        for k, f in (("classLabel", "classes"), ("licLabel", "licence"), ("accLabel", "access")):
            if g(k) and not re.match(r"^Q\d+$", g(k)):
                i[f].add(g(k))
        if g("article") and not i["wp"]:
            i["wp"] = unquote(g("article").rsplit("/wiki/", 1)[-1]).replace("_", " ")
    return info


def wikipedia_intros(titles):
    out = {}
    titles = list(dict.fromkeys(t for t in titles if t))
    for i in range(0, len(titles), 20):
        data = api_json(WP_API.format(lang="en"), {"action": "query", "format": "json", "formatversion": "2",
                                                   "prop": "extracts", "exintro": 1, "explaintext": 1,
                                                   "exchars": 1200, "exlimit": 20, "redirects": 1,
                                                   "titles": "|".join(titles[i:i + 20])})
        q = data.get("query", {})
        for p in q.get("pages", []):
            out[p.get("title", "")] = p.get("extract", "")
        for r in q.get("redirects", []) or []:
            if r.get("to") in out:
                out[r["from"]] = out[r["to"]]
    return out


def decide(r, c, i, intro):
    """Access + evidence for one site from everything known about it except its own pages."""
    classes = "; ".join(sorted(i.get("classes", [])))
    sources = []
    if r.get("status") == "ok" and r.get("description"):
        sources.append(("homepage description", r["description"]))
    if i.get("licence"):
        sources.append(("Wikidata licence", "creative commons " + "; ".join(sorted(i["licence"]))))
    if i.get("access"):
        sources.append(("Wikidata access status", "; ".join(sorted(i["access"]))))
    sources.append(("Wikidata", " ".join([i.get("desc") or r.get("wikidata_description", ""), classes])))
    if intro:
        sources.append(("Wikipedia intro", intro[:700]))
    for t in c.get("ctxs", []):
        sources.append(("search snippet" if t.startswith("search snippet") else
                        ("OpenStreetMap" if t.startswith("OpenStreetMap") else "listing"), t))
    acc, ev = judge(sources)
    if acc == "unconfirmed":
        h = (r.get("seed_hint") or c.get("hint") or "").lower()
        if h in HINT_ACCESS:
            acc, ev = HINT_ACCESS[h], f"listed as '{h}' ({(r.get('source') or c.get('source', ''))[:60]})"
    if acc == "unconfirmed":
        for n in c.get("notes", []):
            m = re.match(r"Gemini suggestion: (free|paid|mixed)", n)
            if m:
                acc, ev = m.group(1), "Gemini suggestion only (unverified)"
                break
    typ = guess_type(" ".join([i.get("desc", ""), classes, r.get("seed_hint", ""),
                               r.get("wikidata_description", ""), " ".join(c.get("ctxs", []))]))
    return acc, ev, typ, classes


def run_evidence(args):
    """Outside evidence for every site we could not read, or whose access is unclear.
    Only Wikidata/Wikipedia APIs and saved listing text are used; the site itself is never fetched."""
    cmap = load_candidates()
    prof = {r["domain"]: r for r in read_jsonl(PROF) if r.get("domain")}
    done = {e["domain"] for e in read_jsonl(EVID)}
    need = [d for d, r in prof.items()
            if d not in done and (r.get("status") != "ok" or r.get("access") in ("unknown", "unconfirmed", ""))]
    if args.limit:
        need = need[:args.limit]
    if not need:
        print("Evidence: nothing new to look up.\n")
        return
    print(f"Evidence: looking up {len(need)} sites in Wikidata and Wikipedia "
          f"(sites that blocked bots, were offline, or gave no clear free/paid signal).")
    fh = open(EVID, "a", encoding="utf-8")
    start = time.time()
    B = 40
    for bi in range(0, len(need), B):
        batch = need[bi:bi + B]
        try:
            wd = wikidata_by_site({d: prof[d].get("url") or f"http://{d}/" for d in batch})
        except ApiError as e:
            print(f"\n  Wikidata lookup failed ({e}); the rest will be tried next run.")
            break
        try:
            intros = wikipedia_intros([i["wp"] for i in wd.values()])
        except ApiError:
            intros = {}
        for d in batch:
            r, c, i = prof[d], cmap.get(d, {}), wd.get(d, {})
            acc, ev, typ, classes = decide(r, c, i, intros.get(i.get("wp", ""), ""))
            rec = {"domain": d, "access": acc, "access_evidence": ev, "type_guess": typ,
                   "qid": i.get("qid") or c.get("qid", ""), "wd_label": i.get("label", ""),
                   "wd_desc": i.get("desc", ""), "wd_classes": classes, "wikipedia": i.get("wp", ""),
                   "checked_at": time.strftime("%Y-%m-%d")}
            fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
        fh.flush()
        n = min(bi + B, len(need))
        el = time.time() - start
        sys.stdout.write(f"\r  {n}/{len(need)} looked up | ~{el / n * (len(need) - n) / 60:.0f} min left   ")
        sys.stdout.flush()
    fh.close()
    print("\nEvidence finished.\n")


# ---------------------------------------------------------------- export
FIELDS = ["name", "url", "domain", "description", "type", "access", "access_label", "access_evidence",
          "formats", "genres", "submissions_signal", "language", "wikidata_description", "wikidata_id",
          "seed_hint", "source", "status", "status_label", "checked_at"]
ACCESS_LABEL = {"free": "Free", "paid": "Paid", "mixed": "Free and paid", "unconfirmed": "Access not yet confirmed"}


def status_label(st):
    if st == "ok":
        return "checked"
    if st == "robots":
        return "site asks bots not to visit (not fetched)"
    if st == "dns":
        return "address no longer exists"
    if st.startswith("error:robots"):
        return "robots file unavailable, so not fetched yet"
    if st in TRANSIENT:
        return "temporarily unreachable"
    if st.startswith("http4"):
        return "page not available"
    return "could not be read"


def merge_row(r, e, c):
    r = dict(r)
    r.setdefault("access_evidence", "")
    ok = r.get("status") == "ok"
    if ok and r.get("access") in ("free", "paid", "mixed"):
        r["access_evidence"] = r["access_evidence"] or "homepage wording"
    elif e and e.get("access") in ("free", "paid", "mixed"):
        r["access"], r["access_evidence"] = e["access"], e["access_evidence"]
    else:
        r["access"], r["access_evidence"] = "unconfirmed", ""
    if e:
        r["type"] = r.get("type") or e.get("type_guess", "")
        r["name"] = r.get("name") or e.get("wd_label", "")
        r["wikidata_description"] = r.get("wikidata_description") or e.get("wd_desc", "")
        r["wikidata_id"] = e.get("qid", "")
    r["wikidata_id"] = r.get("wikidata_id") or c.get("qid", "")
    r["name"] = r.get("name") or c.get("name", "") or r["domain"]
    r["access_label"] = ACCESS_LABEL.get(r["access"], r["access"])
    r["status_label"] = status_label(r.get("status", ""))
    return r


def export():
    rows = {r["domain"]: r for r in read_jsonl(PROF) if r.get("domain")}
    ev = {e["domain"]: e for e in read_jsonl(EVID)}
    cmap = load_candidates()
    out = [merge_row(r, ev.get(d), cmap.get(d, {})) for d, r in rows.items()]
    out.sort(key=lambda r: (r.get("status") != "ok", (r.get("name") or r["domain"]).lower()))
    csv_path = os.path.join(OUT, "reading_directory.csv")
    with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS, extrasaction="ignore")
        w.writeheader()
        w.writerows(out)
    with open(os.path.join(OUT, "reading_directory.jsonl"), "w", encoding="utf-8") as f:
        for r in out:
            f.write(json.dumps({k: r.get(k, "") for k in FIELDS}, ensure_ascii=False) + "\n")
    ok = sum(1 for r in out if r.get("status") == "ok")
    acc = Counter(r["access_label"] for r in out)
    print(f"Saved {len(out)} sites ({ok} read directly, {len(out) - ok} described from outside sources) to:\n  {csv_path}")
    print("  " + ", ".join(f"{k}: {v}" for k, v in acc.most_common()))


def main():
    ap = argparse.ArgumentParser(description="ATL Reading Directory crawler v2")
    ap.add_argument("--seeds", default=os.path.join(HERE, "seeds.txt"))
    ap.add_argument("--queries", default=os.path.join(HERE, "queries.txt"))
    ap.add_argument("--workers", type=int, default=24, help="sites checked in parallel (default 24)")
    ap.add_argument("--limit", type=int, default=0, help="only check / look up N sites this run (testing)")
    ap.add_argument("--search-limit", type=int, default=400, help="max searches per search source per run (default 400)")
    ap.add_argument("--discover-only", action="store_true")
    ap.add_argument("--profile-only", action="store_true")
    ap.add_argument("--no-search", action="store_true", help="skip the search and Gemini step")
    ap.add_argument("--no-evidence", action="store_true", help="skip the outside-evidence step")
    ap.add_argument("--fresh", action="store_true", help="delete previous progress and start over")
    args = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    load_env()
    if args.fresh:
        for p in (CAND, PROF, DISC_DONE, EVID, SEARCH_DONE):
            if os.path.exists(p):
                os.remove(p)
    print(f"Reading Directory crawler v{VERSION}\n")
    try:
        if not args.profile_only:
            col = Collector()
            run_discovery(args, col)
            if not args.no_search:
                run_search(args, col)
            col.fh.close()
        if not args.discover_only:
            run_profiling(args)
            if not args.no_evidence:
                run_evidence(args)
    except KeyboardInterrupt:
        print("\nStopped. Progress is saved; run again to continue where it left off.")
    export()


if __name__ == "__main__":
    main()
