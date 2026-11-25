/** The sky behind the Black & White theme: shooting stars that streak across and burn out. Pure logic, no drawing, so it can be tested. */
export const STARS = {
  maxMeteors: 8,
  maxMeteorsSlow: 4,
  maxSparks: 160,
  maxDt: 0.05,
  /** Average time between shooting stars (seconds), with a minimum gap. */
  meanGapSec: 2.6,
  minGapSec: 0.35,
  showerChance: 0.14,
} as const;

export type RGB = [number, number, number];
export type MeteorKind = "streak" | "faint" | "fireball";
type Rand = () => number;

export interface Meteor {
  kind: MeteorKind; x: number; y: number; dx: number; dy: number; speed: number;
  life: number; age: number; baseLength: number; width: number; color: RGB;
  sparkRate: number; sparkAcc: number; peak: number;
}
export interface Spark { x: number; y: number; vx: number; vy: number; life: number; age: number; size: number; color: RGB }

// Real meteors glow blue-white, white, gold, orange, and sometimes green or violet (the metals burning up).
const PALETTE: [number, RGB][] = [
  [40, [207, 232, 255]], [25, [255, 255, 255]], [15, [255, 216, 138]], [8, [255, 170, 107]], [6, [159, 245, 207]], [6, [229, 184, 255]],
];
const WARM: RGB[] = [[255, 216, 138], [255, 170, 107]];
const between = (rand: Rand, a: number, b: number) => a + rand() * (b - a);
const deg = (d: number) => (d * Math.PI) / 180;

export function pickColor(rand: Rand): RGB {
  let r = rand() * 100;
  for (const [weight, color] of PALETTE) { if (r < weight) return color; r -= weight; }
  return PALETTE[0]![1];
}

/** Direction in radians (screen coordinates, y grows downwards). Mostly falling, but any direction happens. */
export function randomAngle(rand: Rand): number {
  return rand() < 0.7 ? deg(between(rand, 20, 160)) : deg(between(rand, -180, 180));
}

export function spawnMeteor(w: number, h: number, rand: Rand = Math.random, angle?: number, allowFireball = true): Meteor {
  const r = rand();
  const kind: MeteorKind = r < 0.62 ? "streak" : r < 0.88 || !allowFireball ? "faint" : "fireball";
  const a = angle ?? randomAngle(rand);
  let speed: number, life: number, lengthFactor: number, width: number, peak: number, sparkRate: number;
  if (kind === "streak") {
    const cruiser = rand() < 0.4; // some drift slowly and stay on screen for several seconds
    speed = cruiser ? between(rand, 260, 520) : between(rand, 700, 1400); life = cruiser ? between(rand, 2.2, 4.2) : between(rand, 0.7, 1.4);
    lengthFactor = cruiser ? between(rand, 0.3, 0.5) : between(rand, 0.16, 0.28); width = between(rand, 1.6, 2.8); peak = between(rand, 0.85, 1); sparkRate = rand() < 0.5 ? between(rand, 8, 16) : 0; }
  else if (kind === "faint") { speed = between(rand, 300, 900); life = between(rand, 0.8, 2.2); lengthFactor = between(rand, 0.18, 0.3); width = between(rand, 1.0, 1.5); peak = between(rand, 0.35, 0.6); sparkRate = 0; }
  else { speed = between(rand, 140, 330); life = between(rand, 2.8, 5); lengthFactor = between(rand, 0.3, 0.45); width = between(rand, 3.5, 6); peak = 1; sparkRate = between(rand, 40, 60); }
  const color = kind === "fireball" && rand() < 0.6 ? WARM[Math.floor(rand() * WARM.length)]! : pickColor(rand);
  return {
    kind, x: rand() * w, y: rand() * h * 0.75, dx: Math.cos(a), dy: Math.sin(a), speed, life, age: 0,
    baseLength: speed * lengthFactor, width, color, sparkRate, sparkAcc: 0, peak,
  };
}

/** Brightness 0..1: flares up quickly, then fades away until it is gone. */
export function brightness(age: number, life: number, peak = 1): number {
  const u = Math.min(1, Math.max(0, age / life));
  const raw = u < 0.12 ? u / 0.12 : Math.pow(1 - (u - 0.12) / 0.88, 1.6);
  return Math.min(1, Math.max(0, raw * peak));
}

/** Where to draw a meteor: a tapered tail behind a bright head. */
export function meteorShape(m: Meteor) {
  const b = brightness(m.age, m.life, m.peak);
  const grow = Math.min(1, m.age / 0.2);
  const length = m.baseLength * (grow * grow * (3 - 2 * grow)) * (0.4 + 0.6 * b);
  return { hx: m.x, hy: m.y, tx: m.x - m.dx * length, ty: m.y - m.dy * length, nx: -m.dy, ny: m.dx, width: m.width, b, length, color: m.color, kind: m.kind };
}

