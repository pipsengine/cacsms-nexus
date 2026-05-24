export function clampScore(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}

export function safeNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function safeRatio(numerator: number, denominator: number) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(1, numerator / denominator));
}

export function weightedScore(parts: Array<{ key: string; value: number; weight: number }>) {
  const totalWeight = parts.reduce((sum, part) => sum + part.weight, 0);
  if (totalWeight <= 0) {
    return { score: 0, factors: {} as Record<string, number> };
  }

  const factors: Record<string, number> = {};
  const score =
    parts.reduce((sum, part) => {
      const value = clampScore(part.value);
      factors[part.key] = value;
      return sum + value * part.weight;
    }, 0) / totalWeight;

  return { score: clampScore(score), factors };
}
