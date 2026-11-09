#!/usr/bin/env python3
"""
ATL Topaz Pages crawler (Among The Letters).

Builds a directory of the people and companies a writer needs to publish a book:
publishers and small presses, literary agents, editors and proofreaders, cover and
interior designers, picture book illustrators, and printing, audiobook, ISBN and
distribution services. Forked from the Jade Pages reading-directory crawler.

Phases, all resumable (progress lives in output/):
  0. Scam list  - downloads Writer Beware's public scam list (kept on this computer only)
  1. Discovery  - seeds.txt (Wikipedia lists and categories, Wikidata, public member
                  directories and their profile pages, the ALLi service ratings, curated sites)
                  -> output/candidates.jsonl
  2. Search     - queries.txt through Wikipedia search (always, no key) and, only when
                  keys are in .env, Marginalia / Brave / Gemini. Every result is only a lead.
  3. Profiling  - a polite visit to each site's homepage and up to two of its own pages
                  about services, rates or submissions (robots.txt obeyed)
                  -> output/profiles.jsonl
  4. Evidence   - Wikidata facts for sites we could not read -> output/evidence.jsonl
Then writes output/topaz_directory.csv (known scams left out, listed in output/scams_dropped.csv).

Polite by design: obeys robots.txt (never fetches a disallowed page), honest User-Agent,
per-site spacing, honours Crawl-delay, no logins, no paywall bypass, HTML only, and it
never stores page body text (only titles, meta descriptions and the tags read from them).
"""
import argparse, csv, json, os, re, socket, sys, threading, time, warnings
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urljoin, urlparse, quote_plus
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

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import taxonomy as tx  # noqa: E402
import scamcheck  # noqa: E402

VERSION = "1.0"
UA = f"ATLTopazDirectoryBot/{VERSION} (+https://amongtheletters.com)"
OUT = os.path.join(HERE, "output")
CAND = os.path.join(OUT, "candidates.jsonl")
PROF = os.path.join(OUT, "profiles.jsonl")
EVID = os.path.join(OUT, "evidence.jsonl")
FOLLOWED = os.path.join(OUT, "followed_pages.jsonl")
ALLI = os.path.join(OUT, "alli_ratings.jsonl")
DISC_DONE = os.path.join(OUT, "discovery_done_seeds.txt")
SEARCH_DONE = os.path.join(OUT, "search_done.txt")
USAGE = os.path.join(OUT, "api_usage.json")
CSV_OUT = os.path.join(OUT, "topaz_directory.csv")
SCAMS_OUT = os.path.join(OUT, "scams_dropped.csv")

CONNECT_TIMEOUT = 5      # seconds to open a connection
READ_TIMEOUT = 10        # seconds to wait for data
MAX_BYTES = 250_000      # read at most ~250 KB of a page
HOST_DELAY = 1.0         # minimum gap between two requests to the same site
MAX_TRANSIENT_TRIES = 3  # a site that is unreachable this many runs in a row is left alone
EXTRA_PAGES = 2          # own pages read per site beyond the homepage (services, rates, submissions...)
DEADLINE = [0.0]         # set by --hours; work stops cleanly after this time

# Domains that are never services themselves (link hubs, social, infra, big platforms).
SKIP_DOMAINS = {
    "wikipedia.org", "wikidata.org", "wikimedia.org", "wikimediafoundation.org", "mediawiki.org",
    "wiktionary.org", "wikiquote.org", "wikibooks.org", "wikisource.org",
    "facebook.com", "twitter.com", "x.com", "instagram.com", "youtube.com", "youtu.be", "linkedin.com",
    "pinterest.com", "tiktok.com", "reddit.com", "threads.net", "bsky.app", "t.co", "bit.ly", "tumblr.com",
    "google.com", "goo.gl", "doi.org", "worldcat.org", "viaf.org", "isni.org", "orcid.org", "jstor.org",
    "issn.org", "loc.gov", "bnf.fr", "d-nb.info", "nla.gov.au", "web.archive.org", "archive.org", "archive.is",
    "archive.ph", "books.google.com", "toolforge.org", "wmflabs.org", "creativecommons.org", "schema.org", "w3.org",
    "openstreetmap.org", "apple.com", "microsoft.com", "github.com", "gitlab.com", "cloudflare.com",
    "addtoany.com", "sharethis.com", "nytimes.com", "theguardian.com", "bbc.co.uk", "bbc.com", "cnn.com",
    "washingtonpost.com", "imdb.com", "spotify.com", "soundcloud.com", "vimeo.com", "flickr.com", "yelp.com",
    "yelp.ca", "tripadvisor.com", "linktr.ee", "academia.edu", "crossref.org", "wildapricot.com",
    "constantcontact.com", "mailchimp.com", "list-manage.com", "eventbrite.com", "iubenda.com",
    "donorperfect.net", "paypal.com", "gofundme.com", "stripe.com", "squarespace.com", "wix.com",
    "wordpress.org", "godaddy.com", "shopify.com", "sophos.com", "safelinks.protection.outlook.com",
    "cookiedatabase.org", "termly.io", "cookiebot.com", "onetrust.com", "goodreads.com", "amazon.com",
    "amazon.ca", "amazon.co.uk", "indigo.ca", "barnesandnoble.com", "bookshop.org", "trustpilot.com",
    "enable-javascript.com", "gravatar.com", "typekit.net", "googleapis.com", "gstatic.com", "zoom.us",
    "canada.ca", "gc.ca", "canadacouncil.ca", "arts.on.ca", "pixl8.com", "readymembership.com",
    "memnet.com.au", "drgnetwork.com", "informz.net", "zeffy.com", "printify.me", "dashery.com", "kit.com",
    "substack.com", "medium.com", "mangoinnovation.com", "ixmedia.com", "schmidtdigital.ca", "newmode.net",
}
FILE_EXT = re.compile(r"\.(pdf|jpe?g|png|gif|svg|webp|mp3|mp4|zip|epub|mobi|docx?|xlsx?|pptx?)(\?|$)", re.I)


