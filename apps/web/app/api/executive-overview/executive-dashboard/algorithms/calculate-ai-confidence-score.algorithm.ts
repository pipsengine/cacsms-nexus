import { weightedScore } from "./utils";

export function calculateAIConfidenceScore(input: {
  modelConfidence?: number;
  strategyAgreement?: number;
  marketRegimeConfidence?: number;
  visionConfidence?: number;
  sentimentAlignment?: number;
  signalQuality?: number;
}) {
  const { score, factors } = weightedScore([
    { key: "modelConfidence", value: input.modelConfidence ?? 0, weight: 25 },
    { key: "strategyAgreement", value: input.strategyAgreement ?? 0, weight: 20 },
    { key: "regimeConfidence", value: input.marketRegimeConfidence ?? 0, weight: 15 },
    { key: "visionConfidence", value: input.visionConfidence ?? 0, weight: 15 },
    { key: "signalQuality", value: input.signalQuality ?? 0, weight: 15 },
    { key: "sentimentAlignment", value: input.sentimentAlignment ?? 0, weight: 10 }
  ]);

  return {
    score,
    explanation: "AI confidence aggregates model confidence, strategy agreement, regime confidence, vision confidence, signal quality, and sentiment alignment.",
    factors
  };
}

