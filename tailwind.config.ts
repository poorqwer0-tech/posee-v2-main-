import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ธีม "มะนาว × พริก" — ค่าจริงมาจากตัวแปรใน globals.css (รองรับ light/dark)
        brand: {
          bg: "rgb(var(--brand-bg) / <alpha-value>)",
          sidebar: "rgb(var(--brand-sidebar) / <alpha-value>)",
          primary: "rgb(var(--brand-primary) / <alpha-value>)",
          primaryDark: "rgb(var(--brand-primaryDark) / <alpha-value>)",
          topbar: "rgb(var(--brand-topbar) / <alpha-value>)",
          card: "rgb(var(--brand-card) / <alpha-value>)",
          cream: "rgb(var(--brand-cream) / <alpha-value>)",
          ink: "rgb(var(--brand-ink) / <alpha-value>)",
          ink2: "rgb(var(--brand-ink2) / <alpha-value>)",
          muted: "rgb(var(--brand-muted) / <alpha-value>)",
          muted2: "rgb(var(--brand-muted2) / <alpha-value>)",
          muted3: "rgb(var(--brand-muted3) / <alpha-value>)",
          border: "rgb(var(--brand-border) / <alpha-value>)",
          border2: "rgb(var(--brand-border2) / <alpha-value>)",
          border3: "rgb(var(--brand-border3) / <alpha-value>)",
          chip: "rgb(var(--brand-chip) / <alpha-value>)",
          tan: "rgb(var(--brand-tan) / <alpha-value>)",
          tan2: "rgb(var(--brand-tan2) / <alpha-value>)",
          sidebarText: "rgb(var(--brand-sidebarText) / <alpha-value>)",
        },
        accent: {
          green: "rgb(var(--accent-green) / <alpha-value>)",
          greenText: "rgb(var(--accent-greenText) / <alpha-value>)",
          greenBg: "rgb(var(--accent-greenBg) / <alpha-value>)",
          orange: "rgb(var(--accent-orange) / <alpha-value>)",
          orangeBg: "rgb(var(--accent-orangeBg) / <alpha-value>)",
          orangeBorder: "rgb(var(--accent-orangeBorder) / <alpha-value>)",
        },
      },
      fontFamily: {
        mali: ["var(--font-mali)", "sans-serif"],
        itim: ["var(--font-itim)", "cursive"],
      },
      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "none" },
        },
        pop: {
          "0%": { transform: "scale(.92)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        floaty: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        steam: {
          "0%": { opacity: "0", transform: "translateY(2px) scaleY(.8)" },
          "40%": { opacity: ".6" },
          "100%": { opacity: "0", transform: "translateY(-9px) scaleY(1.1)" },
        },
      },
      animation: {
        fadeUp: "fadeUp .35s ease both",
        pop: "pop .25s ease both",
        floaty: "floaty 4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
