"use client";

import { useEffect, useState } from "react";

import { formatNigeriaClockLabel } from "@/lib/nigeria-time";

export function useNigeriaClock(intervalMs = 1000) {
  const [label, setLabel] = useState(() => formatNigeriaClockLabel(new Date()));

  useEffect(() => {
    const tick = () => setLabel(formatNigeriaClockLabel(new Date()));
    tick();
    const timer = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);

  return label;
}
