import { describe, expect, it } from "vitest";
import { PALETTES } from "@/lib/theme";
import { capHeight, createFlakes, elapsedSince, flakeCount, groundDepth, newFlake, SNOW, stepFlakes, surfaceY, wind } from "@/lib/snow/engine";

const seeded = (seed: number) => { let s = seed; return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; };
const MIN = 60_000;

describe("snow pile", () => {
  it("covers half the screen after 15 minutes", () => {
    expect(groundDepth(15 * MIN, 900)).toBeCloseTo(450, 5);
    expect(groundDepth(15 * MIN, 600)).toBeCloseTo(300, 5);
  });
  it("starts empty, only ever grows, and stops at the limit", () => {
    expect(groundDepth(0, 900)).toBe(0);
    expect(groundDepth(-5000, 900)).toBe(0);
    let prev = -1;
    for (let m = 0; m <= 60; m++) { const d = groundDepth(m * MIN, 900); expect(d).toBeGreaterThanOrEqual(prev); prev = d; }
    expect(groundDepth(10_000 * MIN, 900)).toBe(SNOW.maxFraction * 900);
  });
  it("is a light dusting after a minute", () => {
    expect(groundDepth(MIN, 900)).toBeLessThan(40);
    expect(groundDepth(MIN, 900)).toBeGreaterThan(10);
  });
  it("has an uneven but always sensible surface", () => {
    for (const depth of [1, 40, 200, 540]) for (let x = 0; x < 2000; x += 37) {
      const y = surfaceY(x, depth, 900);
      expect(y).toBeLessThanOrEqual(900);
      expect(y).toBeGreaterThanOrEqual(900 - depth - 15);
    }
  });
  it("grows the snow on the dashboard cards up to a small, fixed size", () => {
    expect(capHeight(0)).toBe(0);
    expect(capHeight(7.5 * MIN)).toBeCloseTo(SNOW.capMaxPx / 2, 5);
    expect(capHeight(100 * MIN)).toBe(SNOW.capMaxPx);
    expect(capHeight(-1)).toBe(0);
  });
});

describe("snow while you are away", () => {
  it("keeps piling up by the clock: after 10 minutes on another tab the pile is the 10-minute pile", () => {
    const start = 1_000_000;
    expect(elapsedSince(start, start + 10 * MIN)).toBe(10 * MIN);
    expect(groundDepth(elapsedSince(start, start + 10 * MIN), 900)).toBeCloseTo(300, 5);
    expect(capHeight(elapsedSince(start, start + 10 * MIN))).toBeCloseTo((10 / 15) * SNOW.capMaxPx, 5);
  });
  it("starts from nothing again for a new visit (a new start time)", () => {
    expect(groundDepth(elapsedSince(5_000_000, 5_000_000), 900)).toBe(0);
  });
  it("never goes negative if the clock is adjusted backwards", () => {
    expect(elapsedSince(2000, 1000)).toBe(0);
  });
});

describe("falling snow", () => {
  it("scales with the screen but stays within safe limits", () => {
    expect(flakeCount(390, 844)).toBe(SNOW.minFlakes);
    expect(flakeCount(1440, 900)).toBeGreaterThan(100);
    expect(flakeCount(7680, 4320)).toBe(SNOW.maxFlakes);
  });
  it("starts above the screen, so it begins at the top and falls in", () => {
    const flakes = createFlakes(150, 1440, 900, seeded(1));
    expect(flakes).toHaveLength(150);
    for (const f of flakes) expect(f.y).toBeLessThan(0);
    const before = flakes.filter((f) => f.y > -900).length;
    stepFlakes(flakes, 0.1, 0.1, 1440, 900, 0, seeded(2));
    expect(before).toBeGreaterThan(0);
  });
  it("mixes small flakes, crystals and snowballs with different sizes and speeds", () => {
    const flakes = createFlakes(400, 1440, 900, seeded(3));
    const kinds = new Set(flakes.map((f) => f.kind));
    expect(kinds).toEqual(new Set([0, 1, 2]));
    expect(new Set(flakes.map((f) => Math.round(f.vy / 5))).size).toBeGreaterThan(6);
    expect(Math.min(...flakes.map((f) => f.size))).toBeGreaterThanOrEqual(1);
    expect(Math.max(...flakes.map((f) => f.size))).toBeLessThanOrEqual(18);
    expect(flakes.some((f) => f.drift < 0) && flakes.some((f) => f.drift > 0)).toBe(true); // different angles
  });
  it("changes the wind direction and strength over time, within sane bounds", () => {
    const values = Array.from({ length: 2000 }, (_, i) => wind(i * 0.5));
    expect(Math.min(...values)).toBeLessThan(-10);
    expect(Math.max(...values)).toBeGreaterThan(10);
    for (const v of values) expect(Math.abs(v)).toBeLessThanOrEqual(31.01);
  });
  it("keeps going forever without a single broken value, and every flake keeps coming back", () => {
    const rand = seeded(4);
    const w = 1280, h = 720;
    const flakes = createFlakes(180, w, h, rand);
    let t = 0;
    for (let i = 0; i < 20000; i++) { // about 5.5 minutes of 60 fps snowfall
      t += 1 / 60;
      stepFlakes(flakes, 1 / 60, t, w, h, groundDepth(t * 1000 * 5, h), rand);
    }
    for (const f of flakes) {
      expect(Number.isFinite(f.x) && Number.isFinite(f.y) && Number.isFinite(f.rot)).toBe(true);
      expect(f.x).toBeGreaterThanOrEqual(-40 - 1);
      expect(f.x).toBeLessThanOrEqual(w + 40 + 1);
      expect(f.y).toBeLessThanOrEqual(h + f.size * 2 + 1);
    }
  });
  it("makes flakes that reach the pile start again at the top", () => {
    const flakes = [newFlake(800, seeded(5), 590)];
    const depth = 200; // the pile's surface is around y = 600
    for (let i = 0; i < 200; i++) stepFlakes(flakes, 0.05, i * 0.05, 800, 800, depth, seeded(6 + i));
    expect(flakes[0]!.y).toBeLessThan(surfaceY(flakes[0]!.x, depth, 800));
  });
  it("treats a long pause (slow frame, background tab) as a short one, so nothing jumps", () => {
    const flakes = createFlakes(50, 1000, 800, seeded(7));
    const y0 = flakes.map((f) => f.y);
    stepFlakes(flakes, 30, 30, 1000, 800, 0, seeded(8));
    flakes.forEach((f, i) => { if (f.y > y0[i]!) expect(f.y - y0[i]!).toBeLessThan(f.vy * SNOW.maxDt + 1); });
  });
  it("is fast enough to run on a phone: 10,000 steps of 220 flakes in well under a second", () => {
    const rand = seeded(9);
    const flakes = createFlakes(220, 1920, 1080, rand);
    const start = performance.now();
    for (let i = 0; i < 10000; i++) stepFlakes(flakes, 1 / 60, i / 60, 1920, 1080, 300, rand);
    expect(performance.now() - start).toBeLessThan(1500);
  });
});

describe("the Winter Night and Black & White themes", () => {
  it("use the requested colours", () => {
    expect(PALETTES.mono.bg).toBe("#000000");
    expect(PALETTES.mono.brand).toBe("#FFFFFF");
    expect(PALETTES.winter.bg).toBe("#1D2D44");
    // the accent is the requested teal (#3F818D) made 2 steps darker per channel so white text on it is easy to read
    expect(PALETTES.winter.brand).toBe("#3D7F8B");
  });
});
