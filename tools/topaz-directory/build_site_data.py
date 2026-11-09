#!/usr/bin/env python3
"""Topaz Pages: crawl CSV -> the website's data file. One command, no extra installs.

    python tools/topaz-directory/build_site_data.py                 # reads tools/topaz-directory/output/topaz_directory.csv
    python tools/topaz-directory/build_site_data.py path/to/file.csv

Writes
    public/topaz-pages/data/directory.json              compact data the /topaz-pages/ page will load
    tools/topaz-directory/output/site_data_report.json  counts, what was dropped and why, examples (stays local)

Quality pass, in order
  1. known scams out (Writer Beware's list and known_scams.txt, checked again here in case the lists changed)
  2. junk out: social sites and big platforms, error or parked pages, spam domains, pages that no longer exist,
     newspapers, government pages and university homepages that are not the press itself, search leads that show
     no sign of being a book service
  3. one listing per site (www., m. and language prefixes count as the same site), keeping the best-described row,
     and one listing per name within a category
  4. category, service tags, audiences, submissions, memberships, pricing, formats, country and province, languages,
     and a public reviews link for every entry
Hybrid and self-publishing service companies stay unless they are on a known-scam list.
"""
import csv, json, re, html, collections, sys, os, datetime
from urllib.parse import quote_plus

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import taxonomy as tx  # noqa: E402
import scamcheck  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
SRC = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("-") else os.path.join(HERE, "output", "topaz_directory.csv")
OUT_JSON = os.path.join(ROOT, "public", "topaz-pages", "data", "directory.json")
OUT_REPORT = os.path.join(HERE, "output", "site_data_report.json")
csv.field_size_limit(10_000_000)

# ------------------------------------------------------------------ junk rules
JUNK_DOMAINS = {
    "facebook.com", "twitter.com", "x.com", "instagram.com", "youtube.com", "linkedin.com", "pinterest.com", "tiktok.com",
    "reddit.com", "tumblr.com", "threads.net", "bsky.app", "mastodon.social", "discord.com", "discord.gg",
    "wikipedia.org", "wikimedia.org", "wikidata.org", "wikisource.org", "fandom.com", "bit.ly", "t.co", "goo.gl",
    "tinyurl.com", "linktr.ee", "google.com", "bing.com", "yahoo.com", "microsoft.com", "adobe.com", "github.com",
    "github.io", "wordpress.org", "wix.com", "squarespace.com", "godaddy.com", "cloudflare.com", "un.org", "europa.eu",
    "w3.org", "cnn.com", "bbc.co.uk", "nytimes.com", "theguardian.com", "amazon.com", "amazon.ca", "amazon.co.uk",
    "ebay.com", "etsy.com", "fiverr.com", "upwork.com", "indeed.com", "glassdoor.com", "yelp.com", "yelp.ca",
}
PLATFORM_OK = {"kdp.amazon.com", "play.google.com", "authors.apple.com", "press.barnesandnoble.com"}  # author platforms of big companies
HOSTS_EXACT = {"wordpress.com", "blogspot.com", "substack.com", "medium.com", "tumblr.com", "wixsite.com"}
SOFT404 = re.compile(r"page not found|not found|\b404\b|página no encontrada|seite nicht gefunden|page introuvable|access denied|"
                     r"just a moment|attention required|domain (is )?for sale|parked|buy this domain|something is terribly wrong|"
                     r"under construction|coming soon|account suspended|site is not available", re.I)
HIJACKED = re.compile(r"bóng đá|trực tiếp|nhà cái|cá cược|soi kèo|体育|娱乐|博彩|彩票|\bcasino\b|slot gacor|\bjudi\b|togel|\bbet365\b|"
                      r"sportsbook|replica watches|viagra|escort", re.I)
