import {
  CirclePause,
  Download,
  FileTerminal,
  Search,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatTime } from "../lib/format";
import { fetchRemoteLogs } from "../lib/backend";
import { parseRemoteLogs } from "../lib/remoteData";
import type { LogEntry, ServerProfile } from "../types/server";
import { useI18n } from "../i18n/I18nContext";

export function LogsPage({ profile, onNotice }: { profile: ServerProfile; onNotice: (message: string) => void }) {
  const [paused, setPaused] = useState(false);
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const lastError = useRef<string | null>(null);
  const { t, locale, errorMessage } = useI18n();
  const load = useCallback(async () => {
    try {
      const result = await fetchRemoteLogs(profile, 500);
      if (!result.success) throw new Error(result.stderr || t("读取日志失败"));
      setEntries(parseRemoteLogs(result.stdout));
      lastError.current = null;
    } catch (error) {
      const message = errorMessage(error);
      if (lastError.current !== message) onNotice(message);
      lastError.current = message;
    }
  }, [profile, onNotice, errorMessage, t]);

  useEffect(() => {
    if (paused) return;
    void load();
    const timer = window.setInterval(() => void load(), 5_000);
    return () => window.clearInterval(timer);
  }, [paused, load]);

  const logs = entries.filter((entry) =>
    `${entry.source} ${entry.message}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  const exportLogs = () => {
    const blob = new Blob([entries.map((entry) => `${entry.timestamp} ${entry.message}`).join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `paldeck-logs-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page page--logs">
      <header className="page-header">
        <div>
          <span className="eyebrow">CONTAINER OUTPUT</span>
          <h1>{t("实时日志")}</h1>
          <p>{t("通过 SSH 流式读取 Compose 日志，并在本地进行过滤。")}</p>
        </div>
        <div className="page-header__actions">
          <button
            className={paused ? "button button--warning" : "button button--ghost"}
            onClick={() => setPaused(!paused)}
          >
            <CirclePause size={17} />
            {t(paused ? "继续跟随" : "暂停")}
          </button>
          <button className="button button--ghost" onClick={exportLogs} disabled={entries.length === 0}>
            <Download size={17} />
            {t("导出")}
          </button>
        </div>
      </header>

      <section className="terminal-panel">
        <div className="terminal-toolbar">
          <div className="terminal-title">
            <span className="terminal-lights">
              <i />
              <i />
              <i />
            </span>
            <FileTerminal size={15} />
            palworld-server
          </div>
          <div className="terminal-actions">
            <label className="terminal-search">
              <Search size={14} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("过滤日志")}
              />
            </label>
            <button title={t("清空本地显示")} onClick={() => setEntries([])}>
              <Trash2 size={15} />
            </button>
          </div>
        </div>
        <div className="terminal-output">
          {logs.map((entry) => (
            <div className="log-line" key={entry.id}>
              <time>{formatTime(entry.timestamp, locale)}</time>
              <span className={`log-level log-level--${entry.level}`}>
                {entry.level.toUpperCase()}
              </span>
              <span className="log-source">[{entry.source}]</span>
              <span>{entry.message}</span>
            </div>
          ))}
          <div className="terminal-cursor">
            <span>{t("等待远程日志")}</span>
            {!paused && <i />}
          </div>
        </div>
      </section>
    </div>
  );
}
