#!/usr/bin/env python3
"""Reading Directory: crawl CSV -> the website's data file. One command, no extra installs.

    python tools/reading-directory/build_site_data.py                 # reads tools/reading-directory/output/reading_directory.csv
    python tools/reading-directory/build_site_data.py path/to/file.csv

Writes
    public/directory/data/directory.json            compact data the /directory/ page loads
    tools/reading-directory/output/site_data_report.json   counts, what was dropped and why, examples (stays local)

Works with both crawler formats. v1 rows only carry status/access. v2 rows add access_label, access_evidence,
wikidata_id and status_label, and keep sites that block bots or were busy, described from outside sources.

Quality pass, in order
  1. drop social sites, link shorteners, data portals, government pages with no reading angle, newspapers,
     off-topic magazines, error or parked pages, institutional research repositories and parent-organization
     homepages (a university's front page rather than its press or library)
  2. one listing per site (www., m. and language prefixes count as the same site), keeping the best-described row
  3. fix garbled text, drop broken or boilerplate descriptions, tidy names
  4. sort into categories, read access (free, paid, mixed, unconfirmed), formats, genres, language, country/province
Edit the rule lists below and re-run. The page needs no other change.
"""
import csv, json, re, html, collections, sys, os, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
SRC = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("-") else os.path.join(HERE, "output", "reading_directory.csv")
OUT_JSON = os.path.join(ROOT, "public", "directory", "data", "directory.json")
OUT_REPORT = os.path.join(HERE, "output", "site_data_report.json")
csv.field_size_limit(10_000_000)

# ------------------------------------------------------------------ junk rules
JUNK_DOMAINS = {
 "facebook.com","twitter.com","x.com","instagram.com","youtube.com","linkedin.com","pinterest.com","tiktok.com",
 "reddit.com","tumblr.com","threads.net","bsky.app","mastodon.social","discord.com","discord.gg","telegram.org",
 "wikipedia.org","wikimedia.org","wikidata.org","wikisource.org","mediawiki.org","wikia.com","fandom.com",
 "bit.ly","t.co","goo.gl","tinyurl.com","ow.ly","linktr.ee","lnkd.in","buff.ly","rebrand.ly",
 "google.com","bing.com","yahoo.com","microsoft.com","apple.com","adobe.com","oracle.com","ibm.com","github.com","github.io",
 "wordpress.org","wix.com","squarespace.com","godaddy.com","cloudflare.com","canada.ca","gc.ca","usa.gov",
 "un.org","europa.eu","asean.org","who.int","worldbank.org","oecd.org","w3.org","icann.org","arcgis.com","opendatasoft.com",
 "disney.com","babytv.com","sbnation.com","espn.com","cnn.com","bbc.co.uk","nytimes.com",
}
READ = re.compile(r"\b(literar\w*|literature|litt[ée]ra\w*|fiction|poe(try|m|ms|t|ts|sie|sía)|book\w*|livre\w*|buch|bücher|"
    r"stor(y|ies)|writ(ing|er|ers)|essay\w*|novel\w*|comic\w*|manga|zine\w*|read\w*|librar\w*|biblio\w*|archive\w*|"
    r"manuscript\w*|text\w*|journal\w*|magazine\w*|review\w*|press|publish\w*|edition\w*|éditions?|verlag|author\w*|"
    r"audio ?book\w*|ebook\w*|e-book\w*|serial\w*|webcomic\w*|prize|award\w*|letters|heritage|histor\w*)\b", re.I)
DATA = re.compile(r"(open ?data|offene ?daten|données (publiques|ouvertes)|datos abiertos|otevřen\w* dat|data ?portal|\bdatabase of\b|\bdataset|"
    r"\bgenom|\bprotein|\bchemical|\btoxicolog|\bgeospatial|\bgis\b|\bstatistic|\bclimate data|\bbiodiversity|\bspecimen|"
    r"\bmolecul|\bclinical\b|\bpatent|paleobio|\bfossil|\bdata (from|of)\b|planning data|open government|space agency|\bmission data)", re.I)
