#!/usr/bin/env python3
"""
ATL Reading Directory crawler (Among The Letters).

Builds a directory of reading websites (magazines, journals, libraries,
presses, stores, audiobook sites, web fiction platforms, newsletters...).

Two phases, both resumable:
  1. Discovery  - read seeds.txt (Wikipedia lists/categories via the API,
                  Wikidata SPARQL, curated sites, public link pages) and
                  collect candidate official websites  -> output/candidates.jsonl
  2. Profiling  - visit each site's homepage (+ at most one About page),
                  record public metadata and simple tags   -> output/profiles.jsonl
Finally writes output/reading_directory.csv and output/reading_directory.jsonl.

Polite by design: obeys robots.txt, honest User-Agent, ~1s between requests
to the same site, no logins, no paywall bypass, HTML only, and it never
stores page body text (only titles, meta descriptions and tags).
"""
import argparse, csv, json, os, re, sys, threading, time, warnings
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urljoin, urlparse, quote
from urllib import robotparser

try:
    import requests
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

UA = "ATLReadingDirectoryBot/1.0 (+https://amongtheletters.com)"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "output")
CAND = os.path.join(OUT, "candidates.jsonl")
PROF = os.path.join(OUT, "profiles.jsonl")
DISC_DONE = os.path.join(OUT, "discovery_done_seeds.txt")
TIMEOUT = 15
PER_DOMAIN_DELAY = 1.0
MAX_BYTES = 2_000_000

# Domains that are never "reading sites" themselves (link hubs, social, infra).
SKIP_DOMAINS = {
    "wikipedia.org", "wikidata.org", "wikimedia.org", "wikimediafoundation.org", "mediawiki.org",
    "wiktionary.org", "wikiquote.org", "wikibooks.org", "wikinews.org", "wikiversity.org", "wikivoyage.org",
    "facebook.com", "twitter.com", "x.com", "instagram.com", "youtube.com", "youtu.be", "linkedin.com",
    "pinterest.com", "tiktok.com", "reddit.com", "threads.net", "bsky.app", "t.co", "bit.ly",
    "google.com", "goo.gl", "doi.org", "dx.doi.org", "worldcat.org", "viaf.org", "isni.org", "orcid.org",
    "jstor.org", "issn.org", "portal.issn.org", "loc.gov", "id.loc.gov", "bnf.fr", "d-nb.info", "nla.gov.au",
    "web.archive.org", "archive.is", "archive.ph", "webcitation.org", "books.google.com",     "toolforge.org", "wmflabs.org", "creativecommons.org", "schema.org", "w3.org",
    "apple.com", "microsoft.com", "github.com", "gitlab.com", "cloudflare.com", "addtoany.com", "sharethis.com",
    "nytimes.com", "theguardian.com", "bbc.co.uk", "bbc.com", "cnn.com", "washingtonpost.com", "latimes.com",
    "imdb.com", "discogs.com", "musicbrainz.org", "spotify.com", "soundcloud.com", "vimeo.com", "flickr.com",
    "europeana.eu", "scholar.google.com", "semanticscholar.org", "researchgate.net",
    "academia.edu", "crossref.org", "pubmed.ncbi.nlm.nih.gov", "ncbi.nlm.nih.gov", "mailto",
}
# These are kept when listed directly in seeds (site: lines) even if a hub.
FILE_EXT = re.compile(r"\.(pdf|jpe?g|png|gif|svg|webp|mp3|mp4|zip|epub|mobi|docx?|xlsx?|pptx?)(\?|$)", re.I)

session_local = threading.local()


def sess():
    s = getattr(session_local, "s", None)
    if s is None:
        s = requests.Session()
        s.headers.update({"User-Agent": UA, "Accept-Language": "en;q=0.9,*;q=0.5"})
        session_local.s = s
    return s


RETRY_STATUS = {429, 500, 502, 503, 504}


def retry_after(r, attempt, cap=60.0):
    """Seconds to wait: honour Retry-After when given, else exponential backoff (2, 4, 8...)."""
    ra = (r.headers.get("Retry-After", "") if r is not None else "").strip()
    if ra.isdigit():
        return min(float(ra), cap)
    return min(2.0 * (2 ** attempt), cap)


def get(url, tries=3, cap=30.0, **kw):
    """GET that retries network errors and 429/5xx, honouring Retry-After."""
    kw.setdefault("timeout", TIMEOUT)
    last = None
    for attempt in range(tries):
        try:
            r = sess().get(url, **kw)
            if r.status_code in RETRY_STATUS and attempt < tries - 1:
                wait = retry_after(r, attempt, cap)
                r.close()
                time.sleep(wait)
                continue
            return r
        except (requests.exceptions.SSLError, requests.exceptions.InvalidURL,
                requests.exceptions.TooManyRedirects):
            raise   # not transient, no point retrying
        except requests.RequestException as e:
            last = e
            if attempt < tries - 1:
                time.sleep(2.0 * (2 ** attempt))
    raise last if last else RuntimeError("request failed")