def out_of_time():
    return DEADLINE[0] and time.time() > DEADLINE[0]


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
    """Candidate sites, one line per domain. Extra notes for a domain we already have
    (another listing, a membership, a search snippet) are appended as 'extra' lines and
    merged on read, so the file is never rewritten."""

    def __init__(self):
        self.lock = threading.Lock()
        self.seen = set()
        for c in read_jsonl(CAND):
            if c.get("domain"):
                self.seen.add(c["domain"])
        self.fh = open(CAND, "a", encoding="utf-8")

    def add(self, url, source, name="", desc="", hint="", force=False, qid="", ctx="", note="", member="", country=""):
        if not url or not url.lower().startswith(("http://", "https://")) or FILE_EXT.search(url):
            return False
        d = norm_domain(url)
        if not d or (not force and skipped(d)):
            return False
        rec = {"domain": d, "url": url, "name": name, "wd_desc": desc, "hint": hint, "source": source}
        for k, v in (("qid", qid), ("ctx", ctx[:300]), ("note", note[:200]), ("member", member), ("country", country)):
            if v:
                rec[k] = v
        with self.lock:
            if d in self.seen:
                if ctx or note or qid or member or country or hint:
                    rec["extra"] = True
                    self.fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
                    self.fh.flush()
                return False
            self.seen.add(d)
            self.fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
            self.fh.flush()
        return True


def load_candidates():
    """domain -> merged candidate (first record wins; extras add qid, listings, memberships, hints)."""
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
            c["members"] = [c["member"]] if c.get("member") else []
            c["hints"] = [c["hint"]] if c.get("hint") else []
            cands[d] = c
        else:
            m = cands[d]
            if c.get("qid") and not m.get("qid"):
                m["qid"] = c["qid"]
            if c.get("country") and not m.get("country"):
                m["country"] = c["country"]
            for k, lst in (("ctx", "ctxs"), ("note", "notes"), ("member", "members"), ("hint", "hints")):
                if c.get(k) and c[k] not in m[lst] and len(m[lst]) < 6:
                    m[lst].append(c[k])
            if not m.get("hint") and c.get("hint"):
                m["hint"] = c["hint"]
            if not m.get("name") and c.get("name"):
                m["name"] = c["name"]
    return cands


WP_API = "https://{lang}.wikipedia.org/w/api.php"
WD_API = "https://www.wikidata.org/w/api.php"
SPARQL = "https://query.wikidata.org/sparql"


def wp_query_all(lang, params, max_pages=50):
    params = dict(params, format="json", formatversion="2", action="query")
    for _ in range(max_pages):
        data = api_json(WP_API.format(lang=lang), params)
        yield data
        if "continue" not in data:
            break
        params.update(data["continue"])


SERVICE_WORDS = re.compile(r"book|publish|press|literar|agen|editor|editing|proofread|design|illustrat|print|audio|narrat|"
                           r"isbn|distribut|comic|manga|poet|novel|author|writer|children|picture|graphic|typeset|"
                           r"[ée]dition|imprim", re.I)


def qids_to_sites(qids, col, source, hint, ctx="", must_match=False, opts=None):
    """Official website (P856) + label/description for Wikidata items. People who have died
    (P570) and organizations that have closed (P576) are skipped. must_match keeps only items
    whose label or description sounds like a book service."""
    opts = opts or {}
    qids = list(dict.fromkeys(q for q in qids if q))
    added = 0
    for i in range(0, len(qids), 50):
        if out_of_time():
            break
        batch = qids[i:i + 50]
        data = api_json(WD_API, {"action": "wbgetentities", "ids": "|".join(batch), "format": "json",
                                 "props": "claims|labels|descriptions", "languages": "en|fr"})
        for qid, ent in data.get("entities", {}).items():
            cl = ent.get("claims", {})
            if cl.get("P570") or cl.get("P576"):
                continue
            labels, descs = ent.get("labels", {}), ent.get("descriptions", {})
            label = (labels.get("en") or labels.get("fr") or {}).get("value", "")
            desc = (descs.get("en") or descs.get("fr") or {}).get("value", "")
            if must_match and not SERVICE_WORDS.search(label + " " + desc):
                continue
            for c in cl.get("P856", [])[:1]:
                v = c.get("mainsnak", {}).get("datavalue", {}).get("value")
                if isinstance(v, str) and col.add(v, source, label, desc, hint, qid=qid, ctx=ctx,
                                                  member=opts.get("member", ""), country=opts.get("country", "")):
                    added += 1
    return added


def seed_wp_list(lang, title, col, hint, opts):
    """Wikipedia list page: linked articles -> Wikidata P856, plus direct external links."""
    qids, added = [], 0
    for data in wp_query_all(lang, {"titles": title, "generator": "links", "gplnamespace": 0,
                                    "gpllimit": "max", "prop": "pageprops", "ppprop": "wikibase_item"}):
        for p in data.get("query", {}).get("pages", []):
            q = p.get("pageprops", {}).get("wikibase_item")
            if q:
                qids.append(q)
    added += qids_to_sites(qids, col, f"wp:{title}", hint, opts=opts)
    for data in wp_query_all(lang, {"titles": title, "prop": "extlinks", "ellimit": "max"}):
        for p in data.get("query", {}).get("pages", []):
            for el in p.get("extlinks", []):
                if col.add(el.get("url", ""), f"wp:{title}", hint=hint, country=opts.get("country", "")):
                    added += 1
    return added


def seed_wp_cat(lang, cat, depth, col, hint, opts, _seen=None):
    _seen = _seen if _seen is not None else set()
    if cat in _seen or out_of_time():
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
    added = qids_to_sites(qids, col, f"wpcat:{cat}", hint, opts=opts)
    if depth > 0:
        for sc in subcats:
            added += seed_wp_cat(lang, sc, depth - 1, col, hint, opts, _seen)
    return added


