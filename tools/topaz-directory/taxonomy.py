"""Topaz Pages taxonomy: categories, service tags and the keyword rules that read them.

Shared by crawl.py and build_site_data.py. Pure Python, no installs needed.
Every tag comes from public wording on a site's own pages (or a listing that points to it).
A tag is only set when its words actually appear, otherwise the field stays blank.
"""
import re

# ------------------------------------------------------------------ categories
CATEGORIES = [
    ("publishers", "Publishers & Presses"),
    ("agents", "Literary Agents"),
    ("editors", "Editors & Proofreaders"),
    ("design", "Cover & Interior Design"),
    ("illustration", "Picture Book & Children's Illustration"),
    ("production", "Printing, Audiobooks, ISBNs & Distribution"),
]
CAT_KEYS = [k for k, _ in CATEGORIES]
CAT_LABEL = dict(CATEGORIES)


def rx(words):
    """A list of phrases -> one case-insensitive regex with word edges."""
    return re.compile(r"(?<![a-z0-9])(" + "|".join(words) + r")(?![a-z0-9])", re.I)


# Signals that a site is mainly a given kind of service (used with the seed's category hint).
CAT_SIGNALS = {
    "publishers": rx([r"publish(er|ers|ing house|ing company)", r"small press", r"(university|independent|indie|literary) press",
                      r"our (authors|books|catalogue|catalog|list)", r"imprint", r"forthcoming (titles|books)", r"new releases",
                      r"[ée]ditions?", r"maison d'[ée]dition", r"[ée]diteur"]),
    "agents": rx([r"literary (agency|agent|agents|management)", r"authors'? (agent|agents|representation)", r"our clients",
                  r"query letters?", r"queries", r"we represent", r"literary representation", r"agence litt[ée]raire"]),
    "editors": rx([r"(developmental|structural|substantive|line|stylistic|copy|copy-) ?edit(ing|or|s)?", r"proofread(ing|er|ers)?",
                   r"manuscript (assessment|critique|evaluation|review)", r"book editor", r"freelance editor", r"editorial services",
                   r"r[ée]vision linguistique", r"correct(ion|rice|eur)"]),
    "design": rx([r"(book )?cover design(s|er|ers)?", r"interior (design|layout|formatting)", r"typesetting", r"book design(er|ers)?",
                  r"ebook formatting", r"book formatting", r"premade covers?", r"book layout", r"mise en page"]),
    "illustration": rx([r"illustrat(or|ors|ion|ions)", r"picture books?", r"children'?s book (art|artist|illustration)",
                        r"art (rep|reps|representation|agency)", r"portfolio"]),
    "production": rx([r"book print(ing|er|ers)", r"print on demand", r"offset print(ing)?", r"short[- ]run", r"audiobook(s)?",
                      r"narrat(or|ors|ion)", r"isbn", r"distribut(ion|or|ors)", r"aggregator", r"wholesale", r"fulfil(l)?ment",
                      r"ebook distribution", r"self-publishing platform", r"imprimerie", r"livre audio"]),
}