# Wikimedia APIs (Wikipedia, Wikidata, SPARQL): one request at a time per host
# across all threads, ~1s apart, with retries when throttled.
API_DELAY = 1.0
_api_lock = threading.Lock()
_api_next = {}


class ApiError(Exception):
    pass


def api_json(url, params, tries=5, timeout=TIMEOUT, headers=None):
    """Polite JSON API call: ~1s spacing per host, checks status + content-type,
    retries 429/5xx/non-JSON/network errors with backoff that honours Retry-After."""
    host = urlparse(url).netloc
    last = ""
    for attempt in range(tries):
        with _api_lock:
            wait = _api_next.get(host, 0) - time.time()
            if wait > 0:
                time.sleep(wait)
            _api_next[host] = time.time() + API_DELAY
        r = None
        try:
            r = sess().get(url, params=params, timeout=timeout, headers=headers or {})
            ctype = r.headers.get("Content-Type", "").lower()
            if r.status_code == 200 and "json" in ctype:
                try:
                    data = r.json()
                except ValueError:
                    data = None
                    last = "bad JSON"
                if isinstance(data, dict) and data.get("error", {}).get("code") == "maxlag":
                    last = "maxlag"
                elif data is not None:
                    return data
            elif r.status_code == 200:
                last = f"non-JSON reply ({ctype or 'no content-type'})"
            else:
                last = f"HTTP {r.status_code}"
                if r.status_code not in RETRY_STATUS:
                    raise ApiError(last)
        except requests.RequestException as e:
            last = type(e).__name__
        if attempt < tries - 1:
            pause = retry_after(r, attempt + 1, 120.0)   # 4, 8, 16, 32s unless told otherwise
            with _api_lock:
                _api_next[host] = max(_api_next.get(host, 0), time.time() + pause)
            time.sleep(pause)
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


# ----------------------------------------------------------------- discovery
class Collector:
    def __init__(self):
        self.lock = threading.Lock()
        self.seen = set()
        if os.path.exists(CAND):
            with open(CAND, encoding="utf-8") as f:
                for line in f:
                    try:
                        self.seen.add(json.loads(line)["domain"])
                    except Exception:
                        pass
        self.fh = open(CAND, "a", encoding="utf-8")

    def add(self, url, source, name="", desc="", hint="", force=False):
        if not url or not url.lower().startswith(("http://", "https://")) or FILE_EXT.search(url):
            return False
        d = norm_domain(url)
        if not d or (not force and skipped(d)):
            return False
        with self.lock:
            if d in self.seen:
                return False
            self.seen.add(d)
            self.fh.write(json.dumps({"domain": d, "url": url, "name": name, "wd_desc": desc,
                                      "hint": hint, "source": source}, ensure_ascii=False) + "\n")
            self.fh.flush()
        return True


WP_API = "https://{lang}.wikipedia.org/w/api.php"
WD_API = "https://www.wikidata.org/w/api.php"
SPARQL = "https://query.wikidata.org/sparql"


def wp_query_all(lang, params):
    params = dict(params, format="json", formatversion="2", action="query", maxlag="5")
    while True:
        data = api_json(WP_API.format(lang=lang), params)
        yield data
        if "continue" not in data:
            break
        params.update(data["continue"])


def qids_to_sites(qids, col, source, hint):
    """Fetch official website (P856) + label/description for Wikidata items."""
    qids = list(dict.fromkeys(q for q in qids if q))
    added = 0
    for i in range(0, len(qids), 50):
        batch = qids[i:i + 50]
        data = api_json(WD_API, {"action": "wbgetentities", "ids": "|".join(batch), "format": "json",
                                 "props": "claims|labels|descriptions", "languages": "en", "maxlag": "5"})
        for ent in data.get("entities", {}).values():
            claims = ent.get("claims", {}).get("P856", [])
            label = ent.get("labels", {}).get("en", {}).get("value", "")
            desc = ent.get("descriptions", {}).get("en", {}).get("value", "")
            for c in claims[:1]:
                v = c.get("mainsnak", {}).get("datavalue", {}).get("value")
                if isinstance(v, str) and col.add(v, source, label, desc, hint):
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
        if col.add(b["site"]["value"], f"wikidata:{cls}", b.get("itemLabel", {}).get("value", ""),
                   b.get("itemDescription", {}).get("value", ""), hint):
            added += 1
    return added


