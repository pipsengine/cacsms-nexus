import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./layouts/**/*.{ts,tsx}",
    "./modules/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./stores/**/*.{ts,tsx}",
    "./services/**/*.{ts,tsx}"
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1440px"
      }
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))"
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))"
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))"
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))"
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))"
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))"
        },
        institutional: {
          blue: "#2563EB",
          purple: "#7C3AED",
          green: "#16A34A",
          red: "#DC2626",
          orange: "#EA580C",
          yellow: "#CA8A04",
          teal: "#0F766E",
          indigo: "#4338CA",
          pink: "#DB2777",
          gray: "#64748B",
          cyan: "#0891B2",
          emerald: "#059669",
          amber: "#D97706",
          rose: "#E11D48",
          violet: "#7C3AED",
          slate: "#475569"
        },
        nexus: {
          white: "#FFFFFF",
          soft: "#F8FAFC",
          border: "#E2E8F0",
          analytics: "#2563EB",
          reasoning: "#7C3AED",
          success: "#16A34A",
          critical: "#DC2626",
          warning: "#EA580C",
          pending: "#CA8A04",
          liquidity: "#0F766E",
          quant: "#4338CA",
          strategy: "#DB2777",
          neutral: "#64748B"
        }
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "2xl": "1.5rem"
      },
      boxShadow: {
        enterprise: "0 1px 2px rgba(15, 23, 42, 0.06), 0 10px 30px rgba(15, 23, 42, 0.06)",
        card: "0 1px 2px rgba(15, 23, 42, 0.06), 0 12px 32px rgba(15, 23, 42, 0.08)"
      }
    }
  },
  plugins: [tailwindcssAnimate]
};

export default config;
