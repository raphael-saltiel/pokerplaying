import type { Config } from "tailwindcss";

// ============================================================
//  LEDGER.SYS — design system "console de bookmaker clandestin"
//  Palette resserrée : ambre phosphore (système), burn (alerte),
//  vert cash (STRICTEMENT réservé à l'argent gagné).
// ============================================================

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Surfaces "carbone chaud"
        carbon: {
          950: "#0b0906",
          900: "#12100a",
          800: "#1a160d",
          700: "#242013",
          600: "#2e2a18",
        },
        // Couleur système : ambre phosphore
        amber: {
          DEFAULT: "#ffb000",
          hi: "#ffd23f",
          dim: "#8a6a1f",
        },
        // Secondaire / alerte : burn
        burn: {
          DEFAULT: "#ff4d1c",
          dim: "#8f2c10",
        },
        // Argent gagné UNIQUEMENT
        cash: {
          DEFAULT: "#3dff88",
          dim: "#1d7a44",
        },
        // Rouge "encre" de la roulette
        "rl-red": "#c8321e",
        paper: "#f2e8cf",

        // ---- Alias hérités (anciens noms -> nouveau système) ----
        neon: {
          cyan: "#ffb000",
          magenta: "#ff4d1c",
          yellow: "#ffd23f",
          green: "#3dff88",
          pink: "#ff4d1c",
        },
        gold: {
          DEFAULT: "#ffb000",
          light: "#ffd23f",
          dark: "#8a6a1f",
        },
        ink: {
          DEFAULT: "#0b0906",
          900: "#12100a",
          800: "#1a160d",
          700: "#242013",
          600: "#2e2a18",
        },
        felt: {
          DEFAULT: "#242013",
          dark: "#12100a",
          light: "#2e2a18",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      boxShadow: {
        glow: "0 0 18px rgba(255, 176, 0, 0.4)",
        "glow-amber": "0 0 18px rgba(255, 176, 0, 0.45)",
        "glow-burn": "0 0 18px rgba(255, 77, 28, 0.45)",
        "glow-cash": "0 0 18px rgba(61, 255, 136, 0.45)",
        // alias hérités
        "glow-cyan": "0 0 18px rgba(255, 176, 0, 0.45)",
        "glow-magenta": "0 0 18px rgba(255, 77, 28, 0.45)",
        "glow-yellow": "0 0 18px rgba(255, 210, 63, 0.5)",
        "glow-green": "0 0 18px rgba(61, 255, 136, 0.45)",
      },
    },
  },
  plugins: [],
};

export default config;