OFFTOPIC = re.compile(r"\b(fintech|banking|payments?|finance|financial|crypto|blockchain|technology|tech news|tech lovers|"
    r"computing|software|linux|gaming|video games?|esports|sports?|football|fashion|beauty|music|hip.hop|film|movies?|"
    r"tv shows?|television|celebrity|gossip|automotive|cars?|travel|food|recipes?|health|fitness|business news|marketing|"
    r"real estate|adult|porn|gambling|casino|politic\w*|government affairs|news website|news site|railway|radio|economy|"
    r"sustainab\w*|heavy metal|animation studio|journalists|engineer\w*|nurs(e|ing)|medic\w*|biochem\w*|role-playing|tabletop)\b", re.I)
GOV = re.compile(r"\.(gov|mil)(\.[a-z]{2})?$|\.(gov|gob|gouv|govt)\.[a-z]{2}$|\.gc\.ca$")
HOSTS_EXACT = {"wordpress.com","blogspot.com","substack.com","medium.com","tumblr.com"}
SOFT404 = re.compile(r"page not found|not found|\b404\b|página no encontrada|seite nicht gefunden|page introuvable|access denied|"
    r"just a moment|attention required|domain (is )?for sale|parked|something is terribly wrong|under construction|coming soon", re.I)
LIT = re.compile(r"literar|literat|fiction|poe[tmsz]|book|stor(y|ies)|essay|writ|comic|manga|\bzine|novel|prose|letters|reading|lyrik|roman\b|livre|libro|buch", re.I)
REPOSITORY = re.compile(r"institutional repository|research repository|\bdspace\b|e-?prints|digital commons|academic commons|"
    r"scholar(ly)? (works|commons|archive)|research online|open research|research portal|\btheses\b|dissertations|"
    r"open access repository|research output|\bair\b$", re.I)
INSTITUTION = re.compile(r"^(the )?(univ|college|institut|école|escola|hochschule|academy|universit|politecnico|"
    r"technische|school of|faculty of)|\b(universit\w*|université|universidad|universidade|universität|universiteit|"
    r"uniwersytet|ülikool|üniversitesi|egyetem|college|polytechnic)\b", re.I)
READING_PART = re.compile(r"press|publish|collection|editura|wydawnictw|kiadó|uitgever|nakladatel|books|verlag|éditions|ediciones|editorial|penerbit|forlag|editora|publications|"
    r"librar|biblio|archive|review|journal|quarterly|magazine|poetry|literary|letters", re.I)
TRUSTED_HINTS = {"literary magazine", "poetry magazine", "literary award", "small press publisher", "literary society"}
BROAD_HINTS = {"online magazine", "digital library", "literary award", "online archive"}

def junk(r, text):
    d = r["domain"]; parts = d.split(".")
    if any(".".join(parts[i:]) in JUNK_DOMAINS for i in range(len(parts) - 1)) or d in HOSTS_EXACT: return "junk domain"
    if SOFT404.search(r["name"] + " " + r["description"][:80]): return "error/parked page"
    if HIJACKED.search(r["name"] + " " + r["description"]): return "hijacked or spam domain"
    if DATA.search(text) or re.match(r"^(data|opendata|open-data|geo|gis|maps?|daten|datos|dati)\.", d) or "opendata" in d: return "data portal"
    if GOV.search(d) and not re.search(r"librar|archive|biblio|literat|book|poet", text, re.I): return "government"
    if REPOSITORY.search(r["name"] + " " + r["wikidata_description"]) and not re.search(r"poe|fiction|literar|book", r["name"], re.I):
        return "research repository"
    if r["seed_hint"] in BROAD_HINTS and not READ.search(text): return "no reading signal"
    if re.search(r"\b(breaking|latest|local|top) news\b|news, (politics|sports)|\bnewspaper\b", r["description"] + " " + r["wikidata_description"], re.I) \
       and not LIT.search(r["wikidata_description"]):
        return "newspaper/news site"
    if r["seed_hint"] == "online magazine" and not LIT.search(text): return "non-literary magazine"
    if INSTITUTION.match(r["name"]) and not READING_PART.search(r["name"] + " " + r["url"]) \
       and not re.match(r"^(press|library|lib|books|archives?|digital|collections|journals?|publishing|ebooks?)\.", d):
        return "parent organization homepage"
    if r["seed_hint"] == "university press publisher" and re.search(r"universit|college|ülikool|egyetem|hochschule|school", r["wikidata_description"] + " " + r["description"][:200] + " " + r["name"], re.I) \
       and not READING_PART.search(r["name"] + " " + r["url"]) and not re.search(r"\b(press|publish\w*|books)\b", r["description"][:200], re.I):
        return "parent organization homepage"
    if re.search(r"\bnews\b", r["name"], re.I) and not LIT.search(r["wikidata_description"] + " " + r["name"]):
        return "newspaper/news site"
    if r["seed_hint"] not in TRUSTED_HINTS and OFFTOPIC.search(r["wikidata_description"] + " " + r["name"] + " " + r["description"][:160]) \
       and not re.search(r"literar|fiction|poe|book|stor(y|ies)|essay|writ|comic|\bzines?\b|novel|librar|biblio|literat|culture|\barts\b", r["wikidata_description"] + " " + r["name"] + " " + r["description"][:200], re.I):
        return "off-topic site"
    return ""

