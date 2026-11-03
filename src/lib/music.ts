/* Reading music. One shared audio element for the whole site, created only when a reader presses play, so
   nothing downloads before then. Pages on the site swap in place (see lib/router.ts), so the same element keeps
   playing from page to page and stops only when the reader pauses it or leaves the site. Where the reader was
   (track, position, volume, shuffle) is kept in localStorage. It never starts by itself on a fresh visit.
   The one exception to a page swap is a full reload inside the site (signing in or out, a refresh). If music
   was playing at that moment, the new page carries on from the same spot, within a few seconds, in the same tab. */
import { useSyncExternalStore } from "react";
import DATA from "@/lib/music-tracks.json";

export type Track = (typeof DATA.tracks)[number];
export const TRACKS: Track[] = DATA.tracks;
export const MUSIC_CHECKED = DATA.checked;
const KEY = "atl-music";
export const OPEN_CREDITS = "atl:music-credits";
const LIVE = "atl-music-live"; // sessionStorage: this tab was playing when its last page unloaded

type Saved = { i: number; t: number; vol: number; shuffle: boolean };
/* Stored by track id, so reordering the list never lands a reader on the wrong piece. */
type State = Saved & { playing: boolean; loading: boolean; dur: number; error: string };

function load(): Saved {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "{}");
    const k = typeof s.id === "string" ? TRACKS.findIndex((x) => x.id === s.id) : -1;
    return { i: k >= 0 ? k : 0, t: k >= 0 ? Number(s.t) || 0 : 0, vol: typeof s.vol === "number" ? Math.min(1, Math.max(0, s.vol)) : 0.6, shuffle: !!s.shuffle };
  } catch { return { i: 0, t: 0, vol: 0.6, shuffle: false }; }
}

let state: State = { ...(typeof window === "undefined" ? { i: 0, t: 0, vol: 0.6, shuffle: false } : load()), playing: false, loading: false, dur: 0, error: "" };
const subs = new Set<() => void>();
let audio: HTMLAudioElement | null = null;
let lastSave = 0;
let pending = false; // a play() call is waiting for the track to load
const played: number[] = [];

function set(p: Partial<State>) { state = { ...state, ...p }; subs.forEach((f) => f()); }
function save(force = false) {
  const now = Date.now(); if (!force && now - lastSave < 3000) return; lastSave = now;
  try { localStorage.setItem(KEY, JSON.stringify({ id: TRACKS[state.i].id, t: Math.floor(state.t), vol: state.vol, shuffle: state.shuffle })); } catch { /* private mode */ }
}

function el() {
  if (audio) return audio;
  audio = new Audio(); audio.preload = "none"; audio.volume = state.vol;
  audio.addEventListener("timeupdate", () => { set({ t: audio!.currentTime }); save(); });
  audio.addEventListener("loadedmetadata", () => set({ dur: audio!.duration || TRACKS[state.i].duration }));
  audio.addEventListener("playing", () => { pending = false; set({ playing: true, loading: false, error: "" }); });
  audio.addEventListener("waiting", () => { if (!audio!.paused) set({ loading: true }); });
  audio.addEventListener("loadstart", () => { if (!audio!.paused) set({ loading: true }); });
  audio.addEventListener("canplay", () => { if (audio!.paused) set({ loading: false }); });
  audio.addEventListener("pause", () => { set({ playing: false, loading: pending ? state.loading : false }); save(true); });
  audio.addEventListener("ended", () => next(true));
  audio.addEventListener("error", () => { pending = false; set({ playing: false, loading: false, error: "This track would not load. Try another one." }); });
  window.addEventListener("pagehide", () => {
    save(true);
    try { if (state.playing) sessionStorage.setItem(LIVE, String(Date.now())); else sessionStorage.removeItem(LIVE); } catch { /* private mode */ }
  });
  if ("mediaSession" in navigator) {
    const ms = navigator.mediaSession;
    ms.setActionHandler("play", () => play()); ms.setActionHandler("pause", () => pause());
    ms.setActionHandler("previoustrack", () => prev()); ms.setActionHandler("nexttrack", () => next());
  }
  return audio;
}

