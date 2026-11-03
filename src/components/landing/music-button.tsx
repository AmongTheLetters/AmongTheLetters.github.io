/* The reading music button in the top bar. A small speaker with a faint jade edge that opens a compact player.
   While music plays, three soft bars move beside the speaker (still when reduced motion is on). */
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ExternalLink, Pause, Play, Shuffle, SkipBack, SkipForward, Volume1, Volume2, VolumeX } from "lucide-react";
import { MUSIC_CHECKED, OPEN_CREDITS, TRACKS, choose, fmtTime, next, prev, seek, setShuffle, setVolume, toggle, useMusic } from "@/lib/music";
import { useExclusiveMenu } from "@/lib/menus";
import { cn } from "@/lib/utils";

export function MusicButton({ compact = false }: { compact?: boolean }) {
  const m = useMusic();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"player" | "credits">("player");
  useExclusiveMenu(open, () => setOpen(false));
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const tr = TRACKS[m.i];
  const dur = m.dur || tr.duration;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    document.addEventListener("mousedown", onDown); document.addEventListener("touchstart", onDown); window.addEventListener("keydown", onKey);
    requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>("[data-first]")?.focus());
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("touchstart", onDown); window.removeEventListener("keydown", onKey); };
  }, [open, view]);

  /* The footer's Music credits link opens this panel on the credits view. Only the visible button answers. */
  useEffect(() => {
    const onCredits = () => { if (!btn.current || btn.current.offsetParent === null) return; setView("credits"); setOpen(true); window.scrollTo({ top: 0, behavior: "smooth" }); };
    window.addEventListener(OPEN_CREDITS, onCredits);
    return () => window.removeEventListener(OPEN_CREDITS, onCredits);
  }, []);

  const VolIcon = m.vol === 0 ? VolumeX : m.vol < 0.5 ? Volume1 : Volume2;
  const iconBtn = "inline-flex size-11 shrink-0 items-center justify-center rounded-full text-jade-deep transition-colors hover:bg-jade/10 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-jade disabled:opacity-40";

  return (
    <div ref={wrap} className="relative">
      <button ref={btn} type="button" aria-label="Reading music" aria-expanded={open} aria-controls="music-panel" aria-haspopup="dialog"
        title={m.loading ? `Loading ${tr.title}` : m.playing ? `Playing ${tr.title}` : "Reading music"} aria-busy={m.loading || undefined}
        onClick={() => { setView("player"); setOpen((v) => !v); }}
        className={cn("music-btn relative inline-flex items-center justify-center rounded-full text-jade-deep transition-[box-shadow,background-color] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jade",
          compact ? "size-11" : "size-9", m.playing && "is-playing")}>
        <span className="music-btn-ring" aria-hidden="true" />
        {m.loading ? <span className="music-spin" aria-hidden="true" /> : null}
        <svg viewBox="0 0 24 24" className="relative size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor" fillOpacity=".12" />
          {m.playing ? null : <><path d="M15.5 9.5a3.5 3.5 0 0 1 0 5" /><path d="M18.5 7a7 7 0 0 1 0 10" /></>}
        </svg>
        {m.playing ? <span className="music-bars" aria-hidden="true"><i /><i /><i /></span> : null}
        <span className="sr-only" aria-live="polite">{m.loading ? `, loading ${tr.title}` : m.playing ? `, playing ${tr.title}` : ""}</span>
      </button>

      {open ? (
        <div ref={panel} id="music-panel" role="dialog" aria-busy={m.loading || undefined} aria-label={view === "player" ? "Reading music player" : "Music credits"}
          className="music-panel fixed right-4 top-16 z-50 w-[min(19rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-jade/30 bg-cream shadow-xl sm:absolute sm:right-0 sm:top-[calc(100%+0.5rem)]">
          {view === "player" ? (
            <div className="p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="kicker kicker-jade">Reading music</p>
                <p className="text-[11px] tabular-nums text-faint">{m.i + 1} of {TRACKS.length}</p>
              </div>
              <div className="mt-2 flex min-h-4 items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-jade">{tr.composer}</p>
                <p className="flex items-center gap-1.5 text-[11px] text-faint" role="status" aria-live="polite">
                  {m.loading ? <><span className="music-spin-sm" aria-hidden="true" />Loading</> : null}
                </p>
              </div>
              <p className="mt-0.5 font-display text-lg leading-snug tracking-tight text-ink [overflow-wrap:anywhere]">{tr.title}</p>
              <p className="mt-0.5 text-xs text-muted [overflow-wrap:anywhere]">{tr.performer}</p>

              <div className="mt-3">
                <input type="range" min={0} max={Math.max(1, Math.floor(dur))} step={1} value={Math.min(Math.floor(m.t), Math.floor(dur))}
                  onChange={(e) => seek(Number(e.target.value))} aria-label="Position in track" aria-valuetext={`${fmtTime(m.t)} of ${fmtTime(dur)}`}
                  className="music-range w-full" style={{ "--p": `${(m.t / Math.max(1, dur)) * 100}%` } as React.CSSProperties} />
                <div className="flex justify-between text-[11px] tabular-nums text-faint"><span>{fmtTime(m.t)}</span><span>{fmtTime(dur)}</span></div>
              </div>

              <div className="mt-1 flex items-center justify-between">
                <button type="button" onClick={() => setShuffle(!m.shuffle)} aria-pressed={m.shuffle} aria-label="Shuffle"
                  className={cn(iconBtn, m.shuffle ? "bg-jade/12 text-jade" : "text-faint")}><Shuffle className="size-4" /></button>
                <button type="button" onClick={prev} aria-label="Previous track" className={iconBtn}><SkipBack className="size-5" /></button>
                <button type="button" data-first onClick={toggle} aria-label={m.playing ? "Pause" : m.t > 5 ? `Resume ${tr.title}` : `Play ${tr.title}`}
                  className="jade-polish inline-flex size-12 items-center justify-center rounded-full text-parchment shadow-md transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jade">
                  {m.playing ? <Pause className="size-5" fill="currentColor" /> : <Play className="ml-0.5 size-5" fill="currentColor" />}
                </button>
                <button type="button" onClick={() => next()} aria-label="Next track" className={iconBtn}><SkipForward className="size-5" /></button>
                <span className="size-11" aria-hidden="true" />
              </div>

              <label className="mt-1 flex items-center gap-2">
                <VolIcon className="size-4 shrink-0 text-jade" aria-hidden="true" />
                <span className="sr-only">Volume</span>
                <input type="range" min={0} max={1} step={0.05} value={m.vol} onChange={(e) => setVolume(Number(e.target.value))}
                  aria-valuetext={`${Math.round(m.vol * 100)} percent`} className="music-range w-full" style={{ "--p": `${m.vol * 100}%` } as React.CSSProperties} />
              </label>

              {m.error ? <p className="mt-2 text-xs text-oxblood" role="status">{m.error}</p> : null}
              {!m.playing && m.t > 5 ? <p className="mt-2 text-xs text-faint">Paused at {fmtTime(m.t)}. Press play to carry on.</p> : null}

              <details className="mt-3 border-t border-jade/20 pt-2">
                <summary className="flex min-h-11 cursor-pointer list-none items-center text-sm font-medium text-jade-deep hover:text-jade [&::-webkit-details-marker]:hidden">All pieces</summary>
                <ol className="max-h-48 overflow-y-auto pb-1">
                  {TRACKS.map((t, k) => (
                    <li key={t.id}>
                      <button type="button" onClick={() => choose(k)} aria-current={k === m.i ? "true" : undefined}
                        className={cn("flex min-h-11 w-full flex-col justify-center rounded-md px-2 py-1 text-left hover:bg-jade/[0.07]", k === m.i && "bg-jade/10")}>
                        <span className="text-sm leading-snug text-ink">{t.title}</span>
                        <span className="text-[11px] text-faint">{t.composer.split(" ").pop()}, {fmtTime(t.duration)}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </details>
              <button type="button" onClick={() => setView("credits")} className="mt-1 inline-flex min-h-11 items-center text-xs font-medium text-muted underline-offset-4 hover:text-jade hover:underline">Music credits and licences</button>
            </div>
          ) : (
            <div className="flex max-h-[min(32rem,calc(100dvh-6rem))] flex-col">
              <div className="flex items-center gap-1 border-b border-jade/20 px-2 py-1.5">
                <button type="button" data-first onClick={() => setView("player")} aria-label="Back to the player" className={iconBtn}><ArrowLeft className="size-4" /></button>
                <p className="font-display text-lg tracking-tight text-ink">Music credits</p>
              </div>
              <div className="overflow-y-auto px-4 py-3 text-xs leading-relaxed text-muted">
                <p>The music is long out of copyright. Each recording is free to share too, as public domain, CC0 or a Creative Commons licence that lets anyone reuse it with credit. We checked every file on its Wikimedia Commons page ({MUSIC_CHECKED}). We evened out the loudness and joined movements into single tracks where noted.</p>
                <ol className="mt-3 space-y-3">
                  {TRACKS.map((t) => (
                    <li key={t.id}>
                      <p className="font-medium text-ink">{t.composer}, {t.title}</p>
                      <p>{t.performer}. {t.detail}.</p>
                      <p>
                        Licence {t.licenceUrl ? <a href={t.licenceUrl} target="_blank" rel="noreferrer" className="text-jade underline-offset-2 hover:underline">{t.licence}</a> : t.licence}.{" "}
                        {t.sources.length === 1 ? (
                          <a href={t.sources[0].page} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-jade underline-offset-2 hover:underline">Source <ExternalLink className="size-3" aria-hidden="true" /><span className="sr-only">(opens in a new tab)</span></a>
                        ) : (
                          <>Sources {t.sources.map((s, k) => <a key={s.page} href={s.page} target="_blank" rel="noreferrer" className="text-jade underline-offset-2 hover:underline">{k + 1}<span className="sr-only">, {s.title} (opens in a new tab)</span>{k < t.sources.length - 1 ? ", " : ""}</a>)}</>
                        )}
                      </p>
                      {t.licence.includes("SA") ? <p>Our edited version is shared under the same licence.</p> : null}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
