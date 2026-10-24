#!/usr/bin/env python3
"""Site-wide SEO pass for amongtheletters.com. Idempotent; run after editing pages or adding archive PDFs:

    python3 scripts/build-glossary.py && python3 scripts/build-seo.py

It (1) sets each page's title, description, canonical, Open Graph and Twitter text,
(2) normalizes shared JSON-LD (Organization with sameAs, WebSite, Periodical) on every page,
(3) rebuilds the archive's ItemList JSON-LD and static issue list from src/lib/archive-content.ts,
(4) adds the Substack RSS link, and (5) regenerates public/sitemap.xml with lastmod dates from git.
"""
import json, re, subprocess, datetime, html
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://amongtheletters.com"
SUBSTACK = "https://amongtheletters.substack.com/"
TAGLINE = "Free stories, poems, and essays worth your afternoon, picked and checked daily, with a different genre each day."
GENRES = {"Monday": "Literary Fiction & Poetry", "Tuesday": "Science Fiction & Fantasy",
          "Wednesday": "Mystery, Thriller, Crime, Horror, & Dark Fiction", "Thursday": "Romance, Women's Fiction, & Historical Fiction",
          "Friday": "Nonfiction, Memoir, Essays, & Narrative Journalism", "Saturday": "Speculative, Hybrid, Experimental, Short, & Flash Fiction",
          "Sunday": "Emerging Writers, Debuts, & Reading Worth Revisiting"}
SAME_AS = [SUBSTACK, "https://substack.com/@amongtheletters", "https://x.com/AmongtheLetters",
           "https://bsky.app/profile/amongtheletters.bsky.social", "https://www.pinterest.com/amongtheletters/"]
PINTEREST_VERIFY = "53d57ce857c26a09cc812d755c34a92a"

ORG = {"@type": "Organization", "@id": f"{SITE}/#organization", "name": "Among The Letters", "url": f"{SITE}/",
       "logo": {"@type": "ImageObject", "url": f"{SITE}/favicon.svg"}, "image": f"{SITE}/images/og/share-v3.png",
       "email": "amongtheletters@gmail.com", "description": "A free daily reading newsletter of stories, poems, and essays, with a different genre each day.",
       "areaServed": "Worldwide", "sameAs": SAME_AS}
WEBSITE = {"@type": "WebSite", "@id": f"{SITE}/#website", "url": f"{SITE}/", "name": "Among The Letters",
           "description": TAGLINE, "inLanguage": "en-CA", "publisher": {"@id": f"{SITE}/#organization"}}
PERIODICAL = {"@type": "Periodical", "@id": f"{SITE}/#newsletter", "additionalType": "https://schema.org/Newsletter",
              "name": "Among The Letters", "alternateName": "Afternoon Discoveries",
              "description": "A free daily reading newsletter: Afternoon Discoveries brings stories, poems, and essays you can read online, picked and checked by hand, with a different genre each day. Paid subscribers also receive a Sunday evening Weekly Discoveries Roundup; readers who write can also get Monday Morning Opportunities.",
              "url": SUBSTACK, "genre": list(GENRES.values()), "inLanguage": "en", "isAccessibleForFree": True,
              "publisher": {"@id": f"{SITE}/#organization"}, "sameAs": [SUBSTACK]}

