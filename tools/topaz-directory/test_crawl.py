"""Quick self-checks for the Topaz Pages crawler (no internet needed). Run: python test_crawl.py"""
import http.server, os, socketserver, tempfile, threading
import crawl, scamcheck, taxonomy as tx

PAGES = {
    "/robots.txt": "User-agent: *\nDisallow: /private\n",
    "/": "<html lang='en-CA'><head><title>Maple Edits</title><meta name='description' content='Book editing for indie authors'></head>"
         "<body><a href='/services'>Our services</a> <a href='/private/x'>members</a> "
         "<a href='https://www.trustpilot.com/review/mapleedits.ca'>Read our reviews</a>"
         "<p>Maple Edits, 12 Main St, Halifax, NS B3H 1A1</p></body></html>",
    "/services": "<html><body>Developmental editing, copy editing and proofreading for self-published authors. "
                 "Rates start at $0.03 per word. Member of Editors Canada. We work with clients around the world. "
                 "Picture books, middle grade and young adult.</body></html>",
    "/dir": "<html><body><a href='/dir/p1'>One</a> <a href='/dir/p2'>Two</a> <a href='https://footer-sponsor.example/'>sponsor</a>"
            "<a href='/dir?page=2' rel='next'>Next</a></body></html>",
    "/dir?page=2": "<html><body><a href='/dir/p3'>Three</a> <a href='https://footer-sponsor.example/'>sponsor</a></body></html>",
    "/dir/p1": "<html><body><h1>Press One</h1><a href='https://footer-sponsor.example/'>s</a> <a href='https://pressone.example/about'>web</a></body></html>",
    "/dir/p2": "<html><body><h1>Press Two</h1><a href='https://facebook.com/x'>fb</a> <a href='http://presstwo.example/'>site</a></body></html>",
    "/dir/p3": "<html><body><h1>Press Three</h1>no website</body></html>",
}