NEWS = re.compile(r"\b(breaking|latest|local|top) news\b|news, (politics|sports)|\bnewspaper\b|\bnews (site|website|agency)\b", re.I)
GOV = re.compile(r"\.(gov|mil)(\.[a-z]{2})?$|\.(gov|gob|gouv|govt)\.[a-z]{2}$|\.gc\.ca$")
GOV_OK = re.compile(r"isbn|library|libraries|archives|biblioth[eè]que|legal deposit|d[ée]p[oô]t l[ée]gal", re.I)
INSTITUTION = re.compile(r"^(the )?(univ|college|institut|école|academy|universit|school of|faculty of)|\b(universit\w*|université|college|polytechnic)\b", re.I)
PRESS_PART = re.compile(r"press|publish|books|[ée]ditions|presses|imprint|publications", re.I)
WIDE_NET = re.compile(r"^(wpsearch:|gemini:|marginalia:|search-lead)")

# Sites the crawler could not read stay only when an outside source vouches for them and the failure means
# "would not let us in" or "try later", never "gone".
KEEP_UNREAD_STATUS = re.compile(r"^(robots|error:robots\d*|http(202|401|403|405|406|418|429|444|5\d\d)|error:(ConnectTimeout|ReadTimeout|ConnectionError))$")


def keep_unread(r):
    if not KEEP_UNREAD_STATUS.match(r["status"]):
        return False
    return bool(r["wikidata_id"] or r["wikidata_description"] or r["source"] == "curated" or r["source"].startswith(("page:", "alli:")))


def clean_text(s):
    s = html.unescape(s or "").replace("\u200b", "").replace("\xa0", " ")
    s = re.sub(r"[\x00-\x1f\x7f-\x9f]", " ", s)
    return " ".join(s.split())


def junk(r):
    d = r["domain"]
    parts = d.split(".")
    if d not in PLATFORM_OK and (any(".".join(parts[i:]) in JUNK_DOMAINS for i in range(len(parts) - 1)) or d in HOSTS_EXACT):
        return "junk domain"
    if SOFT404.search(r["name"] + " " + r["description"][:80]):
        return "error or parked page"
    if HIJACKED.search(r["name"] + " " + r["description"]):
        return "hijacked or spam domain"
    if NEWS.search(r["description"] + " " + r["wikidata_description"]) and not tx.CAT_SIGNALS["publishers"].search(r["name"]):
        return "newspaper or news site"
    if GOV.search(d) and not GOV_OK.search(" ".join([r["name"], r["description"], r["url"], r["services"]])):
        return "government page"
    if INSTITUTION.match(r["name"]) and not PRESS_PART.search(r["name"] + " " + r["url"]) \
       and not re.match(r"^(press|presses|books|publishing|pubs?)\.", d):
        return "parent organization homepage"
    if not r["category"]:
        return "not a book service (no clear category)"
    if WIDE_NET.match(r["source"]) and r["status"] == "ok" and not (r["services"] or r["memberships"]) \
       and not tx.CAT_SIGNALS[r["category"]].search(" ".join([r["name"], r["description"], r["wikidata_description"]])):
        return "search lead with no sign of a book service"
    return ""


# ------------------------------------------------------------------ names and descriptions
GENERIC = re.compile(r"^(home( ?page)?|welcome.*|official (web)?site|index|accueil|startseite|inicio|homepage|main page|start|"
                     r"untitled|about( us)?|contact( us)?|shop|store|blog|news|services|portfolio)$", re.I)
SEP = re.compile(r"\s+[|\u2013\u2014\-:·•»]+\s+|\s*\|\s*")
BAD_DESC = re.compile(r"javascript|enable cookies|cookie|browser (is )?(not supported|outdated)|loading\.\.\.|lorem ipsum|"
                      r"log ?in|sign ?in|\bcaptcha\b|^description$|^null$|^undefined$|^none$|^home$|all rights reserved|"
                      r"just another wordpress|sample page|add to cart|shopping cart", re.I)


def norm_name(r):
    raw = clean_text(r["name"])
    if re.fullmatch(r"Q\d+", raw) or raw.lower() in ("null", "undefined", "none"):
        raw = ""
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
    if best.isupper() and len(best) > 6:
        best = best.title()
    return best.strip(" \"'“”")[:80].strip()


def good_desc(s, name):
    s = clean_text(s)
    if len(s) < 20 or BAD_DESC.search(s) or SOFT404.search(s[:80]):
        return ""
    if s.lower().strip(" .") == name.lower():
        return ""
    if sum(c.isalpha() for c in s) < len(s) * 0.5:
        return ""
    return s