def seed_page(url, col, hint):
    """A public list/directory page: collect its outbound links (robots.txt respected)."""
    if not robots_ok(url):
        return 0
    r = get(url)
    if "html" not in r.headers.get("Content-Type", ""):
        return 0
    soup = BeautifulSoup(r.content[:MAX_BYTES], PARSER)
    own = norm_domain(url)
    added = 0
    for a in soup.find_all("a", href=True):
        href = urljoin(url, a["href"])
        d = norm_domain(href)
        if d and d != own and not d.endswith("." + own):
            root = f"{urlparse(href).scheme}://{urlparse(href).netloc}/"
            if col.add(root, f"page:{url}", a.get_text(" ", strip=True)[:120], hint=hint):
                added += 1
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


def run_discovery(args):
    col = Collector()
    done = set()
    if os.path.exists(DISC_DONE):
        done = set(open(DISC_DONE, encoding="utf-8").read().splitlines())
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
        elif kind == "page":
            n = seed_page(rest, col, hint)
        else:
            n = seed_page(line, col, hint) if line.startswith("http") else 0
        return line, n

    site_lines = [t for t in todo if t[0].startswith("site:")]
    other = [t for t in todo if not t[0].startswith("site:")]
    for t in site_lines:
        work(t)
        dfh.write(t[0] + "\n")
    dfh.flush()
    # Wikimedia calls are serialised by api_json(); extra workers only help page: seeds.
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
                print(f"  [{i}/{len(other)}] error {type(e).__name__}: {line[:80]} (will retry next run)")
    print(f"Discovery finished: {len(col.seen)} candidate sites.")
    if failed:
        print(f"  {len(failed)} seeds could not be read this time. Run again later to retry just those.")
    print()


# ----------------------------------------------------------------- profiling
_robots = {}
_robots_lock = threading.Lock()


def robots_ok(url):
    p = urlparse(url)
    base = f"{p.scheme}://{p.netloc}"
    with _robots_lock:
        rp = _robots.get(base)
    if rp is None:
        rp = robotparser.RobotFileParser()
        try:
            r = sess().get(base + "/robots.txt", timeout=10)
            if r.status_code in (401, 403):
                rp.disallow_all = True
            elif r.status_code >= 400:
                rp.allow_all = True
            else:
                rp.parse(r.text.splitlines())
        except requests.RequestException:
            rp.allow_all = True
        with _robots_lock:
            _robots[base] = rp
    return rp.can_fetch(UA, url)


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


def fetch_html(url):
    if not robots_ok(url):
        return None, "robots"
    r = get(url, stream=True, allow_redirects=True)
    ctype = r.headers.get("Content-Type", "")
    if r.status_code in (401, 402, 403, 407):
        r.close()
        return None, f"http{r.status_code}"
    if r.status_code >= 400:
        r.close()
        return None, f"http{r.status_code}"
    if "html" not in ctype.lower():
        r.close()
        return None, "not-html"
    body = b""
    for chunk in r.iter_content(65536):
        body += chunk
        if len(body) > MAX_BYTES:
            break
    r.close()
    return (r.url, body), "ok"


def profile(cand):
    url = cand["url"]
    if not urlparse(url).path:
        url += "/"
    row = {"domain": cand["domain"], "url": url, "name": cand.get("name", ""),
           "description": "", "language": "", "access": "unknown", "formats": "", "type": "",
           "genres": "", "submissions_signal": "", "wikidata_description": cand.get("wd_desc", ""),
           "seed_hint": cand.get("hint", ""), "source": cand.get("source", ""), "status": "",
           "checked_at": time.strftime("%Y-%m-%d")}
    try:
        res, status = fetch_html(url)
        if res is None and url.startswith("http://"):
            res, status = fetch_html("https://" + url[7:])
    except Exception as e:
        row["status"] = "error:" + type(e).__name__
        return row
    if res is None:
        row["status"] = status
        return row
    final_url, body = res
    row["url"] = final_url
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

    # Analysis only: text is used in memory for keyword counts and never stored.
    for s in soup(["script", "style", "noscript"]):
        s.decompose()
    text = " " + " ".join(soup.get_text(" ").lower().split())[:300000] + " "
    hrefs = " ".join(a.get("href", "").lower() for a in soup.find_all("a", href=True))[:200000]

    # One extra page (About) for better tags, same domain, after a polite pause.
    about = None
    for a in soup.find_all("a", href=True):
        h = a["href"].lower()
        if re.search(r"/(about|about-us|masthead|who-we-are)/?$", h):
            about = urljoin(final_url, a["href"])
            break
    if about and norm_domain(about) == norm_domain(final_url):
        time.sleep(PER_DOMAIN_DELAY)
        try:
            res2, _ = fetch_html(about)
            if res2:
                s2 = BeautifulSoup(res2[1], PARSER)
                for s in s2(["script", "style", "noscript"]):
                    s.decompose()
                text += " " + " ".join(s2.get_text(" ").lower().split())[:150000]
        except Exception:
            pass

    full = text + " " + hrefs + " " + (row["description"] + " " + row["wikidata_description"] +
                                       " " + row["seed_hint"]).lower()
    c = {k: count(full, v) for k, v in KW.items()}
    paid, free = c["paid"], c["free"]
    web = c["fmt_web"]
    if paid >= 3 and (free >= 1 or web >= 8):
        row["access"] = "mixed"   # e.g. free to read online, with paid subscriptions or issues
    elif paid >= 3:
        row["access"] = "paid"
    elif free >= 1 or web >= 3:
        row["access"] = "free"
    else:
        row["access"] = "unknown"
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
    row["status"] = "ok"
    return row


