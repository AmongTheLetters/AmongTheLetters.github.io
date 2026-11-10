import { useCallback, useEffect, useRef, useState } from "react";
import { DIRECTORY_API_URL } from "./directory";
import { TOPAZ_API_URL } from "./topaz";

export type DirectoryResponse<T, M> = {
  items: T[]; meta: M; total: number; page: number; has_more: boolean;
  facets: { cat: number[]; all?: number; catAll?: number; acc?: number[]; region?: Record<string, number>; regionAll?: number; prov?: Record<string, number>; gen?: Record<string, number> };
  totals: Record<string, number>; genreTotals: Record<string, number>;
};
export async function siteRequest<T, M>(directory: "jade" | "topaz", action: "search" | "pick" | "counts", filters: object, options: { page?: number; exclude?: number[]; signal?: AbortSignal } = {}): Promise<DirectoryResponse<T, M>> {
  const params = new URLSearchParams({ f: JSON.stringify(filters), page: String(options.page ?? 1), page_size: "24" });
  if (options.exclude?.length) {
    if (options.exclude.length <= 100) params.set("exclude", options.exclude.join(","));
    else {
      const maximum = options.exclude.reduce((largest, id) => Math.max(largest, id), 0);
      const bits = new Uint8Array(Math.ceil((maximum + 1) / 8));
      for (const id of options.exclude) bits[id >>> 3] |= 1 << (id & 7);
      let binary = ""; for (const byte of bits) binary += String.fromCharCode(byte);
      params.set("seen", btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, ""));
    }
  }
  const response = await fetch(`${directory === "jade" ? DIRECTORY_API_URL : TOPAZ_API_URL}/${action}?${params}`, { signal: options.signal, credentials: "omit" });
  if (!(response.headers.get("content-type") || "").includes("json")) throw new Error("The directory is temporarily unavailable. Please try again.");
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message || "The directory could not load. Please try again.");
  return body;
}
export function useDirectoryPages<T, M>(directory: "jade" | "topaz", filters: { q: string }) {
  const [query, setQuery] = useState(filters.q);
  const [data, setData] = useState<DirectoryResponse<T, M> | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const abort = useRef<AbortController | null>(null);
  const loaded = useRef("");
  const failure = useRef<"search" | "more">("search");
  useEffect(() => { const timer = window.setTimeout(() => setQuery(filters.q), 200); return () => window.clearTimeout(timer); }, [filters.q]);
  const signature = JSON.stringify({ ...filters, q: query });
  useEffect(() => {
    abort.current?.abort();
    const controller = new AbortController(); abort.current = controller;
    failure.current = "search"; setBusy(true); setError("");
    siteRequest<T, M>(directory, "search", JSON.parse(signature), { signal: controller.signal })
      .then((body) => { if (!controller.signal.aborted) { loaded.current = signature; setData(body); } })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "The directory could not load."); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => abort.current?.abort();
  }, [directory, signature, retry]);
  const loadMore = useCallback(async () => {
    if (!data?.has_more || busy || loaded.current !== signature) return;
    const controller = new AbortController(); abort.current = controller;
    failure.current = "more"; setBusy(true); setError("");
    try {
      const next = await siteRequest<T, M>(directory, "search", JSON.parse(signature), { page: data.page + 1, signal: controller.signal });
      if (!controller.signal.aborted && loaded.current === signature) setData((current) => current ? { ...next, items: [...current.items, ...next.items] } : next);
    } catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "More listings could not load."); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }, [data, busy, directory, signature]);
  return { data, busy, error, failure: failure.current, loadMore, reload: () => { if (failure.current === "more") void loadMore(); else setRetry((n) => n + 1); } };
}
