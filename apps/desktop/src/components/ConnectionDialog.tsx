import { KeyRound, Server, ShieldCheck, X } from "lucide-react";
import { useEffect, useState } from "react";
import { probeConnection } from "../lib/backend";
import type { ConnectionProbe, ServerProfile } from "../types/server";
import { ConnectionFields } from "./ConnectionFields";
import { useI18n } from "../i18n/I18nContext";

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
  const [trust, setTrust] = useState<ConnectionProbe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { t, errorMessage } = useI18n();

  useEffect(() => {
    setDraft(profile);
    setTrust(null);
    setError(null);
  }, [profile, open]);

  if (!open) return null;

  const saveAfterProbe = async (candidate: ServerProfile) => {
    setSaving(true);
    setError(null);
    try {
      const result = await probeConnection(candidate);
      if (result.requiresTrust) {
        setTrust(result);
        return;
      }
      if (!result.success) {
        setError(errorMessage(result.message || t("SSH 连接测试失败")));
        return;
      }
      setTrust(null);
      await onSave(candidate);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="dialog dialog--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="connection-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="dialog__header">
          <div>
            <span className="eyebrow">CONNECTION</span>
            <h2 id="connection-title">{t("连接远程服务器")}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label={t("关闭")}>
            <X size={18} />
          </button>
        </header>

        <div className="connection-intro">
          <div className="connection-intro__icon">
            <Server size={22} />
          </div>
          <div>
            <strong>{t("两种安全登录方式")}</strong>
            <p>
              {t(
                "可复用系统 OpenSSH 配置，也可直接使用服务器账号密码。两者都通过 SSH 加密连接。",
              )}
            </p>
          </div>
        </div>

        <ConnectionFields
          profile={draft}
          onChange={(next) => {
            setDraft(next);
            setTrust(null);
            setError(null);
          }}
          disabled={saving}
        />

        {trust?.requiresTrust && (
          <div className="trust-card">
            <ShieldCheck size={20} />
            <div>
              <strong>{t("确认服务器主机密钥")}</strong>
              <p>
                {t(
                  "请通过服务器控制台或管理员核对以下 SHA256 指纹。确认后 Paldeck 会保存公钥，后续发生变化时将拒绝连接。",
                )}
              </p>
              <code>{trust.fingerprint}</code>
            </div>
            <button
              className="button button--secondary"
              onClick={() => {
                if (
                  draft.auth.kind !== "password" ||
                  !trust.hostKey
                ) {
                  return;
                }
                const trusted: ServerProfile = {
                  ...draft,
                  auth: {
                    ...draft.auth,
                    trustedHostKey: trust.hostKey,
                  },
                };
                setDraft(trusted);
                void saveAfterProbe(trusted);
              }}
              disabled={saving}
            >
              {t("指纹一致，信任并继续")}
            </button>
          </div>
        )}

        {error && <div className="form-error">{error}</div>}

        <div className="security-note">
          <ShieldCheck size={18} />
          <span>
            {t("登录密码和私钥口令不会持久化；服务器公钥和非敏感连接信息会保存在本机。")}
          </span>
        </div>

        <footer className="dialog__footer">
          <button className="button button--ghost" onClick={onClose}>
            {t("取消")}
          </button>
          <button
            className="button button--primary"
            disabled={saving || !isConnectionComplete(draft)}
            onClick={() => void saveAfterProbe(draft)}
          >
            <KeyRound size={17} />
            {t(saving ? "正在测试…" : "保存并测试连接")}
          </button>
        </footer>
      </section>
    </div>
  );
}

function isConnectionComplete(profile: ServerProfile): boolean {
  if (!profile.name.trim() || !profile.remotePath.trim()) return false;
  if (profile.auth.kind === "openssh") {
    return Boolean(
      profile.auth.host.trim() &&
        profile.auth.username.trim() &&
        (!profile.auth.requiresPassphrase || profile.auth.passphrase),
    );
  }
  return Boolean(
    profile.auth.host.trim() &&
      profile.auth.username.trim() &&
      profile.auth.password &&
      profile.auth.port >= 1 &&
      profile.auth.port <= 65535,
  );
}