# ------------------------------------------------------------------ text tidying
GENERIC = re.compile(r"^(home( ?page)?|welcome.*|official (web)?site|index|accueil|startseite|inicio|homepage|"
                     r"main page|start|page d'accueil|site officiel|untitled|about( us)?|about|contact( us)?|shop|store|blog|news|"
                     r"spotlight|search|catalog(ue)?|o nas|über uns|qui sommes-nous|quiénes somos|chi siamo|sobre nosotros)$", re.I)
SEP = re.compile(r"\s+[|\u2013\u2014\-:·•»]+\s+|\s*\|\s*")
BAD_DESC = re.compile(r"javascript|enable cookies|cookie|browser (is )?(not supported|outdated)|loading\.\.\.|lorem ipsum|"
    r"\bfollowers\b|log ?in|sign ?in|\bcaptcha\b|^since \d{4}$|^description$|^null$|^undefined$|^none$|^home$|copyright ©|all rights reserved|page d.exemple|sample page|just another wordpress|select options|add to cart|multiple variants|"
    r"shopping cart|your cart|free shipping on", re.I)
HIJACKED = re.compile(r"体育|娱乐|博彩|彩票|tiyu|\bcasino\b|slot gacor|\bjudi\b|togel|\bbet365\b|sportsbook|replica watches|viagra", re.I)
MOJIBAKE = re.compile(r"Ã.|â€|Â |\ufffd|[čřĺ]s\b|Å\S")

def fix_mojibake(s):
    if not MOJIBAKE.search(s): return s
    for enc in ("cp1252", "latin-1"):
        try:
            t = s.encode(enc).decode("utf-8")
            if not MOJIBAKE.search(t): return t
        except (UnicodeEncodeError, UnicodeDecodeError):
            pass
    try:   # some text is UTF-8 read as latin-1 with C1 control chars left in
        t = s.encode("latin-1", "ignore").decode("utf-8")
        if not MOJIBAKE.search(t): return t
    except UnicodeDecodeError:
        pass
    return ""   # unfixable, the caller falls back to another description

def clean_text(s):
    s = html.unescape(s or "").replace("\u200b", "").replace("\xa0", " ")
    s = re.sub(r"[\x00-\x1f\x7f-\x9f]", " ", s)
    return " ".join(s.split())

def norm_name(r):
    raw = fix_mojibake(clean_text(r["name"])) or clean_text(r["name"])
    if re.fullmatch(r"Q\d+", raw) or raw.lower() in ("null", "undefined", "none"): raw = ""
    segs = [s.strip(" -|") for s in SEP.split(raw) if s.strip(" -|")]
    segs = [s for s in segs if not GENERIC.match(s)] or segs
    if not segs:
        core = r["domain"].split(".")[0]
        return core.replace("-", " ").title() if len(core) > 3 else r["domain"]
    core = re.sub(r"[^a-z0-9]", "", r["domain"].split(".")[0].lower())
    def score(s):
        k = re.sub(r"[^a-z0-9]", "", s.lower())
        return (bool(k) and (k in core or core in k), -len(s))
    best = max(segs, key=score) if len(segs) > 1 else segs[0]
    if best.isupper() and len(best) > 6: best = best.title()
    best = best.strip(" \"'“”")
    return best[:80].strip()

