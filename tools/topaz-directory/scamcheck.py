"""Known-scam filter for the Topaz Pages. Pure Python, shared by crawl.py and build_site_data.py.

Sources
  known_scams.txt                         our own short list, with a public source for every line
  output/scam_sources/writerbeware.json   Writer Beware's current scam list, downloaded by crawl.py on the
                                          computer that runs it (never committed, never published)
  scam_safelist.txt                       legitimate businesses that share a name with a scam

An entry is dropped when
  - its domain (or a parent domain) is a known scam domain, or
  - its name, or any part of a "Name | Tagline" style title, equals a known scam name, or
  - its web address spells a known scam name exactly (writersrepublic.com -> "Writers Republic"), names of 8+ letters only
unless its domain is on the safelist (then only an exact scam-domain match drops it).
"""
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
WB_CACHE = os.path.join(HERE, "output", "scam_sources", "writerbeware.json")
WB_URL = "https://writerbeware.blog/scam-archive/"
FREEMAIL = {"gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "aol.com", "icloud.com", "proton.me", "protonmail.com"}
SUFFIX = re.compile(r"\b(llc|l\.l\.c|inc|ltd|limited|corp|corporation|co|opc|plc|pty|the|company)\b\.?", re.I)


def norm(name):
    s = (name or "").lower().replace("&", " and ").replace("’", "'")
    s = SUFFIX.sub(" ", s)
    s = re.sub(r"[^a-z0-9]+", "", s)
    return s


def domain_core(domain):
    labels = [x for x in (domain or "").lower().split(".") if x not in ("www", "m")]
    if len(labels) >= 3 and labels[-2] in ("co", "com", "org", "net", "ac"):
        labels = labels[:-2]
    elif len(labels) >= 2:
        labels = labels[:-1]
    return re.sub(r"[^a-z0-9]", "", "".join(labels[-1:]))


def parse_writerbeware(html):
    """Writer Beware scam archive page -> {"names": [...], "domains": [...], "ambiguous": [...]}.
    Uses BeautifulSoup when available, else a plain regex pass."""
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "html.parser")
        for br in soup.find_all("br"):
            br.replace_with("\n")
        main = soup.find("article") or soup.find("main") or soup
        blocks = []
        for el in main.find_all(["p", "li", "h2", "h3", "h4"]):
            blocks.append((el.get_text(""), [a.get_text(" ", strip=True) for a in el.find_all("a")]))
    except ImportError:
        txt = re.sub(r"<br\s*/?>", "\n", html, flags=re.I)
        txt = re.sub(r"<[^>]+>", "", txt).replace("&#8211;", "\u2013").replace("&amp;", "&")
        blocks = [(txt, [])]
    names, domains, ambiguous = set(), set(), set()
    started = False
    for text, anchors in blocks:
        for raw in text.split("\n"):
            line = raw.strip()
            if "SCAM EMAIL ADDRESSES" in line:
                started = True
            if not started or not line.startswith(("\u2013", "-")):
                continue
            line = line.lstrip("\u2013- ").strip()
            for m in re.finditer(r"@([a-z0-9.-]+\.[a-z]{2,})", line, re.I):
                d = m.group(1).lower().strip(".")
                if d not in FREEMAIL:
                    domains.add(d)
            if "@" in line:
                continue
            line = line.replace("[", "(").replace("]", ")")
            line = re.sub(r",?\s+aka\s+", " / ", line) if "(" not in line else line
            conf = re.search(r"[(\u2013-]\s*not to be confused with([^)]*)\)?", line, re.I)
            if conf:
                for a in anchors:
                    if a and a in raw:
                        ambiguous.add(norm(a))
                tail = re.sub(r"^(the )?(similarly-named|talent management firm|a real agency.*)", "", conf.group(1).strip(" ,."), flags=re.I)
                ambiguous.add(norm(tail.split(",")[0]))
                line = line[:conf.start()]
            parts = [line]
            for inner in re.findall(r"\(([^)]*)\)?", line):
                parts.append(re.sub(r"^(aka|aa|see( see)?|formerly|also|dba of|dba)\s+", "", inner.strip(), flags=re.I))
            base = re.sub(r"\(.*", "", line)
            parts[0] = base
            for p in parts:
                for n in re.split(r"\s+/\s+|\s*/\s*(?=[A-Z])|,\s*aka\s+|-\s+(?=[A-Z])", p):
                    n = re.sub(r"\s*\(.*$", "", n)
                    n = re.sub(r"\b(defunct)\b", "", n, flags=re.I).strip(" ,.;")
                    n = re.sub(r",\s*the$", "", n, flags=re.I)
                    if len(norm(n)) >= 4:
                        names.add(n)
    return {"names": sorted(names), "domains": sorted(domains), "ambiguous": sorted(a for a in ambiguous if a)}


class ScamList:
    def __init__(self, wb=None):
        self.names, self.domains, self.sources, self.safe, self.ambiguous = {}, {}, {}, set(), set()
        self.counts = {"known_scams.txt": 0, "writer_beware": 0}
        self._load_known()
        self._load_safe()
        if wb is None and os.path.exists(WB_CACHE):
            try:
                wb = json.load(open(WB_CACHE, encoding="utf-8"))
            except Exception:
                wb = None
        if wb:
            self.ambiguous |= set(wb.get("ambiguous", []))
            for n in wb.get("names", []):
                k = norm(n)
                if k and k not in self.ambiguous and k not in self.names:
                    self.names[k] = (n, "Writer Beware scam list")
                    self.counts["writer_beware"] += 1
            for d in wb.get("domains", []):
                self.domains.setdefault(d, ("@" + d, "Writer Beware scam list (email domain)"))
                self.counts["writer_beware"] += 1
        self.wb_date = (wb or {}).get("fetched", "")

    def _load_known(self):
        p = os.path.join(HERE, "known_scams.txt")
        for raw in open(p, encoding="utf-8") if os.path.exists(p) else []:
            line = raw.split(" #")[0].strip()
            if not line or line.startswith("#"):
                continue
            bits = [b.strip() for b in line.split("|")]
            name, dom, src = (bits + ["", "", ""])[:3]
            if name:
                self.names[norm(name)] = (name, src or "known_scams.txt")
            if dom:
                self.domains[dom.lower()] = (name or dom, src or "known_scams.txt")
            self.counts["known_scams.txt"] += 1

    def _load_safe(self):
        p = os.path.join(HERE, "scam_safelist.txt")
        for raw in open(p, encoding="utf-8") if os.path.exists(p) else []:
            line = raw.split("#")[0].strip().lower()
            if line:
                self.safe.add(line[4:] if line.startswith("www.") else line)

    def total(self):
        return len(self.names) + len(self.domains)

    def check(self, domain, name=""):
        """Returns (matched_name, source, how) or None."""
        d = (domain or "").lower()
        parts = d.split(".")
        for i in range(len(parts) - 1):
            sub = ".".join(parts[i:])
            if sub in self.domains:
                n, s = self.domains[sub]
                return n, s, "domain"
        if d in self.safe or any(d.endswith("." + s) for s in self.safe):
            return None
        segs = [name] + re.split(r"\s+[|\u2013\u2014:\-·•]+\s+|\s*\|\s*", name or "")
        for seg in segs:
            k = norm(seg)
            if k in self.names:
                n, s = self.names[k]
                return n, s, "name"
        core = domain_core(d)
        if len(core) >= 8 and core in self.names:
            n, s = self.names[core]
            return n, s, "web address spells the name"
        return None
