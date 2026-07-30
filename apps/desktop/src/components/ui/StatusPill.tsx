import type { ServerStatus } from "../../types/server";

const labels: Record<ServerStatus, string> = {
  online: "运行中",
  offline: "已停止",
  starting: "启动中",
  stopping: "停止中",
  unknown: "未知",
};

export function StatusPill({ status }: { status: ServerStatus }) {
  return (
    <span className={`status-pill status-pill--${status}`}>
      <span className="status-pill__dot" />
      {labels[status]}
    </span>
  );
}
