/** Lehké spojení mezi scrollem (GSAP) a 3D scénou, bez importu Three.js. */

export type PartId = 'esp' | 'oled' | 'enc' | 'pads';

interface ExplodeState {
  progress: number;
  active: PartId | null;
}

const state: ExplodeState = { progress: 0, active: null };
const listeners = new Set<() => void>();

export const explodeState: Readonly<ExplodeState> = state;

export function setExplode(progress: number, active: PartId | null): void {
  const p = Math.min(1, Math.max(0, progress));
  if (p === state.progress && active === state.active) return;
  state.progress = p;
  state.active = active;
  listeners.forEach((fn) => fn());
}

export function onExplode(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
