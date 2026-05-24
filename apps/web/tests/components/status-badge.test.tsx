import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { StatusBadge } from "@/components/status/status-badge";

describe("StatusBadge", () => {
  it("renders the provided status label", () => {
    render(<StatusBadge status="Running" />);
    expect(screen.getByText("Running")).toBeInTheDocument();
  });
});