def trim(s, n=200):
    if len(s) <= n:
        return s
    return s[:n].rsplit(" ", 1)[0].rstrip(",;:.-–—") + "…"


# ------------------------------------------------------------------ country and province (fallback when the crawl had none)
COUNTRY_WORDS = [("CA", r"canad(a|ian)|qu[ée]b[ée]c"), ("US", r"united states|american|\busa\b|u\.s\."), ("GB", r"united kingdom|british|england|scotland|wales|\buk\b"),
                 ("IE", r"ireland|irish"), ("AU", r"australia(n)?"), ("NZ", r"new zealand")]
PROV_WORDS = {"ON": r"ontario|toronto|ottawa", "QC": r"qu[ée]bec|montr[ée]al", "BC": r"british columbia|vancouver|victoria, bc",
              "AB": r"alberta|calgary|edmonton", "MB": r"manitoba|winnipeg", "SK": r"saskatchewan|regina|saskatoon",
              "NS": r"nova scotia|halifax", "NB": r"new brunswick|fredericton|moncton", "NL": r"newfoundland|st\. john's",
              "PE": r"prince edward island|charlottetown", "YT": r"yukon|whitehorse", "NT": r"northwest territories|yellowknife",
              "NU": r"nunavut|iqaluit"}


def country_of(r):
    c, p = r["country"], r["province"]
    text = " ".join([r["name"], r["wikidata_description"], r["description"][:300]])
    if not c:
        for code, pat in COUNTRY_WORDS:
            if re.search(r"\b(" + pat + r")\b", text, re.I):
                c = code
                break
    if c == "CA" and not p:
        for k, pat in PROV_WORDS.items():
            if re.search(r"\b(" + pat + r")\b", text, re.I):
                p = k
                break
    return c, p


# ------------------------------------------------------------------ schema
CAT_KEYS = tx.CAT_KEYS
CAT_LABELS = [tx.CAT_LABEL[k] for k in CAT_KEYS]
SERVICES = {k: [n for n, _ in tx.SERVICES[k]] for k in CAT_KEYS}
STYLES = [n for n, _ in tx.ILLUSTRATION_STYLES]
AUDIENCES = [n for n, _ in tx.AUDIENCES]
MEMBERSHIPS = [n for n, _ in tx.MEMBERSHIPS]
WORKS_WITH = ["", "self-publishing authors", "publishers", "both"]
SUBMISSIONS = ["", "Open to unagented", "Agented only", "Closed"]
BUSINESS = ["", "Traditional", "Hybrid", "Author-paid services"]
PRICING = ["", "Published rates", "Quote on request", "Free"]
FORMATS = ["Print", "Ebook", "Audio"]
REVIEW_SOURCES = ["search", "search (Absolute Write forums)", "ALLi service rating", "Trustpilot", "Reedsy profile",
                  "Google Maps listing", "Yelp", "Absolute Write"]
FIELDS = {"n": "name", "u": "website", "d": "domain", "c": "category (index into categories)",
          "sv": "services (indexes into services[category])", "st": "illustration styles (indexes into styles)",
          "au": "audiences and genres (indexes into audiences)", "ww": "works with (index into works_with)",
          "sb": "submission status (index into submissions)", "rp": "has reading periods (1/0)",
          "bm": "business model (index into business_models)", "m": "memberships (indexes into memberships)",
          "pr": "pricing info (index into pricing)", "f": "formats bitmask (bit i = formats[i])",
          "r": "country code", "p": "province or state code", "rm": "works remotely or internationally (1/0)",
          "l": "languages (codes)", "kid": "children's or picture-book focus (1/0)", "s": "short description (the site's own meta description)",
          "rv": "public reviews link", "rs": "reviews source (index into review_sources)", "al": "ALLi rating, if rated",
          "k": "read directly by the crawler (1/0)",
          "t": "trust score 0 to 5 from public signals (see trust() in build_site_data.py)",
          "w": "caution flag: ALLi Watchdog Advisory or Caution (1/0)"}


