import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

import { invoke } from "@tauri-apps/api/core";
import SetupScreen from "../components/SetupScreen";

describe("SetupScreen", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders heading and install button on idle", () => {
    render(<SetupScreen onComplete={vi.fn()} />);
    expect(screen.getByText("First-Time Setup")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Install Dependencies/i })).toBeInTheDocument();
  });

  it("shows not-installed hint text", () => {
    render(<SetupScreen onComplete={vi.fn()} />);
    expect(screen.getByText(/not installed/i)).toBeInTheDocument();
  });

  it("shows CLI installing message during cli step", async () => {
    let resolveAwsCli: () => void;
    vi.mocked(invoke)
      .mockResolvedValueOnce({ aws_cli: false, ssm_plugin: false })
      .mockReturnValueOnce(new Promise<void>((r) => { resolveAwsCli = r; })) // install_aws_cli hangs
      .mockResolvedValue(undefined); // install_ssm_plugin

    render(<SetupScreen onComplete={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /Install Dependencies/i }));

    expect(await screen.findByText(/Installing AWS CLI/i)).toBeInTheDocument();
    resolveAwsCli!();
  });

  it("shows plugin installing message during plugin step", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce({ aws_cli: true, ssm_plugin: false })
      .mockResolvedValueOnce(undefined);

    render(<SetupScreen onComplete={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /Install Dependencies/i }));

    expect(await screen.findByText(/Session Manager Plugin/i)).toBeInTheDocument();
  });

  it("shows Setup complete message when done", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce({ aws_cli: false, ssm_plugin: false })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);

    render(<SetupScreen onComplete={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /Install Dependencies/i }));

    expect(await screen.findByText(/Setup complete/i)).toBeInTheDocument();
  });

  it("calls onComplete after done (fake timers advance past delay)", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "setInterval", "clearTimeout", "clearInterval"] });

    vi.mocked(invoke)
      .mockResolvedValueOnce({ aws_cli: false, ssm_plugin: false })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);

    const onComplete = vi.fn();
    render(<SetupScreen onComplete={onComplete} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Install Dependencies/i }));
    });

    expect(screen.getByText(/Setup complete/i)).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(1500); });
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("skips install_aws_cli when aws_cli already present", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce({ aws_cli: true, ssm_plugin: false })
      .mockResolvedValueOnce(undefined);

    render(<SetupScreen onComplete={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /Install Dependencies/i }));

    await screen.findByText(/Setup complete/i);

    const calls = vi.mocked(invoke).mock.calls.map((c) => c[0]);
    expect(calls).not.toContain("install_aws_cli");
    expect(calls).toContain("install_ssm_plugin");
  });

  it("skips install_ssm_plugin when ssm_plugin already present", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce({ aws_cli: false, ssm_plugin: true })
      .mockResolvedValueOnce(undefined);

    render(<SetupScreen onComplete={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /Install Dependencies/i }));

    await screen.findByText(/Setup complete/i);

    const calls = vi.mocked(invoke).mock.calls.map((c) => c[0]);
    expect(calls).not.toContain("install_ssm_plugin");
    expect(calls).toContain("install_aws_cli");
  });

  it("shows error state on install failure", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce({ aws_cli: false, ssm_plugin: false })
      .mockRejectedValueOnce("download failed");

    render(<SetupScreen onComplete={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /Install Dependencies/i }));

    expect(await screen.findByText(/Installation failed/i)).toBeInTheDocument();
    expect(screen.getByText("download failed")).toBeInTheDocument();
    expect(screen.getByText(/install manually/i)).toBeInTheDocument();
  });

  it("does not call onComplete on error", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce({ aws_cli: false, ssm_plugin: false })
      .mockRejectedValueOnce("network error");

    const onComplete = vi.fn();
    render(<SetupScreen onComplete={onComplete} />);
    await userEvent.click(screen.getByRole("button", { name: /Install Dependencies/i }));

    await screen.findByText(/Installation failed/i);
    expect(onComplete).not.toHaveBeenCalled();
  });
});
