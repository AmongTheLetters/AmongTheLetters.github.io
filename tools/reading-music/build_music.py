"""
Reading music for amongtheletters.com.

Every recording here is checked against its Wikimedia Commons file page when this runs. A file is only used when
its licence on that page is public domain, CC0, CC BY or CC BY-SA. Anything else stops the build. The script then
joins movements into one track where noted, encodes AAC at 96 kbps (plays in every current browser, iOS included)
and writes public/music/*.m4a plus src/lib/music-tracks.json with the credits the player shows.

  python tools/reading-music/build_music.py          needs ffmpeg and internet access
Downloads are cached in tools/reading-music/cache (git ignored).
"""
import json, os, re, subprocess, sys, urllib.parse, urllib.request, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
CACHE = os.path.join(HERE, "cache"); OUT = os.path.join(ROOT, "public", "music")
META = os.path.join(ROOT, "src", "lib", "music-tracks.json")
UA = {"User-Agent": "AmongTheLetters-reading-music/1.0 (https://amongtheletters.com; amongtheletters@gmail.com)"}
ALLOWED = re.compile(r"^(public domain|pdm-owner|cc0|cc by(-sa)? [0-9.]+)$", re.I)
BITRATE = "96k"

G = "File:Kimiko Ishizaka - J.S. Bach- -Open- Goldberg Variations, BWV 988 (Piano) - {}.mp3"
JM = "File:JOHN MICHEL CELLO-J S BACH CELLO SUITE 1 in G {}.ogg"
MB = "File:Mozart's Serenade No. 10 \"Grand Partita\" - {} - United States Marine Band.mp3"
TRACKS = [
  dict(id="vivaldi-spring", composer="Antonio Vivaldi", title="The Four Seasons, Spring", detail="Concerto in E major, RV 269, all three movements",
       performer="The Modena Chamber Orchestra (via Musopen)",
       files=["File:The Modena Chamber Orchestra - Vivaldi's Spring, RV 269 - I. Allegro.ogg",
              "File:The Modena Chamber Orchestra - Vivaldi's Spring, RV 269 - II. Largo.ogg",
              "File:The Modena Chamber Orchestra - Vivaldi's Spring, RV 269 - III. Allegro.ogg"]),
  dict(id="bach-goldberg", composer="Johann Sebastian Bach", title="Goldberg Variations, Aria and Variations 1 to 7", detail="BWV 988, from the Open Goldberg Variations",
       performer="Kimiko Ishizaka, piano",
       files=[G.format(x) for x in ["01 Aria", "02 Variatio 1 a 1 Clav", "03 Variatio 2 a 1 Clav", "04 Variatio 3 a 1 Clav. Canone all Unisuono",
                                     "05 Variatio 4 a 1 Clav", "06 Variatio 5 a 1 ovvero 2 Clav", "07 Variatio 6 a 1 Clav. Canone alla Seconda", "08 Variatio 7 a 1 ovvero 2 Clav"]]),
  dict(id="chopin-nocturne-9-2", composer="Frédéric Chopin", title="Nocturne in E-flat major, Op. 9 No. 2", detail="From Musopen's Set Chopin Free project",
       performer="Frank Lévy, piano", files=["File:Chopin - Nocturne No. 2 in E-flat major, Op. 9 No. 2 (Frank Levy).flac"]),
  dict(id="mozart-nachtmusik", composer="Wolfgang Amadeus Mozart", title="Eine kleine Nachtmusik, I. Allegro", detail="Serenade No. 13 in G major, K. 525",
       performer="Advent Chamber Orchestra", files=["File:Mozart - Eine kleine Nachtmusik - 1. Allegro.ogg"]),
  dict(id="vivaldi-autumn", composer="Antonio Vivaldi", title="The Four Seasons, Autumn", detail="Concerto in F major, RV 293, all three movements",
       performer="The Modena Chamber Orchestra (via Musopen)",
       files=["File:Vivaldi The Four Seasons, Op. 8 - The Modena Chamber Orchestra - Violin Concerto in F major RV 293 Autumn.mp3"]),
  dict(id="bach-cello-1", composer="Johann Sebastian Bach", title="Cello Suite No. 1 in G major", detail="BWV 1007, all six movements",
       performer="John Michel, cello", files=[JM.format(x) for x in ["Prelude", "Allemande", "Courante", "Sarabande", "Minuets", "Gigue"]]),
  dict(id="chopin-nocturne-48-1", composer="Frédéric Chopin", title="Nocturne in C minor, Op. 48 No. 1", detail="From Musopen's Set Chopin Free project",
       performer="Luke Faulkner, piano", files=["File:Chopin - Nocturne No. 13 in C minor, Op. 48 No. 1 (Luke Faulkner).flac"]),
  dict(id="mozart-gran-partita-adagio", composer="Wolfgang Amadeus Mozart", title="Serenade No. 10, Gran Partita, III. Adagio", detail="K. 361, for thirteen winds",
       performer="\"The President's Own\" United States Marine Band", files=[MB.format("III. Adagio. Andante")]),
  dict(id="chopin-nocturne-27-2", composer="Frédéric Chopin", title="Nocturne in D-flat major, Op. 27 No. 2", detail="From Musopen's Set Chopin Free project",
       performer="Frank Lévy, piano", files=["File:Chopin - Nocturne No. 8 in D-flat major, Op. 27 No. 2 (Frank Levy).flac"]),
]

def api(**p):
    p["format"] = "json"
    u = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(p)
    return json.load(urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60))