# ------------------------------------------------------------------ service tags (subcategories), per category
SERVICES = {
    "publishers": [
        ("Small press", [r"small press", r"independent press", r"indie press", r"micro ?press"]),
        ("Independent publisher", [r"independent publish(er|ing)", r"independently owned"]),
        ("University press", [r"university press", r"presses de l'universit[ée]", r"academic press"]),
        ("Children's publisher", [r"children'?s (books|publisher|publishing|literature)", r"picture books", r"young readers", r"kids'? books"]),
        ("Poetry press", [r"poetry (press|publisher|collections|chapbooks)", r"chapbooks?"]),
        ("Comics and graphic novels", [r"graphic novels?", r"comics? publisher", r"comic books?", r"bande dessin[ée]e"]),
        ("Literary press", [r"literary (press|publisher|fiction|nonfiction)"]),
        ("Hybrid publisher", [r"hybrid publish(er|ing)"]),
        ("Self-publishing services", [r"self-publishing (services|company|packages|solutions)", r"publishing packages", r"author services",
                                      r"assisted self-publishing", r"publish your (own )?book"]),
        ("French-language publisher", [r"maison d'[ée]dition", r"[ée]diteur (qu[ée]b[ée]cois|franco)", r"[ée]ditions"]),
        ("Trade publisher", [r"trade (publisher|books|paperback)", r"bestsell(ing|er) (authors|titles)"]),
    ],
    "agents": [
        ("Literary agency", [r"literary (agency|agencies|management)", r"agence litt[ée]raire"]),
        ("Children's and YA agents", [r"picture books?", r"middle grade", r"young adult", r"kidlit", r"children'?s (books|authors)"]),
        ("Film and TV rights", [r"film (and|&) (tv|television)", r"dramatic rights", r"screen rights"]),
        ("Foreign rights", [r"foreign rights", r"translation rights", r"international rights"]),
        ("Illustrator representation", [r"represent(s|ing)? illustrators", r"author-illustrators?", r"illustrator clients"]),
    ],
    "editors": [
        ("Developmental editing", [r"developmental edit(ing|or|s)?", r"structural edit(ing|or|s)?", r"substantive edit(ing|or|s)?", r"story edit(ing|or)"]),
        ("Line editing", [r"line edit(ing|or|s)?", r"stylistic edit(ing|or|s)?"]),
        ("Copy editing", [r"copy ?edit(ing|or|ors|s)?", r"copy-edit(ing|or|s)?"]),
        ("Proofreading", [r"proofread(ing|er|ers)?", r"correction d'[ée]preuves"]),
        ("Manuscript assessment", [r"manuscript (assessment|critique|evaluation|review)s?", r"editorial (assessment|letter)s?", r"beta read(ing|er)"]),
        ("Sensitivity reading", [r"sensitivity read(ing|er|ers)?", r"authenticity read(ing|er|ers)?", r"cultural accuracy"]),
        ("Fact-checking", [r"fact[- ]check(ing|er|ers)?"]),
        ("Indexing", [r"index(ing|er|ers)", r"back-of-book index"]),
        ("Book coaching", [r"book coach(ing|es)?", r"writing coach(ing|es)?", r"author coach(ing)?"]),
        ("Query and synopsis help", [r"query (letter|package) (critique|review|edit)", r"synopsis (critique|edit|review)"]),
        ("Ghostwriting", [r"ghostwrit(ing|er|ers)"]),
        ("Translation", [r"translat(ion|or|ors|ing) services?", r"literary translat(ion|or|ors)", r"traduction"]),
    ],
    "design": [
        ("Cover design", [r"cover design(s|er|ers)?", r"book covers?", r"custom covers?", r"conception de couverture"]),
        ("Premade covers", [r"pre-?made (book )?covers?"]),
        ("Interior design and typesetting", [r"interior (design|layout)", r"typesetting", r"book layout", r"page layout", r"mise en page"]),
        ("Ebook formatting", [r"e-?book (formatting|conversion|design)", r"epub (conversion|formatting)", r"kindle formatting"]),
        ("Print formatting", [r"print (formatting|ready|layout)", r"paperback formatting"]),
        ("Audiobook covers", [r"audiobook covers?"]),
        ("Maps and diagrams", [r"map (design|making|illustration)", r"fantasy maps?", r"cartograph(y|er)"]),
        ("Accessible ebooks", [r"accessible (e-?books?|epub)", r"born accessible"]),
    ],
    "illustration": [
        ("Picture book illustration", [r"picture book (illustration|illustrator|art)", r"picture books?"]),
        ("Chapter book and middle grade art", [r"chapter books?", r"middle grade"]),
        ("Cover illustration", [r"cover (illustration|art)", r"book cover art"]),
        ("Board books", [r"board books?"]),
        ("Educational illustration", [r"educational (illustration|publishing|materials)"]),
        ("Illustration agency or rep", [r"illustration agency", r"art (rep|reps|representative|representation)", r"artists'? agent", r"we represent"]),
        ("Character design", [r"character design"]),
        ("Comics and graphic novel art", [r"graphic novels?", r"comics? art(ist)?", r"sequential art"]),
    ],
    "production": [
        ("Offset printing", [r"offset print(ing|er)?"]),
        ("Print on demand", [r"print[- ]on[- ]demand", r"\bpod\b"]),
        ("Short-run printing", [r"short[- ]run", r"small (print )?runs?", r"digital printing"]),
        ("Audiobook production", [r"audiobook production", r"audio production", r"produce (your )?audiobooks?", r"recording studio"]),
        ("Narration", [r"narrat(or|ors|ion)", r"voice (actor|actors|talent)", r"audiobook narrators?"]),
        ("Audiobook distribution", [r"audiobook distribution", r"distribute (your )?audiobooks?"]),
        ("ISBN agency", [r"isbn (agency|agence|service|services)", r"assign(s|ing)? isbns?", r"isbns? (are|is) free", r"buy isbns?", r"get an isbn"]),
        ("Ebook distribution", [r"e-?book distribution", r"distribute (your )?e-?books?", r"e-?book aggregator", r"publish (your )?e-?books? to"]),
        ("Print distribution and wholesale", [r"wholesale", r"distribut(e|ion|or) to (bookstores|libraries|retailers)", r"trade distribution",
                                              r"sales and distribution", r"book distribut(or|ion)"]),
        ("Fulfilment and warehousing", [r"fulfil(l)?ment", r"warehous(e|ing)"]),
        ("Self-publishing platform", [r"self-publishing platform", r"upload your (book|manuscript)", r"publish for free"]),
        ("Library distribution", [r"library distribution", r"distribute to libraries", r"overdrive", r"hoopla"]),
    ],
}
SERVICES_RX = {cat: [(name, rx(words)) for name, words in items] for cat, items in SERVICES.items()}

