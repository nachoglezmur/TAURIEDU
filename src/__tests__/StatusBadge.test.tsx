import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StatusBadge, { SessionStatus } from "../components/StatusBadge";

describe("StatusBadge", () => {
  const cases: Array<[SessionStatus, string, string]> = [
    ["stopped", "Stopped", "#6b7280"],
    ["starting", "Starting…", "#f59e0b"],
    ["running", "Running", "#10b981"],
    ["error", "Error", "#ef4444"],
  ];

  it.each(cases)("renders %s with correct label", (status, label) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it.each(cases)("renders %s with correct background color", (status, label, color) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toHaveStyle({ backgroundColor: color });
  });

  it.each(cases)("renders %s with status-badge class", (status, label) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toHaveClass("status-badge");
  });
});
