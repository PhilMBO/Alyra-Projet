import type { Config } from "tailwindcss";

const config: Config = {
  // Indique a Tailwind ou chercher les classes utilisees
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Design tokens Verivo — chaque cle devient une classe Tailwind
      // Exemple : "primary" → bg-primary, text-primary, border-primary
      colors: {
        primary:          { DEFAULT: "#0A1628", hover: "#142238" },
        secondary:        "#1E6BB8",
        accent:           "#4FC3F7",
        success:          "#059669",
        error:            "#DC2626",
        warning:          "#D97706",
        "text-primary":   "#0F172A",
        "text-secondary": "#3A4A5C",
        border:           "#D1D9E0",
        surface:          "#F0F4F8",
        background:       "#FFFFFF",
      },
      // Rayon de bordure par defaut pour tous les `rounded`
      borderRadius: { DEFAULT: "8px" },
      // Ombre pour les cartes
      boxShadow: { card: "0 1px 3px rgba(10, 22, 40, 0.1)" },
      // Police Inter comme police par defaut
      fontFamily: { sans: ["Inter", "system-ui", "-apple-system", "sans-serif"] },
    },
  },
  plugins: [],
};
export default config;