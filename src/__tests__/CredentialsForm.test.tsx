import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

import { invoke } from "@tauri-apps/api/core";
import CredentialsForm from "../components/CredentialsForm";

describe("CredentialsForm", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  it("renders all fields and button", () => {
    render(<CredentialsForm onComplete={vi.fn()} />);
    expect(screen.getByPlaceholderText("AKIA…")).toBeInTheDocument();
    expect(screen.getByLabelText(/Secret Access Key/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Region/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save Credentials/i })).toBeInTheDocument();
  });

  it("defaults region to us-east-1", () => {
    render(<CredentialsForm onComplete={vi.fn()} />);
    expect(screen.getByLabelText(/Region/i)).toHaveValue("us-east-1");
  });

  it("secret field is type password", () => {
    render(<CredentialsForm onComplete={vi.fn()} />);
    expect(screen.getByLabelText(/Secret Access Key/i)).toHaveAttribute("type", "password");
  });

  it("key id field has autocomplete off and spellcheck false", () => {
    render(<CredentialsForm onComplete={vi.fn()} />);
    const keyField = screen.getByPlaceholderText("AKIA…");
    expect(keyField).toHaveAttribute("autoComplete", "off");
    expect(keyField).toHaveAttribute("spellCheck", "false");
  });

  it("shows credential manager hint text", () => {
    render(<CredentialsForm onComplete={vi.fn()} />);
    expect(screen.getByText(/Windows Credential Manager/i)).toBeInTheDocument();
    expect(screen.getByText(/This screen will not appear again/i)).toBeInTheDocument();
  });

  it("calls invoke with correct args on submit", async () => {
    const user = userEvent.setup();
    vi.mocked(invoke).mockResolvedValue(undefined);
    render(<CredentialsForm onComplete={vi.fn()} />);

    await user.type(screen.getByPlaceholderText("AKIA…"), "AKIAFAKE123");
    await user.type(screen.getByLabelText(/Secret Access Key/i), "mysecret456");
    await user.clear(screen.getByLabelText(/Region/i));
    await user.type(screen.getByLabelText(/Region/i), "eu-west-1");
    await user.click(screen.getByRole("button", { name: /Save Credentials/i }));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("save_credentials", {
        keyId: "AKIAFAKE123",
        secret: "mysecret456",
        region: "eu-west-1",
      });
    });
  });

  it("calls onComplete after successful save", async () => {
    const user = userEvent.setup();
    vi.mocked(invoke).mockResolvedValue(undefined);
    const onComplete = vi.fn();
    render(<CredentialsForm onComplete={onComplete} />);

    await user.type(screen.getByPlaceholderText("AKIA…"), "AKIA");
    await user.type(screen.getByLabelText(/Secret Access Key/i), "secret");
    await user.click(screen.getByRole("button", { name: /Save Credentials/i }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
  });

  it("shows Saving… and disables button while submitting", async () => {
    const user = userEvent.setup();
    let resolveFn: (v: unknown) => void;
    vi.mocked(invoke).mockReturnValue(new Promise((r) => { resolveFn = r; }));
    render(<CredentialsForm onComplete={vi.fn()} />);

    await user.type(screen.getByPlaceholderText("AKIA…"), "AKIA");
    await user.type(screen.getByLabelText(/Secret Access Key/i), "secret");
    await user.click(screen.getByRole("button", { name: /Save Credentials/i }));

    expect(screen.getByRole("button", { name: /Saving/i })).toBeDisabled();
    resolveFn!(undefined);
  });

  it("re-enables button and shows error on failure", async () => {
    const user = userEvent.setup();
    vi.mocked(invoke).mockRejectedValue("Keyring write failed");
    render(<CredentialsForm onComplete={vi.fn()} />);

    await user.type(screen.getByPlaceholderText("AKIA…"), "AKIA");
    await user.type(screen.getByLabelText(/Secret Access Key/i), "secret");
    await user.click(screen.getByRole("button", { name: /Save Credentials/i }));

    await waitFor(() => {
      expect(screen.getByText("Keyring write failed")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Save Credentials/i })).not.toBeDisabled();
    });
  });

  it("does not call onComplete on failure", async () => {
    const user = userEvent.setup();
    vi.mocked(invoke).mockRejectedValue("error");
    const onComplete = vi.fn();
    render(<CredentialsForm onComplete={onComplete} />);

    await user.type(screen.getByPlaceholderText("AKIA…"), "AKIA");
    await user.type(screen.getByLabelText(/Secret Access Key/i), "s");
    await user.click(screen.getByRole("button", { name: /Save Credentials/i }));

    await waitFor(() => screen.getByText("error"));
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("clears previous error on new submit attempt", async () => {
    const user = userEvent.setup();
    vi.mocked(invoke)
      .mockRejectedValueOnce("first error")
      .mockResolvedValueOnce(undefined);
    const onComplete = vi.fn();
    render(<CredentialsForm onComplete={onComplete} />);

    await user.type(screen.getByPlaceholderText("AKIA…"), "AKIA");
    await user.type(screen.getByLabelText(/Secret Access Key/i), "s");
    await user.click(screen.getByRole("button", { name: /Save Credentials/i }));
    await waitFor(() => screen.getByText("first error"));

    await user.click(screen.getByRole("button", { name: /Save Credentials/i }));
    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(screen.queryByText("first error")).not.toBeInTheDocument();
  });
});