def server():
    class H(http.server.SimpleHTTPRequestHandler):
        def do_GET(self):
            if self.path == "/old":
                self.send_response(301); self.send_header("Location", "/private/x"); self.end_headers(); return
            body = PAGES.get(self.path)
            if body is None:
                self.send_response(404); self.end_headers(); return
            self.send_response(200)
            self.send_header("Content-Type", "text/plain" if self.path == "/robots.txt" else "text/html")
            self.end_headers(); self.wfile.write(body.encode())
        def log_message(self, *a): pass
    srv = socketserver.TCPServer(("127.0.0.1", 0), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f"http://127.0.0.1:{srv.server_address[1]}"


def test_robots_and_profile():
    srv, base = server()
    assert crawl.fetch_html(base + "/private/a")[1] == "robots"
    assert crawl.fetch_html(base + "/old")[1] == "robots", "a redirect into a disallowed path must not be fetched"
    row = crawl.profile({"domain": "127.0.0.1", "url": base + "/", "hint": "editors"}, "ok")
    assert row["status"] == "ok" and row["category"] == "editors", row
    assert "Developmental editing" in row["services"] and "Proofreading" in row["services"], row["services"]
    assert row["works_with"] == "self-publishing authors" and row["pricing_info"] == "Published rates", row
    assert "Editors Canada" in row["memberships"] and row["remote"] == "yes", row
    assert row["addr_country"] == "CA" and row["addr_region"] == "NS", row
    assert row["reviews_source"] == "Trustpilot" and "trustpilot.com/review/" in row["reviews_url"], row
    assert "Middle grade" in row["audiences"] and row["pages_read"] == 2, row
    srv.shutdown()


def test_follow_profiles():
    srv, base = server()
    crawl.OUT = tempfile.mkdtemp()
    crawl.CAND = os.path.join(crawl.OUT, "c.jsonl"); crawl.FOLLOWED = os.path.join(crawl.OUT, "f.jsonl")
    crawl.FOLLOWED_CACHE[:] = [crawl.Followed()]
    col = crawl.Collector()
    n = crawl.seed_page(base + "/dir", col, "publishers", {"pages": "3", "follow": r"^/dir/p\d$", "member": "LPG"})
    assert n == 2 and col.seen == {"pressone.example", "presstwo.example"}, col.seen
    c = crawl.load_candidates()
    assert c["pressone.example"]["name"] == "Press One" and c["pressone.example"]["members"] == ["LPG"]
    crawl.FOLLOWED_CACHE[:] = [crawl.Followed()]
    assert len(crawl.FOLLOWED_CACHE[0].done) == 3, "profile pages are remembered for the next run"
    srv.shutdown()


def test_scam_filter():
    html = ("<article><h2>SCAM EMAIL ADDRESSES</h2><p>&#8211; @fakeagent.example<br>&#8211; someone@gmail.com</p>"
            "<p>&#8211; Moonbeam Literary House (aka Starlit Press and Media / Quill Ridge Books)<br>"
            "&#8211; Real Name Agency (not to be confused with <a href='x'>Real Name Agency</a>, a real agency)<br>"
            "&#8211; Lit House</p></article>")
    wb = scamcheck.parse_writerbeware(html)
    assert "fakeagent.example" in wb["domains"] and "gmail.com" not in wb["domains"], wb
    s = scamcheck.ScamList(wb)
    assert s.check("moonbeamliteraryhouse.com", "")[2] == "web address spells the name"
    assert s.check("example.org", "Starlit Press and Media | Publishing")[2] == "name"
    assert s.check("mail.fakeagent.example", "")[2] == "domain"
    assert s.check("realnameagency.com", "Real Name Agency") is None, "a real business sharing the name stays"
    assert s.check("lithub.com", "Lit Hub") is None, "safelisted domains are never dropped by name"
    assert s.check("xlibris.com", "Xlibris") is not None, "known_scams.txt is always loaded"
    assert s.check("penguinrandomhouse.com", "Penguin Random House") is None


def test_taxonomy():
    assert tx.guess_category("agents", "we represent authors of literary fiction. query letters welcome") == "agents"
    t = tx.tags("publishers", " we do not accept unsolicited manuscripts. our authors include ... picture books ")
    assert t["submission_status"] == "Agented only", t
    t = tx.tags("publishers", " we are open to submissions from unagented authors. reading period runs in march ")
    assert t["submission_status"] == "Open to unagented" and t["reading_period"] == "yes", t
    assert tx.tags("illustration", " watercolour and gouache picture book art ")["illustration_styles"] == "Watercolour; Gouache"


def test_reviews_fallback_and_seeds():
    r = crawl.merge_row({"domain": "x.ca", "url": "https://x.ca/", "name": "X Press", "category": "publishers",
                         "status": "robots"}, None, {}, {})
    assert r["reviews_source"].startswith("search") and "absolutewrite" in r["reviews_url"], r
    assert r["country"] == "CA" and r["writer_beware_check_url"].endswith("X+Press")
    r = crawl.merge_row({"domain": "y.com", "url": "https://y.com/", "name": "Y Design", "category": "design",
                         "status": "ok"}, None, {}, {"y.com": {"profile": "https://alli.example/y", "rating": "Recommended"}})
    assert r["reviews_source"] == "ALLi service rating" and r["alli_rating"] == "Recommended"
    seeds = crawl.parse_seeds(os.path.join(crawl.HERE, "seeds.txt"))
    assert len(seeds) > 150 and len({s[0] for s in seeds}) == len(seeds)
    assert {s[3] for s in seeds} >= set(tx.CAT_KEYS)
    q = crawl.parse_queries(os.path.join(crawl.HERE, "queries.txt"))
    assert len(q) > 1000 and len({x for x, _ in q}) == len(q)


def test_env():
    d = tempfile.mkdtemp(); p = os.path.join(d, ".env")
    open(p, "w").write("# c\nATL_TOPAZ_TEST = 'abc'\nEMPTY=\n")
    crawl.load_env(p)
    assert crawl.env("ATL_TOPAZ_TEST") == "abc" and crawl.env("EMPTY") == ""


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn(); print("ok  ", name)
    print("All checks passed.")