PAGES = {
  "index.html": dict(url="/", title="Among The Letters | Free Stories, Poems, and Essays, a New Genre Each Day",
     desc="Among The Letters is a free daily reading newsletter: stories, poems, and essays worth your afternoon, picked and checked by hand, with a different genre each day. Plus opportunities and free tools for readers who write.",
     og="Free stories, poems, and essays worth your afternoon, picked and checked daily, with a different genre each day.",
     ogtitle="Among The Letters | A Free Daily Reading Newsletter", extra=[PERIODICAL]),
  "archive/index.html": dict(url="/archive/", title="The Archive: Past Afternoon Discoveries Editions | Among The Letters",
     desc="Browse past Afternoon Discoveries editions from Among The Letters: free stories, poems, and essays from every genre, one edition a day, each available as a PDF.",
     og="Past Afternoon Discoveries editions, one a day across every genre, with links to free stories, poems, and essays. Open any edition as a PDF.",
     ogtitle="The Archive | Among The Letters"),
  "shop/index.html": dict(url="/shop/", title="Shop: Guides for Writers | Among The Letters",
     desc="For readers who also write: two practical PDF guides from Among The Letters, The Opportunity Map and The Submission Desk, sold through Payhip in Canadian dollars.",
     og="For readers who also write: practical PDF guides to finding the right places for your work and sending it out with confidence.",
     ogtitle="Shop | Among The Letters"),
  "resources/index.html": dict(url="/resources/", title="Free Resources for Writers | Among The Letters",
     desc="Free extras for readers who also write: a printable submission tracker, a cover letter template in PDF and Word, a Before You Hit Submit checklist, and a plain-language glossary. No sign-up.",
     og="Free printable tools and a plain-language glossary for readers who also write. No sign-up.",
     ogtitle="Free Resources for Writers | Among The Letters"),
  "upcoming/index.html": dict(url="/upcoming/", title="Upcoming Featured Pieces | Among The Letters",
     desc="See what is coming to the Among The Letters featured shelf: free featured pieces for Canadian holidays and the seasons, with go-live dates for the months ahead.",
     og="The next free featured pieces from Among The Letters, with go-live dates and the occasions they mark.",
     ogtitle="Upcoming Featured | Among The Letters"),
  "resources/glossary/index.html": dict(url="/resources/glossary/", title="A Plain-Language Glossary for Writers | Among The Letters",
     desc=None, og=None, ogtitle=None),
  "404.html": dict(url=None, title="Page Not Found | Among The Letters", desc="This page could not be found. Read today's free stories, poems, and essays from Among The Letters, or browse the archive.", og=None, ogtitle=None),
}

def set_meta(s, attr, key, val):
    pat = re.compile(rf'(<meta {attr}="{re.escape(key)}" content=")[^"]*(" />)')
    v = html.escape(val, quote=True)
    if pat.search(s): return pat.sub(lambda m: m.group(1) + v + m.group(2), s, count=1)
    return s.replace("</title>", "</title>", 1) if False else s.replace("<title>", f'<meta {attr}="{key}" content="{v}" />\n    <title>', 1)

def add_link(s, tag, marker):
    return s if marker in s else s.replace("<title>", tag + "\n    <title>", 1)

def date_label(d):
    dt = datetime.date.fromisoformat(d); return dt.strftime("%A, %B ") + str(dt.day) + dt.strftime(", %Y"), dt.strftime("%A")

def archive_issues():
    src = (ROOT / "src/lib/archive-content.ts").read_text()
    out = []
    for m in re.finditer(r'edition:\s*"Afternoon Discoveries",\s*date:\s*"(\d{4}-\d{2}-\d{2})",\s*pdf:\s*"([^"]+)"', src):
        out.append((m.group(1), m.group(2)))
    return sorted(out, reverse=True)

def fix_graph(graph, page):
    # Replace Organization/WebSite nodes with the shared versions; keep page-specific nodes.
    keep = [n for n in graph if n.get("@type") not in ("Organization", "WebSite", "Newsletter", "Periodical")]
    nodes = [ORG, WEBSITE] + keep + page.get("extra", [])
    for n in nodes:
        if n.get("@type") in ("WebPage", "CollectionPage") and page.get("desc"):
            n["description"] = page["desc"]; n["name"] = page["title"]
    return nodes

def archive_itemlist(issues):
    items = []
    for i, (d, pdf) in enumerate(issues, 1):
        label, wd = date_label(d)
        items.append({"@type": "ListItem", "position": i, "item": {
            "@type": "PublicationIssue", "@id": f"{SITE}{pdf}", "url": f"{SITE}{pdf}", "name": f"Afternoon Discoveries, {label}",
            "datePublished": d, "genre": GENRES[wd], "encodingFormat": "application/pdf", "isAccessibleForFree": True,
            "isPartOf": {"@id": f"{SITE}/#newsletter"}, "publisher": {"@id": f"{SITE}/#organization"}}})
    return items