TRANSIENT = {"http429", "http500", "http502", "http503", "http504", "error:ConnectionError",
             "error:ConnectTimeout", "error:ReadTimeout", "error:Timeout", "error:ChunkedEncodingError"}

FIELDS = ["name", "url", "domain", "description", "type", "access", "formats", "genres",
          "submissions_signal", "language", "wikidata_description", "seed_hint", "source", "status", "checked_at"]


def run_profiling(args):
    cands = []
    with open(CAND, encoding="utf-8") as f:
        for line in f:
            try:
                cands.append(json.loads(line))
            except Exception:
                pass
    last = {}
    if os.path.exists(PROF):
        with open(PROF, encoding="utf-8") as f:
            for line in f:
                try:
                    r = json.loads(line)
                    last[r["domain"]] = r.get("status", "")
                except Exception:
                    pass
    # Sites that failed for a temporary reason (rate limit, server busy, timeout,
    # dropped connection) are checked again; ok/robots/404/403 etc. stay done.
    done = {d for d, st in last.items() if st not in TRANSIENT}
    retry = sum(1 for st in last.values() if st in TRANSIENT)
    todo = [c for c in cands if c["domain"] not in done]
    if retry:
        print(f"Profiling: re-checking {retry} sites that hit a temporary error last time.")
    if args.limit:
        todo = todo[:args.limit]
    total = len(todo)
    print(f"Profiling: {len(cands)} candidates, {len(done)} already done, {total} to check now "
          f"with {args.workers} workers.")
    if not total:
        return
    fh = open(PROF, "a", encoding="utf-8")
    lock = threading.Lock()
    stats = Counter()
    start = time.time()
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = [ex.submit(profile, c) for c in todo]
        for i, fut in enumerate(as_completed(futs), 1):
            try:
                row = fut.result()
            except Exception as e:
                stats["error"] += 1
                continue
            with lock:
                fh.write(json.dumps(row, ensure_ascii=False) + "\n")
                fh.flush()
            stats["ok" if row["status"] == "ok" else "skipped"] += 1
            if i % 10 == 0 or i == total:
                el = time.time() - start
                eta = el / i * (total - i)
                sys.stdout.write(f"\r  {i}/{total} checked | ok {stats['ok']} | skipped {stats['skipped']} "
                                 f"| {el / 60:.1f} min elapsed, ~{eta / 60:.0f} min left   ")
                sys.stdout.flush()
    print("\nProfiling finished.\n")


def export():
    rows = {}
    if os.path.exists(PROF):
        with open(PROF, encoding="utf-8") as f:
            for line in f:
                try:
                    r = json.loads(line)
                    rows[r["domain"]] = r
                except Exception:
                    pass
    ordered = sorted(rows.values(), key=lambda r: (r.get("status") != "ok", (r.get("name") or r["domain"]).lower()))
    csv_path = os.path.join(OUT, "reading_directory.csv")
    with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS, extrasaction="ignore")
        w.writeheader()
        w.writerows(ordered)
    with open(os.path.join(OUT, "reading_directory.jsonl"), "w", encoding="utf-8") as f:
        for r in ordered:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    ok = sum(1 for r in ordered if r.get("status") == "ok")
    print(f"Saved {len(ordered)} sites ({ok} profiled OK) to:\n  {csv_path}")


def main():
    ap = argparse.ArgumentParser(description="ATL Reading Directory crawler")
    ap.add_argument("--seeds", default=os.path.join(HERE, "seeds.txt"))
    ap.add_argument("--workers", type=int, default=24, help="sites checked in parallel (default 24)")
    ap.add_argument("--limit", type=int, default=0, help="only profile N sites this run (testing)")
    ap.add_argument("--discover-only", action="store_true")
    ap.add_argument("--profile-only", action="store_true")
    ap.add_argument("--fresh", action="store_true", help="delete previous progress and start over")
    args = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    if args.fresh:
        for p in (CAND, PROF, DISC_DONE):
            if os.path.exists(p):
                os.remove(p)
    try:
        if not args.profile_only:
            run_discovery(args)
        if not args.discover_only:
            run_profiling(args)
    except KeyboardInterrupt:
        print("\nStopped. Progress is saved; run again to continue where it left off.")
    export()


if __name__ == "__main__":
    main()
