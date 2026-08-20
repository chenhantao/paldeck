import { LoaderCircle, MessageSquareWarning, Power, RotateCw, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useI18n } from "../i18n/I18nContext";
import type { LifecycleAction } from "../types/server";

const DEFAULT_DELAY_SECONDS = 10;
const MAX_MESSAGE_LENGTH = 512;

interface LifecycleActionDialogProps {
  action: LifecycleAction | null;
  running: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (message: string, delaySeconds: number) => void | Promise<void>;
}

export function LifecycleActionDialog({
  action,
  running,
  error,
  onClose,
  onConfirm,
}: LifecycleActionDialogProps) {
  const [message, setMessage] = useState("");
  const [delaySeconds, setDelaySeconds] = useState<number | "">(DEFAULT_DELAY_SECONDS);
  const [messageCustomized, setMessageCustomized] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    if (!action) return;
    setDelaySeconds(DEFAULT_DELAY_SECONDS);
    setMessageCustomized(false);
    setMessage(
      t(
        action === "restart"
          ? "服务器将在 {seconds} 秒后重启，请暂时停止操作。"
          : "服务器将在 {seconds} 秒后停止，请及时退出游戏。",
        { seconds: DEFAULT_DELAY_SECONDS },
      ),
    );
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [action, t]);

  useEffect(() => {
    if (!action) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !running) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [action, running, onClose]);

  if (!action) return null;

  const trimmedMessage = message.trim();
  const validDelay = typeof delaySeconds === "number"
    && Number.isInteger(delaySeconds)
    && delaySeconds >= 0
    && delaySeconds <= 300;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!trimmedMessage || !validDelay || running || typeof delaySeconds !== "number") return;
    void onConfirm(trimmedMessage, delaySeconds);
  };
  const restarting = action === "restart";

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={() => {
        if (!running) onClose();
      }}
    >
      <form
        className="dialog lifecycle-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lifecycle-title"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={submit}
      >
        <header className="dialog__header">
          <div>
            <span className="eyebrow">SAFE SERVER LIFECYCLE</span>
            <h2 id="lifecycle-title">{t(restarting ? "安全重启服务器" : "安全停止服务器")}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} disabled={running} aria-label={t("关闭")}>
            <X size={18} />
          </button>
        </header>

        <div className="lifecycle-dialog__body">
          <div className="connection-intro lifecycle-dialog__intro">
            <div className="connection-intro__icon">
              <MessageSquareWarning size={20} />
            </div>
            <div>
              <strong>{t("广播、保存，然后执行操作")}</strong>
              <p>{t("Paldeck 会先广播消息并等待倒计时，再保存世界；保存失败时不会停止或重启服务器。")}</p>
            </div>
          </div>

          <div className="form-grid lifecycle-dialog__fields">
            <label className="field field--wide">
              <span>{t("广播消息")}</span>
              <input
                ref={inputRef}
                value={message}
                onChange={(event) => {
                  setMessageCustomized(true);
                  setMessage(event.target.value);
                }}
                maxLength={MAX_MESSAGE_LENGTH}
                disabled={running}
                autoComplete="off"
              />
              <small className="field__hint">{t("{count} / {max} 个字符", { count: message.length, max: MAX_MESSAGE_LENGTH })}</small>
            </label>
            <label className="field">
              <span>{t("广播后等待秒数")}</span>
              <input
                type="number"
                min={0}
                max={300}
                step={1}
                value={delaySeconds}
                onChange={(event) => {
                  const nextDelay = event.currentTarget.value === ""
                    ? ""
                    : event.currentTarget.valueAsNumber;
                  setDelaySeconds(nextDelay);
                  if (!messageCustomized && typeof nextDelay === "number" && Number.isFinite(nextDelay)) {
                    setMessage(t(
                      action === "restart"
                        ? "服务器将在 {seconds} 秒后重启，请暂时停止操作。"
                        : "服务器将在 {seconds} 秒后停止，请及时退出游戏。",
                      { seconds: nextDelay },
                    ));
                  }
                }}
                disabled={running}
              />
              <small className="field__hint">{t("允许 0 到 300 秒")}</small>
            </label>
          </div>
        </div>

        {error && <div className="form-error">{error}</div>}

        <footer className="dialog__footer">
          <button type="button" className="button button--ghost" onClick={onClose} disabled={running}>
            {t("取消")}
          </button>
          <button type="submit" className={restarting ? "button button--primary" : "button button--danger"} disabled={!trimmedMessage || !validDelay || running}>
            {running ? <LoaderCircle size={17} className="spin" /> : restarting ? <RotateCw size={17} /> : <Power size={17} />}
            {t(running ? "正在广播并保存…" : restarting ? "广播并重启" : "广播并停止")}
          </button>
        </footer>
      </form>
    </div>
  );
}