def seed_sparql(spec, col, hint, opts):
    """spec: 'Q2085381' or 'Q2085381 sub' (include subclasses) or 'Q2085381 countries=Q16,Q30'."""
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
      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en,fr". }}
    }} LIMIT 30000"""
    data = api_json(SPARQL, {"query": q, "format": "json"}, tries=4, timeout=90,
                    headers={"Accept": "application/sparql-results+json"})
    added = 0
    for b in data["results"]["bindings"]:
        qid = b["item"]["value"].rsplit("/", 1)[-1]
        if col.add(b["site"]["value"], f"wikidata:{cls}", b.get("itemLabel", {}).get("value", ""),
                   b.get("itemDescription", {}).get("value", ""), hint, qid=qid,
                   member=opts.get("member", ""), country=opts.get("country", "")):
            added += 1
    return added


class Followed:
    """Remembers profile pages already opened, so an interrupted seed resumes without re-fetching."""

    def __init__(self):
        self.lock = threading.Lock()
        self.done = {r["u"]: r for r in read_jsonl(FOLLOWED) if r.get("u")}
        self.fh = open(FOLLOWED, "a", encoding="utf-8")

    def get(self, u):
        return self.done.get(u)

    def put(self, u, site, name):
        rec = {"u": u, "site": site, "name": name}
        with self.lock:
            self.done[u] = rec
            self.fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
            self.fh.flush()


FOLLOWED_CACHE = []


def page_name(soup, fallback=""):
    h = soup.find("h1")
    t = h.get_text(" ", strip=True) if h else ""
    if not t and soup.title:
        t = soup.title.get_text(" ", strip=True)
    return " ".join(t.split())[:120] or fallback


def seed_page(url, col, hint, opts):
    """A public directory page. Collects its outbound links (robots.txt respected).
    Options
      pages=N     follow the page's own Next link, up to N listing pages
      follow=RE   open the site's own profile pages whose path matches RE, and take the first outside
                  website each one links to (links that also appear on the listing page, like the
                  footer, are ignored). Without follow, every outside link on the listing is a lead.
      max=M       open at most M profile pages (default 5000)
      direct=1    with follow, also keep outside links found on the listing pages"""
    pages = int(opts.get("pages", 1))
    follow = re.compile(opts["follow"], re.I) if opts.get("follow") else None
    maxf = int(opts.get("max", 5000))
    direct = opts.get("direct") == "1" or not follow
    member, country = opts.get("member", ""), opts.get("country", "")
    added = 0
    own = norm_domain(url)
    chrome, queue = set(), []
    start = url
    for _ in range(max(1, pages)):
        if out_of_time():
            break
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
            href = urljoin(final_url, a["href"]).split("#")[0]
            d = norm_domain(href)
            txt = a.get_text(" ", strip=True)
            if not d:
                continue
            if d == own or d.endswith("." + own) or own.endswith("." + d):
                rel = a.get("rel") or []
                low = txt.lower().strip()
                if nxt is None and ("next" in rel or low in ("next", "next ›", "next »", "›", "»", "next page", "suivant", ">")
                                    or low.startswith("next ")):
                    nxt = href
                p = urlparse(href)
                if follow and follow.search(p.path + ("?" + p.query if p.query else "")) and href not in queue:
                    queue.append(href)
                continue
            chrome.add(d)
            if direct:
                p = urlparse(href)
                root = f"{p.scheme}://{p.netloc}/"
                parent = a.find_parent(["li", "tr", "p", "article"])
                ptxt = " ".join(parent.get_text(" ", strip=True).split())[:220] if parent else txt
                if col.add(root, f"page:{start}", txt[:120], hint=hint, ctx=f"listed on {title}: {ptxt}",
                           member=member, country=country):
                    added += 1
        if not nxt or nxt == url:
            break
        url = nxt
    if follow and queue:
        fol = FOLLOWED_CACHE[0]
        for i, pu in enumerate(queue[:maxf]):
            if out_of_time():
                break
            prev = fol.get(pu)
            if prev is None:
                site, name = "", ""
                try:
                    r2, st2 = fetch_html(pu, max_bytes=1_500_000)
                except Exception:
                    r2 = None
                if r2:
                    s2 = BeautifulSoup(r2[1], PARSER)
                    name = page_name(s2)
                    for a in s2.find_all("a", href=True):
                        href = urljoin(r2[0], a["href"])
                        d = norm_domain(href)
                        if (not d or d == own or d.endswith("." + own) or d in chrome or skipped(d)
                                or not href.lower().startswith("http") or FILE_EXT.search(href)):
                            continue
                        p = urlparse(href)
                        site = f"{p.scheme}://{p.netloc}/"
                        break
                fol.put(pu, site, name)
            else:
                site, name = prev.get("site", ""), prev.get("name", "")
            if site and col.add(site, f"page:{start}", name, hint=hint, ctx=f"listed in {own} directory: {name}",
                                member=member, country=country):
                added += 1
            if (i + 1) % 50 == 0:
                print(f"      {own}: {i + 1}/{min(len(queue), maxf)} profile pages read")
    return added


ALLI_CATS = {"Design and Formatting Services": "design", "Editorial Services": "editors", "Audio Services": "production",
             "Production & Distribution Services": "production", "Multi/Full Services": "publishers",
             "Specialist Services": "", "Marketing & Promotion Services": "", "Writing Services": "editors"}


def seed_alli(url, col, hint, opts):
    """ALLi's public service ratings table (one page of 50 at a time). Each company's own website is a
    lead. Its ALLi rating and profile page are saved so the profile can be the entry's reviews link."""
    added = 0
    pages = int(opts.get("pages", 60))
    fh = open(ALLI, "a", encoding="utf-8")
    for n in range(1, pages + 1):
        if out_of_time():
            break
        res, status = fetch_html(f"{url}?page={n}", max_bytes=3_000_000)
        if res is None:
            if status == "robots":
                break
            raise ApiError(f"page {status}")
        soup = BeautifulSoup(res[1], PARSER)
        rows = soup.find_all("tr", attrs={"data-name": True})
        if not rows:
            break
        for tr in rows:
            name, link = tr.get("data-name", ""), tr.get("data-link", "")
            cats = [c.strip() for c in tr.get("data-categories", "").split(",") if c.strip()]
            rating_td = tr.find("td", class_="rating")
            rating = " ".join(rating_td.get_text(" ", strip=True).split()) if rating_td else ""
            ours = [ALLI_CATS.get(c, "") for c in cats]
            ours = [c for c in ours if c]
            if link and "//" not in link:
                link = "https://" + link
            fh.write(json.dumps({"domain": norm_domain(link), "name": name, "rating": rating, "categories": cats,
                                 "profile": tr.get("data-profile-url", ""), "locations": tr.get("data-locations", "")},
                                ensure_ascii=False) + "\n")
            if link and ours and col.add(link, "alli:service-ratings", name, hint=ours[0], member="ALLi rated",
                                         ctx=f"ALLi service rating: {rating} ({', '.join(cats)})"):
                added += 1
        fh.flush()
    fh.close()
    return added


