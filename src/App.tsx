import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import SetupScreen from "./components/SetupScreen";
import CredentialsForm from "./components/CredentialsForm";
import MainScreen from "./components/MainScreen";

type Phase = "checking" | "setup" | "credentials" | "main";

interface DepStatus {
  aws_cli: boolean;
  ssm_plugin: boolean;
}

export default function App() {
  const [phase, setPhase] = useState<Phase>("checking");

  useEffect(() => {
    (async () => {
      try {
        const deps = await invoke<DepStatus>("check_dependencies");
        if (!deps.aws_cli || !deps.ssm_plugin) {
          setPhase("setup");
          return;
        }
        await invoke("load_credentials");
        setPhase("main");
      } catch {
        setPhase("credentials");
      }
    })();
  }, []);

  if (phase === "checking") return <div className="loading">Checking setup…</div>;
  if (phase === "setup") return <SetupScreen onComplete={() => setPhase("credentials")} />;
  if (phase === "credentials") return <CredentialsForm onComplete={() => setPhase("main")} />;
  return <MainScreen />;
}
