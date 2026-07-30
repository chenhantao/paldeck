import { KeyRound, Server, ShieldCheck, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { ServerProfile } from "../types/server";

interface ConnectionDialogProps {
  open: boolean;
  profile: ServerProfile;
  onClose: () => void;
  onSave: (profile: ServerProfile) => void | Promise<void>;
}

export function ConnectionDialog({
  open,
  profile,
  onClose,
  onSave,
}: ConnectionDialogProps) {
  const [draft, setDraft] = useState(profile);
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(profile), [profile, open]);

  if (!open) return null;

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="connection-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="dialog__header">
          <div>
            <span className="eyebrow">CONNECTION</span>
            <h2 id="connection-title">连接远程服务器</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </header>

        <div className="connection-intro">
          <div className="connection-intro__icon">
            <Server size={22} />
          </div>
          <div>
            <strong>复用 OpenSSH 配置</strong>
            <p>
              Host 对应 <code>~/.ssh/config</code> 中的名称，私钥不会进入
              Paldeck。
            </p>
          </div>
        </div>

        <div className="form-grid">
          <label className="field">
            <span>显示名称</span>
            <input
              value={draft.name}
              onChange={(event) =>
                setDraft({ ...draft, name: event.target.value })
              }
              placeholder="我的帕鲁服务器"
            />
          </label>
          <label className="field">
            <span>SSH Host</span>
            <input
              value={draft.sshHost}
              onChange={(event) =>
                setDraft({ ...draft, sshHost: event.target.value })
              }
              placeholder="palworld-server"
              spellCheck={false}
            />
          </label>
          <label className="field field--wide">
            <span>远程 Compose 目录</span>
            <input
              value={draft.remotePath}
              onChange={(event) =>
                setDraft({ ...draft, remotePath: event.target.value })
              }
              placeholder="/opt/paldeck"
              spellCheck={false}
            />
          </label>
        </div>

        <div className="security-note">
          <ShieldCheck size={18} />
          <span>
            首次连接会校验 SSH 主机指纹。管理 API 通过 SSH 隧道访问，无需开放
            8212 端口。
          </span>
        </div>

        <footer className="dialog__footer">
          <button className="button button--ghost" onClick={onClose}>
            取消
          </button>
          <button
            className="button button--primary"
            disabled={
              saving || !draft.sshHost.trim() || !draft.remotePath.trim()
            }
            onClick={async () => {
              setSaving(true);
              try {
                await onSave(draft);
              } finally {
                setSaving(false);
              }
            }}
          >
            <KeyRound size={17} />
            {saving ? "正在测试…" : "保存并测试连接"}
          </button>
        </footer>
      </section>
    </div>
  );
}
