/** Lehké spojení mezi scrollem (GSAP) a 3D scénou, bez importu Three.js. */

export type PartId = 'esp' | 'oled' | 'enc' | 'pads';

interface ExplodeState {
  /** 0 = sestaveno, 1 = rozloženo. */
  progress: number;
  /** 0 = kamera u spodní vrstvy, 1 = u horní. */
  travel: number;
  active: PartId | null;
}

const state: ExplodeState = { progress: 0, travel: 0, active: null };
const listeners = new Set<() => void>();

export const explodeState: Readonly<ExplodeState> = state;

export function setExplode(progress: number, travel: number, active: PartId | null): void {
  const p = Math.min(1, Math.max(0, progress));
  const t = Math.min(1, Math.max(0, travel));
  if (p === state.progress && t === state.travel && active === state.active) return;
  state.progress = p;
  state.travel = t;
  state.active = active;
  listeners.forEach((fn) => fn());
}

export function onExplode(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
