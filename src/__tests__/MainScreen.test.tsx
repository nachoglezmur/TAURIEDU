import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

vi.mock("../components/InstanceList", () => ({
  default: ({
    onSelect,
  }: {
    selected: unknown;
    onSelect: (i: { id: string; name: string }) => void;
  }) => (
    <div data-testid="instance-list">
      <button onClick={() => onSelect({ id: "i-0abc", name: "TestServer" })}>
        Select Instance
      </button>
    </div>
  ),
}));

vi.mock("../components/SessionControl", () => ({
  default: ({ selected }: { selected: { id: string; name: string } | null }) => (
    <div
      data-testid="session-control"
      data-selected={selected?.id ?? "none"}
    />
  ),
}));

import MainScreen from "../components/MainScreen";

describe("MainScreen", () => {
  it("renders app header", () => {
    render(<MainScreen />);
    expect(screen.getByRole("heading", { name: /SSM Port Manager/i })).toBeInTheDocument();
  });

  it("renders subtitle", () => {
    render(<MainScreen />);
    expect(screen.getByText(/AWS Session Manager/i)).toBeInTheDocument();
  });

  it("passes null to SessionControl initially", () => {
    render(<MainScreen />);
    expect(screen.getByTestId("session-control")).toHaveAttribute("data-selected", "none");
  });

  it("passes selected instance to SessionControl after InstanceList selection", async () => {
    const user = userEvent.setup();
    render(<MainScreen />);
    await user.click(screen.getByRole("button", { name: /Select Instance/i }));
    expect(screen.getByTestId("session-control")).toHaveAttribute("data-selected", "i-0abc");
  });
});
