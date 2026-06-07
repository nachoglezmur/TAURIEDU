import { useState } from "react";
import InstanceList, { Instance } from "./InstanceList";
import SessionControl from "./SessionControl";

export default function MainScreen() {
  const [selected, setSelected] = useState<Instance | null>(null);

  return (
    <div className="main-screen">
      <header className="app-header">
        <h1>SSM Port Manager</h1>
        <span className="subtitle">AWS Session Manager · Port 443 → localhost:1443</span>
      </header>
      <div className="content">
        <InstanceList selected={selected} onSelect={setSelected} />
        <SessionControl selected={selected} />
      </div>
    </div>
  );
}
