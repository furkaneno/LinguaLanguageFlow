import { describe, expect, it } from "vitest";
import {
  brightness, createBackdropStars, createSky, meteorShape, nextSpawnDelay, pickColor, planShower, randomAngle, spawnMeteor,
  starCount, STARS, stepMeteor, stepSky, type Meteor,
} from "@/lib/stars/engine";
import { PALETTES } from "@/lib/theme";

const seeded = (seed: number) => { let s = seed; return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; };
const W = 1440, H = 900;

describe("kinds, colours and directions", () => {
  it("makes several kinds of shooting stars, fireballs being the rarest", () => {
    const rand = seeded(1);
    const kinds = { streak: 0, faint: 0, fireball: 0 };
    for (let i = 0; i < 2000; i++) kinds[spawnMeteor(W, H, rand).kind]++;
    expect(kinds.streak).toBeGreaterThan(kinds.faint);
    expect(kinds.faint).toBeGreaterThan(kinds.fireball);
    expect(kinds.fireball).toBeGreaterThan(100);
  });
  it("uses different colours, all valid", () => {
    const rand = seeded(2);
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) { const c = pickColor(rand); expect(c.every((v) => v >= 0 && v <= 255)).toBe(true); seen.add(c.join(",")); }
    expect(seen.size).toBe(6);
  });
  it("flies in every direction, mostly downwards, never in lockstep", () => {
    const rand = seeded(3);
    const dirs = Array.from({ length: 1500 }, () => spawnMeteor(W, H, rand));
    for (const m of dirs) expect(Math.hypot(m.dx, m.dy)).toBeCloseTo(1, 6);
    const down = dirs.filter((m) => m.dy > 0.3).length / dirs.length;
    expect(down).toBeGreaterThan(0.55);
    expect(down).toBeLessThan(0.9);
    expect(dirs.some((m) => m.dx > 0.5) && dirs.some((m) => m.dx < -0.5) && dirs.some((m) => m.dy < -0.5)).toBe(true);
    expect(new Set(dirs.map((m) => Math.round(Math.atan2(m.dy, m.dx) * 10))).size).toBeGreaterThan(30);
    expect(Number.isFinite(randomAngle(rand))).toBe(true);
  });
  it("gives slow fireballs, fast streaks and dim faint ones different speeds, lengths and brightness", () => {
    const rand = seeded(4);
    const by = (k: string) => Array.from({ length: 1500 }, () => spawnMeteor(W, H, rand)).filter((m) => m.kind === k);
    const fire = by("fireball"), streak = by("streak"), faint = by("faint");
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(avg(fire.map((m) => m.speed))).toBeLessThan(avg(streak.map((m) => m.speed)));
    expect(avg(fire.map((m) => m.life))).toBeGreaterThan(avg(streak.map((m) => m.life)));
    expect(Math.min(...fire.map((m) => m.width))).toBeGreaterThan(Math.max(...streak.map((m) => m.width)));
    expect(Math.max(...faint.map((m) => m.peak))).toBeLessThan(Math.min(...streak.map((m) => m.peak)));
    expect(fire.every((m) => m.sparkRate > 0)).toBe(true);
    expect(faint.every((m) => m.sparkRate === 0)).toBe(true);
  });
  it("starts every meteor on screen", () => {
    const rand = seeded(5);
    for (let i = 0; i < 500; i++) { const m = spawnMeteor(W, H, rand); expect(m.x).toBeGreaterThanOrEqual(0); expect(m.x).toBeLessThanOrEqual(W); expect(m.y).toBeLessThanOrEqual(H * 0.75); }
  });
});

