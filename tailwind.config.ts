import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: { DEFAULT: "#FAF5ED", surface: "#FFFDF9" },
        blush: { DEFAULT: "#F2D6D8", accent: "#E9BFC5" },
        emerald: { DEFAULT: "#087F5B", dark: "#066649" },
        ink: { DEFAULT: "#292724", muted: "#77736D" },
        line: "#E9E1D7",
        success: "#E4F3EA",
        danger: "#FBE8E7",
      },
      fontFamily: { sans: ['"Inter Variable"','ui-sans-serif','system-ui','sans-serif'], display: ['"Fraunces Variable"','Georgia','serif'] },
      borderRadius: { xl2: "1.25rem" },
    },
  },
  plugins: [],
};
export default config;