def trust(r, item):
    """0 to 5 points from public signals only. It is a guide for readers, not a rating.
    One point each for: the crawler read the site itself, a professional membership, a listing in an association or
    curated directory, a Wikidata entry, a real review page (Trustpilot, Reedsy, Google Maps, ALLi...), and an ALLi
    rating of Excellent or Recommended. An ALLi Watchdog Advisory or Caution sets the score to 0 and the caution flag."""
    al = r["alli_rating"].lower()
    if "watchdog" in al or "caution" in al:
        return 0, 1
    pts = item["k"] + bool(item["m"]) + r["source"].startswith(("page:", "curated", "alli:")) + bool(r["wikidata_id"])
    pts += item["rs"] >= 2
    pts += ("excellent" in al or "recommended" in al)
    return min(pts, 5), 0


def idx_list(values, names):
    vals = [v.strip() for v in (values or "").split(";") if v.strip()]
    return [names.index(v) for v in vals if v in names]


def pick(value, names):
    return names.index(value) if value in names else 0


def dedupe_key(d):
    return re.sub(r"^(www\d?|m|en|fr|de|es)\.(?=[^.]+\.[^.]+)", "", d.lower())


def score_row(r):
    filled = sum(bool(r[k]) for k in ("services", "audiences", "memberships", "submission_status", "pricing_info", "country"))
    return (r["status"] == "ok", bool(good_desc(r["description"], r["name"])), filled, r["source"] == "curated")


