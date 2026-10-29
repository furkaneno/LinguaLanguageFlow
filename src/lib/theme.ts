/** Single source of truth for the colour themes. CSS variables are generated from this at render time. */
export const THEME_STORAGE_KEY = "lingua-theme";

export interface Palette {
  name: string;
  scheme: "dark" | "light";
  /** Opacity of the English-themed background pattern. */
  patternOpacity: number;
  bg: string; surface: string; blush: string; blushAccent: string;
  brand: string; brandDark: string; brandLight: string; onBrand: string;
  good: string; goodDark: string;
  ink: string; inkMuted: string; line: string;
  success: string; danger: string; onDanger: string; err: string;
}

export const PALETTES = {
  wine: {
    name: "Wine & Pink", scheme: "dark", patternOpacity: 0.07,
    bg: "#3A1526", surface: "#4A1D32", blush: "#6A2B48", blushAccent: "#8C3D5E",
    brand: "#D81B60", brandDark: "#B3144D", brandLight: "#FF6B9A", onBrand: "#FFFFFF",
    good: "#4FC796", goodDark: "#2E9E73",
    ink: "#F3E7D3", inkMuted: "#C9B3A6", line: "#6B3550",
    success: "#1F4D3A", danger: "#6B1D1D", onDanger: "#FFD9D4", err: "#FF8A80",
  },
  forest: {
    name: "Forest & Orange", scheme: "dark", patternOpacity: 0.07,
    bg: "#0F2A1D", surface: "#17382A", blush: "#245039", blushAccent: "#2F6548",
    brand: "#FF7A1A", brandDark: "#E8650A", brandLight: "#FFA04D", onBrand: "#1B1206",
    good: "#8CF0B5", goodDark: "#4FBF80",
    ink: "#F4EAD5", inkMuted: "#B8CCB9", line: "#2F5A44",
    success: "#165638", danger: "#6E1F1F", onDanger: "#FFD9D4", err: "#FF8A80",
  },
  sky: {
    name: "Sky & Navy", scheme: "light", patternOpacity: 0.07,
    bg: "#E3F1FB", surface: "#F4FAFE", blush: "#C5E0F4", blushAccent: "#A8CFEA",
    brand: "#1D4E89", brandDark: "#123A6B", brandLight: "#1D4E89", onBrand: "#FFFFFF",
    good: "#176B3F", goodDark: "#0F5530",
    ink: "#0F2747", inkMuted: "#3A566F", line: "#B7D3E8",
    success: "#CDEBDA", danger: "#FADBD8", onDanger: "#7A1C14", err: "#B42318",
  },
} as const satisfies Record<string, Palette>;

export type ThemeId = keyof typeof PALETTES;
export const THEME_IDS = Object.keys(PALETTES) as ThemeId[];
export const DEFAULT_THEME: ThemeId = "wine";

export const isThemeId = (v: unknown): v is ThemeId => typeof v === "string" && (THEME_IDS as string[]).includes(v);

export const nextTheme = (id: ThemeId): ThemeId => THEME_IDS[(THEME_IDS.indexOf(id) + 1) % THEME_IDS.length]!;

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

function variables(p: Palette): string {
  const pairs: [string, string][] = [
    ["bg", p.bg], ["surface", p.surface], ["blush", p.blush], ["blush-accent", p.blushAccent],
    ["brand", p.brand], ["brand-dark", p.brandDark], ["brand-light", p.brandLight], ["on-brand", p.onBrand],
    ["good", p.good], ["good-dark", p.goodDark], ["ink", p.ink], ["ink-muted", p.inkMuted], ["line", p.line],
    ["success", p.success], ["danger", p.danger], ["on-danger", p.onDanger], ["err", p.err],
  ];
  return pairs.map(([k, v]) => `--c-${k}:${rgb(v)};`).join("") + `--pattern-opacity:${p.patternOpacity};color-scheme:${p.scheme};`;
}

/** CSS custom properties for every theme; the default theme also applies to :root. */
export function themeCss(): string {
  return THEME_IDS.map((id) => `${id === DEFAULT_THEME ? ":root," : ""}[data-theme="${id}"]{${variables(PALETTES[id])}}`).join("\n");
}

/** Runs before first paint so the saved theme never flashes the default one. */
export const THEME_INIT_SCRIPT =
  `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(${THEME_IDS.map((i) => `t==="${i}"`).join("||")})document.documentElement.dataset.theme=t}catch(e){}`;
