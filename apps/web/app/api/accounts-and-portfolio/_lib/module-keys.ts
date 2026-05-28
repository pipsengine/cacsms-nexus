export const PORTFOLIO_MODULE_KEYS = ["account-center"] as const;

export type PortfolioModuleKey = (typeof PORTFOLIO_MODULE_KEYS)[number];

export function isPortfolioModuleKey(value: string): value is PortfolioModuleKey {
  return (PORTFOLIO_MODULE_KEYS as readonly string[]).includes(value);
}

export function resolvePortfolioModuleKeys(pathname: string): PortfolioModuleKey[] {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] !== "api" || segments[1] !== "accounts-and-portfolio") {
    return [];
  }

  const segment = segments[2];
  if (segment && isPortfolioModuleKey(segment)) {
    return [segment];
  }

  return [];
}
