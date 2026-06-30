import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        felt: {
          DEFAULT: "#0b6b3a",
          dark: "#073d22",
          light: "#0e8347",
        },
        gold: {
          DEFAULT: "#e3b341",
          light: "#f5d77a",
          dark: "#b8862b",
        },
      },
      fontFamily: {
        display: ["Georgia", "serif"],
      },
      boxShadow: {
        glow: "0 0 24px rgba(227, 179, 65, 0.45)",
      },
    },
  },
  plugins: [],
};

export default config;
