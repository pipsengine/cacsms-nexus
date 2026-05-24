import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("framer-motion", () => ({
  motion: {
    article: ({ children, ...props }: any) => <article {...props}>{children}</article>
  }
}));

import { WorkflowCard } from "@/components/workflow/workflow-card";

describe("WorkflowCard", () => {
  it("renders stage title and status", () => {
    render(
      <WorkflowCard
        stageNumber={1}
        title="Human Administration"
        description="Executive controls"
        status="Operational"
        confidence="98%"
        latency="12ms"
        health="Nominal"
        colorType="blue"
        onSelect={() => {}}
      />
    );

    expect(screen.getByText("Human Administration")).toBeInTheDocument();
    expect(screen.getByText("Operational")).toBeInTheDocument();
  });
});

