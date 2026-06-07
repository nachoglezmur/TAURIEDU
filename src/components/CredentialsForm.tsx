import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface Props {
  onComplete: () => void;
}

export default function CredentialsForm({ onComplete }: Props) {
  const [keyId, setKeyId] = useState("");
  const [secret, setSecret] = useState("");
  const [region, setRegion] = useState("us-east-1");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await invoke("save_credentials", { keyId, secret, region });
      onComplete();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="screen">
      <h1>AWS Credentials</h1>
      <p className="hint">
        Stored encrypted in Windows Credential Manager.
        <br />
        This screen will not appear again after saving.
      </p>

      <form onSubmit={handleSubmit} className="credentials-form">
        <label>
          Access Key ID
          <input
            type="text"
            value={keyId}
            onChange={(e) => setKeyId(e.target.value)}
            required
            autoComplete="off"
            spellCheck={false}
            placeholder="AKIA…"
          />
        </label>

        <label>
          Secret Access Key
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            required
          />
        </label>

        <label>
          Region
          <input
            type="text"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            required
            placeholder="us-east-1"
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Saving…" : "Save Credentials"}
        </button>
      </form>
    </div>
  );
}