def good_desc(s, name):
    s = fix_mojibake(clean_text(s))
    if len(s) < 20 or BAD_DESC.search(s) or SOFT404.search(s[:80]): return ""
    if s.lower().strip(" .") == name.lower(): return ""
    if sum(c.isalpha() for c in s) < len(s) * 0.5: return ""
    return s

def trim(s, n=180):
    if len(s) <= n: return s
    return s[:n].rsplit(" ", 1)[0].rstrip(",;:.-–—") + "…"

# ------------------------------------------------------------------ categories
CATS = ["Publishers & Presses", "Literary Magazines & Journals", "Free Reading Libraries & Archives", "Bookstores",
        "Literary Awards & Organizations", "Poetry", "Web Fiction, Serials & Webcomics", "Audiobooks",
        "Ebook Stores & Platforms", "Newsletters", "Book Reviews & Communities"]
def rx(p): return re.compile(p, re.I)
RULES = [
 ("Newsletters", rx(r"\bnewsletter\b|substack|beehiiv|buttondown"), {"newsletter"}),
 ("Audiobooks", rx(r"audio ?books?|audiolibro|hörbuch|livres? audio"), {"audiobook publisher", "audiobooks"}),
 ("Web Fiction, Serials & Webcomics", rx(r"webcomic|web ?comic|web novel|web ?fiction|web serial|fan ?fiction|fanfic|serial fiction|webtoon"), {"web fiction platform"}),
 ("Book Reviews & Communities", rx(r"book review|reviews of books|social cataloging|book club|reading community|book blog|book community|readers' community"), {"reader community", "book reviews", "book website"}),
 ("Literary Awards & Organizations", rx(r"\b(literary|book|poetry|fiction) (award|prize)s?\b|\bprize\b|\baward\b|literary society|writers' (union|association|guild)|literary festival|book festival|pen (centre|center|international)"), {"literary award", "literary society"}),
 ("Poetry", rx(r"\bpoetry\b|\bpoems?\b|\bpoets?\b|poésie|poesía|lyrik"), {"poetry magazine", "poetry"}),
 ("Bookstores", rx(r"book ?stores?|book ?shops?|booksellers?|librairie|buchhandlung|librería"), {"bookstore", "independent bookstore", "online bookstore"}),
 ("Ebook Stores & Platforms", rx(r"\be-?books?\b|self-publishing|ebook (store|platform|retailer)|digital publishing platform|e-reader"), {"self-publishing platform", "ebook store"}),
 ("Free Reading Libraries & Archives", rx(r"\blibrar(y|ies)\b|\barchives?\b|digital collection|public domain|bibliothè?que|biblioteca|bibliothek|digitised|digitized"), {"digital library", "free library", "online archive"}),
 ("Literary Magazines & Journals", rx(r"magazine|journal|\breview\b|quarterly|\bzine\b|fanzine|anthology|revue|revista|zeitschrift"), {"literary magazine", "science fiction magazine", "online magazine", "zine", "fanzine", "horror magazine", "mystery magazine", "fantasy"}),
 ("Publishers & Presses", rx(r"publish|\bpress\b|\bbooks\b|éditions?|editorial|verlag|imprint|university press"), {"book publisher", "university press publisher", "small press publisher", "comics publisher"}),
]
def category(r):
    strong = (r["name"] + " " + r["wikidata_description"]).lower()
    if "webcomic" in r["source"].lower(): return "Web Fiction, Serials & Webcomics"
    if r["source"].startswith("osm:books"): return "Bookstores"
    if r["source"].startswith("osm:library"): return "Free Reading Libraries & Archives"
    for cat, pat, _ in RULES:
        if pat.search(strong): return cat
    for cat, _, hints in RULES:
        if r["seed_hint"] in hints: return cat
    for cat, pat, _ in RULES:
        if pat.search(r["description"].lower()): return cat
    t = r["type"].split(";")[0].strip()
    return {"magazine/journal": "Literary Magazines & Journals", "library/archive": "Free Reading Libraries & Archives",
            "publisher/press": "Publishers & Presses", "store": "Bookstores", "platform": "Ebook Stores & Platforms",
            "newsletter": "Newsletters"}.get(t, "")

