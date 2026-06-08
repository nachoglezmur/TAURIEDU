import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

import { invoke } from "@tauri-apps/api/core";
import SessionControl from "../components/SessionControl";
import type { Instance } from "../components/InstanceList";

const INSTANCE: Instance = { id: "i-0abc123def", name: "MyServer" };

const clickStart = () =>
  act(async () => { fireEvent.click(screen.getByRole("button", { name: /Start Session/i })); });

const clickStop = () =>
  act(async () => { fireEvent.click(screen.getByRole("button", { name: /Stop Session/i })); });

const clickOpen = () =>
  act(async () => { fireEvent.click(screen.getByRole("button", { name: /Open/i })); });

const advanceMs = (ms: number) =>
  act(async () => { vi.advanceTimersByTime(ms); });

describe("SessionControl", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "setInterval", "clearTimeout", "clearInterval"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- No instance selected ---

  it("shows select-an-instance hint when nothing selected", () => {
    render(<SessionControl selected={null} />);
    expect(screen.getByText(/Select an instance/i)).toBeInTheDocument();
  });

  it("Start Session button disabled when no instance", () => {
    render(<SessionControl selected={null} />);
    expect(screen.getByRole("button", { name: /Start Session/i })).toBeDisabled();
  });

  it("Open button disabled when stopped and no instance", () => {
    render(<SessionControl selected={null} />);
    expect(screen.getByRole("button", { name: /Open/i })).toBeDisabled();
  });

  // --- Instance selected, stopped ---

  it("shows instance name and id when selected", () => {
    render(<SessionControl selected={INSTANCE} />);
    expect(screen.getByText("MyServer")).toBeInTheDocument();
    expect(screen.getByText("i-0abc123def")).toBeInTheDocument();
  });

  it("Start Session button enabled when instance selected", () => {
    render(<SessionControl selected={INSTANCE} />);
    expect(screen.getByRole("button", { name: /Start Session/i })).not.toBeDisabled();
  });

  it("Open button disabled when stopped", () => {
    render(<SessionControl selected={INSTANCE} />);
    expect(screen.getByRole("button", { name: /Open/i })).toBeDisabled();
  });

  it("shows Stopped badge initially", () => {
    render(<SessionControl selected={INSTANCE} />);
    expect(screen.getByText("Stopped")).toBeInTheDocument();
  });

  // --- Start session ---

  it("calls start_session with instanceId on click", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    render(<SessionControl selected={INSTANCE} />);
    await clickStart();
    expect(invoke).toHaveBeenCalledWith("start_session", { instanceId: "i-0abc123def" });
  });

  it("shows Starting badge after start click", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    render(<SessionControl selected={INSTANCE} />);
    await clickStart();
    expect(screen.getByText("Starting…")).toBeInTheDocument();
  });

  it("shows Stop Session button once starting", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    render(<SessionControl selected={INSTANCE} />);
    await clickStart();
    expect(screen.getByRole("button", { name: /Stop Session/i })).toBeInTheDocument();
  });

  // --- Status polling ---

  it("polls get_session_status every 1s when active", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValue("starting");

    render(<SessionControl selected={INSTANCE} />);
    await clickStart();
    await advanceMs(3100);

    await waitFor(() => {
      const pollCalls = vi.mocked(invoke).mock.calls.filter((c) => c[0] === "get_session_status");
      expect(pollCalls.length).toBeGreaterThanOrEqual(3);
    });
  });

  it("transitions to Running when poll returns running", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValue("running");

    render(<SessionControl selected={INSTANCE} />);
    await clickStart();
    await advanceMs(1100);
    await waitFor(() => expect(screen.getByText("Running")).toBeInTheDocument());
  });

  it("enables Open button when running", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValue("running");

    render(<SessionControl selected={INSTANCE} />);
    await clickStart();
    await advanceMs(1100);
    await waitFor(() => expect(screen.getByRole("button", { name: /Open/i })).not.toBeDisabled());
  });

  it("shows port-forwarding hint when running", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValue("running");

    render(<SessionControl selected={INSTANCE} />);
    await clickStart();
    await advanceMs(1100);
    await waitFor(() => expect(screen.getByText(/localhost:1443/i)).toBeInTheDocument());
  });

  it("stops polling when status becomes stopped", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValue("stopped");

    render(<SessionControl selected={INSTANCE} />);
    await clickStart();
    await advanceMs(1100);
    await waitFor(() => expect(screen.getByText("Stopped")).toBeInTheDocument());

    const countAfterStop = vi.mocked(invoke).mock.calls.filter(
      (c) => c[0] === "get_session_status"
    ).length;
    await advanceMs(3000);
    const countNow = vi.mocked(invoke).mock.calls.filter(
      (c) => c[0] === "get_session_status"
    ).length;
    expect(countNow).toBe(countAfterStop);
  });

  // --- Stop session ---

  it("calls stop_session on Stop click", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValue("starting");

    render(<SessionControl selected={INSTANCE} />);
    await clickStart();
    await clickStop();
    expect(invoke).toHaveBeenCalledWith("stop_session");
  });

  it("shows Start Session button after stopping", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValue("starting");

    render(<SessionControl selected={INSTANCE} />);
    await clickStart();
    await clickStop();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Start Session/i })).toBeInTheDocument()
    );
  });

  // --- Open view ---

  it("calls open_forwarded_view when Open clicked while running", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce("running")
      .mockResolvedValue(undefined);

    render(<SessionControl selected={INSTANCE} />);
    await clickStart();
    await advanceMs(1100);
    await waitFor(() => expect(screen.getByRole("button", { name: /Open/i })).not.toBeDisabled());
    await clickOpen();
    expect(invoke).toHaveBeenCalledWith("open_forwarded_view");
  });

  it("shows error message when open_forwarded_view fails", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce("running")
      .mockRejectedValue("webview error");

    render(<SessionControl selected={INSTANCE} />);
    await clickStart();
    await advanceMs(1100);
    await waitFor(() => expect(screen.getByRole("button", { name: /Open/i })).not.toBeDisabled());
    await clickOpen();
    await waitFor(() => expect(screen.getByText("webview error")).toBeInTheDocument());
  });

  // --- Error from start ---

  it("shows Error badge when start_session throws", async () => {
    vi.mocked(invoke).mockRejectedValue("spawn failed");
    render(<SessionControl selected={INSTANCE} />);
    await clickStart();
    await waitFor(() => expect(screen.getByText("Error")).toBeInTheDocument());
  });

  it("shows error message text when start fails", async () => {
    vi.mocked(invoke).mockRejectedValue("aws: command not found");
    render(<SessionControl selected={INSTANCE} />);
    await clickStart();
    await waitFor(() =>
      expect(screen.getByText("aws: command not found")).toBeInTheDocument()
    );
  });

  it("shows Start Session again after error (not Stop)", async () => {
    vi.mocked(invoke).mockRejectedValue("error");
    render(<SessionControl selected={INSTANCE} />);
    await clickStart();
    await waitFor(() => expect(screen.getByText("Error")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /Stop Session/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start Session/i })).toBeInTheDocument();
  });
});
