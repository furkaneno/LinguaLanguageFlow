/** The physics behind the Winter theme's snowfall. Pure functions, no drawing, so every rule can be tested. */
export const SNOW = {
  /** After this long of snowfall, the pile covers `halfCoverFraction` of the screen height. */
  halfCoverMs: 15 * 60_000,
  halfCoverFraction: 0.5,
  /** The pile stops growing here, so the page never disappears under snow. */
  maxFraction: 0.6,
  /** Snow on the dashboard cards reaches full size after this long. */
  capFullMs: 15 * 60_000,
  capMaxPx: 16,
  /** A long pause (slow frame, hidden tab) is treated as at most this many seconds. */
  maxDt: 0.1,
  minFlakes: 60,
  maxFlakes: 220,
} as const;

/** Height of the snow pile in pixels after `elapsedMs` of snowfall on a screen `h` tall. */
export function groundDepth(elapsedMs: number, h: number): number {
  const fraction = Math.max(0, elapsedMs) * (SNOW.halfCoverFraction / SNOW.halfCoverMs);
  return Math.min(SNOW.maxFraction, fraction) * h;
}

/** Height in pixels of the snow cap on a card. */
export function capHeight(elapsedMs: number): number {
  return Math.min(1, Math.max(0, elapsedMs) / SNOW.capFullMs) * SNOW.capMaxPx;
}

/** Number of flakes for a screen: more on big screens, never so many that a phone struggles. */
export function flakeCount(w: number, h: number): number {
  return Math.round(Math.min(SNOW.maxFlakes, Math.max(SNOW.minFlakes, (w * h) / 9000)));
}

/** 0 = small dot, 1 = crystal, 2 = soft snowball. */
export type FlakeKind = 0 | 1 | 2;
export interface Flake {
  kind: FlakeKind; x: number; y: number; size: number; vy: number;
  swayAmp: number; swayFreq: number; phase: number; drift: number; windFactor: number;
  rot: number; rotSpeed: number; alpha: number;
}
type Rand = () => number;

const between = (rand: Rand, a: number, b: number) => a + rand() * (b - a);

/** One flake, just above the top of the screen. */
export function newFlake(w: number, rand: Rand = Math.random, startY?: number): Flake {
  const r = rand();
  const kind: FlakeKind = r < 0.7 ? 0 : r < 0.88 ? 1 : 2;
  const size = kind === 0 ? between(rand, 1, 3) : kind === 1 ? between(rand, 9, 18) : between(rand, 5, 12);
  // Bigger flakes are nearer, so they fall faster; small ones are pushed around more by the wind.
  const vy = between(rand, 22, 55) + size * (kind === 0 ? 7 : 2.2);
  return {
    kind, size, vy,
    x: rand() * (w + 80) - 40,
    y: startY ?? -size - rand() * 60,
    swayAmp: between(rand, 4, 22), swayFreq: between(rand, 0.5, 1.6), phase: rand() * Math.PI * 2,
    drift: between(rand, -7, 7),
    windFactor: Math.min(1, Math.max(0.45, 1 - size / 40)),
    rot: rand() * Math.PI * 2, rotSpeed: between(rand, -0.8, 0.8),
    alpha: kind === 2 ? between(rand, 0.35, 0.6) : between(rand, 0.55, 0.95),
  };
}

/** All flakes start above the screen, spread out, so the snow begins at the top and comes down. */
export function createFlakes(count: number, w: number, h: number, rand: Rand = Math.random): Flake[] {
  return Array.from({ length: count }, () => newFlake(w, rand, -rand() * h - 4));
}

/** Gusts: a slow wind that changes direction and strength (pixels per second, roughly -30 to +30). */
export function wind(tSec: number): number {
  return Math.sin(tSec * 0.05) * 18 + Math.sin(tSec * 0.19 + 1.3) * 10 + Math.sin(tSec * 0.6) * 3;
}

/** Top edge of the snow pile at column `x`: gently uneven, like real drifts. */
export function surfaceY(x: number, depth: number, h: number): number {
  const amp = Math.min(14, depth * 0.12);
  const bumps = Math.sin(x * 0.011 + 1.3) + 0.6 * Math.sin(x * 0.027 + 0.4) + 0.3 * Math.sin(x * 0.061 + 2.1);
  return h - depth - (amp * (bumps + 1.9)) / 3.8;
}

/** Moves every flake forward by `dtSec`. A flake that reaches the pile (or leaves the screen) starts again at the top. */
export function stepFlakes(flakes: Flake[], dtSec: number, tSec: number, w: number, h: number, depth: number, rand: Rand = Math.random): void {
  const dt = Math.min(Math.max(dtSec, 0), SNOW.maxDt);
  const gust = wind(tSec);
  for (const f of flakes) {
    f.phase += f.swayFreq * dt;
    f.x += (gust * f.windFactor + f.drift + Math.sin(f.phase) * f.swayAmp) * dt;
    f.y += f.vy * dt;
    f.rot += f.rotSpeed * dt;
    if (f.x < -40) f.x += w + 80; else if (f.x > w + 40) f.x -= w + 80; // wrap sideways so wind never empties one side
    const ground = depth > 0.5 ? surfaceY(f.x, depth, h) : h + f.size;
    if (f.y >= ground || f.y > h + f.size * 2) {
      const next = newFlake(w, rand);
      f.x = next.x; f.y = next.y; f.vy = next.vy; f.drift = next.drift; f.swayAmp = next.swayAmp; f.swayFreq = next.swayFreq;
    }
  }
}

/** Time since the snowfall began, by the clock: it keeps counting while the tab is in the background. */
export const elapsedSince = (startMs: number, nowMs: number): number => Math.max(0, nowMs - startMs);
