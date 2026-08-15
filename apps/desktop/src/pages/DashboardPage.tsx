import {
  Activity,
  Archive,
  ArrowUpRight,
  Clock3,
  Cpu,
  Database,
  FileTerminal,
  LoaderCircle,
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
import { useCallback, useEffect, useRef, useState } from "react";
import { MetricCard } from "../components/ui/MetricCard";
import { StatusPill } from "../components/ui/StatusPill";
import { formatBytes, formatDateTime, formatTime, formatUptime } from "../lib/format";
import { fetchBackups, fetchOnlinePlayers, fetchRemoteLogs } from "../lib/backend";
import { parseRemoteLogs } from "../lib/remoteData";
import type { Backup, LogEntry, Player, ServerProfile, ServerSnapshot } from "../types/server";
import type { ComposeAction } from "../types/server";
import { useI18n } from "../i18n/I18nContext";

interface DashboardPageProps {
  profile: ServerProfile;
  snapshot: ServerSnapshot;
  onOpenLogs: () => void;
  onOpenPlayers: () => void;
  onNotice: (message: string) => void;
  onComposeAction: (action: ComposeAction) => Promise<void>;
  onSaveWorld: () => Promise<void>;
}

export function DashboardPage({
  profile,
  snapshot,
  onOpenLogs,
  onOpenPlayers,
  onNotice,
  onComposeAction,
  onSaveWorld,
}: DashboardPageProps) {
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [backups, setBackups] = useState<Backup[]>([]);
  const loadingPlayers = useRef(false);
  const lastPlayersError = useRef<string | null>(null);
  const { t, locale, errorMessage } = useI18n();

  const loadPlayers = useCallback(async () => {
    if (loadingPlayers.current) return;
    loadingPlayers.current = true;
    try {
      setPlayers(await fetchOnlinePlayers(profile));
      lastPlayersError.current = null;
    } catch (error) {
      const message = errorMessage(error);
      if (lastPlayersError.current !== message) onNotice(message);
      lastPlayersError.current = message;
    } finally {
      loadingPlayers.current = false;
    }
  }, [profile, onNotice, errorMessage]);

  useEffect(() => {
    void fetchBackups(profile).then(setBackups).catch(() => setBackups([]));
  }, [profile]);

  useEffect(() => {
    if (snapshot.status !== "online") {
      setPlayers([]);
      return;
    }
    void loadPlayers();
    const timer = window.setInterval(() => void loadPlayers(), 10_000);
    const refreshOnFocus = () => void loadPlayers();
    window.addEventListener("focus", refreshOnFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [snapshot.status, loadPlayers]);

  useEffect(() => {
    if (snapshot.status !== "online") {
      setLogs([]);
      return;
    }
    void fetchRemoteLogs(profile, 80).then((result) => {
      if (result.success) setLogs(parseRemoteLogs(result.stdout));
    });
  }, [profile, snapshot.status]);

  const performAction = async (
    action: string,
    operation: () => Promise<void>,
  ) => {
    setBusyAction(action);
    try {
      await operation();
    } catch (error) {
      onNotice(errorMessage(error));
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="page page--dashboard">
      <header className="page-header">
        <div>
          <span className="eyebrow">SERVER OVERVIEW</span>
          <h1>{t("早上好，管理员")}</h1>
          <p>{t("当前服务器状态：{status}，在线玩家：{count}。", {
            status: t(statusLabel[snapshot.status]),
            count: snapshot.onlinePlayers ?? "—",
          })}</p>
        </div>
        <div className="page-header__actions">
          <button className="button button--ghost" onClick={onOpenLogs}>
            <FileTerminal size={17} />
            {t("查看日志")}
          </button>
          <button
            className="button button--primary"
            onClick={() => performAction("save", onSaveWorld)}
            disabled={busyAction !== null || snapshot.status !== "online"}
          >
            {busyAction === "save" ? <LoaderCircle size={17} className="spin" /> : <Save size={17} />}
            {t(busyAction === "save" ? "正在保存世界…" : "保存世界")}
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
            <span>{t("世界第 {day} 天", { day: snapshot.worldDay ?? "—" })}</span>
          </div>
          <h2>{snapshot.serverName ?? profile.name}</h2>
          <p>
            Palworld Dedicated Server
            <span>•</span>
            {snapshot.version ?? "—"}
          </p>
          <div className="hero-card__meta">
            <div>
              <Users size={17} />
              <span>
                <strong>{snapshot.onlinePlayers ?? "—"}</strong> / {snapshot.maxPlayers ?? "—"}{" "}
                {t("玩家")}
              </span>
            </div>
            <div>
              <Clock3 size={17} />
              <span>{snapshot.metrics.uptimeSeconds === null ? "—" : formatUptime(snapshot.metrics.uptimeSeconds, locale)}</span>
            </div>
            <div>
              <Archive size={17} />
              <span>{formatDateTime(backups[0] ? new Date(backups[0].modifiedUnix * 1000).toISOString() : null, locale)}</span>
            </div>
          </div>
        </div>

        <div className="hero-card__controls">
          <button
            className="round-action round-action--positive"
            title={t("启动")}
            onClick={() =>
              performAction("start", () => onComposeAction("start"))
            }
            disabled={busyAction !== null}
          >
            {busyAction === "start" ? <RefreshCw size={18} className="spin" /> : <Play size={18} fill="currentColor" />}
          </button>
          <button
            className="round-action"
            title={t("重启")}
            onClick={() =>
              performAction("restart", () => onComposeAction("restart"))
            }
            disabled={busyAction !== null}
          >
            <RefreshCw
              size={18}
              className={busyAction === "restart" ? "spin" : undefined}
            />
          </button>
          <button
            className="round-action round-action--danger"
            title={t("停止")}
            onClick={() =>
              performAction("stop", () => onComposeAction("stop"))
            }
            disabled={busyAction !== null}
          >
            <Square size={16} fill="currentColor" />
          </button>
        </div>
      </section>

      <section className="metric-grid">
        <MetricCard
          icon={Cpu}
          label="CPU"
          value={snapshot.metrics.cpuPercent === null ? "—" : `${snapshot.metrics.cpuPercent.toFixed(1)}%`}
          detail={t("容器实时数据")}
          tone="mint"
          footer={
            <div />
          }
        />
        <MetricCard
          icon={MemoryStick}
          label={t("内存")}
          value={formatBytes(snapshot.metrics.memoryUsedBytes, locale)}
          detail={t("上限 {value}", { value: formatBytes(snapshot.metrics.memoryLimitBytes, locale) })}
          tone="sky"
          footer={
            <div className="progress-track">
              <span
                style={{
                  width: snapshot.metrics.memoryUsedBytes !== null && snapshot.metrics.memoryLimitBytes
                    ? `${(snapshot.metrics.memoryUsedBytes / snapshot.metrics.memoryLimitBytes) * 100}%`
                    : "0%",
                }}
              />
            </div>
          }
        />
        <MetricCard
          icon={Activity}
          label={t("服务端 FPS")}
          value={snapshot.metrics.fps === null ? "—" : snapshot.metrics.fps.toFixed(1)}
          detail={t("来自 Palworld REST API")}
          tone="violet"
          footer={
            <div className="metric-trend metric-trend--good">
              <Zap size={13} fill="currentColor" />
              {snapshot.restAvailable ? t("实时") : t("不可用")}
            </div>
          }
        />
        <MetricCard
          icon={Database}
          label={t("最近备份")}
          value={formatBytes(backups[0]?.sizeBytes ?? null, locale)}
          detail={formatDateTime(backups[0] ? new Date(backups[0].modifiedUnix * 1000).toISOString() : null, locale)}
          tone="amber"
          footer={
            <div className="metric-trend">
              <Archive size={13} />
              {t("自动备份")}
            </div>
          }
        />
      </section>

      <div className="dashboard-columns">
        <section className="panel">
          <header className="panel__header">
            <div>
              <span className="eyebrow">LIVE PLAYERS</span>
              <h3>{t("在线玩家")}</h3>
            </div>
            <button className="text-button" onClick={onOpenPlayers}>
              {t("查看全部")} <ArrowUpRight size={14} />
            </button>
          </header>
          <div className="player-list player-list--compact">
            {players.slice(0, 5).map((player) => (
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
                    Lv.{player.level} · {player.accountName || player.id}
                  </span>
                </div>
                <div className="ping">
                  <i />
                  {player.pingMs.toFixed(0)} ms
                </div>
              </div>
            ))}
            {players.length === 0 && <div className="empty-state">{t("当前没有在线玩家")}</div>}
          </div>
        </section>

        <section className="panel">
          <header className="panel__header">
            <div>
              <span className="eyebrow">RECENT ACTIVITY</span>
              <h3>{t("最近活动")}</h3>
            </div>
            <button className="icon-button" onClick={onOpenLogs}>
              <MoreHorizontal size={18} />
            </button>
          </header>
          <div className="activity-list">
            {logs.slice(-4).reverse().map((entry) => (
              <div className="activity-row" key={entry.id}>
                <span
                  className={`activity-row__dot activity-row__dot--${entry.level}`}
                />
                <div>
                  <strong>{entry.message}</strong>
                  <span>
                    {entry.source} · {formatTime(entry.timestamp, locale)}
                  </span>
                </div>
              </div>
            ))}
            {logs.length === 0 && <div className="empty-state">{t("暂无日志")}</div>}
          </div>
        </section>
      </div>

      {!snapshot.restAvailable && snapshot.status === "online" && (
        <div className="preview-banner">
          <ServerCog size={17} />
          <span>{t("容器正在运行，但 Palworld REST API 尚未就绪；玩家、FPS 和世界天数暂不可用。")}</span>
        </div>
      )}
    </div>
  );
}

const statusLabel = {
  online: "运行中",
  offline: "已停止",
  starting: "启动中",
  stopping: "停止中",
  unknown: "未知",
} as const;
