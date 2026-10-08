import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        cat: {
          orange: "#F97316",
          amber: "#F59E0B",
          salmon: "#FB7185",
          warm: "#FFFBEB",
          dark: "#1E1E24",
          card: "#FFFFFF",
          border: "#E2E8F0"
        }
      },
      borderRadius: {
        "3xl": "1.75rem",
        "4xl": "2.25rem",
      },
      boxShadow: {
        'soft': '0 10px 30px -5px rgba(0, 0, 0, 0.05), 0 5px 15px -5px rgba(0, 0, 0, 0.02)',
        'glow-green': '0 0 25px -5px rgba(34, 197, 94, 0.4)',
        'glow-orange': '0 0 25px -5px rgba(249, 115, 22, 0.4)',
      }
    },
  },
  plugins: [],
} satisfies Config;
