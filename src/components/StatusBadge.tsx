export type SessionStatus = "stopped" | "starting" | "running" | "error";

const labels: Record<SessionStatus, string> = {
  stopped: "Stopped",
  starting: "Starting…",
  running: "Running",
  error: "Error",
};

const colors: Record<SessionStatus, string> = {
  stopped: "#6b7280",
  starting: "#f59e0b",
  running: "#10b981",
  error: "#ef4444",
};

export default function StatusBadge({ status }: { status: SessionStatus }) {
  return (
    <span className="status-badge" style={{ backgroundColor: colors[status] }}>
      {labels[status]}
    </span>
  );
}
