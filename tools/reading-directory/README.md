# Reading Directory crawler

Builds the starting list for the *Among The Letters* reading directory: literary magazines, journals,
zines, poetry and fiction sites, free libraries, web fiction platforms, presses, bookstores, ebook and
audiobook sites, and newsletters.

It only records public facts about each site (name, address, meta description, language, and simple
tags like free/paid, ebook/print/audio, magazine/library/store). It never copies stories, poems or
page text. It obeys every site's robots.txt, identifies itself honestly, waits about a second between
requests to the same site, and skips anything behind a login or paywall.

This folder is not part of the website build.

## Run it on Windows

1. **Python.** If you don't have it, install Python 3 from https://www.python.org/downloads/ and tick
   **"Add python.exe to PATH"** on the first installer screen.
2. **Get the latest code.** In the website folder run `git pull` (or pull in GitHub Desktop).
3. **Double-click `run.bat`** in `tools\reading-directory`. It installs the two small packages it
   needs and starts the crawl.

   Command-line alternative, from this folder:
   ```
   pip install -r requirements.txt
   python crawl.py
   ```
4. **Wait.** Discovery (gathering site addresses from Wikipedia, Wikidata and public lists) takes about
   10 to 20 minutes. Checking each site then takes roughly 1 to 3 hours for several thousand sites.
   A progress line shows how many are done and the time left. The computer must stay awake.
5. **Result:** `tools\reading-directory\output\reading_directory.csv` (opens in Excel), plus
   `reading_directory.jsonl`. Tell Link it's done and where the file is.

You can close the window at any time. Running it again continues where it stopped.

Running `run.bat` again also picks up anything skipped last time: seeds that errored ("will retry next run") and sites that hit a temporary error (rate limit, busy server, timeout), while finished sites are left alone.

## Options

- `python crawl.py --limit 30` quick test on 30 sites
- `python crawl.py --workers 32` check more sites at once (default 24)
- `python crawl.py --discover-only` / `--profile-only` run one phase
- `python crawl.py --fresh` throw away previous progress and start over

## Adding seeds

Edit `seeds.txt`. Each line is a Wikipedia list (`wp:`), a Wikipedia category (`wpcat:`), a Wikidata
class (`sparql:`), a public directory page (`page:`) or a single site (`site:`). A rerun only processes
new seed lines.

## Output columns

name, url, domain, description, type, access, formats, genres, submissions_signal, language,
wikidata_description, seed_hint, source, status, checked_at. The tags are best guesses from keywords
and get reviewed before anything goes on the site.
