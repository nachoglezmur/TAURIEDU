import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

vi.mock("../components/SetupScreen", () => ({
  default: ({ onComplete }: { onComplete: () => void }) => (
    <div data-testid="setup-screen">
      <button onClick={onComplete}>Complete Setup</button>
    </div>
  ),
}));

vi.mock("../components/CredentialsForm", () => ({
  default: ({ onComplete }: { onComplete: () => void }) => (
    <div data-testid="credentials-form">
      <button onClick={onComplete}>Complete Creds</button>
    </div>
  ),
}));

vi.mock("../components/MainScreen", () => ({
  default: () => <div data-testid="main-screen">Main</div>,
}));

import { invoke } from "@tauri-apps/api/core";
import App from "../App";

const DEPS_OK = { aws_cli: true, ssm_plugin: true };
const DEPS_NO_CLI = { aws_cli: false, ssm_plugin: true };
const DEPS_NO_PLUGIN = { aws_cli: true, ssm_plugin: false };
const CREDS = { key_id: "AKIA", secret: "s", region: "us-east-1" };

describe("App phase routing", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  it("shows checking state before invoke resolves", () => {
    vi.mocked(invoke).mockReturnValue(new Promise(() => {}));
    render(<App />);
    expect(screen.getByText(/Checking setup/i)).toBeInTheDocument();
  });

  it("goes to setup when aws_cli missing", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(DEPS_NO_CLI);
    render(<App />);
    expect(await screen.findByTestId("setup-screen")).toBeInTheDocument();
  });

  it("goes to setup when ssm_plugin missing", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(DEPS_NO_PLUGIN);
    render(<App />);
    expect(await screen.findByTestId("setup-screen")).toBeInTheDocument();
  });

  it("goes to setup when both deps missing", async () => {
    vi.mocked(invoke).mockResolvedValueOnce({ aws_cli: false, ssm_plugin: false });
    render(<App />);
    expect(await screen.findByTestId("setup-screen")).toBeInTheDocument();
  });

  it("goes to credentials when load_credentials throws", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce(DEPS_OK)
      .mockRejectedValueOnce("No credentials stored");
    render(<App />);
    expect(await screen.findByTestId("credentials-form")).toBeInTheDocument();
  });

  it("goes to main when deps ok and credentials loaded", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce(DEPS_OK)
      .mockResolvedValueOnce(CREDS);
    render(<App />);
    expect(await screen.findByTestId("main-screen")).toBeInTheDocument();
  });

  it("goes to credentials when check_dependencies itself throws", async () => {
    vi.mocked(invoke).mockRejectedValueOnce("IPC error");
    render(<App />);
    expect(await screen.findByTestId("credentials-form")).toBeInTheDocument();
  });

  it("setup → credentials transition on onComplete", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(DEPS_NO_CLI);
    render(<App />);
    await screen.findByTestId("setup-screen");

    await userEvent.click(screen.getByRole("button", { name: /Complete Setup/i }));
    expect(screen.getByTestId("credentials-form")).toBeInTheDocument();
  });

  it("credentials → main transition on onComplete", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce(DEPS_OK)
      .mockRejectedValueOnce("no creds");
    render(<App />);
    await screen.findByTestId("credentials-form");

    await userEvent.click(screen.getByRole("button", { name: /Complete Creds/i }));
    expect(screen.getByTestId("main-screen")).toBeInTheDocument();
  });

  it("only setup screen rendered when in setup phase", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(DEPS_NO_CLI);
    render(<App />);
    await screen.findByTestId("setup-screen");
    expect(screen.queryByTestId("credentials-form")).not.toBeInTheDocument();
    expect(screen.queryByTestId("main-screen")).not.toBeInTheDocument();
  });

  it("only main screen rendered when in main phase", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(DEPS_OK).mockResolvedValueOnce(CREDS);
    render(<App />);
    await screen.findByTestId("main-screen");
    expect(screen.queryByTestId("setup-screen")).not.toBeInTheDocument();
    expect(screen.queryByTestId("credentials-form")).not.toBeInTheDocument();
  });
});