describe("slow and long-lasting shooting stars", () => {
  const sample = () => { const rand = seeded(30); return Array.from({ length: 3000 }, () => spawnMeteor(W, H, rand)); };
  it("lets some drift slowly and stay on screen for several seconds, while others are quick", () => {
    const streaks = sample().filter((m) => m.kind === "streak");
    const slow = streaks.filter((m) => m.speed < 520), quick = streaks.filter((m) => m.speed > 700);
    expect(slow.length).toBeGreaterThan(streaks.length * 0.3);
    expect(quick.length).toBeGreaterThan(streaks.length * 0.5);
    expect(Math.min(...slow.map((m) => m.life))).toBeGreaterThanOrEqual(2.2);
    expect(Math.max(...quick.map((m) => m.life))).toBeLessThanOrEqual(1.4);
  });
  it("keeps the slow ones easy to follow: modest speed, a clearly visible tail", () => {
    for (const m of sample().filter((m) => m.speed < 520)) {
      expect(m.baseLength).toBeGreaterThan(70);
      expect(m.speed * m.life).toBeGreaterThan(500); // they cross a good part of the screen
    }
  });
  it("is slower overall than before: the fastest are still fast, but the average streak lives longer", () => {
    const all = sample();
    expect(all.filter((m) => m.life >= 2).length).toBeGreaterThan(all.length * 0.3);
    expect(Math.max(...all.map((m) => m.speed))).toBeLessThanOrEqual(1400);
    expect(Math.min(...all.map((m) => m.speed))).toBeGreaterThanOrEqual(140);
  });
  it("never lives longer than five seconds, so nothing lingers", () => {
    expect(Math.max(...sample().map((m) => m.life))).toBeLessThanOrEqual(5);
  });
});

describe("one shooting star", () => {
  it("flares up fast and then fades to nothing", () => {
    expect(brightness(0, 1)).toBe(0);
    expect(brightness(1, 1)).toBe(0);
    expect(brightness(0.12, 1)).toBeCloseTo(1, 6);
    let prev = 1;
    for (let u = 0.12; u <= 1; u += 0.02) { const b = brightness(u, 1); expect(b).toBeLessThanOrEqual(prev + 1e-9); expect(b).toBeGreaterThanOrEqual(0); prev = b; }
    expect(brightness(0.12, 1, 0.4)).toBeCloseTo(0.4, 6);
  });
  it("draws a tail that grows from nothing and always points back along its path", () => {
    const m: Meteor = spawnMeteor(W, H, seeded(6), 1.0);
    expect(meteorShape(m).length).toBe(0);
    m.age = 0.3 * m.life;
    const s = meteorShape(m);
    expect(s.length).toBeGreaterThan(10);
    expect((s.hx - s.tx) * m.dx + (s.hy - s.ty) * m.dy).toBeGreaterThan(0);
    expect(Math.hypot(s.hx - s.tx, s.hy - s.ty)).toBeCloseTo(s.length, 5);
  });
  it("moves along its direction at its speed, and ends when it burns out or leaves the screen", () => {
    const m = spawnMeteor(W, H, seeded(7), Math.PI / 2);
    m.x = 500; m.y = 100; m.life = 10;
    expect(stepMeteor(m, 0.05, W, H)).toBe(true);
    expect(m.y).toBeCloseTo(100 + m.speed * 0.05, 4);
    expect(m.x).toBeCloseTo(500, 4);
    for (let i = 0; i < 400; i++) if (!stepMeteor(m, 0.05, W, H)) break;
    expect(m.y).toBeGreaterThan(H);
    const burnt = spawnMeteor(W, H, seeded(8), 0); burnt.life = 0.2; burnt.x = 10; burnt.y = 10;
    expect(stepMeteor(burnt, 0.3, W, H)).toBe(false);
  });
});

