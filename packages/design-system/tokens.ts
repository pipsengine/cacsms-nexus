export const designTokens = {
  colors: {
    background: {
      white: "#FFFFFF",
      softGray: "#F8FAFC",
      borderGray: "#E2E8F0"
    },
    status: {
      blue: "#2563EB",
      purple: "#7C3AED",
      green: "#16A34A",
      red: "#DC2626",
      orange: "#EA580C",
      yellow: "#CA8A04",
      teal: "#0F766E",
      indigo: "#4338CA",
      pink: "#DB2777",
      gray: "#64748B"
    }
  },
  spacing: {
    xs: "0.25rem",
    sm: "0.5rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2rem",
    "2xl": "3rem"
  },
  radius: {
    sm: "0.5rem",
    md: "0.75rem",
    lg: "1rem",
    xl: "1.25rem",
    "2xl": "1.5rem"
  },
  shadows: {
    card: "0 1px 2px rgba(15, 23, 42, 0.06), 0 12px 32px rgba(15, 23, 42, 0.08)",
    subtle: "0 1px 2px rgba(15, 23, 42, 0.05)"
  },
  typography: {
    primary: "Inter",
    secondary: "Geist",
    fallback: "IBM Plex Sans",
    scale: {
      pageTitle: "text-4xl font-semibold tracking-normal",
      sectionTitle: "text-2xl font-semibold tracking-normal",
      cardTitle: "text-sm font-semibold tracking-normal",
      cardSubtitle: "text-xs font-medium",
      body: "text-sm leading-6",
      metric: "text-xs font-semibold",
      badge: "text-[11px] font-semibold uppercase"
    }
  }
} as const;
