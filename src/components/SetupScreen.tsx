import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface Props {
  onComplete: () => void;
}

type Step = "idle" | "cli" | "plugin" | "done" | "error";

interface DepStatus {
  aws_cli: boolean;
  ssm_plugin: boolean;
}

export default function SetupScreen({ onComplete }: Props) {
  const [step, setStep] = useState<Step>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function runSetup() {
    try {
      const deps = await invoke<DepStatus>("check_dependencies");

      if (!deps.aws_cli) {
        setStep("cli");
        await invoke("install_aws_cli");
      }

      if (!deps.ssm_plugin) {
        setStep("plugin");
        await invoke("install_ssm_plugin");
      }

      setStep("done");
      setTimeout(onComplete, 1500);
    } catch (e) {
      setStep("error");
      setErrorMsg(String(e));
    }
  }

  return (
    <div className="screen">
      <h1>First-Time Setup</h1>
      <p className="hint">
        AWS CLI and/or Session Manager Plugin are not installed.
      </p>

      {step === "idle" && (
        <button className="btn-primary" onClick={runSetup}>
          Install Dependencies
        </button>
      )}

      {step === "cli" && (
        <p className="status-msg">Installing AWS CLI… (may take a minute)</p>
      )}

      {step === "plugin" && (
        <p className="status-msg">Installing Session Manager Plugin…</p>
      )}

      {step === "done" && (
        <p className="status-msg success">Setup complete!</p>
      )}

      {step === "error" && (
        <div className="error-box">
          <p>Installation failed:</p>
          <pre>{errorMsg}</pre>
          <p style={{ marginTop: "0.5rem", color: "#9ca3af", fontSize: "0.8rem" }}>
            Please install manually and restart the app.
          </p>
        </div>
      )}
    </div>
  );
}
