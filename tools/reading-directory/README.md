# Reading Directory crawler (v2)

Builds the list behind the *Among The Letters* reading directory: literary magazines, journals, zines,
poetry and fiction sites, free libraries, web fiction platforms, presses, bookstores, public libraries,
ebook and audiobook sites, and newsletters.

It only records public facts about each site (name, address, short description, language and simple
tags like free/paid, ebook/print/audio, magazine/library/store). It never copies stories, poems or page
text. It obeys every site's robots.txt, identifies itself honestly, never visits a page a site asks bots
to avoid, and skips anything behind a login or paywall.

This folder is not part of the website build.

## Run it (Windows)

Open the website folder in Cursor, open a terminal (**Terminal > New Terminal**) and paste these lines
one at a time:

```
cd C:\Users\Chris\Desktop\AmongTheLetters.github.io
git pull
cd tools\reading-directory
.\run.bat
```

Your earlier progress is kept. Sites already checked are not checked again, so a rerun only does new
sites, new seeds, new searches and sites that were busy last time.

To stop early, click the trash-can icon on the terminal panel (or press Ctrl+C and wait). Progress is
saved, and `.\run.bat` carries on later.

**Result:** `tools\reading-directory\output\reading_directory.csv` (opens in Excel). Tell Link when it's done.

## Update the Jade Pages on the website

After a run, one command turns the crawl into the data the `/jade-pages/` page loads. From the website folder:

```
python tools\reading-directory\build_site_data.py
```

It reads `tools\reading-directory\output\reading_directory.csv` (or a CSV path you give it), drops junk and duplicates,
sorts every site into a category, reads free or paid, formats, language and country or province, and writes
`public\jade-pages\data\directory.json`. A report of what was kept and dropped, with examples, goes to
`tools\reading-directory\output\site_data_report.json`. It needs nothing beyond Python. To change what counts as junk
or how sites are sorted, edit the rule lists at the top of `build_site_data.py` and run it again.

Then `python scripts/build-seo.py` refreshes the sitemap date, and committing `public/jade-pages/data/directory.json`
publishes the new list.

## What a run does

1. **Discovery.** Reads `seeds.txt`: Wikipedia lists and categories, Wikidata, OpenStreetMap bookshops
   and libraries (every Canadian province and territory, US states, UK, Ireland, Australia, New Zealand),
   and public directory pages (NewPages big lists, Literary Press Group, Magazines Canada and more).
2. **Search.** Runs the searches in `queries.txt` (like "independent bookstore Halifax" or "free online
   poetry magazine") through Wikipedia's search, which needs no key. If you added keys (below), it also
   asks Marginalia, Brave and Gemini. Search results and AI answers are only leads. Every site still gets
   checked like any other.
3. **Checking.** Looks up every address first, so dead sites drop out in seconds, then visits each
   homepage once. It reads about 200 KB at most and waits up to 10 seconds. Many sites run at the same
   time, and each site gets at most one visit per second.
4. **Outside evidence.** Sites that block bots, are offline or say nothing clear are **kept**. Their
   free/paid guess comes from Wikidata (licence, open access, what kind of thing it is), the Wikipedia
   article's intro, and the listing or search snippet that pointed to them. The `access_evidence` column
   says where each guess came from. Sites with no evidence get `unconfirmed`, shown as
   "Access not yet confirmed".

## Optional free keys

Everything works with no keys. Keys just add more sources. To add one:

1. In `tools\reading-directory`, copy `.env.example` and name the copy `.env`. In a terminal in that
   folder: `copy .env.example .env`
2. Open `.env` in Cursor, paste the key after the `=` on its line, and save.
3. Run `.\run.bat` again.

`.env` stays on your computer and is never uploaded to GitHub.

- **Gemini (recommended, free):** go to https://aistudio.google.com/apikey, sign in with a Google
  account, click **Create API key**, and paste it after `GEMINI_API_KEY=`. You don't need billing, and
  you shouldn't turn it on. Without billing Google can't charge anything, and when the daily free limit
  runs out it stops until the next day. Free-tier prompts may be used by Google to improve its products,
  which is fine here because we only ask for public lists of websites.
- **Marginalia Search (free, non-commercial):** email contact@marginalia-search.com and ask for a free
  non-commercial API key for a reading-site directory. Paste it after `MARGINALIA_API_KEY=`. It's good at
  small independent sites.
- **Brave Search (not recommended for now):** Brave no longer has a free plan, only $5 of monthly
  credit, and it requires a credit card. Its terms also forbid keeping search results, so even with a
  key, this script only keeps each site's address as a lead and stores nothing else from Brave.
- **Google Programmable Search** is not used. Google closed it to new users in January 2026 and shuts it
  down on January 1, 2027.
- The script never controls the ChatGPT or Gemini chat websites. It only uses official APIs.

## Options

- `.\run.bat --limit 30` quick test on 30 sites
- `.\run.bat --no-search` skip the search step
- `.\run.bat --search-limit 100` fewer searches per source this run (default 400)
- `.\run.bat --workers 16` change how many sites are checked at once (default 24)
- `.\run.bat --discover-only` or `--profile-only` run one part only
- `.\run.bat --fresh` throw away all previous progress and start over (rarely needed)
- `python test_crawl.py` quick self-check

## Adding sources

- `seeds.txt`: one source per line. `wp:` Wikipedia list, `wpcat:` Wikipedia category, `sparql:`
  Wikidata class, `osm:books CA-ON` OpenStreetMap bookshops (or `osm:library`) in a region, `page:` a
  public directory page (add `| pages=5` to follow its Next links), `site:` one site. A rerun only does
  new lines.
- `queries.txt`: search phrases and Gemini topics. A rerun only does new ones.

Sources checked and left out on purpose: CIBA's member directory and indiebookstores.ca, IndieBound/ABA,
Bookshop.org, the UK and Australian bookseller finders, and the CLMP directory all need JavaScript or a
login. Duotrope is a paid service. Curlie didn't respond. Poets & Writers' database loads its listings by
script. OpenStreetMap and Wikidata cover bookstores and libraries instead.

## Output columns

name, url, domain, description, type, access (free / paid / mixed / unconfirmed), access_label,
access_evidence, formats, genres, submissions_signal, language, wikidata_description, wikidata_id,
seed_hint, source, status, status_label, checked_at. The tags are best guesses and get reviewed before
anything goes on the site. OpenStreetMap data is © OpenStreetMap contributors (ODbL), and Wikidata is CC0.