describe("the sky", () => {
  it("waits a random time between shooting stars, never too soon, about 2.6 s on average", () => {
    const rand = seeded(9);
    const gaps = Array.from({ length: 4000 }, () => nextSpawnDelay(rand));
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(STARS.minGapSec);
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    expect(mean).toBeGreaterThan(2.2);
    expect(mean).toBeLessThan(3.1);
  });
  it("sometimes sends a small shower that flies roughly the same way, one after another", () => {
    const shower = planShower(W, H, seeded(10));
    expect(shower.length).toBeGreaterThanOrEqual(3);
    expect(shower.length).toBeLessThanOrEqual(6);
    const angles = shower.map((e) => Math.atan2(e.meteor.dy, e.meteor.dx));
    expect(Math.max(...angles) - Math.min(...angles)).toBeLessThan((14 * Math.PI) / 180);
    for (let i = 1; i < shower.length; i++) expect(shower[i]!.delay).toBeGreaterThan(shower[i - 1]!.delay);
    expect(shower.every((e) => e.meteor.kind !== "fireball")).toBe(true);
  });
  it("starts with a first shooting star soon", () => {
    const sky = createSky(W, H, seeded(11));
    let t = 0;
    while (sky.meteors.length === 0 && t < 5) { stepSky(sky, 0.016); t += 0.016; }
    expect(sky.meteors.length).toBeGreaterThan(0);
    expect(t).toBeLessThan(2.5);
  });
  it("runs for ages without anything piling up, breaking, or leaving star dust behind", () => {
    const sky = createSky(W, H, seeded(12));
    let maxMeteors = 0, maxSparks = 0, sawFireball = false, sawShower = false;
    for (let i = 0; i < 60 * 60 * 10; i++) { // ten minutes at 60 fps
      stepSky(sky, 1 / 60);
      maxMeteors = Math.max(maxMeteors, sky.meteors.length);
      maxSparks = Math.max(maxSparks, sky.sparks.length);
      if (sky.meteors.some((m) => m.kind === "fireball")) sawFireball = true;
      if (sky.meteors.length >= 3) sawShower = true;
      expect(sky.queue.length).toBeLessThanOrEqual(12);
    }
    expect(maxMeteors).toBeLessThanOrEqual(STARS.maxMeteors);
    expect(maxSparks).toBeLessThanOrEqual(STARS.maxSparks);
    expect(sawFireball && sawShower).toBe(true);
    for (const m of sky.meteors) expect([m.x, m.y, m.age].every(Number.isFinite)).toBe(true);
    for (const p of sky.sparks) expect([p.x, p.y, p.age].every(Number.isFinite)).toBe(true);
  });
  it("everything dies out once the shooting stops: no star dust is left over", () => {
    const sky = createSky(W, H, seeded(13));
    for (let i = 0; i < 600; i++) stepSky(sky, 1 / 60);
    sky.timer = 1e9; sky.queue.length = 0;
    for (let i = 0; i < 60 * 12; i++) stepSky(sky, 1 / 60);
    expect(sky.meteors).toHaveLength(0);
    expect(sky.sparks).toHaveLength(0);
  });
  it("makes star dust only for bright meteors, and none when the device is slow", () => {
    const sky = createSky(W, H, seeded(14));
    sky.sparksOn = false;
    for (let i = 0; i < 3000; i++) stepSky(sky, 1 / 60);
    expect(sky.sparks).toHaveLength(0);
    const sky2 = createSky(W, H, seeded(15));
    let dust = 0;
    for (let i = 0; i < 3000; i++) { stepSky(sky2, 1 / 60); dust = Math.max(dust, sky2.sparks.length); }
    expect(dust).toBeGreaterThan(5);
  });
  it("treats a long pause as a short one, so nothing jumps", () => {
    const sky = createSky(W, H, seeded(16));
    sky.meteors.push(spawnMeteor(W, H, seeded(17), 1));
    const y0 = sky.meteors[0]!.y;
    stepSky(sky, 30);
    expect(Math.abs(sky.meteors[0]!.y - y0)).toBeLessThan(sky.meteors[0]!.speed * STARS.maxDt + 1);
  });
  it("is fast enough for a phone: ten minutes of sky in about a second", () => {
    const sky = createSky(1920, 1080, seeded(18));
    const start = performance.now();
    for (let i = 0; i < 36000; i++) stepSky(sky, 1 / 60);
    expect(performance.now() - start).toBeLessThan(2000);
  });
});

describe("the background stars and the theme", () => {
  it("scales the number of fixed stars with the screen, within limits", () => {
    expect(starCount(390, 844)).toBe(60); // a phone: the computed 47 is raised to the minimum
    expect(starCount(1440, 900)).toBe(Math.round((1440 * 900) / 7000));
    expect(starCount(100, 100)).toBe(60);
    expect(starCount(7680, 4320)).toBe(260);
    const stars = createBackdropStars(W, H, seeded(19));
    expect(stars.every((s) => s.x >= 0 && s.x <= W && s.y >= 0 && s.y <= H && s.r > 0 && s.alpha > 0 && s.alpha <= 1)).toBe(true);
    expect(stars.some((s) => s.twinkle) && stars.some((s) => !s.twinkle)).toBe(true);
  });
  it("is the Black & White theme that has the shooting stars", () => {
    expect(PALETTES.mono.pattern).toBe("stars");
    expect(PALETTES.mono.bg).toBe("#000000");
  });
});