def parse_seeds(path):
    """-> [(line, base, options, category hint)]. '## cat: editors' sets the category for the lines below it.
    Options follow the seed after ' | ', like 'pages=20' or 'member=LPG'."""
    seeds, hint = [], ""
    with open(path, encoding="utf-8") as f:
        for raw in f:
            line = re.sub(r"\s+#\s.*$", "", raw.strip())
            if not line or line.startswith("#"):
                m = re.match(r"^##\s*cat:\s*(\w+)", line)
                if m:
                    hint = m.group(1)
                continue
            bits = [b.strip() for b in re.split(r"\s+\|\s+", line)]
            opts = {}
            for b in bits[1:]:
                k, _, v = b.partition("=")
                opts[k.strip()] = v.strip()
            seeds.append((line, bits[0], opts, opts.get("cat", hint)))
    return seeds


def run_discovery(args, col):
    done = set()
    if os.path.exists(DISC_DONE):
        with open(DISC_DONE, encoding="utf-8") as f:
            done = set(f.read().splitlines())
    seeds = parse_seeds(args.seeds)
    todo = [s for s in seeds if s[0] not in done]
    print(f"Discovery: {len(seeds)} seeds ({len(seeds) - len(todo)} already done), "
          f"{len(col.seen)} sites collected so far")
    dfh = open(DISC_DONE, "a", encoding="utf-8")
    lock = threading.Lock()
    FOLLOWED_CACHE[:] = [Followed()]

    def work(item):
        line, base, opts, hint = item
        kind, _, rest = base.partition(":")
        rest = rest.strip()
        lang = "en"
        if kind in ("wp", "wpcat") and re.match(r"^[a-z]{2}\|", rest):
            lang, rest = rest[:2], rest[3:]
        if kind == "site":
            n = int(col.add(rest, "curated", opts.get("name", ""), hint=hint, force=True,
                            member=opts.get("member", ""), country=opts.get("country", "")))
        elif kind == "wp":
            n = seed_wp_list(lang, rest, col, hint, opts)
        elif kind == "wpcat":
            n = seed_wp_cat(lang, rest, int(opts.get("depth", 1)), col, hint, opts)
        elif kind == "sparql":
            n = seed_sparql(rest, col, hint, opts)
        elif kind == "page":
            n = seed_page(rest, col, hint, opts)
        elif kind == "alli":
            n = seed_alli(rest, col, hint, opts)
        else:
            n = 0
        return line, n

    site_lines = [t for t in todo if t[1].startswith("site:")]
    other = [t for t in todo if not t[1].startswith("site:")]
    for t in site_lines:
        work(t)
        dfh.write(t[0] + "\n")
    dfh.flush()
    failed = []
    with ThreadPoolExecutor(max_workers=6) as ex:
        futs = {ex.submit(work, t): t for t in other}
        for i, fut in enumerate(as_completed(futs), 1):
            line = futs[fut][0]
            try:
                _, n = fut.result()
                if out_of_time():
                    print(f"  [{i}/{len(other)}] stopped for time: {line[:80]} (continues next run)")
                    continue
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


def split_cat(line):
    cat, _, q = line.partition("|")
    return (cat.strip(), q.strip()) if q else ("", line.strip())


def parse_queries(path):
    """queries.txt -> [(query, category)]: [place_queries] x [places], then [extra]."""
    data = read_sections(path)
    out = []
    for line in data["place_queries"]:
        cat, phrase = split_cat(line)
        out += [(f"{phrase} {p}", cat) for p in data["places"]]
    out += [split_cat(line)[::-1] for line in data["extra"]]
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


def ask_gemini(line, region, col, key, model):
    cat, what = split_cat(line)
    prompt = (f"List up to 40 real, currently active {what} based in or serving {region}. "
              "Give each one's official website homepage URL (not a social media page or a marketplace profile). "
              "Only include businesses or people you are confident exist, and do not invent URLs.")
    body = {"contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json",
                                 "responseSchema": {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {
                                     "name": {"type": "STRING"}, "url": {"type": "STRING"}},
                                     "required": ["name", "url"]}}}}
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
        if col.add(u, f"gemini:{what} | {region}", (it.get("name") or "")[:120], hint=cat, note="Gemini suggestion"):
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
            if out_of_time():
                print("\n  Time limit reached. The rest waits for the next run.")
                break
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
                if out_of_time():
                    break
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
EXTRA_LINK = re.compile(r"servic|rates|pricing|prices|fees|tarif|submi|guideline|query|queries|about|what-we-do|"
                        r"for-authors|authors|manuscript|portfolio|editing|design|print|audiobook|narrat|isbn|"
                        r"distribution|faq|soumission|propos", re.I)
EXTRA_PRIORITY = [r"submi|guideline|soumission|quer", r"servic|what-we-do|editing|design|audiobook|print|narrat|isbn",
                  r"rates|pricing|prices|fees|tarif", r"about|propos|for-authors|faq|portfolio"]
