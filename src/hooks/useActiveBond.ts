import { useSyncExternalStore, useCallback } from "react";

const KEY = "lumen.activeBondId";
const listeners = new Set<() => void>();
let cached: string | null = null;
let hydrated = false;

function read(): string | null {
  if (typeof window === "undefined") return null;
  if (!hydrated) {
    cached = window.localStorage.getItem(KEY);
    hydrated = true;
  }
  return cached;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function setActiveBondId(id: string | null) {
  cached = id;
  hydrated = true;
  if (typeof window !== "undefined") {
    if (id) window.localStorage.setItem(KEY, id);
    else window.localStorage.removeItem(KEY);
  }
  listeners.forEach((l) => l());
}

/**
 * The bond the user is currently looking at. `undefined` on the server and
 * before hydration, which makes the server fall back to the most recent bond.
 */
export function useActiveBondId() {
  const id = useSyncExternalStore(
    subscribe,
    () => read(),
    () => null,
  );
  const set = useCallback((next: string | null) => setActiveBondId(next), []);
  return [id ?? undefined, set] as const;
}
