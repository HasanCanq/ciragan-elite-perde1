import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    // Override defaults rather than extend where precision matters
    screens: {
      sm:  "640px",
      md:  "768px",
      lg:  "1024px",
      xl:  "1280px",
      "2xl": "1536px",
    },
    extend: {
      // ── Brand palette ────────────────────────────────────────────────────
      colors: {
        hanedan: {
          white: "#FFFFFF",   // primary background
          black: "#000000",   // primary text / UI chrome
          gold:  "#B89947",   // accent — hover states, active links, prices ONLY
          gray:  "#F3F4F6",   // subtle borders & dividers
          muted: "#9CA3AF",   // secondary / caption text
        },
        // Semantic aliases bound to CSS variables (allows future theming)
        background: "var(--background)",
        foreground: "var(--foreground)",
        accent:     "var(--accent)",
        border:     "var(--border)",
      },

      // ── Typography — CSS-variable driven ─────────────────────────────────
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "ui-serif", "serif"],
        sans:  ["var(--font-sans)", "system-ui", "ui-sans-serif", "sans-serif"],
      },

      fontSize: {
        // Luxury micro labels
        "2xs":  ["10px", { lineHeight: "1.4", letterSpacing: "0.35em" }],
        xs:     ["11px", { lineHeight: "1.5", letterSpacing: "0.12em" }],
        sm:     ["13px", { lineHeight: "1.6", letterSpacing: "0.04em" }],
        base:   ["14px", { lineHeight: "1.65", letterSpacing: "0.02em" }],
        lg:     ["16px", { lineHeight: "1.6",  letterSpacing: "0.01em" }],
        xl:     ["20px", { lineHeight: "1.4",  letterSpacing: "0.01em" }],
        "2xl":  ["24px", { lineHeight: "1.3",  letterSpacing: "0.02em" }],
        "3xl":  ["32px", { lineHeight: "1.2",  letterSpacing: "0.02em" }],
        "4xl":  ["40px", { lineHeight: "1.1",  letterSpacing: "0.02em" }],
        "5xl":  ["52px", { lineHeight: "1.05", letterSpacing: "0.02em" }],
        "6xl":  ["64px", { lineHeight: "1.0",  letterSpacing: "0.02em" }],
        "7xl":  ["80px", { lineHeight: "0.95", letterSpacing: "0.01em" }],
      },

      letterSpacing: {
        tighter:  "-0.02em",
        tight:    "-0.01em",
        normal:   "0em",
        label:    "0.08em",    // nav items, tags
        luxury:   "0.2em",     // section labels
        widest:   "0.4em",     // eyebrow / hero labels
      },

      lineHeight: {
        "none":    "1",
        "tight":   "1.1",
        "snug":    "1.25",
        "normal":  "1.5",
        "relaxed": "1.65",
        "loose":   "2",
      },

      // ── Spacing — generous white space is the design ──────────────────────
      spacing: {
        "18":  "4.5rem",
        "22":  "5.5rem",
        "26":  "6.5rem",
        "30":  "7.5rem",
        "34":  "8.5rem",
        "38":  "9.5rem",
        "42":  "10.5rem",
        "46":  "11.5rem",
        "50":  "12.5rem",
        "60":  "15rem",
        "72":  "18rem",
        "80":  "20rem",
        "96":  "24rem",
        "128": "32rem",
      },

      maxWidth: {
        "prose": "68ch",
        "8xl":   "88rem",
        "9xl":   "96rem",
      },

      // ── No decorative shadows — flat design ──────────────────────────────
      boxShadow: {
        none: "none",
        // Single pixel border-ring helper (not a shadow)
        ring: "0 0 0 1px #000000",
        "ring-gold": "0 0 0 1px #B89947",
      },

      // ── Transitions ──────────────────────────────────────────────────────
      transitionDuration: {
        "200": "200ms",
        "300": "300ms",
        "400": "400ms",
        "600": "600ms",
      },

      transitionTimingFunction: {
        "luxury": "cubic-bezier(0.25, 0.1, 0.25, 1)",
        "ease-in-expo": "cubic-bezier(0.95, 0.05, 0.795, 0.035)",
        "ease-out-expo": "cubic-bezier(0.19, 1, 0.22, 1)",
      },

      // ── No border radius — sharp, architectural feel ──────────────────────
      borderRadius: {
        none: "0",
        sm:   "2px",
        DEFAULT: "2px",
        // Only small radius where truly needed (badges, tags)
        tag: "2px",
      },

      // ── Aspect ratios ────────────────────────────────────────────────────
      aspectRatio: {
        "product":   "3 / 4",     // portrait product cards
        "editorial": "16 / 9",
        "hero":      "21 / 9",
        "square":    "1 / 1",
      },
    },
  },
  plugins: [],
};

export default config;