LOGIN = re.compile(r"/(log-?in|sign-?in|account|my-account|cart|checkout|wp-admin|register)\b", re.I)
REVIEW_LINKS = [  # (pattern on the link, label), first one found wins
    (re.compile(r"https?://(www\.|[a-z]{2}\.)?trustpilot\.com/review/[^\s\"'?#]+", re.I), "Trustpilot"),
    (re.compile(r"https?://(www\.)?reedsy\.com/[^\s\"'?#]+", re.I), "Reedsy profile"),
    (re.compile(r"https?://(www\.)?google\.[a-z.]+/maps/[^\s\"']+|https?://maps\.app\.goo\.gl/[^\s\"']+|https?://g\.page/[^\s\"']+|"
                r"https?://maps\.google\.[a-z.]+/[^\s\"']+|https?://goo\.gl/maps/[^\s\"']+", re.I), "Google Maps listing"),
    (re.compile(r"https?://(www\.)?yelp\.[a-z.]+/biz/[^\s\"'?#]+", re.I), "Yelp"),
    (re.compile(r"https?://(www\.)?absolutewrite\.com/forums/[^\s\"']+", re.I), "Absolute Write"),
]
CA_POSTAL = re.compile(r"\b(AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT|Ontario|Quebec|Québec|Alberta|Manitoba|Saskatchewan|"
                       r"Nova Scotia|New Brunswick|British Columbia|Newfoundland(?: and Labrador)?|Prince Edward Island|Yukon)"
                       r"[\s,]+([ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d)\b")
CA_POSTAL_ONLY = re.compile(r"\b[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z] \d[ABCEGHJ-NPRSTV-Z]\d\b")
US_ZIP = re.compile(r",\s*(A[KLRZ]|C[AOT]|D[CE]|FL|GA|HI|I[ADLN]|K[SY]|LA|M[ADEINOST]|N[CDEHJMVY]|O[HKR]|PA|RI|S[CD]|T[NX]|UT|V[AT]|W[AIVY])\s+\d{5}(-\d{4})?\b")
UK_POST = re.compile(r"\b[A-Z]{1,2}\d[A-Z\d]? \d[A-Z]{2}\b")
AU_POST = re.compile(r"\b(NSW|VIC|QLD|SA|WA|TAS|ACT|NT)\s+\d{4}\b")
PROV_FULL = {"ontario": "ON", "quebec": "QC", "québec": "QC", "alberta": "AB", "manitoba": "MB", "saskatchewan": "SK",
             "nova scotia": "NS", "new brunswick": "NB", "british columbia": "BC", "newfoundland": "NL",
             "newfoundland and labrador": "NL", "prince edward island": "PE", "yukon": "YT"}


def address_location(raw_text):
    """Country and province from a postal address printed on the page (raw case kept for the patterns)."""
    m = CA_POSTAL.search(raw_text)
    if m:
        p = m.group(1)
        return "CA", PROV_FULL.get(p.lower(), p.upper() if len(p) == 2 else "")
    m = US_ZIP.search(raw_text)
    if m:
        return "US", m.group(1)
    if CA_POSTAL_ONLY.search(raw_text):
        return "CA", ""
    if AU_POST.search(raw_text):
        return "AU", AU_POST.search(raw_text).group(1)
    if UK_POST.search(raw_text) and re.search(r"\b(UK|United Kingdom|England|Scotland|Wales|London)\b", raw_text):
        return "GB", ""
    return "", ""


def new_row(cand):
    return {"domain": cand["domain"], "url": cand["url"], "name": cand.get("name", ""), "description": "",
            "language": "", "category": "", "services": "", "illustration_styles": "", "audiences": "",
            "works_with": "", "submission_status": "", "reading_period": "", "business_model": "",
            "memberships": "", "pricing_info": "", "formats": "", "remote": "", "languages": "",
            "children_focus": "", "addr_country": "", "addr_region": "", "reviews_url": "", "reviews_source": "",
            "pages_read": 0, "wikidata_description": cand.get("wd_desc", ""), "seed_category": cand.get("hint", ""),
            "source": cand.get("source", ""), "status": "", "checked_at": time.strftime("%Y-%m-%d")}


def err_status(e):
    if isinstance(e, RobotsUnavailable):
        return "error:" + str(e)
    for cls, name in ((requests.exceptions.SSLError, "SSLError"),
                      (requests.exceptions.ConnectTimeout, "ConnectTimeout"),
                      (requests.exceptions.ReadTimeout, "ReadTimeout")):
        if isinstance(e, cls):
            return "error:" + name
    return "error:" + type(e).__name__


def read_page(body):
    """-> (soup-derived facts). Page text is used in memory only and never stored."""
    soup = BeautifulSoup(body, PARSER)

    def meta(*names):
        for n in names:
            t = soup.find("meta", attrs={"property": n}) or soup.find("meta", attrs={"name": n})
            if t and t.get("content"):
                return " ".join(t["content"].split())[:400]
        return ""
    title = soup.title.get_text(" ", strip=True)[:200] if soup.title else ""
    html_tag = soup.find("html")
    links = [(a.get("href", ""), a.get_text(" ", strip=True)) for a in soup.find_all("a", href=True)]
    for s in soup(["script", "style", "noscript", "svg"]):
        s.decompose()
    raw = " ".join(soup.get_text(" ").split())[:300000]
    return {"site_name": meta("og:site_name"), "title": title, "desc": meta("description", "og:description", "twitter:description"),
            "lang": (html_tag.get("lang", "") if html_tag else "")[:10], "links": links, "raw": raw}


def pick_extra_pages(links, final_url, n=EXTRA_PAGES):
    own = norm_domain(final_url)
    cands = []
    for href, txt in links:
        u = urljoin(final_url, href).split("#")[0]
        if norm_domain(u) != own or u.rstrip("/") == final_url.rstrip("/") or LOGIN.search(u) or FILE_EXT.search(u):
            continue
        key = (urlparse(u).path + " " + txt).lower()
        if not EXTRA_LINK.search(key):
            continue
        rank = next((i for i, p in enumerate(EXTRA_PRIORITY) if re.search(p, key)), 9)
        cands.append((rank, len(u), u))
    out, seen = [], set()
    for _, _, u in sorted(cands):
        if u not in seen:
            seen.add(u)
            out.append(u)
        if len(out) >= n:
            break
    return out


