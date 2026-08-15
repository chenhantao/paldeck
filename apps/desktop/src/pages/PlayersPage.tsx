import {
  Ban,
  MessageSquareText,
  Search,
  Signal,
  UserMinus,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { BroadcastDialog } from "../components/BroadcastDialog";
import { fetchOnlinePlayers, runPlayerAction } from "../lib/backend";
import type { Player, ServerProfile } from "../types/server";
import { useI18n } from "../i18n/I18nContext";

export function PlayersPage({
  profile,
  onNotice,
}: {
  profile: ServerProfile;
  onNotice: (message: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastError, setBroadcastError] = useState<string | null>(null);
  const loadingPlayers = useRef(false);
  const lastLoadError = useRef<string | null>(null);
  const { t, errorMessage } = useI18n();
  const load = useCallback(async (showLoading = false) => {
    if (loadingPlayers.current) return;
    loadingPlayers.current = true;
    if (showLoading) setLoading(true);
    try {
      setPlayers(await fetchOnlinePlayers(profile));
      lastLoadError.current = null;
    } catch (error) {
      const message = errorMessage(error);
      if (lastLoadError.current !== message) onNotice(message);
      lastLoadError.current = message;
    } finally {
      if (showLoading) setLoading(false);
      loadingPlayers.current = false;
    }
  }, [profile, onNotice, errorMessage]);

  useEffect(() => {
    void load(true);
    const timer = window.setInterval(() => void load(), 10_000);
    const refreshOnFocus = () => void load();
    window.addEventListener("focus", refreshOnFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [load]);

  const filteredPlayers = players.filter((player) =>
    player.name.toLowerCase().includes(query.toLowerCase()),
  );

  const act = async (action: "kick" | "ban", player: Player) => {
    if (!window.confirm(t(action === "kick" ? "确认踢出玩家 {name}？" : "确认封禁玩家 {name}？", { name: player.name }))) return;
    setBusyId(player.id);
    try {
      const result = await runPlayerAction(profile, action, player.id, "Managed by Paldeck");
      if (!result.success) throw new Error(result.stderr || t("玩家操作失败"));
      onNotice(t(action === "kick" ? "玩家已被踢出" : "玩家已被封禁"));
      await load();
    } catch (error) {
      onNotice(errorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  const announce = async (message: string) => {
    setBroadcastSending(true);
    setBroadcastError(null);
    try {
      const result = await runPlayerAction(profile, "announce", null, message);
      if (!result.success) throw new Error(result.stderr || t("广播发送失败"));
      setBroadcastOpen(false);
      onNotice(t("广播已发送"));
    } catch (error) {
      setBroadcastError(errorMessage(error));
    } finally {
      setBroadcastSending(false);
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">PLAYER MANAGEMENT</span>
          <h1>{t("玩家")}</h1>
          <p>{t("查看在线状态，并通过 Palworld REST API 管理当前玩家。")}</p>
        </div>
        <button
          className="button button--primary"
          onClick={() => {
            setBroadcastError(null);
            setBroadcastOpen(true);
          }}
        >
          <MessageSquareText size={17} />
          {t("广播消息")}
        </button>
      </header>

      <div className="summary-strip">
        <div>
          <Users size={18} />
          <span>{t("当前在线")}</span>
          <strong>{players.length}</strong>
        </div>
      </div>

      <section className="panel panel--table">
        <div className="table-toolbar">
          <label className="search-box">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("搜索玩家名称")}
            />
          </label>
        </div>

        <div className="data-table">
          <div className="data-table__head">
            <span>{t("玩家")}</span>
            <span>{t("账号与等级")}</span>
            <span>{t("延迟")}</span>
            <span />
          </div>
          {filteredPlayers.map((player) => (
            <div className="data-table__row" key={player.id}>
              <div className="table-player">
                <div className={`avatar avatar--${player.name.length % 3}`}>
                  {player.name.slice(0, 1).toUpperCase()}
                  <span />
                </div>
                <div>
                  <strong>{player.name}</strong>
                  <small>{player.id}</small>
                </div>
              </div>
              <span>
                {player.accountName || player.id} · Lv.{player.level}
              </span>
              <span className="table-ping">
                <Signal size={14} />
                {player.pingMs.toFixed(0)} ms
              </span>
              <div className="row-actions">
                <button title={t("踢出玩家")} disabled={busyId !== null} onClick={() => void act("kick", player)}>
                  <UserMinus size={16} />
                </button>
                <button title={t("封禁玩家")} className="danger" disabled={busyId !== null} onClick={() => void act("ban", player)}>
                  <Ban size={16} />
                </button>
              </div>
            </div>
          ))}
          {!loading && filteredPlayers.length === 0 && <div className="empty-state">{t("当前没有在线玩家")}</div>}
        </div>
      </section>

      <BroadcastDialog
        open={broadcastOpen}
        sending={broadcastSending}
        error={broadcastError}
        onClose={() => {
          if (!broadcastSending) setBroadcastOpen(false);
        }}
        onSend={announce}
      />
    </div>
  );
}
