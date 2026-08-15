import { LoaderCircle, RefreshCw, ServerCog, X } from "lucide-react";
import { useEffect } from "react";
import { useI18n } from "../i18n/I18nContext";

interface ApplySettingsDialogProps {
  open: boolean;
  applying: boolean;
  error: string | null;
  onLater: () => void;
  onApply: () => void | Promise<void>;
}

export function ApplySettingsDialog({
  open,
  applying,
  error,
  onLater,
  onApply,
}: ApplySettingsDialogProps) {
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !applying) onLater();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, applying, onLater]);

  if (!open) return null;

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={() => {
        if (!applying) onLater();
      }}
    >
      <section
        className="dialog apply-settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="apply-settings-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="dialog__header">
          <div>
            <span className="eyebrow">APPLY WORLD SETTINGS</span>
            <h2 id="apply-settings-title">{t("应用世界配置")}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onLater}
            disabled={applying}
            aria-label={t("关闭")}
          >
            <X size={18} />
          </button>
        </header>

        <div className="apply-settings-dialog__body">
          <div className="connection-intro apply-settings-dialog__intro">
            <div className="connection-intro__icon">
              <ServerCog size={20} />
            </div>
            <div>
              <strong>{t("配置已安全写入远程服务器")}</strong>
              <p>{t("需要重新创建容器才能让新配置生效；游戏存档不会被删除。")}</p>
            </div>
          </div>
        </div>

        {error && <div className="form-error">{error}</div>}

        <footer className="dialog__footer">
          <button
            type="button"
            className="button button--ghost"
            onClick={onLater}
            disabled={applying}
          >
            {t("稍后应用")}
          </button>
          <button
            type="button"
            className="button button--primary"
            onClick={() => void onApply()}
            disabled={applying}
          >
            {applying ? <LoaderCircle size={17} className="spin" /> : <RefreshCw size={17} />}
            {t(applying ? "正在应用…" : "立即应用")}
          </button>
        </footer>
      </section>
    </div>
  );
}
