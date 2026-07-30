import {
  CirclePause,
  Download,
  FileTerminal,
  Search,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { formatTime } from "../lib/format";
import { mockLogs } from "../lib/mockData";

export function LogsPage() {
  const [paused, setPaused] = useState(false);
  const [query, setQuery] = useState("");
  const logs = mockLogs.filter((entry) =>
    `${entry.source} ${entry.message}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  return (
    <div className="page page--logs">
      <header className="page-header">
        <div>
          <span className="eyebrow">CONTAINER OUTPUT</span>
          <h1>实时日志</h1>
          <p>通过 SSH 流式读取 Compose 日志，并在本地进行过滤。</p>
        </div>
        <div className="page-header__actions">
          <button
            className={paused ? "button button--warning" : "button button--ghost"}
            onClick={() => setPaused(!paused)}
          >
            <CirclePause size={17} />
            {paused ? "继续跟随" : "暂停"}
          </button>
          <button className="button button--ghost">
            <Download size={17} />
            导出
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
                placeholder="过滤日志"
              />
            </label>
            <button title="清空本地显示">
              <Trash2 size={15} />
            </button>
          </div>
        </div>
        <div className="terminal-output">
          {logs.map((entry) => (
            <div className="log-line" key={entry.id}>
              <time>{formatTime(entry.timestamp)}</time>
              <span className={`log-level log-level--${entry.level}`}>
                {entry.level.toUpperCase()}
              </span>
              <span className="log-source">[{entry.source}]</span>
              <span>{entry.message}</span>
            </div>
          ))}
          <div className="terminal-cursor">
            <span>等待远程日志</span>
            {!paused && <i />}
          </div>
        </div>
      </section>
    </div>
  );
}