ILLUSTRATION_STYLES = [
    ("Watercolour", [r"watercolou?r"]), ("Gouache", [r"gouache"]), ("Acrylic", [r"acrylics?"]), ("Oil", [r"oil paint(ing|s)?"]),
    ("Digital", [r"digital (art|illustration|painting)", r"procreate", r"photoshop"]), ("Pencil and graphite", [r"pencil", r"graphite", r"charcoal"]),
    ("Ink", [r"pen and ink", r"ink (drawing|illustration)s?"]), ("Collage", [r"collage"]), ("Mixed media", [r"mixed[- ]media"]),
    ("Vector", [r"vector"]), ("3D", [r"3d (art|illustration|modell?ing)"]), ("Cartoon", [r"cartoon(s|ing)?", r"whimsical"]),
    ("Realistic", [r"realistic", r"realism"]), ("Linocut and printmaking", [r"linocut", r"printmaking", r"woodcut"]),
]
STYLES_RX = [(n, rx(w)) for n, w in ILLUSTRATION_STYLES]

AUDIENCES = [
    ("Picture books", [r"picture books?"]), ("Board books", [r"board books?"]), ("Early readers", [r"early readers?", r"easy readers?", r"beginning readers?"]),
    ("Chapter books", [r"chapter books?"]), ("Middle grade", [r"middle[- ]grade"]), ("Young adult", [r"young adult", r"\bya (fiction|novels?|books?)"]),
    ("Adult fiction", [r"adult fiction", r"commercial fiction", r"upmarket fiction", r"women'?s fiction", r"book club fiction"]),
    ("Literary fiction", [r"literary fiction"]), ("Romance", [r"romance"]),
    ("Science fiction and fantasy", [r"science fiction", r"sci-fi", r"fantasy", r"speculative fiction"]),
    ("Mystery and thriller", [r"myster(y|ies)", r"thrillers?", r"crime fiction", r"suspense"]), ("Horror", [r"horror"]),
    ("Historical fiction", [r"historical fiction"]), ("Short stories", [r"short stor(y|ies)", r"short fiction"]),
    ("Nonfiction", [r"non-?fiction", r"narrative nonfiction"]), ("Memoir", [r"memoirs?"]), ("Poetry", [r"poetry", r"poems"]),
    ("Graphic novels and comics", [r"graphic novels?", r"comics"]), ("Academic and scholarly", [r"academic", r"scholarly", r"peer[- ]reviewed"]),
    ("Faith and inspirational", [r"christian (books|fiction|publish\w*)", r"faith-based", r"inspirational"]),
    ("Cookbooks", [r"cookbooks?"]), ("Business and self-help", [r"self-help", r"business books?", r"personal development"]),
    ("Indigenous voices", [r"indigenous (authors|writers|voices|stories|publish\w*)", r"first nations", r"m[ée]tis", r"inuit"]),
    ("LGBTQ+", [r"lgbtq\+?", r"2slgbtq\w*", r"queer (authors|writers|books|fiction|voices|stories)"]),
    ("French-language", [r"livres? en fran[cç]ais", r"french-language", r"litt[ée]rature (qu[ée]b[ée]coise|franco)"]),
]
AUDIENCES_RX = [(n, rx(w)) for n, w in AUDIENCES]