def find_reviews(all_hrefs):
    for pat, label in REVIEW_LINKS:
        for h in all_hrefs:
            m = pat.search(h)
            if m:
                return m.group(0), label
    return "", ""


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
    if dns and dns.startswith("ok:"):
        url = f"{p.scheme}://{dns[3:]}/"
    alt = ("https://" + url[7:]) if url.startswith("http://") else ("http://" + url[8:])
    res, status = None, ""
    for u in (url, alt):
        try:
            res, status = fetch_html(u)
            break
        except requests.exceptions.ConnectTimeout as e:
            status = err_status(e)
            break
        except (requests.exceptions.SSLError, requests.exceptions.ConnectionError) as e:
            status = err_status(e)
            continue
        except Exception as e:
            status = err_status(e)
            break
    if res is None:
        row["status"] = status
        return row
    final_url, body = res
    row["url"] = final_url
    home = read_page(body)
    row["name"] = home["site_name"] or row["name"] or home["title"]
    row["description"] = home["desc"]
    row["language"] = home["lang"]
    raws = [home["raw"]]
    hrefs = [urljoin(final_url, h) for h, _ in home["links"]]
    pages = 1
    for xu in pick_extra_pages(home["links"], final_url):
        try:
            r2, _ = fetch_html(xu)
        except Exception:
            r2 = None
        if r2:
            pg = read_page(r2[1])
            raws.append(pg["raw"][:150000])
            hrefs += [urljoin(r2[0], h) for h, _ in pg["links"]]
            pages += 1
    raw = " ".join(raws)
    text = raw.lower()
    hint = cand.get("hint", "")
    cat = tx.guess_category(hint, text + " " + (row["description"] + " " + row["wikidata_description"]).lower(), row["name"].lower())
    row["category"] = cat
    href_text = " ".join(h.lower() for h in hrefs)[:200000]
    row.update(tx.tags(cat, text + " " + href_text + " " + row["description"].lower(), row["name"], row["language"]))
    row["addr_country"], row["addr_region"] = address_location(raw)
    row["reviews_url"], row["reviews_source"] = find_reviews(hrefs)
    row["pages_read"] = pages
    row["status"] = "ok"
    if not cand.get("source", "").startswith("link:"):   # one hop outward from seeds and searches, no further
        own, leads = norm_domain(final_url), {}
        for h, t in home["links"]:
            u = urljoin(final_url, h)
            d = norm_domain(u)
            if not d or d == own or skipped(d) or d in leads or not u.lower().startswith("http") or FILE_EXT.search(u):
                continue
            if SERVICE_WORDS.search(d + " " + t):
                pu = urlparse(u)
                leads[d] = (f"{pu.scheme}://{pu.netloc}/", t[:120])
        row["_leads"] = list(leads.values())[:30]
    return row


TRANSIENT = {"http429", "http500", "http502", "http503", "http504", "http520", "http521", "http522",
             "http523", "http524", "http525", "error:ConnectionError", "error:ConnectTimeout",
             "error:ReadTimeout", "error:Timeout", "error:ChunkedEncodingError", "error:dns-retry",
             "error:robots429", "error:robots500", "error:robots502", "error:robots503", "error:robots504",
             "error:ContentDecodingError"}


def run_profiling(args, scams):
    cands = list(load_candidates().values())
    last, fails = {}, Counter()
    for r in read_jsonl(PROF):
        d = r.get("domain")
        if not d:
            continue
        st = r.get("status", "")
        last[d] = st
        fails[d] = fails[d] + 1 if st in TRANSIENT else 0
    done = {d for d, st in last.items() if st not in TRANSIENT or fails[d] >= MAX_TRANSIENT_TRIES}
    todo = [c for c in cands if c["domain"] not in done]
    known_bad = [c for c in todo if scams.check(c["domain"], c.get("name", ""))]
    todo = [c for c in todo if not scams.check(c["domain"], c.get("name", ""))]
    retry = sum(1 for c in todo if c["domain"] in last)
    if args.limit:
        todo = todo[:args.limit]
    total = len(todo)
    print(f"Profiling: {len(cands)} candidates, {len(done)} already done, {total} to check now "
          f"(including {retry} retries) with {args.workers} workers. "
          f"{len(known_bad)} known scams skipped without a visit.")
    if not total:
        return
    t0 = time.time()
    dns = dns_precheck(todo)
    nd = sum(1 for v in dns.values() if v == "dead")
    print(f"  Address check: {nd} sites no longer exist, {total - nd} to visit ({time.time() - t0:.0f}s)")
    fh = open(PROF, "a", encoding="utf-8")
    lock = threading.Lock()
    stats = Counter()
    start = time.time()
    col = Collector() if args.follow_links else None

    def job(c):
        if out_of_time():
            return None
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
            if row is None:
                stats["left for next run"] += 1
                continue
            leads = row.pop("_leads", [])
            if col is not None:
                for lu, lt in leads:
                    if col.add(lu, f"link:{row['domain']}", lt, hint=row.get("category") or row.get("seed_category", ""),
                               ctx=f"linked from {row['name'][:60]}"):
                        stats["new leads"] += 1
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
    if col is not None:
        col.fh.close()
        if stats["new leads"]:
            print(f"\n  Found {stats['new leads']} new sites linked from the ones checked. They are checked next.")
    if stats["left for next run"]:
        print(f"\n  Time limit reached. {stats['left for next run']} sites wait for the next run.")
    print("\nProfiling finished.\n")


