import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Light, premium palette
        bg: "#f6f7fb",
        panel: "#ffffff",
        panel2: "#f3f4fa",
        edge: "#e6e8f2",
        ink: "#1b1e2e", // primary emphasis text
        muted: "#6b7280",
        accent: "#4f46e5", // indigo
        accent2: "#7c3aed", // violet
        risk: { red: "#dc2626", yellow: "#b45309", green: "#15803d" },
      },
      boxShadow: {
        card: "0 6px 24px rgba(40, 40, 90, 0.07)",
        cardHover: "0 10px 34px rgba(40, 40, 90, 0.12)",
      },
    },
  },
  plugins: [],
};
export default config;
