"use client";
import { useEffect, useRef } from "react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { createBackdropStars, createSky, meteorShape, STARS, stepSky, type BackdropStar, type RGB, type Sky } from "@/lib/stars/engine";
import { PALETTES } from "@/lib/theme";

const rgba = (c: RGB, a: number) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
const lighten = (c: RGB, k: number): RGB => [c[0] + (255 - c[0]) * k, c[1] + (255 - c[1]) * k, c[2] + (255 - c[2]) * k];
const WHITE: RGB = [255, 255, 255];

/**
 * Black & White backdrop: a quiet field of stars with shooting stars of different kinds streaking across it, some leaving a
 * fading trail of star dust. They burn out or fly off screen, so nothing ever builds up. It pauses while the tab is hidden,
 * lightens itself on slow devices, and shows only the still stars for people who asked their device to reduce motion.
 */
export function ShootingStars() {
  const { theme } = useTheme();
  const active = PALETTES[theme].pattern === "stars";
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!active || !canvas || !ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let w = 0, h = 0, stars: BackdropStar[] = [], field: HTMLCanvasElement | null = null;
    let sky: Sky | null = null;
    let t = 0, last = 0, raf = 0, avg = 16, slow = 0;

    const buildField = () => {
      field = document.createElement("canvas");
      field.width = Math.round(w * dpr); field.height = Math.round(h * dpr);
      const fc = field.getContext("2d");
      if (!fc) return;
      fc.scale(dpr, dpr);
      for (const s of stars) { fc.beginPath(); fc.arc(s.x, s.y, s.r, 0, Math.PI * 2); fc.fillStyle = rgba(s.tint, s.alpha); fc.fill(); }
    };

    const draw = () => {
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, w, h);
      if (field) ctx.drawImage(field, 0, 0, w, h);
      if (reduce || !sky) return;
      ctx.globalCompositeOperation = "lighter"; // light adds up, like real glow
      for (const s of stars) {
        if (!s.twinkle) continue;
        ctx.fillStyle = rgba(s.tint, s.alpha * (0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * s.freq + s.phase))));
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 1.5, 0, Math.PI * 2); ctx.fill();
      }
      for (const p of sky.sparks) { // star dust
        ctx.fillStyle = rgba(p.color, Math.pow(1 - p.age / p.life, 1.5) * 0.9);
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      }
      for (const m of sky.meteors) {
        const s = meteorShape(m);
        if (s.length < 1 || s.b <= 0.01) continue;
        const hot = lighten(s.color, 0.65);
        const g = ctx.createLinearGradient(s.tx, s.ty, s.hx, s.hy);
        g.addColorStop(0, rgba(s.color, 0)); g.addColorStop(0.6, rgba(s.color, 0.38 * s.b)); g.addColorStop(1, rgba(hot, 0.95 * s.b));
        for (const [widen, alpha] of [[3.2, 0.22], [1, 1]] as const) { // a soft wide glow, then the thin bright core
          const half = (s.width * widen) / 2;
          ctx.globalAlpha = alpha;
          ctx.beginPath(); ctx.moveTo(s.tx, s.ty); ctx.lineTo(s.hx + s.nx * half, s.hy + s.ny * half); ctx.lineTo(s.hx - s.nx * half, s.hy - s.ny * half); ctx.closePath();
          ctx.fillStyle = g; ctx.fill();
        }
        ctx.globalAlpha = 1;
        const r = s.width * (s.kind === "fireball" ? 8 : 6);
        const head = ctx.createRadialGradient(s.hx, s.hy, 0, s.hx, s.hy, r);
        head.addColorStop(0, rgba(WHITE, s.b)); head.addColorStop(0.3, rgba(hot, 0.55 * s.b)); head.addColorStop(1, rgba(s.color, 0));
        ctx.fillStyle = head; ctx.beginPath(); ctx.arc(s.hx, s.hy, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    };

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const nw = Math.max(1, Math.round(r.width)), nh = Math.max(1, Math.round(r.height));
      if (nw === w && nh === h) return;
      w = nw; h = nh;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = createBackdropStars(w, h);
      buildField();
      if (!sky) sky = createSky(w, h); else { sky.w = w; sky.h = h; }
      draw();
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (document.hidden || !sky) { last = 0; return; }
      const dt = last ? (now - last) / 1000 : 0;
      last = now;
      const step = Math.min(dt, STARS.maxDt);
      t += step;
      stepSky(sky, step);
      draw();
      // On a slow device, quietly use fewer meteors and no star dust instead of stuttering.
      if (dt > 0) avg = avg * 0.9 + dt * 1000 * 0.1;
      if (avg > 30) { if (++slow > 90) { sky.maxMeteors = STARS.maxMeteorsSlow; sky.sparksOn = false; } } else slow = 0;
    };

    const onVisible = () => { if (!document.hidden) last = 0; };
    document.addEventListener("visibilitychange", onVisible);
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    if (!reduce) raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [active]);

  if (!active) return null;
  return <canvas ref={canvasRef} aria-hidden className="pointer-events-none fixed inset-0 -z-10 h-full w-full" />;
}