def process(path, page):
    p = ROOT / path; s = p.read_text()
    s = re.sub(r"<title>.*?</title>", f"<title>{html.escape(page['title'])}</title>", s, count=1, flags=re.S)
    if page.get("desc"):
        s = set_meta(s, "name", "description", page["desc"])
    if page.get("ogtitle"):
        for a, k in (("property", "og:title"), ("name", "twitter:title")): s = set_meta(s, a, k, page["ogtitle"])
    if page.get("og"):
        for a, k in (("property", "og:description"), ("name", "twitter:description")): s = set_meta(s, a, k, page["og"])
    # Minimal CSP that cannot block site assets: upgrade stray http, no plugins, no <base> hijack.
    s = add_link(s, '<meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests; object-src \'none\'; base-uri \'self\'" />', 'Content-Security-Policy')
    s = add_link(s, f'<meta name="p:domain_verify" content="{PINTEREST_VERIFY}"/>', 'p:domain_verify')
    if page.get("url"):
        s = add_link(s, f'<link rel="canonical" href="{SITE}{page["url"]}" />', 'rel="canonical"')
    s = add_link(s, f'<link rel="alternate" type="application/rss+xml" title="Among The Letters on Substack" href="{SUBSTACK}feed" />', 'application/rss+xml')
    s = add_link(s, f'<link rel="alternate" type="text/plain" title="LLM summary" href="{SITE}/llms.txt" />', 'llms.txt"')
    m = re.search(r'(<script type="application/ld\+json">)(.*?)(</script>)', s, re.S)
    if m:
        data = json.loads(m.group(2)); graph = data.get("@graph", [data])
        graph = fix_graph(graph, page)
        if path == "archive/index.html":
            issues = archive_issues()
            for n in graph:
                if n.get("@type") == "ItemList":
                    n["itemListElement"] = archive_itemlist(issues); n["numberOfItems"] = len(issues)
                    n["description"] = "Past Afternoon Discoveries editions, newest first, each with its date and the day's genre."
            graph.append(PERIODICAL) if not any(n.get("@id") == PERIODICAL["@id"] for n in graph) else None
        data = {"@context": "https://schema.org", "@graph": graph}
        s = s[:m.start(2)] + "\n" + json.dumps(data, indent=2, ensure_ascii=False) + "\n    " + s[m.end(2):]
    if path == "archive/index.html":
        lis = "\n".join(f'            <li><a href="{pdf}">Afternoon Discoveries, {html.escape(date_label(d)[0])}</a> ({html.escape(GENRES[date_label(d)[1]])})</li>' for d, pdf in archive_issues())
        s = re.sub(r'(<h2 id="issues-heading">[^<]*</h2>\s*<ul>\n).*?(\n\s*</ul>)', lambda mm: mm.group(1) + lis + mm.group(2), s, count=1, flags=re.S)
    p.write_text(s)

def git_date(rel):
    try:
        out = subprocess.run(["git", "log", "-1", "--format=%cs", "--", rel], cwd=ROOT, capture_output=True, text=True).stdout.strip()
        return out or datetime.date.today().isoformat()
    except Exception:
        return datetime.date.today().isoformat()

def sitemap():
    today = datetime.date.today().isoformat()
    def lm(*rels):
        ds = [git_date(r) for r in rels]
        dirty = subprocess.run(["git", "status", "--porcelain", "--", *rels], cwd=ROOT, capture_output=True, text=True).stdout.strip()
        return today if dirty else max(ds)
    pages = [("/", ["index.html", "src/App.tsx", "src/lib/site-content.ts", "src/components/landing"], "1.0"),
             ("/archive/", ["archive/index.html", "src/ArchiveApp.tsx", "src/lib/archive-content.ts"], "0.9"),
             ("/resources/", ["resources/index.html", "src/ResourcesApp.tsx", "src/lib/resources-content.ts"], "0.7"),
             ("/resources/glossary/", ["resources/glossary/index.html", "src/lib/glossary.json"], "0.7"),
             ("/shop/", ["shop/index.html", "src/ShopApp.tsx", "src/lib/shop-content.ts"], "0.6"),
             ("/upcoming/", ["upcoming/index.html", "src/UpcomingApp.tsx", "src/lib/featured-schedule.ts"], "0.6")]
    urls = [(SITE + u, lm(*r), pr) for u, r, pr in pages]
    for f in sorted((ROOT / "public/resources").glob("*")):
        urls.append((f"{SITE}/resources/{f.name}", lm(f"public/resources/{f.name}"), "0.4"))
    for d, pdf in archive_issues():
        urls.append((SITE + pdf, lm("public" + pdf), "0.5"))
    for f in sorted((ROOT / "public/featured").glob("*.pdf")):
        urls.append((f"{SITE}/featured/{f.name}", lm(f"public/featured/{f.name}"), "0.6"))
    body = "\n".join(f"  <url>\n    <loc>{u}</loc>\n    <lastmod>{d}</lastmod>\n    <priority>{p}</priority>\n  </url>" for u, d, p in urls)
    (ROOT / "public/sitemap.xml").write_text(f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{body}\n</urlset>\n')
    return len(urls)

if __name__ == "__main__":
    for path, page in PAGES.items():
        if (ROOT / path).exists(): process(path, page)
    print("sitemap urls:", sitemap(), "| archive issues:", len(archive_issues()))
