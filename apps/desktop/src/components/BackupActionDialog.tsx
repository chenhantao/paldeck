import { AlertTriangle, LoaderCircle, RotateCcw, Trash2, X } from "lucide-react";
import { useEffect } from "react";
import { useI18n } from "../i18n/I18nContext";
import type { Backup } from "../types/server";

export type BackupAction = "restore" | "delete";

interface BackupActionDialogProps {
  backup: Backup | null;
  action: BackupAction | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}

export function BackupActionDialog({
  backup,
  action,
  busy,
  error,
  onClose,
  onConfirm,
}: BackupActionDialogProps) {
  const { t } = useI18n();
  const open = backup !== null && action !== null;

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, busy, onClose]);

  if (!open || !backup || !action) return null;
  const restoring = action === "restore";

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={() => {
        if (!busy) onClose();
      }}
    >
      <section
        className="dialog backup-action-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="backup-action-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="dialog__header">
          <div>
            <span className="eyebrow">{restoring ? "RESTORE BACKUP" : "DELETE BACKUP"}</span>
            <h2 id="backup-action-title">{t(restoring ? "从备份恢复世界" : "删除备份")}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} disabled={busy} aria-label={t("关闭")}>
            <X size={18} />
          </button>
        </header>

        <div className="backup-action-dialog__body">
          <div className={`connection-intro backup-action-dialog__intro${restoring ? " backup-action-dialog__intro--warning" : ""}`}>
            <div className="connection-intro__icon">
              <AlertTriangle size={20} />
            </div>
            <div>
              <strong>{backup.filename}</strong>
              <p>{t(restoring
                ? "恢复前会校验归档并停止服务器；当前世界会另存为安全备份，完成后恢复原运行状态。"
                : "删除后无法从 Paldeck 恢复这个归档，此操作不会影响当前运行中的世界。")}</p>
            </div>
          </div>
        </div>

        {error && <div className="form-error">{error}</div>}

        <footer className="dialog__footer">
          <button type="button" className="button button--ghost" onClick={onClose} disabled={busy}>
            {t("取消")}
          </button>
          <button
            type="button"
            className={`button ${restoring ? "button--primary" : "button--danger"}`}
            onClick={() => void onConfirm()}
            disabled={busy}
          >
            {busy ? <LoaderCircle size={17} className="spin" /> : restoring ? <RotateCcw size={17} /> : <Trash2 size={17} />}
            {t(busy
              ? restoring ? "正在恢复…" : "正在删除…"
              : restoring ? "停止并恢复" : "确认删除")}
          </button>
        </footer>
      </section>
    </div>
  );
}