ACCESS = ["free", "paid", "mixed", "unconfirmed"]
DEFAULT_ACCESS = {"Bookstores": "paid", "Publishers & Presses": "paid", "Ebook Stores & Platforms": "paid"}
FORMATS = ["print", "ebook", "audiobook", "web", "podcast"]
IMPLIED_FMT = {"Bookstores": "print", "Audiobooks": "audiobook", "Web Fiction, Serials & Webcomics": "web",
               "Free Reading Libraries & Archives": "web", "Newsletters": "web"}
GENRES = ["fiction", "poetry", "nonfiction & essays", "literary", "comics", "mystery & crime", "translation",
          "science fiction", "fantasy", "drama", "horror", "children & YA", "classics", "romance", "flash fiction"]

# ------------------------------------------------------------------ country and province
PROV_NAMES = {"ON": r"ontario|toronto|ottawa|hamilton|kitchener|waterloo|guelph|kingston|sudbury|thunder bay|mississauga|london, on",
 "QC": r"qu[ée]bec|montr[ée]al|gatineau|sherbrooke|trois-rivi[èe]res", "BC": r"british columbia|vancouver|victoria, bc|kelowna|nanaimo|surrey, bc",
 "AB": r"alberta|calgary|edmonton|lethbridge|banff", "MB": r"manitoba|winnipeg|brandon, mb", "SK": r"saskatchewan|regina|saskatoon",
 "NS": r"nova scotia|halifax|cape breton|wolfville|antigonish", "NB": r"new brunswick|fredericton|moncton|saint john",
 "NL": r"newfoundland|labrador|st\. john's", "PE": r"prince edward island|charlottetown", "YT": r"yukon|whitehorse",
 "NT": r"northwest territories|yellowknife", "NU": r"nunavut|iqaluit"}
PROV_RX = {k: re.compile(r"\b(" + v + r")\b", re.I) for k, v in PROV_NAMES.items()}
DEMONYM = {"canadian": "CA", "canada": "CA", "american": "US", "united states": "US", "british": "GB", "united kingdom": "GB",
 "english": "GB", "scottish": "GB", "welsh": "GB", "england": "GB", "scotland": "GB", "wales": "GB", "irish": "IE", "ireland": "IE",
 "australian": "AU", "australia": "AU", "new zealand": "NZ", "german": "DE", "germany": "DE", "french": "FR", "france": "FR",
 "italian": "IT", "italy": "IT", "spanish": "ES", "spain": "ES", "japanese": "JP", "japan": "JP", "polish": "PL", "poland": "PL",
 "dutch": "NL", "netherlands": "NL", "mexican": "MX", "mexico": "MX", "brazilian": "BR", "brazil": "BR", "indian": "IN", "india": "IN",
 "swedish": "SE", "sweden": "SE", "norwegian": "NO", "norway": "NO", "danish": "DK", "denmark": "DK", "finnish": "FI", "finland": "FI",
 "czech": "CZ", "russian": "RU", "russia": "RU", "chinese": "CN", "china": "CN", "korean": "KR", "argentine": "AR", "argentina": "AR",
 "belgian": "BE", "belgium": "BE", "swiss": "CH", "switzerland": "CH", "austrian": "AT", "austria": "AT", "portuguese": "PT",
 "portugal": "PT", "israeli": "IL", "israel": "IL", "south african": "ZA", "nigerian": "NG", "nigeria": "NG", "turkish": "TR",
 "greek": "GR", "hungarian": "HU", "romanian": "RO", "ukrainian": "UA", "chilean": "CL", "colombian": "CO", "indonesian": "ID",
 "filipino": "PH", "philippine": "PH", "singaporean": "SG", "taiwanese": "TW", "slovak": "SK", "slovenian": "SI", "croatian": "HR",
 "serbian": "RS", "bulgarian": "BG", "estonian": "EE", "latvian": "LV", "lithuanian": "LT", "icelandic": "IS", "egyptian": "EG",
 "iranian": "IR", "pakistani": "PK", "bangladeshi": "BD", "kenyan": "KE", "ghanaian": "GH", "jamaican": "JM", "peruvian": "PE",
 "venezuelan": "VE", "cuban": "CU", "catalan": "ES", "basque": "ES", "flemish": "BE", "quebec": "CA", "québécois": "CA"}
