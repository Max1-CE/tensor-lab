// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
/** The current orbit and its integrated track (memoised; shared by canvas and panel). */
import { integrateOrbit, orbitFromTurningPoints, precessionExact, precessionWeak, type Orbit, type Track } from "./orbits";

export const TURNS = 8;
export const STEPS_PER_TURN = 360;

export interface OrbitView {
  orbit: Orbit;
  track: Track;
  precession: number; // exact, rad per orbit
  weak: number; // 6πM/p
  /** φ of each periapsis along the track (for markers). */
  periapses: number[];
}

let last: { key: string; value: OrbitView } | null = null;

export function orbitView(M: number, rpX: number, raX: number): OrbitView {
  const key = `${M}|${rpX}|${raX}`;
  if (last?.key === key) return last.value;
  const orbit = orbitFromTurningPoints(M, rpX * M, raX * M);
  const track = integrateOrbit(orbit, TURNS, STEPS_PER_TURN);
  const precession = orbit.valid ? precessionExact(orbit) : NaN;
  // starting from apoapsis, periapses sit at half an orbit plus k orbits
  const periapses: number[] = [];
  if (orbit.valid) {
    const per = 2 * Math.PI + precession;
    for (let phi = per / 2; phi <= 2 * Math.PI * TURNS; phi += per) periapses.push(phi);
  }
  const value = { orbit, track, precession, weak: precessionWeak(orbit), periapses };
  last = { key, value };
  return value;
}

/** r at angle φ by linear interpolation along the track. */
export function rAt(t: Track, phi: number): number {
  const h = t.phi[1] - t.phi[0];
  const i = Math.min(t.phi.length - 2, Math.max(0, Math.floor(phi / h)));
  const f = (phi - t.phi[i]) / h;
  return t.r[i] * (1 - f) + t.r[i + 1] * f;
}
