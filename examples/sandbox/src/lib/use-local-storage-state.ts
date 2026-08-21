"use client";
import { useCallback, useMemo, useSyncExternalStore } from "react";

export interface StorageCodec<T> {
  parse: (raw: string) => T;
  stringify: (value: T) => string;
}

export interface StorageStateOptions<T> {
  codec?: StorageCodec<T>;
}

// Same-tab writes do not fire the browser "storage" event, so every hook instance
// also subscribes to this in-memory set and setValue notifies it explicitly.
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function notify() {
  listeners.forEach((listener) => listener());
}

const stringCodec: StorageCodec<string> = {
  parse: (raw) => raw,
  stringify: (value) => value,
};

/**
 * React state backed by one localStorage key. All hook instances sharing a key stay in sync,
 * including across browser tabs. Setting `null` removes the key.
 */
export function useLocalStorageState<T = string>(
  key: string,
  initialValue: T | null = null,
  options?: StorageStateOptions<T>,
): [T | null, (value: T | null) => void] {
  const codec = (options?.codec ?? stringCodec) as StorageCodec<T>;

  const raw = useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(key),
    () => null,
  );

  // Memoized so object values keep a stable identity between renders; callers use them in effect deps.
  const value = useMemo(
    () => (raw === null ? initialValue : codec.parse(raw)),
    [raw, initialValue, codec],
  );

  const setValue = useCallback(
    (next: T | null) => {
      if (next === null) {
        window.localStorage.removeItem(key);
      } else {
        window.localStorage.setItem(key, codec.stringify(next));
      }
      notify();
    },
    [key, codec],
  );

  return [value, setValue];
}