DEMONYM_RX = re.compile(r"\b(" + "|".join(sorted(map(re.escape, DEMONYM), key=len, reverse=True)) + r")\b", re.I)
GENERIC_TLD = {"co", "io", "tv", "me", "fm", "ly", "cc", "ai", "to", "ws", "is", "la", "am", "gg", "so", "sh", "nu", "tk", "ml", "ga", "cf", "eu", "asia", "st", "im", "vc", "app"}

def country_of(r):
    src = r["source"]
    m = re.match(r"osm:\w+ ([A-Z]{2})(?:-([A-Z]{2}))?", src)
    if m: return m.group(1), (m.group(2) or "") if m.group(1) == "CA" else ""
    d = r["domain"]; tld = d.rsplit(".", 1)[-1]
    wd = re.sub(r"(\w+)-language", "", r["wikidata_description"])
    c = ""
    m = DEMONYM_RX.search(wd)
    if m: c = DEMONYM[m.group(1).lower()]
    elif len(tld) == 2 and tld not in GENERIC_TLD: c = {"uk": "GB"}.get(tld, tld.upper())
    elif tld in ("edu", "gov", "mil"): c = "US"
    text = " ".join([r["name"], r["wikidata_description"], r["description"][:300]])
    if not c and re.search(r"\b(canada|canadian)\b", text, re.I): c = "CA"
    prov = ""
    if c == "CA" or not c:
        sub = re.search(r"\.(on|qc|bc|ab|mb|sk|ns|nb|nl|pe|yk|nt|nu)\.ca$", d)
        if sub: prov = {"YK": "YT"}.get(sub.group(1).upper(), sub.group(1).upper()); c = "CA"
        else:
            for k, rxp in PROV_RX.items():
                if rxp.search(text):
                    if c == "CA" or k in ("ON", "BC", "QC", "AB", "MB", "SK", "NS", "NB", "PE", "YT", "NT", "NU") and re.search(r"\b(canada|canadian)\b", text, re.I):
                        prov = k; c = "CA"; break
    return c, prov

# ------------------------------------------------------------------ main
KEEP_UNREAD = {"robots", "http403", "http429", "http503", "error:robots"}   # the site exists but would not let us read it

def dedupe_key(d):
    return re.sub(r"^(www\d?|m|en|fr|de|es|it|pt|nl|ja|zh|ru|pl|sv)\.(?=[^.]+\.[^.]+)", "", d.lower())

def score_row(r):
    return (r["status"] == "ok", bool(good_desc(r["description"], r["name"])), bool(r["wikidata_description"]),
            r["language"].lower().startswith("en"), bool(r["type"]), r["source"] == "curated")

