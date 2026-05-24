import { clampScore, safeNumber, weightedScore } from "./utils";

export function calculateSystemHealthScore(input: {
  serviceHealthStates?: Array<{
    status: "Operational" | "Degraded" | "Offline" | "Warning";
    latencyMs: number;
    lastHeartbeatAgeSeconds: number;
    errorRate: number;
  }>;
}) {
  const services = input.serviceHealthStates ?? [];

  const availability = services.length
    ? (services.filter((s) => s.status === "Operational").length / services.length) * 100
    : 0;

  const uptimeScore = clampScore(availability);

  const latencyMs = services.length ? services.reduce((sum, s) => sum + safeNumber(s.latencyMs), 0) / services.length : 0;
  const latencyScore = clampScore(100 - Math.min(100, latencyMs / 2));

  const errorRate = services.length ? services.reduce((sum, s) => sum + safeNumber(s.errorRate), 0) / services.length : 1;
  const errorScore = clampScore(100 - Math.min(100, errorRate * 100));

  const heartbeatAge =
    services.length ? services.reduce((sum, s) => sum + safeNumber(s.lastHeartbeatAgeSeconds), 0) / services.length : 1200;
  const heartbeatScore = clampScore(100 - Math.min(100, heartbeatAge / 6));

  const serviceAvailabilityScore = clampScore(
    services.length
      ? (services.reduce((sum, s) => {
          const base = s.status === "Operational" ? 100 : s.status === "Warning" ? 70 : s.status === "Degraded" ? 45 : 0;
          return sum + base;
        }, 0) /
          services.length)
      : 0
  );

  const { score, factors } = weightedScore([
    { key: "uptime", value: uptimeScore, weight: 30 },
    { key: "latency", value: latencyScore, weight: 20 },
    { key: "serviceAvailability", value: serviceAvailabilityScore, weight: 25 },
    { key: "errorRate", value: errorScore, weight: 15 },
    { key: "heartbeatFreshness", value: heartbeatScore, weight: 10 }
  ]);

  return {
    score,
    explanation:
      services.length === 0
        ? "No service telemetry provided; score defaults to 0."
        : `Health derived from ${services.length} services with weighted uptime, availability, latency, error rate, and heartbeat freshness.`,
    factors
  };
}

