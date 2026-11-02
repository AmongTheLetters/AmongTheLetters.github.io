"""Quick self-checks for crawl.py (no internet needed except DNS). Run: python test_crawl.py"""
import http.server, os, socketserver, tempfile, threading
import crawl


def test_robots_and_fetch():
    class H(http.server.SimpleHTTPRequestHandler):
        def do_GET(self):
            if self.path == "/robots.txt":
                body = b"User-agent: *\nDisallow: /private\n"
            elif self.path == "/old":
                self.send_response(301); self.send_header("Location", "/private/x"); self.end_headers(); return
            else:
                body = b"<html><head><title>T</title><meta name='description' content='A free online poetry journal'></head><body>read online poems</body></html>"
            self.send_response(200)
            self.send_header("Content-Type", "text/plain" if self.path == "/robots.txt" else "text/html")
            self.end_headers(); self.wfile.write(body)
        def log_message(self, *a): pass
    srv = socketserver.TCPServer(("127.0.0.1", 0), H); port = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{port}"
    assert crawl.fetch_html(base + "/private/a")[1] == "robots"
    assert crawl.fetch_html(base + "/old")[1] == "robots", "redirect into a disallowed path must not be fetched"
    res, st = crawl.fetch_html(base + "/")
    assert st == "ok" and b"poetry" in res[1]
    row = crawl.profile({"domain": "127.0.0.1", "url": base + "/"}, "ok")
    assert row["status"] == "ok" and row["access"] == "free", row
    srv.shutdown()


def test_dns_dead():
    import socket
    try:
        fake = socket.getaddrinfo("no-such-host-atl-check.invalid", 443)[0][4][0].startswith("198.18.")
    except socket.gaierror:
        fake = False
    if fake:
        print("     (this network answers every name, so the address check is skipped here)")
        return
    assert crawl.dns_status("no-such-host-atl-check.invalid") == "dead"
    r = crawl.profile({"domain": "x.invalid", "url": "http://x.invalid/"}, "dead")
    assert r["status"] == "dns"


def test_judge_and_merge():
    assert crawl.judge([("Wikidata", "online literary magazine")])[0] == "free"
    assert crawl.judge([("Wikidata", "independent bookstore in Halifax")])[0] == "paid"
    assert crawl.judge([("x", "")])[0] == "unconfirmed"
    r = crawl.merge_row({"domain": "a.ca", "status": "robots", "access": "unknown"}, None, {})
    assert r["access"] == "unconfirmed" and r["access_label"] == "Access not yet confirmed"
    r = crawl.merge_row({"domain": "a.ca", "status": "robots", "access": "unknown"},
                        {"access": "free", "access_evidence": "Wikidata: 'open access'"}, {})
    assert r["access"] == "free" and "Wikidata" in r["access_evidence"]


def test_env_and_queries():
    d = tempfile.mkdtemp(); p = os.path.join(d, ".env")
    open(p, "w").write("# c\nATL_TEST_KEY = 'abc'\nEMPTY=\n")
    crawl.load_env(p)
    assert crawl.env("ATL_TEST_KEY") == "abc" and crawl.env("EMPTY") == ""
    q = crawl.parse_queries(os.path.join(crawl.HERE, "queries.txt"))
    assert len(q) > 500 and len({x for x, _ in q}) == len(q)


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn(); print("ok  ", name)
    print("All checks passed.")