def main():
    raw = list(csv.DictReader(open(SRC, encoding="utf-8-sig")))
    keys = ("name", "url", "domain", "category", "services", "illustration_styles", "audiences", "works_with", "submission_status",
            "reading_period", "business_model", "memberships", "pricing_info", "formats", "country", "province", "remote",
            "languages", "children_focus", "description", "reviews_url", "reviews_source", "alli_rating", "wikidata_id",
            "wikidata_description", "seed_category", "source", "status", "status_label")
    for r in raw:
        for k in keys:
            r[k] = (r.get(k) or "").strip()
        r["domain"] = r["domain"].lower()
    scams = scamcheck.ScamList()
    dropped = collections.Counter()
    examples = collections.defaultdict(list)

    def drop(why, r):
        dropped[why] += 1
        if len(examples[why]) < 15:
            examples[why].append(f'{r["domain"]} ({clean_text(r["name"])[:40]})')
    rows = []
    for r in raw:
        if r["status"] == "ok" or keep_unread(r):
            rows.append(r)
        else:
            drop("page no longer exists or could not be read", r)
    keep = {}
    for r in rows:
        hit = scams.check(r["domain"], r["name"])
        if hit:
            drop("known scam", r)
            continue
        why = junk(r)
        if why:
            drop(why, r)
            continue
        k = dedupe_key(r["domain"])
        if k in keep:
            if score_row(r) <= score_row(keep[k]):
                drop("duplicate site", r)
                continue
            drop("duplicate site", keep[k])
        keep[k] = r
    out, seen_name = [], {}
    for r in keep.values():
        cat = r["category"]
        ci = CAT_KEYS.index(cat)
        name = norm_name(r)
        desc = good_desc(r["description"], name) or good_desc(r["wikidata_description"], name)
        if desc and desc[0].islower():
            desc = desc[0].upper() + desc[1:]
        c, p = country_of(r)
        nk = (re.sub(r"[^a-z0-9]", "", name.lower()), ci)
        if nk[0] and len(nk[0]) > 5 and nk in seen_name:
            prev = seen_name[nk]
            if (bool(desc), r["status"] == "ok") <= (bool(prev["s"]), bool(prev["k"])):
                drop("duplicate name", r)
                continue
            out.remove(prev)
        rv, rs = r["reviews_url"], r["reviews_source"]
        if not rv:   # older CSVs: every entry still gets a reviews link
            q = f'"{name}" site:absolutewrite.com' if cat in ("publishers", "agents") else f'"{name}" reviews'
            rv, rs = "https://duckduckgo.com/?q=" + quote_plus(q), "search (Absolute Write forums)" if cat in ("publishers", "agents") else "search"
        item = {"n": name, "u": r["url"], "d": r["domain"], "c": ci,
                "sv": idx_list(r["services"], SERVICES[cat]), "st": idx_list(r["illustration_styles"], STYLES),
                "au": idx_list(r["audiences"], AUDIENCES), "ww": pick(r["works_with"], WORKS_WITH),
                "sb": pick(r["submission_status"], SUBMISSIONS), "rp": int(r["reading_period"] == "yes"),
                "bm": pick(r["business_model"], BUSINESS), "m": idx_list(r["memberships"], MEMBERSHIPS),
                "pr": pick(r["pricing_info"], PRICING),
                "f": sum(1 << i for i, f in enumerate(FORMATS) if f in r["formats"].split("; ")),
                "r": c, "p": p, "rm": int(r["remote"] == "yes"),
                "l": [x for x in r["languages"].split("; ") if x][:3], "kid": int(r["children_focus"] == "yes" or cat == "illustration"),
                "s": trim(desc), "rv": rv, "rs": pick(rs, REVIEW_SOURCES), "al": r["alli_rating"], "k": int(r["status"] == "ok")}
        item["t"], item["w"] = trust(r, item)
        seen_name[nk] = item
        out.append(item)
    out.sort(key=lambda x: (x["c"], x["n"].lower()))
    order = list(FIELDS)
    data = {"v": 1, "built": datetime.date.today().isoformat(), "source": os.path.basename(SRC), "count": len(out),
            "fields": order, "field_notes": FIELDS, "categories": CAT_LABELS, "category_keys": CAT_KEYS,
            "services": [SERVICES[k] for k in CAT_KEYS], "styles": STYLES, "audiences": AUDIENCES, "memberships": MEMBERSHIPS,
            "works_with": WORKS_WITH, "submissions": SUBMISSIONS, "business_models": BUSINESS, "pricing": PRICING,
            "formats": FORMATS, "review_sources": REVIEW_SOURCES,
            "rows": [[x[k] for k in order] for x in out]}
    os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    C = collections.Counter
    report = {"input_rows": len(raw), "considered": len(rows), "kept": len(out), "dropped": dict(dropped.most_common()),
              "drop_examples": examples, "scam_list_size": scams.total(), "scam_list_counts": scams.counts,
              "writer_beware_list_date": scams.wb_date,
              "category": {CAT_LABELS[k]: v for k, v in C(x["c"] for x in out).most_common()},
              "country_top": dict(C(x["r"] or "?" for x in out).most_common(20)),
              "canada_provinces": dict(C(x["p"] or "?" for x in out if x["r"] == "CA").most_common()),
              "submission_status": {SUBMISSIONS[k] or "unknown": v for k, v in C(x["sb"] for x in out if x["c"] in (0, 1)).most_common()},
              "works_with": {WORKS_WITH[k] or "unknown": v for k, v in C(x["ww"] for x in out).most_common()},
              "pricing": {PRICING[k] or "unknown": v for k, v in C(x["pr"] for x in out).most_common()},
              "memberships": {MEMBERSHIPS[m]: n for m, n in C(m for x in out for m in x["m"]).most_common()},
              "reviews_source": {REVIEW_SOURCES[k]: v for k, v in C(x["rs"] for x in out).most_common()},
              "trust_score": {str(k): v for k, v in sorted(C(x["t"] for x in out).items())},
              "caution_flag": sum(x["w"] for x in out),
              "with_services": sum(1 for x in out if x["sv"]), "with_audiences": sum(1 for x in out if x["au"]),
              "children_focus": sum(1 for x in out if x["kid"]), "remote": sum(1 for x in out if x["rm"]),
              "no_description": sum(1 for x in out if not x["s"]), "described_from_outside_sources": sum(1 for x in out if not x["k"])}
    os.makedirs(os.path.dirname(OUT_REPORT), exist_ok=True)
    json.dump(report, open(OUT_REPORT, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(f"{len(out)} entries written to {os.path.relpath(OUT_JSON, ROOT)} ({os.path.getsize(OUT_JSON) // 1024} KB)")
    print(json.dumps({k: report[k] for k in ("input_rows", "considered", "kept", "dropped", "category", "country_top",
                                              "canada_provinces", "reviews_source")}, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