def info(title):
    r = api(action="query", titles=title, prop="imageinfo|revisions", rvprop="content", rvslots="main",
            iiprop="url|size|extmetadata", iiextmetadatafilter="LicenseShortName|LicenseUrl|UsageTerms")
    pg = next(iter(r["query"]["pages"].values()))
    if "missing" in pg: sys.exit(f"missing on Commons: {title}")
    ii = pg["imageinfo"][0]; m = ii.get("extmetadata", {})
    lic = re.sub("<[^>]+>", "", m.get("LicenseShortName", {}).get("value", "")).strip()
    text = pg["revisions"][0]["slots"]["main"]["*"]
    templates = sorted(set(re.findall(r"\{\{\s*((?:PD|cc|CC|PDMark)[^|}]*)", text)))
    if not ALLOWED.match(lic): sys.exit(f"licence not allowed ({lic}) for {title}")
    if re.search(r"PD-EU|PD-US-?\}|NonCommercial|-nc|-nd", " ".join(templates), re.I): sys.exit(f"licence template not allowed {templates} for {title}")
    return dict(title=title, page="https://commons.wikimedia.org/wiki/" + urllib.parse.quote(title.replace(" ", "_"), safe=":/(),'"),
                url=ii["url"], licence=lic, licence_url=m.get("LicenseUrl", {}).get("value", ""), templates=templates)

def fetch(u, path):
    if os.path.exists(path): return
    with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=300) as r, open(path + ".part", "wb") as f:
        while True:
            b = r.read(1 << 20)
            if not b: break
            f.write(b)
    os.replace(path + ".part", path)

def duration(path):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path]).decode().strip())

NICE = {"pdm-owner": "Public Domain Mark", "public domain": "Public domain", "cc0": "CC0 public domain dedication"}
def nice(lic): return NICE.get(lic.lower(), lic)
PD_NOTE = {"PD-USGov-Military-Marines": "a work of the US Marine Corps", "PD-USGov-Military-Air Force": "a work of the US Air Force", "PD-author": "released by Musopen"}

def main():
    os.makedirs(CACHE, exist_ok=True); os.makedirs(OUT, exist_ok=True)
    out = []
    for t in TRACKS:
        srcs = []
        for i, title in enumerate(t["files"]):
            meta = info(title)
            ext = os.path.splitext(urllib.parse.urlparse(meta["url"]).path)[1]
            path = os.path.join(CACHE, f'{t["id"]}-{i}{ext}'); fetch(meta["url"], path)
            srcs.append((path, meta))
        dest = os.path.join(OUT, f'{t["id"]}.m4a')
        if not os.path.exists(dest):
            ins = sum((["-i", p] for p, _ in srcs), [])
            graph = "".join(f"[{i}:a]" for i in range(len(srcs))) + f"concat=n={len(srcs)}:v=0:a=1,loudnorm=I=-20:TP=-2:LRA=14[a]"
            subprocess.run(["ffmpeg", "-y", "-v", "error", *ins, "-filter_complex", graph, "-map", "[a]", "-ac", "2", "-ar", "44100",
                            "-c:a", "aac", "-b:a", BITRATE, "-movflags", "+faststart", "-map_metadata", "-1",
                            "-metadata", f'title={t["title"]}', "-metadata", f'artist={t["performer"]}', "-metadata", f'composer={t["composer"]}', dest + ".tmp.m4a"], check=True)
            os.replace(dest + ".tmp.m4a", dest)
        lic = sorted({nice(m["licence"]) for _, m in srcs})
        why = next((v for _, m in srcs for k, v in PD_NOTE.items() if any(x.strip() == k for x in m["templates"])), "")
        if why and lic == ["Public domain"]: lic = [f"Public domain, {why}"]
        out.append(dict(id=t["id"], src=f'/music/{t["id"]}.m4a', title=t["title"], composer=t["composer"], performer=t["performer"], detail=t["detail"],
                        duration=round(duration(dest)), bytes=os.path.getsize(dest), licence=" and ".join(lic),
                        licenceUrl=next((m["licence_url"] for _, m in srcs if m["licence_url"]), ""),
                        sources=[dict(title=m["title"].removeprefix("File:"), page=m["page"], licence=m["licence"], templates=m["templates"]) for _, m in srcs],
                        changes=("Movements joined into one track, " if len(srcs) > 1 else "") + "loudness evened out and encoded as AAC at 96 kbps"))
        print(f'{t["id"]:24} {out[-1]["duration"]//60:3d} min {out[-1]["bytes"]//1024:6d} KB  {out[-1]["licence"]}')
    json.dump({"checked": datetime.date.today().isoformat(), "tracks": out}, open(META, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    with open(os.path.join(OUT, "CREDITS.txt"), "w", encoding="utf-8") as f:
        f.write("Reading music on amongtheletters.com\nEach file below was checked on its Wikimedia Commons page on " + datetime.date.today().isoformat() + ".\n\n")
        for x in out:
            f.write(f'{x["id"]}.m4a\n  {x["composer"]}, {x["title"]}\n  Performed by {x["performer"]}\n  Licence: {x["licence"]} {x["licenceUrl"]}\n  Changes: {x["changes"]}\n')
            for s_ in x["sources"]: f.write(f'  Source: {s_["page"]}\n')
            f.write("\n")
    print("total", sum(x["bytes"] for x in out) // (1 << 20), "MB,", sum(x["duration"] for x in out) // 60, "min")

if __name__ == "__main__":
    main()
