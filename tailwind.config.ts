import type { Config } from "tailwindcss";

// ============================================================
//  DARKPOOL:// — design system "cercle privé chiffré"
//  Cyan = système, Magenta = accents chauds/alerte,
//  Vert acide = argent gagné. Fond bleu-noir profond.
//  NOTE : les noms de tokens historiques (amber/burn/cash) sont
//  conservés comme rôles sémantiques — seules les valeurs changent :
//  amber=accent cyan, burn=magenta, cash=vert acide.
// ============================================================

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Surfaces bleu-noir
        carbon: {
          950: "#05070a",
          900: "#070c10",
          800: "#0b1216",
          700: "#0d1a20",
          600: "#14252e",
        },
        // Accent système : cyan DARKPOOL
        amber: {
          DEFAULT: "#00F0FF",
          hi: "#a7fbff",
          dim: "#0e6a75",
        },
        // Secondaire / chaud : magenta
        burn: {
          DEFAULT: "#FF2BD6",
          dim: "#7a1566",
        },
        // Argent gagné UNIQUEMENT : vert acide
        cash: {
          DEFAULT: "#7CFF00",
          dim: "#3f7a12",
        },
        // Rouge roulette (framboise néon, famille magenta)
        "rl-red": "#d8145e",
        paper: "#EFFBFD",

        // ---- Alias hérités ----
        neon: {
          cyan: "#00F0FF",
          magenta: "#FF2BD6",
          yellow: "#a7fbff",
          green: "#7CFF00",
          pink: "#FF2BD6",
        },
        gold: {
          DEFAULT: "#00F0FF",
          light: "#a7fbff",
          dark: "#0e6a75",
        },
        ink: {
          DEFAULT: "#05070a",
          900: "#070c10",
          800: "#0b1216",
          700: "#0d1a20",
          600: "#14252e",
        },
        felt: {
          DEFAULT: "#0d1a20",
          dark: "#070c10",
          light: "#14252e",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      boxShadow: {
        glow: "0 0 18px rgba(0, 240, 255, 0.4)",
        "glow-amber": "0 0 18px rgba(0, 240, 255, 0.45)",
        "glow-burn": "0 0 18px rgba(255, 43, 214, 0.45)",
        "glow-cash": "0 0 18px rgba(124, 255, 0, 0.5)",
        // alias hérités
        "glow-cyan": "0 0 18px rgba(0, 240, 255, 0.45)",
        "glow-magenta": "0 0 18px rgba(255, 43, 214, 0.45)",
        "glow-yellow": "0 0 18px rgba(167, 251, 255, 0.5)",
        "glow-green": "0 0 18px rgba(124, 255, 0, 0.5)",
      },
    },
  },
  plugins: [],
};

export default config;
