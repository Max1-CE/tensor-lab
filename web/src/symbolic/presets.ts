// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
/** Loads build-time precomputed analyses from public/precomputed/. */
import type { Analysis, PresetMeta } from "./types";

const base = `${import.meta.env.BASE_URL}precomputed/`;
const loaded = new Map<string, Promise<Analysis>>();

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

export function loadIndex(): Promise<PresetMeta[]> {
  return getJson<PresetMeta[]>(`${base}index.json`);
}

export function loadPreset(id: string): Promise<Analysis> {
  let p = loaded.get(id);
  if (!p) {
    p = getJson<Analysis>(`${base}${id}.json`);
    loaded.set(id, p);
  }
  return p;
}