def main():
    raw = list(csv.DictReader(open(SRC, encoding="utf-8-sig")))
    for r in raw:
        for k in ("name", "url", "domain", "description", "type", "access", "formats", "genres", "submissions_signal",
                  "language", "wikidata_description", "seed_hint", "source", "status", "checked_at", "access_evidence", "wikidata_id"):
            r[k] = (r.get(k) or "").strip()
        r["domain"] = r["domain"].lower()
    rows = []
    for r in raw:
        if r["status"] == "ok": rows.append(r)
        elif r["status"] in KEEP_UNREAD and (r["wikidata_description"] or r["access_evidence"] or r["wikidata_id"]): rows.append(r)
    dropped = collections.Counter(); examples = collections.defaultdict(list)
    def drop(why, r):
        dropped[why] += 1
        if len(examples[why]) < 12: examples[why].append(f'{r["domain"]} ({clean_text(r["name"])[:40]})')
    keep = {}
    for r in rows:
        text = " ".join([r["name"], r["wikidata_description"], r["description"]])
        why = junk(r, text)
        if why: drop(why, r); continue
        k = dedupe_key(r["domain"])
        if k in keep:
            if score_row(r) <= score_row(keep[k]): drop("duplicate domain", r); continue
            drop("duplicate domain", keep[k])
        keep[k] = r
    out = []; seen_name = {}
    for r in keep.values():
        cat = category(r)
        if not cat: drop("no clear category", r); continue
        name = norm_name(r)
        acc = r["access"].lower()
        if acc in ("unknown", "", "unconfirmed"): acc = "unconfirmed"
        inferred = False
        if acc == "unconfirmed" and cat in DEFAULT_ACCESS: acc, inferred = DEFAULT_ACCESS[cat], True
        evidence = r["access_evidence"] or ("homepage wording" if r["status"] == "ok" and not inferred and acc != "unconfirmed" else "")
        if inferred: evidence = "the kind of site it is"
        fmts = {f.strip() for f in r["formats"].split(";") if f.strip()}
        if IMPLIED_FMT.get(cat): fmts.add(IMPLIED_FMT[cat])
        desc = good_desc(r["description"], name) or good_desc(r["wikidata_description"], name)
        if desc and desc[0].islower() and desc == good_desc(r["wikidata_description"], name): desc = desc[0].upper() + desc[1:]
        lang = (r["language"] or "").split("-")[0].split("_")[0].lower()[:3]
        if lang in ("unk", "und"): lang = ""
        c, prov = country_of(r)
        # same name and same category on two addresses is almost always one outlet with two domains
        nk = (re.sub(r"[^a-z0-9]", "", name.lower()), cat)
        if nk[0] and len(nk[0]) > 5 and nk in seen_name:
            prev = seen_name[nk]
            if (bool(desc), r["status"] == "ok") <= (bool(prev["s"]), prev["k"]): drop("duplicate name", r); continue
            out.remove(prev)
        item = {"n": name, "u": r["url"], "d": r["domain"], "c": CATS.index(cat), "a": ACCESS.index(acc),
                "f": sum(1 << i for i, f in enumerate(FORMATS) if f in fmts),
                "g": sum(1 << i for i, g in enumerate(GENRES) if g in r["genres"].split("; ")),
                "s": trim(desc), "l": lang, "r": c, "p": prov, "k": r["status"] == "ok",
                "w": r["submissions_signal"] == "yes", "e": evidence}
        seen_name[nk] = item; out.append(item)
    out.sort(key=lambda x: x["n"].lower())
    keys = ["n", "u", "d", "c", "a", "f", "g", "s", "l", "r", "p", "k", "w", "e"]
    data = {"v": 1, "built": datetime.date.today().isoformat(), "source": os.path.basename(SRC), "count": len(out),
            "fields": keys, "categories": CATS, "access": ACCESS, "formats": FORMATS, "genres": GENRES,
            "rows": [[(int(x[k]) if isinstance(x[k], bool) else x[k]) for k in keys] for x in out]}
    os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    C = collections.Counter
    report = {"input_rows": len(raw), "considered": len(rows), "kept": len(out), "dropped": dict(dropped.most_common()),
              "drop_examples": examples,
              "category": {CATS[k]: v for k, v in C(x["c"] for x in out).most_common()},
              "access": {ACCESS[k]: v for k, v in C(x["a"] for x in out).most_common()},
              "access_from_category": sum(1 for x in out if x["e"] == "the kind of site it is"),
              "described_from_outside_sources": sum(1 for x in out if not x["k"]),
              "formats": {f: sum(1 for x in out if x["f"] >> i & 1) for i, f in enumerate(FORMATS)},
              "country_top": dict(C(x["r"] or "?" for x in out).most_common(20)),
              "canada_provinces": dict(C(x["p"] or "?" for x in out if x["r"] == "CA").most_common()),
              "no_description": sum(1 for x in out if not x["s"]),
              "category_x_access": {CATS[c]: {ACCESS[a]: n for a, n in C(x["a"] for x in out if x["c"] == c).most_common()} for c in range(len(CATS))}}
    os.makedirs(os.path.dirname(OUT_REPORT), exist_ok=True)
    json.dump(report, open(OUT_REPORT, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(f"{len(out)} sites written to {os.path.relpath(OUT_JSON, ROOT)} ({os.path.getsize(OUT_JSON) // 1024} KB)")
    print(json.dumps({k: report[k] for k in ("input_rows", "considered", "kept", "dropped", "category", "access", "country_top", "canada_provinces", "no_description")}, indent=1, ensure_ascii=False))

if __name__ == "__main__":
    main()
