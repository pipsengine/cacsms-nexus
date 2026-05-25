export function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function safeNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function safeString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export function weightedScore(parts: Array<{ key: string; value: number; weight: number }>) {
  const totalWeight = parts.reduce((sum, p) => sum + p.weight, 0);
  if (totalWeight <= 0) return { score: 0, factors: {} as Record<string, number> };

  const factors: Record<string, number> = {};
  const score =
    parts.reduce((sum, p) => {
      const v = clampScore(p.value);
      factors[p.key] = v;
      return sum + v * p.weight;
    }, 0) / totalWeight;

  return { score: clampScore(score), factors };
}