function meta() {
  if (!("mediaSession" in navigator) || typeof MediaMetadata === "undefined") return;
  const tr = TRACKS[state.i];
  navigator.mediaSession.metadata = new MediaMetadata({ title: tr.title, artist: `${tr.composer}, ${tr.performer}`, album: "Reading music, Among The Letters" });
}

function loadTrack(i: number, at = 0) {
  const a = el(); const tr = TRACKS[i];
  set({ i, t: at, dur: tr.duration, error: "" });
  if (!a.src.endsWith(tr.src)) a.src = tr.src;
  if (at) { const seek = () => { a.currentTime = at; a.removeEventListener("loadedmetadata", seek); }; a.addEventListener("loadedmetadata", seek); }
  meta(); save(true);
}

export function play() {
  const a = el();
  if (!a.src) loadTrack(state.i, state.t > 5 && state.t < TRACKS[state.i].duration - 5 ? state.t : 0);
  pending = true; set({ loading: true, error: "" });
  a.play().then(() => { pending = false; }, (e: DOMException) => {
    if (e?.name === "AbortError") return; // a newer track or play call took over
    pending = false;
    set({ loading: false, playing: false, error: e?.name === "NotAllowedError" ? "" : "This track would not play. Try another one." });
  });
}
/** After a full reload inside the site, pick the music back up if it was playing a moment ago in this tab.
    Browsers can refuse sound until the reader touches the page, so in that case it resumes on the first tap or key. */
export function resumeAfterReload() {
  let at = 0;
  try { at = Number(sessionStorage.getItem(LIVE)) || 0; sessionStorage.removeItem(LIVE); } catch { return; }
  if (!at || Date.now() - at > 10000) return;
  const fromSite = (() => { try { return !document.referrer || new URL(document.referrer).origin === window.location.origin; } catch { return false; } })();
  if (!fromSite) return;
  const a = el();
  loadTrack(state.i, state.t > 1 ? state.t : 0);
  a.play().catch(() => {
    const go = (e: Event) => { if ((e.target as Element | null)?.closest?.(".music-btn, #music-panel")) { off(); return; } off(); if (!state.playing) play(); };
    const off = () => { ["pointerdown", "keydown"].forEach((ev) => window.removeEventListener(ev, go, true)); };
    ["pointerdown", "keydown"].forEach((ev) => window.addEventListener(ev, go, { capture: true, once: true }));
  });
}
export function pause() { pending = false; set({ loading: false }); audio?.pause(); }
export function toggle() { if (state.playing) pause(); else play(); }
function pick(dir: 1 | -1) {
  if (!state.shuffle) return (state.i + dir + TRACKS.length) % TRACKS.length;
  const left = TRACKS.map((_, k) => k).filter((k) => k !== state.i && !played.slice(-(TRACKS.length - 2)).includes(k));
  return left[Math.floor(Math.random() * left.length)] ?? (state.i + 1) % TRACKS.length;
}
export function next(auto = false) {
  const was = state.playing || auto; played.push(state.i);
  loadTrack(pick(1)); if (was) play();
}
export function prev() {
  if (audio && audio.currentTime > 5) { audio.currentTime = 0; return; }
  const was = state.playing;
  const back = state.shuffle && played.length ? played.pop()! : pick(-1);
  loadTrack(back); if (was) play();
}
export function choose(i: number) { played.push(state.i); loadTrack(i); play(); }
export function seek(t: number) { if (audio && audio.src) audio.currentTime = t; set({ t }); save(true); }
export function setVolume(v: number) { if (audio) audio.volume = v; set({ vol: v }); save(true); }
export function setShuffle(on: boolean) { set({ shuffle: on }); save(true); }

const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
const snap = () => state;
export function useMusic() { return useSyncExternalStore(subscribe, snap, snap); }
export const fmtTime = (s: number) => { s = Math.max(0, Math.floor(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60; return (h ? `${h}:${String(m).padStart(2, "0")}` : `${m}`) + `:${String(r).padStart(2, "0")}`; };
