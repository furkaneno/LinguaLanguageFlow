"use client";
import { useEffect, useRef } from "react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { capHeight, createFlakes, elapsedSince, flakeCount, groundDepth, newFlake, stepFlakes, surfaceY, type Flake, type FlakeKind } from "@/lib/snow/engine";
import { PALETTES } from "@/lib/theme";

function makeSprite(size: number, paint: (c: CanvasRenderingContext2D, s: number) => void): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const c = canvas.getContext("2d");
  if (c) paint(c, size);
  return canvas;
}

/** Flakes are drawn once into small images and then only copied, which is what keeps the animation smooth. */
function makeSprites(dpr: number): Record<FlakeKind, HTMLCanvasElement> {
  const S = Math.round(64 * dpr);
  const glow = (stops: [number, string][]) => (c: CanvasRenderingContext2D, s: number) => {
    const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    for (const [at, color] of stops) g.addColorStop(at, color);
    c.fillStyle = g; c.fillRect(0, 0, s, s);
  };
  return {
    0: makeSprite(S, glow([[0, "rgba(255,255,255,1)"], [0.55, "rgba(255,255,255,0.85)"], [1, "rgba(255,255,255,0)"]])),
    2: makeSprite(S, glow([[0, "rgba(255,255,255,0.95)"], [0.5, "rgba(232,244,250,0.55)"], [1, "rgba(232,244,250,0)"]])),
    1: makeSprite(S, (c, s) => {
      c.translate(s / 2, s / 2);
      c.strokeStyle = "rgba(255,255,255,0.95)"; c.lineCap = "round"; c.lineWidth = s * 0.05;
      const r = s * 0.42, b = r * 0.26;
      for (let i = 0; i < 6; i++) {
        c.save(); c.rotate((i * Math.PI) / 3);
        c.beginPath(); c.moveTo(0, 0); c.lineTo(r, 0);
        c.moveTo(r * 0.55, 0); c.lineTo(r * 0.55 + b, b); c.moveTo(r * 0.55, 0); c.lineTo(r * 0.55 + b, -b);
        c.stroke(); c.restore();
      }
    }),
  };
}

function drawGround(ctx: CanvasRenderingContext2D, w: number, h: number, depth: number) {
  const step = 6;
  ctx.beginPath(); ctx.moveTo(0, h);
  for (let x = 0; x <= w + step; x += step) { const cx = Math.min(x, w); ctx.lineTo(cx, surfaceY(cx, depth, h)); }
  ctx.lineTo(w, h); ctx.closePath();
  const g = ctx.createLinearGradient(0, h - depth - 14, 0, h);
  g.addColorStop(0, "#F8FCFE"); g.addColorStop(0.15, "#EAF3F7"); g.addColorStop(1, "#B7CFDA");
  ctx.fillStyle = g; ctx.fill();
  ctx.beginPath();
  for (let x = 0; x <= w + step; x += step) { const cx = Math.min(x, w); const y = surfaceY(cx, depth, h); if (x === 0) ctx.moveTo(cx, y); else ctx.lineTo(cx, y); }
  ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 2; ctx.stroke();
}

/**
 * Winter Night backdrop: snow of mixed sizes falls on a changing wind and slowly piles up (half the screen after 15 minutes).
 * It starts from nothing every time the theme is entered or the page is loaded. The pile keeps growing by the clock even while
 * you are on another tab (the falling itself only animates while the tab is visible), it lightens itself on slow devices,
 * and it shows a still picture for people who asked their device to reduce motion.
 */
export function Snowfall() {
  const { theme } = useTheme();
  const active = PALETTES[theme].pattern === "snow";
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!active || !canvas || !ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const sprites = makeSprites(dpr);
    const root = document.documentElement;
    let w = 0, h = 0, flakes: Flake[] = [];
    const startedAt = Date.now();
    const wallMs = () => elapsedSince(startedAt, Date.now()); // the pile and the card snow follow the clock
    let motion = 0;             // seconds of animation actually shown; drives the wind
    let last = 0, raf = 0, avg = 16, slow = 0;
    let sky: CanvasGradient | null = null;

    const setCap = () => root.style.setProperty("--snow-cap", String(reduce ? 4 : +capHeight(wallMs()).toFixed(1)));
    setCap();

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      if (sky) { ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h); }
      const depth = reduce ? h * 0.05 : groundDepth(wallMs(), h);
      if (depth > 0.5) drawGround(ctx, w, h, depth);
      for (const f of flakes) {
        ctx.globalAlpha = f.alpha;
        const d = f.kind === 0 ? f.size * 2.6 : f.size * 2;
        if (f.kind === 1) {
          ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot);
          ctx.drawImage(sprites[1], -d / 2, -d / 2, d, d); ctx.restore();
        } else ctx.drawImage(sprites[f.kind], f.x - d / 2, f.y - d / 2, d, d);
      }
      ctx.globalAlpha = 1;
    };

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const nw = Math.max(1, Math.round(r.width)), nh = Math.max(1, Math.round(r.height));
      if (nw === w && nh === h) return;
      const sx = w ? nw / w : 1;
      w = nw; h = nh;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "rgba(10,20,35,0)"); sky.addColorStop(1, "rgba(61,127,139,0.22)");
      const target = flakeCount(w, h);
      if (flakes.length === 0) flakes = createFlakes(target, w, h);
      else {
        for (const f of flakes) f.x *= sx;
        while (flakes.length < target) flakes.push(newFlake(w, Math.random, -Math.random() * h - 4));
        if (flakes.length > target) flakes.length = target;
      }
      if (reduce) { for (const f of flakes) f.y = Math.random() * h * 0.9; draw(); }
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (document.hidden) { last = 0; return; }
      const dt = last ? (now - last) / 1000 : 0;
      last = now;
      const step = Math.min(dt, 0.1);
      motion += step;
      stepFlakes(flakes, step, motion, w, h, groundDepth(wallMs(), h));
      draw();
      // On a slow device, quietly use fewer flakes instead of stuttering.
      if (dt > 0) avg = avg * 0.9 + dt * 1000 * 0.1;
      if (avg > 30 && flakes.length > 50) { if (++slow > 90) { flakes.length = Math.max(50, Math.floor(flakes.length * 0.8)); slow = 0; avg = 16; } } else slow = 0;
    };

    const onVisible = () => { if (!document.hidden) { last = 0; setCap(); } }; // coming back: the pile has grown meanwhile
    document.addEventListener("visibilitychange", onVisible);
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    let capTimer: ReturnType<typeof setInterval> | undefined;
    if (!reduce) { raf = requestAnimationFrame(frame); capTimer = setInterval(setCap, 3000); }

    return () => {
      cancelAnimationFrame(raf);
      if (capTimer) clearInterval(capTimer);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisible);
      root.style.removeProperty("--snow-cap"); // leaving the theme clears the snow, so coming back starts fresh
    };
  }, [active]);

  if (!active) return null;
  return <canvas ref={canvasRef} aria-hidden className="pointer-events-none fixed inset-0 -z-10 h-full w-full" />;
}