WORKS_WITH = {
    "self-publishing authors": rx([r"self-publish(ing|ed)? authors?", r"indie authors?", r"independent authors?", r"self-publishers?",
                                   r"self-published (books?|authors?)", r"authors who self-publish", r"auteurs? autonomes?"]),
    "publishers": rx([r"(for|with|clients include|our clients|working with) (major |traditional |trade |independent )?publish(ers|ing houses)",
                      r"traditional publishers?", r"publishing houses?", r"in-house (editor|designer)", r"publisher clients",
                      r"(penguin|harpercollins|simon (&|and) schuster|hachette|macmillan|scholastic|random house)"]),
}

# Submission status, for publishers and agents. Checked in this order, first match wins.
SUBMISSIONS = [
    ("Agented only", rx([r"agented submissions only", r"only (accept|consider)s? (agented|submissions (from|through) (a |an )?(literary )?agents?)",
                         r"(do|does) not (accept|consider|review) unsolicited", r"no unsolicited (manuscripts|submissions)",
                         r"unsolicited (manuscripts|submissions) (are|will) not", r"submissions (only )?through (a |an )?(literary )?agent"])),
    ("Closed", rx([r"(closed|not open) to (new )?(submissions|queries)", r"not (currently )?accepting (new )?(submissions|queries|clients|manuscripts)",
                   r"submissions are (currently |now )?closed", r"queries are (currently |now )?closed", r"(currently|temporarily) closed to"])),
    ("Open to unagented", rx([r"(accept|accepts|accepting|consider|considers|welcome|welcomes) (unagented|unsolicited) (manuscripts|submissions|work|authors)",
                              r"(open|opens) (to|for) (submissions|queries|unagented)", r"(now|currently) accepting (submissions|queries|manuscripts)",
                              r"submissions are (now |currently )?open", r"queries are (now |currently )?open", r"open to queries",
                              r"we (are|'re) (now |currently )?(open|accepting)", r"submit (your|a) (manuscript|proposal|query)",
                              r"submission guidelines", r"query guidelines", r"how to (submit|query)"])),
]
READING_PERIOD = rx([r"reading periods?", r"submission (window|period)s?", r"open (for|to) submissions (from|in|between|during)",
                     r"submissions (are )?open (from|in|between|during|each)"])

BUSINESS_MODEL = [
    ("Hybrid", rx([r"hybrid publish(er|ing)"])),
    ("Author-paid services", rx([r"self-publishing (services|packages|company)", r"publishing packages", r"assisted self-publishing",
                                 r"author-funded", r"author investment", r"pay to publish", r"packages (start|starting) at"])),
    ("Traditional", rx([r"(we )?pay (an )?advances?", r"royalt(y|ies) (on|of|paid)", r"we (never|do not|don't) charge (authors|writers|a fee)",
                        r"no (cost|fees?) to (the )?(author|writer)s?", r"traditional publish(er|ing)"])),
]

