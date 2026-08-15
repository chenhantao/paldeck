import { LoaderCircle, MessageSquareText, Send, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useI18n } from "../i18n/I18nContext";

const MAX_BROADCAST_LENGTH = 512;

interface BroadcastDialogProps {
  open: boolean;
  sending: boolean;
  error: string | null;
  onClose: () => void;
  onSend: (message: string) => void | Promise<void>;
}

export function BroadcastDialog({
  open,
  sending,
  error,
  onClose,
  onSend,
}: BroadcastDialogProps) {
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return;
    setMessage("");
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !sending) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, sending, onClose]);

  if (!open) return null;

  const trimmedMessage = message.trim();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!trimmedMessage || sending) return;
    void onSend(trimmedMessage);
  };

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={() => {
        if (!sending) onClose();
      }}
    >
      <form
        className="dialog broadcast-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="broadcast-title"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={submit}
      >
        <header className="dialog__header">
          <div>
            <span className="eyebrow">SERVER ANNOUNCEMENT</span>
            <h2 id="broadcast-title">{t("广播消息")}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            disabled={sending}
            aria-label={t("关闭")}
          >
            <X size={18} />
          </button>
        </header>

        <div className="broadcast-dialog__body">
          <div className="connection-intro broadcast-dialog__intro">
            <div className="connection-intro__icon">
              <MessageSquareText size={20} />
            </div>
            <div>
              <strong>{t("发送服务器广播")}</strong>
              <p>{t("消息会立即发送给当前服务器中的所有在线玩家。")}</p>
            </div>
          </div>

          <label className="field">
            <span>{t("消息内容")}</span>
            <input
              ref={inputRef}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={MAX_BROADCAST_LENGTH}
              placeholder={t("输入广播消息")}
              disabled={sending}
              autoComplete="off"
            />
            <small className="field__hint broadcast-dialog__count">
              {t("{count} / {max} 个字符", {
                count: message.length,
                max: MAX_BROADCAST_LENGTH,
              })}
            </small>
          </label>
        </div>

        {error && <div className="form-error">{error}</div>}

        <footer className="dialog__footer">
          <button
            type="button"
            className="button button--ghost"
            onClick={onClose}
            disabled={sending}
          >
            {t("取消")}
          </button>
          <button
            type="submit"
            className="button button--primary"
            disabled={!trimmedMessage || sending}
          >
            {sending ? <LoaderCircle size={17} className="spin" /> : <Send size={17} />}
            {t(sending ? "正在发送…" : "发送广播")}
          </button>
        </footer>
      </form>
    </div>
  );
}
