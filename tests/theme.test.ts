import { describe, expect, it } from "vitest";
import { ANIMAL_COUNT, PATTERN_TILE } from "@/components/layout/patternMarkup";
import { DEFAULT_THEME, PALETTES, THEME_IDS, THEME_INIT_SCRIPT, THEME_STORAGE_KEY, isThemeId, nextTheme, themeCss, type Palette } from "@/lib/theme";

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

// Every text/background pairing the interface actually uses must stay readable (WCAG AA, 4.5:1).
const PAIRS: [keyof Palette, keyof Palette][] = [
  ["ink", "bg"], ["ink", "surface"], ["ink", "blush"], ["inkMuted", "bg"], ["inkMuted", "surface"], ["inkMuted", "blush"],
  ["onBrand", "brand"], ["onBrand", "brandDark"], ["brandLight", "bg"], ["brandLight", "surface"],
  ["good", "surface"], ["good", "success"], ["ink", "success"], ["ink", "danger"], ["onDanger", "danger"],
  ["err", "bg"], ["err", "surface"], ["err", "danger"],
];

describe("themes", () => {
  it("has the three themes, with wine as the default", () => {
    expect(THEME_IDS).toEqual(["wine", "forest", "retro"]);
    expect(DEFAULT_THEME).toBe("wine");
  });
  for (const id of ["wine", "forest", "retro"] as const) {
    it(`${id}: every text/background pair is readable`, () => {
      const p = PALETTES[id] as Palette;
      for (const [fg, bg] of PAIRS) {
        expect(contrast(p[fg] as string, p[bg] as string), `${id}: ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
  it("forest is a dark green background with bright orange; retro is a brown, paper-like theme", () => {
    expect(luminance(PALETTES.forest.bg)).toBeLessThan(0.05);
    expect(PALETTES.forest.brand).toBe("#FF7A1A");
    expect(PALETTES.retro.scheme).toBe("light");
    expect(luminance(PALETTES.retro.brand)).toBeLessThan(0.1); // dark brown buttons and links
  });
  it("only the retro theme has the animal background; the others are plain colour", () => {
    expect(PALETTES.wine.pattern).toBe("none");
    expect(PALETTES.forest.pattern).toBe("none");
    expect(PALETTES.retro.pattern).toBe("animals");
    const css = themeCss();
    expect(css).toMatch(/\[data-theme="forest"\]\{[^}]*--pattern-display:none;/);
    expect(css).toMatch(/\[data-theme="retro"\]\{[^}]*--pattern-display:block;/);
  });
  it("the animal tile uses a real drawing in every slot and has plenty of animals", () => {
    expect(ANIMAL_COUNT).toBeGreaterThanOrEqual(25);
    expect(PATTERN_TILE).not.toMatch(/translate\([^)]*\)"><\/g>/);
  });
  it("validates theme ids", () => {
    expect(isThemeId("forest")).toBe(true);
    expect(isThemeId("toString")).toBe(false);
    expect(isThemeId(undefined)).toBe(false);
    expect(isThemeId("neon")).toBe(false);
    expect(isThemeId("sky")).toBe(false); // the removed theme falls back to the default
  });
  it("cycles through themes and wraps around", () => {
    expect(nextTheme("wine")).toBe("forest");
    expect(nextTheme("forest")).toBe("retro");
    expect(nextTheme("retro")).toBe("wine");
  });
  it("generates CSS variables for every theme, and the default also applies to :root", () => {
    const css = themeCss();
    expect(css).toContain(':root,[data-theme="wine"]');
    expect(css).toContain('[data-theme="forest"]');
    expect(css).toContain('[data-theme="retro"]');
    expect(css).toContain("--c-brand:255 122 26;");
    expect(css).toContain("color-scheme:light;");
  });
  it("the pre-paint script only accepts known themes", () => {
    expect(THEME_INIT_SCRIPT).toContain(THEME_STORAGE_KEY);
    for (const id of THEME_IDS) expect(THEME_INIT_SCRIPT).toContain(`t==="${id}"`);
  });
});
