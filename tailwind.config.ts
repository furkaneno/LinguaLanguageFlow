import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
            colors: {
        cream: { DEFAULT: "#3A1526", surface: "#4A1D32" },   // sayfa zemini / kart yüzeyi (bordo)
        blush: { DEFAULT: "#6A2B48", accent: "#8C3D5E" },    // seçili alanlar, etiketler, ilerleme çubuğu zemini
        brand: { DEFAULT: "#D81B60", dark: "#B3144D", light: "#FF6B9A" }, // pembe: buton, link, vurgu
        emerald: { DEFAULT: "#4FC796", dark: "#2E9E73" },    // yeşil: sadece başarı
        ink: { DEFAULT: "#F3E7D3", muted: "#C9B3A6" },       // bej yazı
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
