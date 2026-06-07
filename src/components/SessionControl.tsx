import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import StatusBadge, { SessionStatus } from "./StatusBadge";
import { Instance } from "./InstanceList";

interface Props {
  selected: Instance | null;
}

export default function SessionControl({ selected }: Props) {
  const [status, setStatus] = useState<SessionStatus>("stopped");
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "stopped") return;
    const id = setInterval(async () => {
      const s = await invoke<SessionStatus>("get_session_status");
      setStatus(s);
    }, 1000);
    return () => clearInterval(id);
  }, [status]);

  async function start() {
    if (!selected) return;
    setError("");
    setStatus("starting");
    try {
      await invoke("start_session", { instanceId: selected.id });
    } catch (e) {
      setStatus("error");
      setError(String(e));
    }
  }

  async function stop() {
    try {
      await invoke("stop_session");
    } finally {
      setStatus("stopped");
    }
  }

  async function openView() {
    try {
      await invoke("open_forwarded_view");
    } catch (e) {
      setError(String(e));
    }
  }

  const active = status === "starting" || status === "running";
  const running = status === "running";

  return (
    <div className="session-control">
      <div className="session-header">
        <h2>Session</h2>
        <StatusBadge status={status} />
      </div>

      {selected ? (
        <p className="target">
          Target: <strong>{selected.name}</strong>{" "}
          <span className="inst-id">{selected.id}</span>
        </p>
      ) : (
        <p className="hint">Select an instance from the list</p>
      )}

      <div className="session-buttons">
        {!active ? (
          <button
            className="btn-primary"
            onClick={start}
            disabled={!selected}
          >
            Start Session
          </button>
        ) : (
          <button className="btn-danger" onClick={stop}>
            Stop Session
          </button>
        )}

        <button
          className="btn-secondary"
          onClick={openView}
          disabled={!running}
        >
          Open https://localhost:1443
        </button>
      </div>

      {running && (
        <p className="port-hint">
          Port 443 forwarded → <code>https://localhost:1443</code>
        </p>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  );
}
