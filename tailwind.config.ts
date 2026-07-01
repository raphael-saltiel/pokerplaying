import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Fonds profonds cyberpunk
        ink: {
          DEFAULT: "#05010f",
          900: "#05010f",
          800: "#0a0418",
          700: "#120a24",
          600: "#1a0f33",
        },
        // Accents néon
        neon: {
          cyan: "#00f0ff",
          magenta: "#ff00e6",
          yellow: "#f4ff00",
          green: "#39ff14",
          pink: "#ff2d95",
        },
        // Remap des anciennes clés pour ne rien casser dans les composants :
        // "gold" devient le cyan néon (accent principal), "felt" le violet profond.
        gold: {
          DEFAULT: "#00f0ff",
          light: "#8bfaff",
          dark: "#00aeb8",
        },
        felt: {
          DEFAULT: "#160c2b",
          dark: "#0a0418",
          light: "#241540",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Orbitron", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      boxShadow: {
        glow: "0 0 20px rgba(0, 240, 255, 0.45)",
        "glow-cyan": "0 0 22px rgba(0, 240, 255, 0.55)",
        "glow-magenta": "0 0 22px rgba(255, 0, 230, 0.55)",
        "glow-yellow": "0 0 22px rgba(244, 255, 0, 0.5)",
        "glow-green": "0 0 22px rgba(57, 255, 20, 0.5)",
      },
    },
  },
  plugins: [],
};

export default config;