/** Moves a meteor; false once it has burnt out or left the screen for good (it flies in a straight line). */
export function stepMeteor(m: Meteor, dt: number, w: number, h: number): boolean {
  m.age += dt;
  m.x += m.dx * m.speed * dt;
  m.y += m.dy * m.speed * dt;
  const margin = m.baseLength + 30;
  const gone = m.x < -margin || m.x > w + margin || m.y < -margin || m.y > h + margin;
  return m.age < m.life && !gone;
}

/** Seconds until the next shooting star: random, never too soon. */
export function nextSpawnDelay(rand: Rand = Math.random): number {
  return STARS.minGapSec - Math.log(1 - rand()) * (STARS.meanGapSec - STARS.minGapSec);
}

/** A small meteor shower: several meteors flying roughly the same way, one after another. */
export function planShower(w: number, h: number, rand: Rand = Math.random): { delay: number; meteor: Meteor }[] {
  const count = 3 + Math.floor(rand() * 4);
  const base = deg(between(rand, 25, 155));
  let delay = 0;
  return Array.from({ length: count }, () => {
    const entry = { delay, meteor: spawnMeteor(w, h, rand, base + deg(between(rand, -6, 6)), false) };
    delay += between(rand, 0.1, 0.4);
    return entry;
  });
}

export interface Sky {
  w: number; h: number; t: number; timer: number;
  meteors: Meteor[]; sparks: Spark[]; queue: { at: number; meteor: Meteor }[];
  maxMeteors: number; sparksOn: boolean; rand: Rand;
}

export function createSky(w: number, h: number, rand: Rand = Math.random): Sky {
  return { w, h, t: 0, timer: between(rand, 0.6, 1.6), meteors: [], sparks: [], queue: [], maxMeteors: STARS.maxMeteors, sparksOn: true, rand };
}

/** Advances the whole sky. Everything is bounded: stars burn out and sparks fade, so nothing ever piles up. */
export function stepSky(sky: Sky, dtSec: number): void {
  const dt = Math.min(Math.max(dtSec, 0), STARS.maxDt);
  const { rand } = sky;
  sky.t += dt;

  sky.timer -= dt;
  if (sky.timer <= 0) {
    sky.timer = nextSpawnDelay(rand);
    if (rand() < STARS.showerChance) for (const e of planShower(sky.w, sky.h, rand)) sky.queue.push({ at: sky.t + e.delay, meteor: e.meteor });
    else sky.queue.push({ at: sky.t, meteor: spawnMeteor(sky.w, sky.h, rand) });
  }
  if (sky.queue.length > 12) sky.queue.length = 12;
  for (let i = sky.queue.length - 1; i >= 0; i--) {
    const item = sky.queue[i]!;
    if (item.at > sky.t) continue;
    sky.queue.splice(i, 1);
    if (sky.meteors.length < sky.maxMeteors) sky.meteors.push(item.meteor);
  }

  for (let i = sky.meteors.length - 1; i >= 0; i--) {
    const m = sky.meteors[i]!;
    if (!stepMeteor(m, dt, sky.w, sky.h)) { sky.meteors.splice(i, 1); continue; }
    if (sky.sparksOn && m.sparkRate > 0 && brightness(m.age, m.life, m.peak) > 0.35) {
      m.sparkAcc += m.sparkRate * dt;
      while (m.sparkAcc >= 1) {
        m.sparkAcc -= 1;
        const s = meteorShape(m), back = rand() * s.length * 0.5;
        sky.sparks.push({
          x: s.hx - m.dx * back + (rand() - 0.5) * 6, y: s.hy - m.dy * back + (rand() - 0.5) * 6,
          vx: between(rand, -22, 22), vy: between(rand, -22, 22), life: between(rand, 0.7, 1.8), age: 0, size: between(rand, 0.7, 1.9), color: m.color,
        });
        if (sky.sparks.length > STARS.maxSparks) sky.sparks.shift();
      }
    }
  }

  for (let i = sky.sparks.length - 1; i >= 0; i--) {
    const s = sky.sparks[i]!;
    s.age += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= 0.98; s.vy *= 0.98;
    if (s.age >= s.life) sky.sparks.splice(i, 1);
  }
}

/** Fixed background stars (tiny dots), generated once per screen size. */
export interface BackdropStar { x: number; y: number; r: number; alpha: number; tint: RGB; twinkle: boolean; phase: number; freq: number }
export function starCount(w: number, h: number): number {
  return Math.round(Math.min(260, Math.max(60, (w * h) / 7000)));
}
export function createBackdropStars(w: number, h: number, rand: Rand = Math.random): BackdropStar[] {
  return Array.from({ length: starCount(w, h) }, (_, i) => {
    const t = rand();
    return {
      x: rand() * w, y: rand() * h, r: 0.4 + Math.pow(rand(), 3) * 1.1, alpha: 0.2 + rand() * 0.6,
      tint: t < 0.75 ? [255, 255, 255] : t < 0.9 ? [190, 215, 255] : [255, 235, 200],
      twinkle: i % 6 === 0, phase: rand() * Math.PI * 2, freq: between(rand, 0.6, 2.2),
    };
  });
}
