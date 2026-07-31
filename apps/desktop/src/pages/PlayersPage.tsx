import {
  Ban,
  Clock3,
  MessageSquareText,
  MoreHorizontal,
  Search,
  Shield,
  Signal,
  UserMinus,
  Users,
} from "lucide-react";
import { useState } from "react";
import { formatTime } from "../lib/format";
import { mockPlayers } from "../lib/mockData";
import { useI18n } from "../i18n/I18nContext";

export function PlayersPage() {
  const [query, setQuery] = useState("");
  const { t, locale } = useI18n();
  const filteredPlayers = mockPlayers.filter((player) =>
    player.name.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">PLAYER MANAGEMENT</span>
          <h1>{t("玩家")}</h1>
          <p>{t("查看在线状态，并通过 Palworld REST API 管理当前玩家。")}</p>
        </div>
        <button className="button button--primary">
          <MessageSquareText size={17} />
          {t("广播消息")}
        </button>
      </header>

      <div className="summary-strip">
        <div>
          <Users size={18} />
          <span>{t("当前在线")}</span>
          <strong>3</strong>
        </div>
        <div>
          <Clock3 size={18} />
          <span>{t("今日峰值")}</span>
          <strong>6</strong>
        </div>
        <div>
          <Shield size={18} />
          <span>{t("已封禁")}</span>
          <strong>0</strong>
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
          <button className="button button--ghost">
            <MoreHorizontal size={17} />
            {t("更多操作")}
          </button>
        </div>

        <div className="data-table">
          <div className="data-table__head">
            <span>{t("玩家")}</span>
            <span>{t("平台与等级")}</span>
            <span>{t("加入时间")}</span>
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
                {player.platform} · Lv.{player.level}
              </span>
              <span>{formatTime(player.joinedAt, locale)}</span>
              <span className="table-ping">
                <Signal size={14} />
                {player.pingMs} ms
              </span>
              <div className="row-actions">
                <button title={t("踢出玩家")}>
                  <UserMinus size={16} />
                </button>
                <button title={t("封禁玩家")} className="danger">
                  <Ban size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
