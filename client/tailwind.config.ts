import type { Config } from "tailwindcss";

const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: v("bg"),
        surface: v("surface"),
        elevated: v("elevated"),
        line: v("line"),
        fg: v("fg"),
        muted: v("muted"),
        accent: v("accent"),
        accent2: v("accent2"),
        ok: v("ok"),
        warn: v("warn"),
        danger: v("danger"),
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: { xl2: "1.25rem" },
      boxShadow: {
        glass: "0 8px 32px -8px rgb(0 0 0 / 0.35), inset 0 1px 0 rgb(255 255 255 / 0.06)",
        glow: "0 0 0 1px rgb(var(--accent) / 0.4), 0 8px 30px -6px rgb(var(--accent) / 0.55)",
      },
      keyframes: {
        "typing-dot": {
          "0%, 60%, 100%": { transform: "translateY(0)", opacity: "0.4" },
          "30%": { transform: "translateY(-4px)", opacity: "1" },
        },
        "pop-in": {
          "0%": { transform: "scale(0.6)", opacity: "0" },
          "70%": { transform: "scale(1.08)", opacity: "1" },
          "100%": { transform: "scale(1)" },
        },
        shimmer: { "100%": { transform: "translateX(100%)" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-10px)" } },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgb(var(--ok) / 0.6)" },
          "100%": { boxShadow: "0 0 0 8px rgb(var(--ok) / 0)" },
        },
        gradient: { "0%,100%": { backgroundPosition: "0% 50%" }, "50%": { backgroundPosition: "100% 50%" } },
        wave: { "0%,100%": { transform: "scaleY(0.4)" }, "50%": { transform: "scaleY(1)" } },
      },
      animation: {
        "typing-dot": "typing-dot 1.2s infinite ease-in-out",
        "pop-in": "pop-in 0.35s cubic-bezier(.2,.9,.3,1.3)",
        shimmer: "shimmer 1.6s infinite",
        float: "float 6s ease-in-out infinite",
        "pulse-ring": "pulse-ring 1.6s infinite",
        gradient: "gradient 8s ease infinite",
        wave: "wave 1s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
