export function formatIso(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

export function formatNumber(value: number | null | undefined, digits = 2) {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function formatMs(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${Math.round(value)}ms`;
}

export function formatPips(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${formatNumber(value, 2)} pips`;
}

export function formatPoints(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${formatNumber(value, 1)} pts`;
}

