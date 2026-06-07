import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface Instance {
  id: string;
  name: string;
}

interface Props {
  selected: Instance | null;
  onSelect: (instance: Instance) => void;
}

export default function InstanceList({ selected, onSelect }: Props) {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [filePath, setFilePath] = useState("");
  const [loading, setLoading] = useState(true);

  async function reload() {
    setLoading(true);
    try {
      const [list, path] = await Promise.all([
        invoke<Instance[]>("load_instances"),
        invoke<string>("get_instances_file_path"),
      ]);
      setInstances(list);
      setFilePath(path);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  return (
    <div className="instance-list-container">
      <div className="instance-header">
        <h2>Instances</h2>
        <button className="btn-small" onClick={reload} disabled={loading}>
          {loading ? "…" : "Refresh"}
        </button>
      </div>

      {loading ? (
        <p className="hint">Loading…</p>
      ) : instances.length === 0 ? (
        <p className="hint">
          No instances found.
          <br />
          Edit the config file and click Refresh.
        </p>
      ) : (
        <ul className="instances">
          {instances.map((inst) => (
            <li
              key={inst.id}
              className={`instance-item${selected?.id === inst.id ? " selected" : ""}`}
              onClick={() => onSelect(inst)}
            >
              <span className="inst-name">{inst.name}</span>
              <span className="inst-id">{inst.id}</span>
            </li>
          ))}
        </ul>
      )}

      {filePath && (
        <p className="file-path">
          Config: <code>{filePath}</code>
          <br />
          Format: <code>i-0abc,Name</code>
        </p>
      )}
    </div>
  );
}