MEMBERSHIPS = [
    ("Editors Canada", [r"editors canada", r"editors' association of canada", r"r[ée]viseurs canada", r"editors\.ca"]),
    ("ACES", [r"aces: the society for editing", r"aceseditors", r"aces member"]),
    ("EFA", [r"editorial freelancers association", r"the-efa\.org"]),
    ("CIEP", [r"chartered institute of editing and proofreading", r"\bciep\b", r"\bsfep\b", r"ciep\.uk"]),
    ("IPEd", [r"institute of professional editors", r"\biped\b", r"iped-editors\.org"]),
    ("AALA (formerly AAR)", [r"association of american literary agents", r"association of authors'? representatives", r"aalitagents\.org", r"aaronline\.org"]),
    ("AAA (UK)", [r"association of authors'? agents", r"agentsassoc\.co\.uk"]),
    ("ALAA (Australia)", [r"australian literary agents'? association"]),
    ("PACLA (Canada)", [r"professional association of canadian literary agents", r"\bpacla\b"]),
    ("ACP", [r"association of canadian publishers", r"publishers\.ca"]),
    ("LPG", [r"literary press group", r"lpg\.ca"]),
    ("ANEL", [r"\banel\b", r"association nationale des [ée]diteurs de livres"]),
    ("IBPA", [r"independent book publishers association", r"\bibpa\b", r"ibpa-online\.org"]),
    ("IPG (UK)", [r"independent publishers guild", r"ipg\.uk\.com"]),
    ("Publishing Ireland", [r"publishing ireland", r"publishingireland\.com"]),
    ("PANZ", [r"publishers association of new zealand", r"\bpanz\b", r"publishers\.org\.nz"]),
    ("APA (Australia)", [r"australian publishers association", r"publishers\.asn\.au"]),
    ("Small Press Network", [r"small press network", r"smallpressnetwork\.com\.au"]),
    ("AUPresses", [r"association of university presses", r"aupresses\.org"]),
    ("CLMP", [r"community of literary magazines and presses", r"\bclmp\b", r"clmp\.org"]),
    ("SCBWI", [r"\bscbwi\b", r"society of children'?s book writers (and|&) illustrators"]),
    ("CANSCAIP", [r"\bcanscaip\b", r"canadian society of children'?s authors"]),
    ("AOI", [r"association of illustrators", r"theaoi\.com"]),
    ("ALLi", [r"alliance of independent authors", r"allianceindependentauthors\.org"]),
    ("Audio Publishers Association", [r"audio publishers association", r"audiopub\.org"]),
    ("ACTRA", [r"\bactra\b"]), ("SAG-AFTRA", [r"sag-aftra"]),
    ("Canadian Freelance Guild", [r"canadian freelance guild", r"professional writers association of canada", r"\bpwac\b"]),
    ("Society of Authors", [r"society of authors"]),
    ("Writers' Union of Canada", [r"writers'? union of canada", r"writersunion\.ca"]),
]
MEMBERSHIPS_RX = [(n, re.compile("|".join(w), re.I)) for n, w in MEMBERSHIPS]

PRICING = [  # first match wins
    ("Free", rx([r"isbns? (are|is) free", r"free of charge", r"at no (cost|charge)", r"free (service|to use|isbns?)", r"no (fee|cost) to (publish|use|join)"])),
    ("Published rates", rx([r"rates? (start|starting|from)", r"(starting|starts|prices? start|from) (at )?(\$|£|€|ca\$|us\$)\s?\d",
                            r"(\$|£|€)\s?\d[\d,.]*\s?(per|/)\s?(word|hour|page|hr|1,?000 words)", r"(per|a) word", r"per hour", r"our rates",
                            r"pricing", r"price list", r"rate sheet", r"tarifs?"])),
    ("Quote on request", rx([r"(request|get|free|custom|ask for) (a |your )?(free )?quote", r"quote request", r"estimate", r"soumission", r"devis"])),
]

