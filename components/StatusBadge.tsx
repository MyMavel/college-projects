import { STATUSES, type Status } from "@/lib/projects";

export default function StatusBadge({ status }: { status: Status }) {
  const s = STATUSES[status];
  return <span className="badge" style={{ background: s.color }}>{s.label}</span>;
}
