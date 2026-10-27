import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: { DEFAULT: "#3A1526", surface: "#4A1D32" },   // page background / card surface (burgundy)
        blush: { DEFAULT: "#6A2B48", accent: "#8C3D5E" },    // selected surfaces, chips, progress track
        brand: { DEFAULT: "#D81B60", dark: "#B3144D", light: "#FF6B9A" }, // hot pink: buttons, links, accents
        emerald: { DEFAULT: "#4FC796", dark: "#2E9E73" },    // green: success only
        ink: { DEFAULT: "#F3E7D3", muted: "#C9B3A6" },       // beige text
        line: "#6B3550",
        success: "#1F4D3A",
        danger: "#6B1D1D",
      },
      fontFamily: { sans: ['"Inter Variable"','ui-sans-serif','system-ui','sans-serif'], display: ['"Fraunces Variable"','Georgia','serif'] },
      borderRadius: { xl2: "1.25rem" },
    },
  },
  plugins: [],
};
export default config;
