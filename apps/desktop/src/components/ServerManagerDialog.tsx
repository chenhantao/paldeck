import { Check, Pencil, Plus, Server, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "../i18n/I18nContext";
import { profileAddress } from "../lib/profile";
import type { ServerProfile } from "../types/server";

interface ServerManagerDialogProps {
  open: boolean;
  profiles: ServerProfile[];
  activeProfileId: string | null;
  onClose: () => void;
  onSelect: (profile: ServerProfile) => void;
  onAdd: () => void;
  onEdit: (profile: ServerProfile) => void;
  onDelete: (profile: ServerProfile) => void;
}

export function ServerManagerDialog({
  open,
  profiles,
  activeProfileId,
  onClose,
  onSelect,
  onAdd,
  onEdit,
  onDelete,
}: ServerManagerDialogProps) {
  const { t } = useI18n();
  const [pendingDelete, setPendingDelete] = useState<ServerProfile | null>(null);

  useEffect(() => setPendingDelete(null), [open]);

  if (!open) return null;

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="dialog dialog--wide server-manager"
        role="dialog"
        aria-modal="true"
        aria-labelledby="server-manager-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="dialog__header">
          <div>
            <span className="eyebrow">SERVERS · BETA</span>
            <h2 id="server-manager-title">{t("管理服务器")}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label={t("关闭")}>
            <X size={18} />
          </button>
        </header>

        <div className="server-manager__intro">
          <p>{t("Beta：保存多个服务器连接并快速切换。登录密码和私钥口令始终只保留在当前会话；建议先保留原连接信息。")}</p>
          <button className="button button--primary" onClick={onAdd}>
            <Plus size={17} />
            {t("添加服务器")}
          </button>
        </div>

        <div className="server-manager__list">
          {profiles.map((profile) => {
            const active = profile.id === activeProfileId;
            return (
              <div
                className={active ? "server-profile server-profile--active" : "server-profile"}
                key={profile.id}
              >
                <button
                  className="server-profile__select"
                  onClick={() => onSelect(profile)}
                  aria-label={t("切换到 {name}", { name: profile.name })}
                >
                  <span className="server-profile__icon"><Server size={18} /></span>
                  <span className="server-profile__copy">
                    <strong>{profile.name}</strong>
                    <small>{profileAddress(profile, t("尚未配置"))}</small>
                    <small>{profile.remotePath}</small>
                  </span>
                  {active && (
                    <span className="server-profile__active"><Check size={14} />{t("当前")}</span>
                  )}
                </button>
                <div className="server-profile__actions">
                  <button
                    className="icon-button"
                    onClick={() => onEdit(profile)}
                    aria-label={t("编辑 {name}", { name: profile.name })}
                    title={t("编辑连接")}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    className="icon-button icon-button--danger"
                    onClick={() => setPendingDelete(profile)}
                    aria-label={t("删除 {name}", { name: profile.name })}
                    title={t("删除本地记录")}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {pendingDelete && (
          <div className="server-manager__delete-confirm" role="alertdialog">
            <div>
              <strong>{t("删除服务器记录“{name}”？", { name: pendingDelete.name })}</strong>
              <p>{t("只会删除本机保存的连接信息，不会停止服务器，也不会删除远程部署、存档或备份。")}</p>
            </div>
            <div>
              <button className="button button--ghost" onClick={() => setPendingDelete(null)}>
                {t("取消")}
              </button>
              <button
                className="button button--danger"
                onClick={() => {
                  onDelete(pendingDelete);
                  setPendingDelete(null);
                }}
              >
                <Trash2 size={16} />
                {t("删除本地记录")}
              </button>
            </div>
          </div>
        )}

        <footer className="dialog__footer">
          <button className="button button--ghost" onClick={onClose}>{t("关闭")}</button>
        </footer>
      </section>
    </div>
  );
}
