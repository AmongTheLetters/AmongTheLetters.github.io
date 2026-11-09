# Topaz Pages crawler

Builds the list behind the *Among The Letters* Topaz Pages, a directory of the people and companies a writer needs to
publish a book. It covers six kinds of service.

- Publishers and small presses
- Literary agents
- Editors and proofreaders
- Cover and interior designers
- Picture book and children's book illustrators
- Printing, audiobooks, ISBNs and distribution

It records public facts about each one, such as name, address, category, services, who they work with, submission
status, memberships, whether rates are published, and where they are. It never copies page text. It obeys every
site's robots.txt, identifies itself honestly, never visits a page a site asks bots to avoid, and skips anything behind
a login or paywall. Canada comes first, then the United States, then the UK, Ireland, Australia and New Zealand.

This folder is not part of the website build.

## Run it (Windows)

Open the website folder in Cursor, open a terminal (**Terminal > New Terminal**) and paste these lines one at a time.

```
cd C:\Users\Chris\Desktop\AmongTheLetters.github.io
git pull
cd tools\topaz-directory
.\run.bat
```

A full first run is long, about 4 to 6 hours on a home internet connection, because it reads thousands of directory
pages and sites one polite request at a time. You can stop any time and carry on later.

To stop early, click the trash-can icon on the terminal panel (or press Ctrl+C and wait). Progress is saved, and
`.\run.bat` carries on where it left off. To run in shorter sittings, `.\run.bat --hours 2` stops cleanly after two
hours. Run it again to continue.

**Result:** `tools\topaz-directory\output\topaz_directory.csv` (opens in Excel). Tell Link when it's done.

## Build the website data

After a run, one command turns the crawl into the data the `/topaz-pages/` page will load. From the website folder

```
python tools\topaz-directory\build_site_data.py
```

It drops known scams, junk and duplicates, and writes `public\topaz-pages\data\directory.json`. A report of what was
kept and dropped, with examples, goes to `tools\topaz-directory\output\site_data_report.json`. It needs nothing beyond
Python. The page itself comes later.

## What a run does

1. **Scam list.** Downloads Writer Beware's public list of publishing scams (once a week) and loads `known_scams.txt`.
2. **Discovery.** Reads `seeds.txt`. These are Wikipedia lists and categories, Wikidata, public member lists (LPG,
   PACLA, Publishing Ireland, PANZ, CLMP, the Book Publishers Association of Alberta and more), Poets & Writers' small
   press and agent listings, the CIEP editor directory, illustrator directories, the ALLi service ratings and hand-picked
   sites. It follows each directory's Next pages and opens its profile pages to find each member's own website.
3. **Search.** Runs the searches in `queries.txt` (like "literary agency Toronto" or "book printer Winnipeg") through
   Wikipedia's search, which needs no key. With keys (below) it also asks Marginalia, Brave and Gemini. Results are
   only leads. Every site still gets checked like any other.
4. **Checking.** Visits each site's homepage and up to two of its own pages about services, rates or submissions. It
   reads about 250 KB a page at most, waits up to 10 seconds, and visits each site no more than once a second.
5. **Following links.** Sites linked from the ones it checked (a partner printer, an agency's sister press) are added
   and checked too. This goes one step out and stops, so the crawl stays on topic.
6. **Outside facts.** Looks up each site in Wikidata for its name, description and country.

## The scam filter

Writers need to trust this list, so known scams are always left out.

- Writer Beware's current scam list is downloaded on your computer at the start of each run and saved in
  `output\scam_sources\`. Writer Beware asks that the list not be copied, so it is only used as a filter. It is never
  uploaded to GitHub or shown on the website.
- `known_scams.txt` adds well-documented cases with a public source for each line, such as Author Solutions and its
  imprints, PublishAmerica and Tate Publishing.
- An entry is left out when its web address is a scam address, or its name matches a scam name exactly, or its web
  address spells a scam name.
- `scam_safelist.txt` lists real businesses that share a name with a scam, so they are never caught by mistake.
- Everything left out is listed in `output\scams_dropped.csv` with the name it matched, so you can check it.

Nothing else is removed for being paid. Hybrid publishers, self-publishing companies and services that charge stay in
the list unless they are on a scam list. The ALLi rating is shown when a company has one, and a Watchdog Advisory or
Caution rating puts a caution flag on the entry instead of removing it.

## What each entry records

name, url, domain, category, services (for example developmental editing, proofreading, cover design, typesetting,
offset printing, narration, ISBN agency), illustration styles, audiences and genres (picture books, middle grade, young
adult, romance, poetry and more), works with (self-publishing authors, publishers or both), submission status for
publishers and agents (open to unagented, agented only, closed) and whether they use reading periods, business model
for publishers (traditional, hybrid, author-paid services), memberships (Editors Canada, ACES, EFA, CIEP, IPEd, AALA,
PACLA, ACP, LPG, ANEL, IBPA, SCBWI, CANSCAIP and more), pricing info (published rates, quote on request, free), formats
(print, ebook, audio), country and province, whether they work remotely or internationally, languages, a children's
book flag, the site's own short description, a reviews link, the ALLi rating, a Writer Beware search link and where the
entry was found. A field stays blank when the site doesn't say.

**Reviews link.** Every entry gets one. It is the ALLi rating page when there is one, else a review page the site links
to itself (Trustpilot, Reedsy, Google Maps, Yelp or Absolute Write), else a web search for the name. For publishers and
agents that search looks in the Absolute Write forums, where writers compare notes on them.

**Trust score.** The website data gives each entry 0 to 5 points from public signals only. One point each for being
read directly, a professional membership, a listing in an association or curated directory, a Wikidata entry, a real
review page, and an ALLi rating of Excellent or Recommended. It is a guide for readers, not a rating.

## Optional free keys

Everything works with no keys. Keys add more search sources. If you already made a `.env` for the Jade Pages crawler
(`tools\reading-directory\.env`), its keys are used here automatically. Otherwise

1. In `tools\topaz-directory`, copy `.env.example` and name the copy `.env`. In a terminal in that folder run
   `copy .env.example .env`
2. Open `.env` in Cursor, paste the key after the `=` on its line, and save.

`.env` stays on your computer and is never uploaded to GitHub. The Jade Pages README explains each key. Gemini is the
most useful one here, since it suggests freelance editors, designers and illustrators that no list covers. Its free
daily limit means the Gemini questions are spread over a few days of runs.

## Options

- `.\run.bat --hours 2` stop cleanly after two hours
- `.\run.bat --limit 30` quick test on 30 sites
- `.\run.bat --no-search` skip the search step
- `.\run.bat --no-follow-links` don't add sites that checked sites link to
- `.\run.bat --workers 16` change how many sites are checked at once (default 24)
- `.\run.bat --discover-only` or `--profile-only` run one part only
- `.\run.bat --export-only` rebuild the CSV from saved progress
- `.\run.bat --fresh` throw away all previous progress and start over (rarely needed)
- `python test_crawl.py` quick self-check

## Adding sources

- `seeds.txt` has one source per line and the format is explained at its top. A rerun only does new lines.
- `queries.txt` holds search phrases and Gemini topics. A rerun only does new ones.
- The keyword rules for services, audiences, memberships and the rest live in `taxonomy.py`.

Left out on purpose, because they load by script, need a login or refuse bots: the Editors Canada, EFA and IPEd member
directories, SCBWI's illustrator gallery, CANSCAIP's member list, the AALA agent finder, IBPA, Duotrope and Publishers
Marketplace listings. Wikidata data is CC0.