FORMATS = [("Print", rx([r"print(ed)? books?", r"paperbacks?", r"hardcovers?", r"print editions?", r"offset", r"print on demand", r"printing"])),
           ("Ebook", rx([r"e-?books?", r"epub", r"kindle", r"digital editions?"])),
           ("Audio", rx([r"audiobooks?", r"audio books?", r"narrat(ion|ed|or)", r"livres? audio"]))]

REMOTE = rx([r"worldwide", r"around the world", r"international clients", r"clients (all )?(over|across) the (world|globe)",
             r"work(ing)? remotely", r"remote(ly)?", r"anywhere in the world", r"clients (from|in) (around|across)",
             r"across (canada|north america|the us|the united states)", r"virtual(ly)?"])
FRENCH = rx([r"fran[cç]ais", r"french", r"bilingu(al|e)", r"en fran[cç]ais", r"qu[ée]b[ée]c"])
SPANISH = rx([r"espa[nñ]ol", r"spanish"])
CHILDREN = rx([r"picture books?", r"children'?s (books?|literature|publish\w*|authors?|illustrat\w*)", r"kidlit", r"board books?",
               r"middle[- ]grade", r"young readers", r"kids'? books?", r"jeunesse", r"albums? jeunesse"])

# ------------------------------------------------------------------ helpers


def find_all(pairs, text, limit=8):
    return [n for n, r in pairs if r.search(text)][:limit]


def services_for(cat, text):
    return find_all(SERVICES_RX.get(cat, []), text)


def first_match(pairs, text):
    for n, r in pairs:
        if r.search(text):
            return n
    return ""


def guess_category(hint, text, name=""):
    """Seed hint wins when the page agrees or says nothing clear. Otherwise the strongest signal decides."""
    t = (name + " " + text)[:400000]
    scores = {k: len(CAT_SIGNALS[k].findall(t)) for k in CAT_KEYS}
    if hint in scores and (scores[hint] > 0 or max(scores.values()) < 3):
        return hint
    best = max(scores, key=scores.get)
    return best if scores[best] >= 2 else (hint if hint in scores else "")


def tags(cat, text, name="", lang=""):
    """All filter fields for one site, from its public wording (text is lower-cased page text, kept in memory only)."""
    t = " " + text + " "
    out = {
        "services": "; ".join(services_for(cat, t)),
        "illustration_styles": "; ".join(find_all(STYLES_RX, t)) if cat in ("illustration", "design") else "",
        "audiences": "; ".join(find_all(AUDIENCES_RX, t, 10)),
        "works_with": "",
        "submission_status": "",
        "reading_period": "",
        "business_model": first_match(BUSINESS_MODEL, t) if cat in ("publishers",) else "",
        "memberships": "; ".join(find_all(MEMBERSHIPS_RX, t, 10)),
        "pricing_info": first_match(PRICING, t) if cat != "publishers" and cat != "agents" else "",
        "formats": "; ".join(n for n, r in FORMATS if r.search(t)),
        "remote": "yes" if REMOTE.search(t) else "",
        "languages": "",
        "children_focus": "yes" if (cat == "illustration" or len(CHILDREN.findall(t)) >= 3) else "",
    }
    ww = [k for k, r in WORKS_WITH.items() if r.search(t)]
    out["works_with"] = "both" if len(ww) == 2 else (ww[0] if ww else "")
    if cat in ("publishers", "agents"):
        out["submission_status"] = first_match(SUBMISSIONS, t)
        out["reading_period"] = "yes" if READING_PERIOD.search(t) else ""
    langs = []
    l2 = (lang or "").split("-")[0].lower()
    if l2:
        langs.append(l2)
    if "fr" not in langs and len(FRENCH.findall(t)) >= 2:
        langs.append("fr")
    if "es" not in langs and len(SPANISH.findall(t)) >= 2:
        langs.append("es")
    if langs and "en" not in langs and re.search(r"\b(the|and|our|services)\b", t[:5000]):
        langs.insert(0, "en")
    out["languages"] = "; ".join(dict.fromkeys(langs))
    return out
