import type { Config } from "tailwindcss";

// Colours come from CSS variables (generated from src/lib/theme.ts), so themes switch without a rebuild.
const c = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: { DEFAULT: c("bg"), surface: c("surface") },     // page background / card surface
        blush: { DEFAULT: c("blush"), accent: c("blush-accent") }, // selected surfaces, chips, progress track
        brand: { DEFAULT: c("brand"), dark: c("brand-dark"), light: c("brand-light") }, // main accent
        emerald: { DEFAULT: c("good"), dark: c("good-dark") },  // success only
        ink: { DEFAULT: c("ink"), muted: c("ink-muted") },      // text
        line: c("line"),
        success: c("success"),
        danger: c("danger"),
        "on-brand": c("on-brand"),   // text on brand-coloured buttons
        "on-danger": c("on-danger"), // text on the danger background
        err: c("err"),               // error text / icons on the page
      },
      fontFamily: { sans: ['"Inter Variable"','ui-sans-serif','system-ui','sans-serif'], display: ['"Fraunces Variable"','Georgia','serif'] },
      borderRadius: { xl2: "1.25rem" },
    },
  },
  plugins: [],
};
export default config;
