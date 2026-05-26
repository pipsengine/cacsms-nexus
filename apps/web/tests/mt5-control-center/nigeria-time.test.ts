import { describe, expect, it } from "vitest";

import { formatNigeriaClockLabel, formatNigeriaTime, NIGERIA_TIME_ZONE } from "@/lib/nigeria-time";
import { ONBOARDING_FORM_OPTIONS } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/data/broker-catalog";

describe("Nigeria time formatting", () => {
  it("uses Africa/Lagos timezone", () => {
    expect(NIGERIA_TIME_ZONE).toBe("Africa/Lagos");
    const formatted = formatNigeriaTime("2026-01-15T12:00:00.000Z");
    expect(formatted).toMatch(/\d/);
    expect(formatNigeriaClockLabel("2026-01-15T12:00:00.000Z")).toContain("WAT");
  });
});

describe("onboarding leverage options", () => {
  it("supports leverage up to 1:2000", () => {
    expect(ONBOARDING_FORM_OPTIONS.leverage.at(-1)).toBe("1:2000");
  });
});
