import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Elite Renk Paleti
        elite: {
          black: "#111111",
          brown: "#2F1B12",
          gold: "#C9A24D",
          bone: "#FAF9F6",
          gray: "#555555",
        },
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      fontFamily: {
        serif: ["Playfair Display", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        elite: "0 4px 20px rgba(17, 17, 17, 0.08)",
        "elite-hover": "0 8px 30px rgba(17, 17, 17, 0.12)",
      },
      transitionDuration: {
        "400": "400ms",
        "600": "600ms",
      },
      borderRadius: {
        elite: "0.625rem",
      },
    },
  },
  plugins: [],
};

export default config;