# ---------------------------------------------------------------- known-scam list
def update_scam_list(force=False):
    """Downloads Writer Beware's public scam list (robots.txt obeyed) once a week. It is saved under
    output/ on this computer only and used as a filter. It is never uploaded or published."""
    os.makedirs(os.path.dirname(scamcheck.WB_CACHE), exist_ok=True)
    fresh = os.path.exists(scamcheck.WB_CACHE) and time.time() - os.path.getmtime(scamcheck.WB_CACHE) < 7 * 86400
    if fresh and not force:
        return
    try:
        res, status = fetch_html(scamcheck.WB_URL, max_bytes=5_000_000)
    except Exception as e:
        res, status = None, type(e).__name__
    if res is None:
        print(f"Scam list: could not download Writer Beware's list this time ({status}). "
              f"{'Using the saved copy.' if os.path.exists(scamcheck.WB_CACHE) else 'Only known_scams.txt is used.'}")
        return
    wb = scamcheck.parse_writerbeware(res[1].decode("utf-8", errors="ignore"))
    if len(wb["names"]) < 50:
        print("Scam list: Writer Beware's page looked different than expected, so the saved copy is kept.")
        return
    wb["fetched"] = time.strftime("%Y-%m-%d")
    wb["source"] = scamcheck.WB_URL
    with open(scamcheck.WB_CACHE, "w", encoding="utf-8") as f:
        json.dump(wb, f, ensure_ascii=False, indent=0)


# ---------------------------------------------------------------- outside evidence
IRI_BAD = re.compile(r'[\s<>"{}|\\^`]')


def wikidata_by_site(domain_urls):
    """{domain: url} -> {domain: info} by Wikidata 'official website' (P856): label, description, country code."""
    vals, back = [], {}
    for d, u in domain_urls.items():
        variants = {f"{s}://{w}{d}{e}" for s in ("http", "https") for w in ("", "www.") for e in ("", "/")}
        variants.add(u)
        for v in variants:
            if v and not IRI_BAD.search(v):
                vals.append(f"<{v}>")
                back[v] = d
    q = f"""SELECT ?item ?site ?itemLabel ?itemDescription ?iso WHERE {{
      VALUES ?site {{ {' '.join(vals)} }}
      ?item wdt:P856 ?site .
      OPTIONAL {{ ?item wdt:P17 ?c . ?c wdt:P297 ?iso }}
      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en,fr". }}
    }}"""
    data = api_json(SPARQL, data={"query": q, "format": "json"}, tries=4, timeout=90,
                    headers={"Accept": "application/sparql-results+json"})
    info = {}
    for b in data["results"]["bindings"]:
        d = back.get(b["site"]["value"])
        if not d:
            continue
        g = lambda k: b.get(k, {}).get("value", "")
        i = info.setdefault(d, {"qid": g("item").rsplit("/", 1)[-1], "label": "", "desc": "", "iso": ""})
        i["label"] = i["label"] or (g("itemLabel") if not re.match(r"^Q\d+$", g("itemLabel")) else "")
        i["desc"] = i["desc"] or g("itemDescription")
        i["iso"] = i["iso"] or g("iso")
    return info


def run_evidence(args):
    """Wikidata facts (name, description, country) for every checked site. Only the Wikidata API is used."""
    prof = {r["domain"]: r for r in read_jsonl(PROF) if r.get("domain")}
    done = {e["domain"] for e in read_jsonl(EVID)}
    need = [d for d in prof if d not in done]
    if args.limit:
        need = need[:args.limit]
    if not need:
        print("Evidence: nothing new to look up.\n")
        return
    print(f"Evidence: looking up {len(need)} sites in Wikidata (name, description and country).")
    fh = open(EVID, "a", encoding="utf-8")
    start = time.time()
    B = 40
    for bi in range(0, len(need), B):
        if out_of_time():
            break
        batch = need[bi:bi + B]
        try:
            wd = wikidata_by_site({d: prof[d].get("url") or f"http://{d}/" for d in batch})
        except ApiError as e:
            print(f"\n  Wikidata lookup failed ({e}); the rest will be tried next run.")
            break
        for d in batch:
            i = wd.get(d, {})
            fh.write(json.dumps({"domain": d, "qid": i.get("qid", ""), "wd_label": i.get("label", ""),
                                 "wd_desc": i.get("desc", ""), "iso": i.get("iso", ""),
                                 "checked_at": time.strftime("%Y-%m-%d")}, ensure_ascii=False) + "\n")
        fh.flush()
        n = min(bi + B, len(need))
        el = time.time() - start
        sys.stdout.write(f"\r  {n}/{len(need)} looked up | ~{el / n * (len(need) - n) / 60:.0f} min left   ")
        sys.stdout.flush()
    fh.close()
    print("\nEvidence finished.\n")


# ---------------------------------------------------------------- export
FIELDS = ["name", "url", "domain", "category", "category_label", "services", "illustration_styles", "audiences",
          "works_with", "submission_status", "reading_period", "business_model", "memberships", "pricing_info",
          "formats", "country", "province", "remote", "languages", "children_focus", "description",
          "reviews_url", "reviews_source", "alli_rating", "writer_beware_check_url", "wikidata_id",
          "wikidata_description", "seed_category", "source", "status", "status_label", "pages_read", "checked_at"]
CC_TLD = {"ca": "CA", "us": "US", "uk": "GB", "ie": "IE", "au": "AU", "nz": "NZ"}
CA_SUB = re.compile(r"\.(on|qc|bc|ab|mb|sk|ns|nb|nl|pe|yk|nt|nu)\.ca$")


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


def search_url(q):
    return "https://duckduckgo.com/?q=" + quote_plus(q)


def reviews_for(r, alli):
    """A public reviews link for every entry: the ALLi rating page, a review page the site links to itself,
    or else a web search for the name."""
    a = alli.get(r["domain"])
    if a and a.get("profile"):
        return a["profile"], "ALLi service rating"
    if r.get("reviews_url"):
        return r["reviews_url"], r.get("reviews_source", "")
    name = r.get("name") or r["domain"]
    if r.get("category") in ("publishers", "agents"):
        return search_url(f'"{name}" site:absolutewrite.com'), "search (Absolute Write forums)"
    return search_url(f'"{name}" reviews'), "search"


