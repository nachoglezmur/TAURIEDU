import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

import { invoke } from "@tauri-apps/api/core";
import InstanceList from "../components/InstanceList";

const CSV_PATH = "C:\\Users\\test\\AppData\\Roaming\\SSMPortManager\\instances.csv";
const INSTANCES = [
  { id: "i-0abc123def", name: "MyServer" },
  { id: "i-0def456ghi", name: "DBServer" },
];

function setupMocks(instances = INSTANCES, path = CSV_PATH) {
  vi.mocked(invoke)
    .mockResolvedValueOnce(instances)
    .mockResolvedValueOnce(path);
}

describe("InstanceList", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  it("shows loading text initially", () => {
    vi.mocked(invoke).mockReturnValue(new Promise(() => {}));
    render(<InstanceList selected={null} onSelect={vi.fn()} />);
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  it("renders instance names and ids after load", async () => {
    setupMocks();
    render(<InstanceList selected={null} onSelect={vi.fn()} />);
    expect(await screen.findByText("MyServer")).toBeInTheDocument();
    expect(screen.getByText("i-0abc123def")).toBeInTheDocument();
    expect(screen.getByText("DBServer")).toBeInTheDocument();
    expect(screen.getByText("i-0def456ghi")).toBeInTheDocument();
  });

  it("shows empty state when no instances", async () => {
    setupMocks([]);
    render(<InstanceList selected={null} onSelect={vi.fn()} />);
    expect(await screen.findByText(/No instances found/i)).toBeInTheDocument();
    expect(screen.getByText(/Edit the config file/i)).toBeInTheDocument();
  });

  it("shows file path after load", async () => {
    setupMocks();
    render(<InstanceList selected={null} onSelect={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(CSV_PATH)).toBeInTheDocument();
    });
  });

  it("shows format hint", async () => {
    setupMocks();
    render(<InstanceList selected={null} onSelect={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/i-0abc,Name/i)).toBeInTheDocument();
    });
  });

  it("renders 'Instances' section heading", async () => {
    setupMocks();
    render(<InstanceList selected={null} onSelect={vi.fn()} />);
    expect(await screen.findByText("Instances")).toBeInTheDocument();
  });

  it("calls onSelect with correct instance when clicked", async () => {
    setupMocks();
    const onSelect = vi.fn();
    render(<InstanceList selected={null} onSelect={onSelect} />);
    await screen.findByText("MyServer");
    await userEvent.click(screen.getByText("MyServer").closest("li")!);
    expect(onSelect).toHaveBeenCalledWith(INSTANCES[0]);
  });

  it("selects second instance independently", async () => {
    setupMocks();
    const onSelect = vi.fn();
    render(<InstanceList selected={null} onSelect={onSelect} />);
    await screen.findByText("DBServer");
    await userEvent.click(screen.getByText("DBServer").closest("li")!);
    expect(onSelect).toHaveBeenCalledWith(INSTANCES[1]);
  });

  it("applies selected class to active instance", async () => {
    setupMocks();
    render(<InstanceList selected={INSTANCES[0]} onSelect={vi.fn()} />);
    await screen.findByText("MyServer");
    expect(screen.getByText("MyServer").closest("li")).toHaveClass("selected");
  });

  it("does not apply selected class to other instances", async () => {
    setupMocks();
    render(<InstanceList selected={INSTANCES[0]} onSelect={vi.fn()} />);
    await screen.findByText("DBServer");
    expect(screen.getByText("DBServer").closest("li")).not.toHaveClass("selected");
  });

  it("has Refresh button that reloads", async () => {
    setupMocks();
    render(<InstanceList selected={null} onSelect={vi.fn()} />);
    await screen.findByText("MyServer");

    const newInstances = [{ id: "i-0new999", name: "NewServer" }];
    vi.mocked(invoke).mockReset();
    vi.mocked(invoke)
      .mockResolvedValueOnce(newInstances)
      .mockResolvedValueOnce(CSV_PATH);

    await userEvent.click(screen.getByRole("button", { name: /Refresh/i }));
    expect(await screen.findByText("NewServer")).toBeInTheDocument();
    expect(screen.queryByText("MyServer")).not.toBeInTheDocument();
  });

  it("Refresh button shows loading text during reload", async () => {
    setupMocks();
    render(<InstanceList selected={null} onSelect={vi.fn()} />);
    await screen.findByText("MyServer");

    vi.mocked(invoke).mockReturnValue(new Promise(() => {}));
    await userEvent.click(screen.getByRole("button", { name: /Refresh/i }));
    expect(screen.getByRole("button", { name: "…" })).toBeInTheDocument();
  });

  it("loads instances on mount (invokes load_instances + get_instances_file_path)", async () => {
    setupMocks();
    render(<InstanceList selected={null} onSelect={vi.fn()} />);
    await screen.findByText("MyServer");

    const calls = vi.mocked(invoke).mock.calls.map((c) => c[0]);
    expect(calls).toContain("load_instances");
    expect(calls).toContain("get_instances_file_path");
  });
});
