import {
  Activity,
  Archive,
  ArrowUpRight,
  Clock3,
  Cpu,
  Database,
  FileTerminal,
  MemoryStick,
  MoreHorizontal,
  Play,
  RefreshCw,
  Save,
  ServerCog,
  Square,
  Users,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { MetricCard } from "../components/ui/MetricCard";
import { StatusPill } from "../components/ui/StatusPill";
import { formatDateTime, formatTime, formatUptime } from "../lib/format";
import { mockLogs, mockPlayers } from "../lib/mockData";
import type { ServerSnapshot } from "../types/server";
import type { ComposeAction } from "../types/server";

interface DashboardPageProps {
  snapshot: ServerSnapshot;
  onOpenLogs: () => void;
  onNotice: (message: string) => void;
  onComposeAction: (action: ComposeAction) => Promise<void>;
  onSaveWorld: () => Promise<void>;
}

export function DashboardPage({
  snapshot,
  onOpenLogs,
  onNotice,
  onComposeAction,
  onSaveWorld,
}: DashboardPageProps) {
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const performAction = async (
    action: string,
    operation: () => Promise<void>,
  ) => {
    setBusyAction(action);
    try {
      await operation();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "操作失败");
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="page page--dashboard">
      <header className="page-header">
        <div>
          <span className="eyebrow">SERVER OVERVIEW</span>
          <h1>早上好，管理员</h1>
          <p>你的世界运行稳定，现在有 {snapshot.onlinePlayers} 位玩家在线。</p>
        </div>
        <div className="page-header__actions">
          <button className="button button--ghost" onClick={onOpenLogs}>
            <FileTerminal size={17} />
            查看日志
          </button>
          <button
            className="button button--primary"
            onClick={() => performAction("save", onSaveWorld)}
          >
            <Save
              size={17}
              className={busyAction === "save" ? "spin" : undefined}
            />
            保存世界
          </button>
        </div>
      </header>

      <section className="hero-card">
        <div className="hero-card__glow" />
        <div className="hero-card__visual" aria-hidden="true">
          <div className="planet planet--back" />
          <div className="planet">
            <span className="planet__land planet__land--one" />
            <span className="planet__land planet__land--two" />
            <span className="planet__land planet__land--three" />
            <span className="planet__ring" />
          </div>
          <div className="orbit-dot orbit-dot--one" />
          <div className="orbit-dot orbit-dot--two" />
        </div>

        <div className="hero-card__content">
          <div className="hero-card__status">
            <StatusPill status={snapshot.status} />
            <span>世界第 {snapshot.worldDay} 天</span>
          </div>
          <h2>{snapshot.serverName}</h2>
          <p>
            Palworld Dedicated Server
            <span>•</span>
            {snapshot.version}
          </p>
          <div className="hero-card__meta">
            <div>
              <Users size={17} />
              <span>
                <strong>{snapshot.onlinePlayers}</strong> / {snapshot.maxPlayers}{" "}
                玩家
              </span>
            </div>
            <div>
              <Clock3 size={17} />
              <span>{formatUptime(snapshot.metrics.uptimeSeconds)}</span>
            </div>
            <div>
              <Archive size={17} />
              <span>{formatDateTime(snapshot.lastBackupAt)}</span>
            </div>
          </div>
        </div>

        <div className="hero-card__controls">
          <button
            className="round-action round-action--positive"
            title="启动"
            onClick={() =>
              performAction("start", () => onComposeAction("start"))
            }
          >
            <Play size={18} fill="currentColor" />
          </button>
          <button
            className="round-action"
            title="重启"
            onClick={() =>
              performAction("restart", () => onComposeAction("restart"))
            }
          >
            <RefreshCw
              size={18}
              className={busyAction === "restart" ? "spin" : undefined}
            />
          </button>
          <button
            className="round-action round-action--danger"
            title="停止"
            onClick={() =>
              performAction("stop", () => onComposeAction("stop"))
            }
          >
            <Square size={16} fill="currentColor" />
          </button>
          <button className="round-action" title="更多">
            <MoreHorizontal size={19} />
          </button>
        </div>
      </section>

      <section className="metric-grid">
        <MetricCard
          icon={Cpu}
          label="CPU"
          value={`${snapshot.metrics.cpuPercent}%`}
          detail="4 核 · 负载正常"
          tone="mint"
          footer={
            <div className="spark-bars">
              {[28, 42, 34, 51, 48, 64, 43, 56, 36, 49, 61, 52].map(
                (height, index) => (
                  <i key={index} style={{ height: `${height}%` }} />
                ),
              )}
            </div>
          }
        />
        <MetricCard
          icon={MemoryStick}
          label="内存"
          value={`${snapshot.metrics.memoryUsedGb} GB`}
          detail={`共 ${snapshot.metrics.memoryTotalGb} GB`}
          tone="sky"
          footer={
            <div className="progress-track">
              <span
                style={{
                  width: `${
                    (snapshot.metrics.memoryUsedGb /
                      snapshot.metrics.memoryTotalGb) *
                    100
                  }%`,
                }}
              />
            </div>
          }
        />
        <MetricCard
          icon={Activity}
          label="服务端 FPS"
          value={snapshot.metrics.fps.toFixed(1)}
          detail="目标 60 FPS"
          tone="violet"
          footer={
            <div className="metric-trend metric-trend--good">
              <Zap size={13} fill="currentColor" />
              稳定
            </div>
          }
        />
        <MetricCard
          icon={Database}
          label="最近备份"
          value="284 MB"
          detail={formatDateTime(snapshot.lastBackupAt)}
          tone="amber"
          footer={
            <div className="metric-trend">
              <Archive size={13} />
              自动备份
            </div>
          }
        />
      </section>

      <div className="dashboard-columns">
        <section className="panel">
          <header className="panel__header">
            <div>
              <span className="eyebrow">LIVE PLAYERS</span>
              <h3>在线玩家</h3>
            </div>
            <button className="text-button">
              查看全部 <ArrowUpRight size={14} />
            </button>
          </header>
          <div className="player-list player-list--compact">
            {mockPlayers.map((player) => (
              <div className="player-row" key={player.id}>
                <div
                  className={`avatar avatar--${player.name.length % 3}`}
                  aria-hidden="true"
                >
                  {player.name.slice(0, 1).toUpperCase()}
                  <span />
                </div>
                <div className="player-row__identity">
                  <strong>{player.name}</strong>
                  <span>
                    Lv.{player.level} · {player.platform}
                  </span>
                </div>
                <div className="ping">
                  <i />
                  {player.pingMs} ms
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <header className="panel__header">
            <div>
              <span className="eyebrow">RECENT ACTIVITY</span>
              <h3>最近活动</h3>
            </div>
            <button className="icon-button" onClick={onOpenLogs}>
              <MoreHorizontal size={18} />
            </button>
          </header>
          <div className="activity-list">
            {mockLogs.slice(0, 4).map((entry) => (
              <div className="activity-row" key={entry.id}>
                <span
                  className={`activity-row__dot activity-row__dot--${entry.level}`}
                />
                <div>
                  <strong>{entry.message}</strong>
                  <span>
                    {entry.source} · {formatTime(entry.timestamp)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="preview-banner">
        <ServerCog size={17} />
        <span>
          当前显示演示数据。保存 SSH 连接后，Rust 后端会读取远程 Compose 和 REST
          API 的真实状态。
        </span>
      </div>
    </div>
  );
}