def merge_row(r, e, c, alli):
    r = dict(r)
    e = e or {}
    if r.get("status") != "ok":
        r["category"] = r.get("category") or tx.guess_category(c.get("hint", ""), (e.get("wd_desc", "") + " " + " ".join(c.get("ctxs", []))).lower(),
                                                               (r.get("name") or e.get("wd_label", "")).lower())
    r["name"] = r.get("name") or e.get("wd_label", "") or c.get("name", "") or r["domain"]
    r["wikidata_description"] = r.get("wikidata_description") or e.get("wd_desc", "")
    r["wikidata_id"] = e.get("qid", "") or c.get("qid", "")
    r["category_label"] = tx.CAT_LABEL.get(r.get("category", ""), "")
    mem = [m for m in (r.get("memberships") or "").split("; ") if m]
    for m in c.get("members", []):
        if m and m != "ALLi rated" and m not in mem:
            mem.append(m)
    r["memberships"] = "; ".join(mem)
    country, prov = r.get("addr_country", ""), r.get("addr_region", "")
    if not country:
        country = c.get("country", "") or e.get("iso", "")
    tld = r["domain"].rsplit(".", 1)[-1]
    if not country and tld in CC_TLD:
        country = CC_TLD[tld]
    m = CA_SUB.search(r["domain"])
    if m and not prov:
        country, prov = "CA", {"YK": "YT"}.get(m.group(1).upper(), m.group(1).upper())
    r["country"], r["province"] = country, prov if country in ("CA", "US", "AU") else ""
    a = alli.get(r["domain"], {})
    r["alli_rating"] = a.get("rating", "")
    r["reviews_url"], r["reviews_source"] = reviews_for(r, alli)
    r["writer_beware_check_url"] = "https://writerbeware.blog/?s=" + quote_plus(r["name"][:80])
    r["status_label"] = status_label(r.get("status", ""))
    return r


def export(scams):
    rows = {r["domain"]: r for r in read_jsonl(PROF) if r.get("domain")}
    ev = {e["domain"]: e for e in read_jsonl(EVID)}
    alli = {a["domain"]: a for a in read_jsonl(ALLI) if a.get("domain")}
    cmap = load_candidates()
    out, dropped = [], []
    for d, r in rows.items():
        m = merge_row(r, ev.get(d), cmap.get(d, {}), alli)
        hit = scams.check(d, m["name"]) or scams.check(d, cmap.get(d, {}).get("name", ""))
        if hit:
            dropped.append({"name": m["name"], "url": m["url"], "matched": hit[0], "how": hit[2], "list": hit[1]})
            continue
        out.append(m)
    for d, c in cmap.items():   # known scams skipped before profiling still belong in the report
        if d not in rows:
            hit = scams.check(d, c.get("name", ""))
            if hit:
                dropped.append({"name": c.get("name", "") or d, "url": c["url"], "matched": hit[0], "how": hit[2], "list": hit[1]})
    out.sort(key=lambda r: (r.get("status") != "ok", (r.get("name") or r["domain"]).lower()))
    with open(CSV_OUT, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS, extrasaction="ignore")
        w.writeheader()
        w.writerows(out)
    with open(SCAMS_OUT, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=["name", "url", "matched", "how", "list"])
        w.writeheader()
        w.writerows(dropped)
    ok = sum(1 for r in out if r.get("status") == "ok")
    cats = Counter(r.get("category_label") or "not sorted yet" for r in out)
    print(f"Saved {len(out)} entries ({ok} read directly) to:\n  {CSV_OUT}")
    print("  " + ", ".join(f"{k}: {v}" for k, v in cats.most_common()))
    print(f"Left out {len(dropped)} known scams (list in output\\scams_dropped.csv). "
          f"Scam list size: {scams.total()} names and domains"
          f"{' (Writer Beware list from ' + scams.wb_date + ')' if scams.wb_date else ''}.")


def main():
    ap = argparse.ArgumentParser(description="ATL Topaz Pages crawler")
    ap.add_argument("--seeds", default=os.path.join(HERE, "seeds.txt"))
    ap.add_argument("--queries", default=os.path.join(HERE, "queries.txt"))
    ap.add_argument("--workers", type=int, default=24, help="sites checked in parallel (default 24)")
    ap.add_argument("--limit", type=int, default=0, help="only check / look up N sites this run (testing)")
    ap.add_argument("--search-limit", type=int, default=2500, help="max searches per search source per run (default 2500)")
    ap.add_argument("--hours", type=float, default=0, help="stop cleanly after this many hours (progress is kept)")
    ap.add_argument("--discover-only", action="store_true")
    ap.add_argument("--profile-only", action="store_true")
    ap.add_argument("--export-only", action="store_true", help="only rebuild the CSV from saved progress")
    ap.add_argument("--no-search", action="store_true", help="skip the search and Gemini step")
    ap.add_argument("--no-evidence", action="store_true", help="skip the Wikidata step")
    ap.add_argument("--no-follow-links", dest="follow_links", action="store_false",
                    help="don't add sites that checked sites link to")
    ap.add_argument("--fresh", action="store_true", help="delete previous progress and start over")
    args = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    load_env()
    load_env(os.path.join(HERE, "..", "reading-directory", ".env"))   # reuse the Jade Pages keys if they exist
    if args.hours:
        DEADLINE[0] = time.time() + args.hours * 3600
    if args.fresh:
        for p in (CAND, PROF, DISC_DONE, EVID, SEARCH_DONE, FOLLOWED, ALLI):
            if os.path.exists(p):
                os.remove(p)
    print(f"Topaz Pages crawler v{VERSION}\n")
    try:
        if not args.export_only:
            update_scam_list()
        scams = scamcheck.ScamList()
        print(f"Scam list: {scams.total()} known scam names and domains loaded "
              f"({scams.counts['writer_beware']} from Writer Beware, {scams.counts['known_scams.txt']} from known_scams.txt).\n")
        if not args.export_only:
            if not args.profile_only:
                col = Collector()
                run_discovery(args, col)
                if not args.no_search and not out_of_time():
                    run_search(args, col)
                col.fh.close()
            if not args.discover_only and not out_of_time():
                run_profiling(args, scams)
                if args.follow_links and not out_of_time():
                    run_profiling(args, scams)   # the sites found by following links (one hop only)
                if not args.no_evidence and not out_of_time():
                    run_evidence(args)
    except KeyboardInterrupt:
        print("\nStopped. Progress is saved; run again to continue where it left off.")
        scams = scamcheck.ScamList()
    export(scams)


if __name__ == "__main__":
    main()
