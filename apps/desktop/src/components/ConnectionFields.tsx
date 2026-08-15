import { Eye, EyeOff, KeyRound, TerminalSquare } from "lucide-react";
import { useState } from "react";
import type { ServerProfile } from "../types/server";
import { useI18n } from "../i18n/I18nContext";

interface ConnectionFieldsProps {
  profile: ServerProfile;
  onChange: (profile: ServerProfile) => void;
  disabled?: boolean;
}

export function ConnectionFields({
  profile,
  onChange,
  disabled = false,
}: ConnectionFieldsProps) {
  const [showPassword, setShowPassword] = useState(false);
  const auth = profile.auth;
  const { t } = useI18n();

  return (
    <>
      <div className="auth-tabs" role="tablist" aria-label={t("登录方式")}>
        <button
          type="button"
          className={
            auth.kind === "openssh"
              ? "auth-tab auth-tab--active"
              : "auth-tab"
          }
          onClick={() =>
            onChange({
              ...profile,
              auth: { kind: "openssh", host: "", username: "" },
            })
          }
          disabled={disabled}
        >
          <TerminalSquare size={17} />
          {t("OpenSSH 配置 / 密钥")}
        </button>
        <button
          type="button"
          className={
            auth.kind === "password"
              ? "auth-tab auth-tab--active"
              : "auth-tab"
          }
          onClick={() =>
            onChange({
              ...profile,
              auth: {
                kind: "password",
                host: "",
                port: 22,
                username: "",
                password: "",
              },
            })
          }
          disabled={disabled}
        >
          <KeyRound size={17} />
          {t("账号密码")}
        </button>
      </div>

      <div className="form-grid">
        <label className="field">
          <span>{t("显示名称")}</span>
          <input
            value={profile.name}
            onChange={(event) =>
              onChange({ ...profile, name: event.target.value })
            }
            placeholder={t("我的帕鲁服务器")}
            disabled={disabled}
          />
        </label>

        {auth.kind === "openssh" ? (
          <>
            <label className="field">
              <span>{t("SSH 用户名")}</span>
              <input
                value={auth.username}
                onChange={(event) =>
                  onChange({
                    ...profile,
                    auth: {
                      ...auth,
                      username: event.target.value,
                    },
                  })
                }
                placeholder="steam"
                autoComplete="username"
                disabled={disabled}
              />
            </label>
            <label className="field">
              <span>{t("服务器地址 / SSH Host")}</span>
              <input
                value={auth.host}
                onChange={(event) =>
                  onChange({
                    ...profile,
                    auth: {
                      ...auth,
                      host: event.target.value,
                    },
                  })
                }
                placeholder="192.0.2.10 或 palworld-server"
                spellCheck={false}
                disabled={disabled}
              />
              <small className="field__hint">
                {t(
                  "OpenSSH 将以 ssh 用户名@Host 连接，并继续复用系统 SSH 配置、密钥和端口设置。",
                )}
              </small>
            </label>
          </>
        ) : (
          <>
            <label className="field">
              <span>{t("服务器地址")}</span>
              <input
                value={auth.host}
                onChange={(event) =>
                  onChange({
                    ...profile,
                    auth: {
                      ...auth,
                      host: event.target.value,
                      trustedHostKey: undefined,
                    },
                  })
                }
                placeholder="192.168.1.10 或 server.example.com"
                spellCheck={false}
                disabled={disabled}
              />
            </label>
            <label className="field">
              <span>{t("SSH 端口")}</span>
              <input
                type="number"
                min={1}
                max={65535}
                value={auth.port}
                onChange={(event) =>
                  onChange({
                    ...profile,
                    auth: {
                      ...auth,
                      port: Number(event.target.value),
                      trustedHostKey: undefined,
                    },
                  })
                }
                disabled={disabled}
              />
            </label>
            <label className="field">
              <span>{t("账号")}</span>
              <input
                value={auth.username}
                onChange={(event) =>
                  onChange({
                    ...profile,
                    auth: {
                      ...auth,
                      username: event.target.value,
                    },
                  })
                }
                placeholder="steam"
                autoComplete="username"
                disabled={disabled}
              />
            </label>
            <label className="field field--wide">
              <span>{t("密码")}</span>
              <div className="password-field">
                <input
                  type={showPassword ? "text" : "password"}
                  value={auth.password}
                  onChange={(event) =>
                    onChange({
                      ...profile,
                      auth: {
                        ...auth,
                        password: event.target.value,
                      },
                    })
                  }
                  placeholder={t("仅保存在当前运行会话")}
                  autoComplete="current-password"
                  disabled={disabled}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={t(showPassword ? "隐藏密码" : "显示密码")}
                  disabled={disabled}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <small className="field__hint">
                {t("Paldeck 不会把登录密码写入本地配置或日志。")}
              </small>
            </label>
          </>
        )}

        <label className="field field--wide">
          <span>{t("远程部署目录")}</span>
          <input
            value={profile.remotePath}
            onChange={(event) =>
              onChange({ ...profile, remotePath: event.target.value })
            }
            placeholder="~/.palworld"
            spellCheck={false}
            disabled={disabled}
          />
          <small className="field__hint">
            {t(
              "默认为 ~/.palworld。目录必须不存在或完全为空；不接受 .、..、非规范路径或经过符号链接的目录。",
            )}
          </small>
        </label>
      </div>
    </>
  );
}
