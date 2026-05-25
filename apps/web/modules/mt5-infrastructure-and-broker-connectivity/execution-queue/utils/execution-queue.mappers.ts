export function formatNumber(value: number, maximumFractionDigits = 2) {
  return value.toLocaleString(undefined, { maximumFractionDigits });
}

export function formatSeconds(value: number) {
  if (!Number.isFinite(value)) return "—";
  if (value < 60) return `${Math.round(value)}s`;
  const m = Math.floor(value / 60);
  const s = Math.round(value % 60);
  return `${m}m ${s}s`;
}

export function formatIso(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
}

