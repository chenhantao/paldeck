import {
  Archive,
  HardDrive,
  LoaderCircle,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ApplySettingsDialog } from "../components/ApplySettingsDialog";
import { BackupActionDialog, type BackupAction } from "../components/BackupActionDialog";
import { Toggle } from "../components/ui/Toggle";
import { formatBytes, formatDateTime } from "../lib/format";
import {
  createRemoteBackup,
  deleteRemoteBackup,
  fetchBackups,
  fetchBackupSettings,
  restoreRemoteBackup,
  saveBackupSettings,
} from "../lib/backend";
import type { Backup, BackupSettings, ServerProfile } from "../types/server";
import { useI18n } from "../i18n/I18nContext";

const defaultBackupSettings: BackupSettings = {
  enabled: true,
  cronExpression: "0 3 * * *",
  deleteOldBackups: true,
  retentionDays: 30,
};

interface BackupsPageProps {
  profile: ServerProfile;
  onNotice: (message: string) => void;
  onApplySettings: () => Promise<void>;
  onServerChanged: () => Promise<void>;
}

export function BackupsPage({
  profile,
  onNotice,
  onApplySettings,
  onServerChanged,
}: BackupsPageProps) {
  const { t, locale, errorMessage } = useI18n();
  const [backups, setBackups] = useState<Backup[]>([]);
  const [settings, setSettings] = useState<BackupSettings>(defaultBackupSettings);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [applyingSettings, setApplyingSettings] = useState(false);
  const [applyPromptOpen, setApplyPromptOpen] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null);
  const [selectedAction, setSelectedAction] = useState<BackupAction | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const busy = loading || creating || savingSettings || applyingSettings || actionBusy;

  const loadBackups = useCallback(async () => {
    setBackups(await fetchBackups(profile));
  }, [profile]);

  useEffect(() => {
    setLoading(true);
    void Promise.all([loadBackups(), fetchBackupSettings(profile).then(setSettings)])
      .catch((error) => onNotice(errorMessage(error)))
      .finally(() => setLoading(false));
  }, [profile, loadBackups, onNotice, errorMessage]);

  const createBackup = async () => {
    setCreating(true);
    onNotice(t("正在创建并验证备份…"));
    try {
      const result = await createRemoteBackup(profile);
      if (!result.success) throw new Error(result.stderr || t("创建备份失败"));
      await loadBackups();
      onNotice(t("备份创建完成，已确认新归档"));
    } catch (error) {
      onNotice(errorMessage(error));
    } finally {
      setCreating(false);
    }
  };

  const savePolicy = async () => {
    setSavingSettings(true);
    onNotice(t("正在保存并验证备份策略…"));
    try {
      const result = await saveBackupSettings(profile, settings);
      if (!result.success) throw new Error(result.stderr || t("保存备份策略失败"));
      setApplyError(null);
      setApplyPromptOpen(true);
      onNotice(t("备份策略已保存，等待应用"));
    } catch (error) {
      onNotice(errorMessage(error));
    } finally {
      setSavingSettings(false);
    }
  };

  const applyPolicy = async () => {
    setApplyingSettings(true);
    setApplyError(null);
    onNotice(t("正在重新创建容器并应用备份策略…"));
    try {
      await onApplySettings();
      setApplyPromptOpen(false);
      onNotice(t("备份策略已应用"));
    } catch (error) {
      const message = errorMessage(error);
      setApplyError(message);
      onNotice(message);
    } finally {
      setApplyingSettings(false);
    }
  };

  const applyPolicyLater = () => {
    if (applyingSettings) return;
    setApplyPromptOpen(false);
    setApplyError(null);
    onNotice(t("备份策略已保存，稍后重启服务器即可应用"));
  };

  const openAction = (backup: Backup, action: BackupAction) => {
    setSelectedBackup(backup);
    setSelectedAction(action);
    setActionError(null);
  };

  const closeAction = () => {
    if (actionBusy) return;
    setSelectedBackup(null);
    setSelectedAction(null);
    setActionError(null);
  };

  const confirmAction = async () => {
    if (!selectedBackup || !selectedAction) return;
    setActionBusy(true);
    setActionError(null);
    const restoring = selectedAction === "restore";
    onNotice(t(restoring ? "正在停止服务器并恢复备份…" : "正在删除备份…"));
    try {
      const result = restoring
        ? await restoreRemoteBackup(profile, selectedBackup.filename)
        : await deleteRemoteBackup(profile, selectedBackup.filename);
      if (!result.success) {
        throw new Error(result.stderr || t(restoring ? "恢复备份失败" : "删除备份失败"));
      }
      await loadBackups();
      if (restoring) await onServerChanged();
      closeActionAfterSuccess();
      onNotice(t(restoring
        ? result.stdout.includes("PALDECK_RESTARTED=1")
          ? "世界已恢复，服务器已重新启动"
          : "世界已恢复，服务器保持停止状态"
        : "备份已删除"));
    } catch (error) {
      const message = errorMessage(error);
      setActionError(message);
      onNotice(message);
    } finally {
      setActionBusy(false);
    }
  };

  const closeActionAfterSuccess = () => {
    setSelectedBackup(null);
    setSelectedAction(null);
    setActionError(null);
  };

  const totalBytes = backups.reduce((sum, backup) => sum + backup.sizeBytes, 0);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">SAVE PROTECTION · BETA</span>
          <h1>{t("备份")}</h1>
          <p>{t("Beta：设置自动备份策略，创建、删除备份，并安全恢复世界；恢复前请保留额外存档。")}</p>
        </div>
        <button className="button button--primary" onClick={() => void createBackup()} disabled={busy}>
          {creating ? <LoaderCircle size={17} className="spin" /> : <Plus size={17} />}
          {t(creating ? "正在备份…" : "立即备份")}
        </button>
      </header>

      <div className="backup-summary">
        <div className="backup-summary__visual">
          <Archive size={30} />
          <span />
        </div>
        <div>
          <span>{t("备份策略")}</span>
          <strong>{settings.enabled ? t("自动备份已启用") : t("自动备份已停用")}</strong>
          <p>{t("共 {count} 个备份 · 占用 {size}", { count: backups.length, size: formatBytes(totalBytes, locale) })}</p>
        </div>
        <div className="backup-summary__health">
          <ShieldCheck size={17} />
          {t("已读取真实备份")}
        </div>
      </div>

      <section className="settings-card backup-policy-card">
        <header>
          <div>
            <h3>{t("自动备份设置")}</h3>
            <p>{t("计划任务使用服务器时区；保存后需要重新创建容器才能更新计划。")}</p>
          </div>
          <button className="button button--primary" onClick={() => void savePolicy()} disabled={busy}>
            {savingSettings ? <LoaderCircle size={17} className="spin" /> : <Save size={17} />}
            {t(savingSettings ? "正在保存…" : "保存备份策略")}
          </button>
        </header>
        <div className="backup-policy-grid">
          <Toggle
            checked={settings.enabled}
            onChange={(enabled) => setSettings((current) => ({ ...current, enabled }))}
            label={t("启用自动归档备份")}
            description="BACKUP_ENABLED"
            disabled={busy}
          />
          <label className="field">
            <span>{t("Cron 表达式")}</span>
            <input
              value={settings.cronExpression}
              onChange={(event) => setSettings((current) => ({ ...current, cronExpression: event.target.value }))}
              disabled={busy || !settings.enabled}
              placeholder="0 3 * * *"
            />
            <small className="field__hint">{t("分 时 日 月 周，例如 0 3 * * * 表示每天 03:00")}</small>
          </label>
          <Toggle
            checked={settings.deleteOldBackups}
            onChange={(deleteOldBackups) => setSettings((current) => ({ ...current, deleteOldBackups }))}
            label={t("自动清理旧备份")}
            description="DELETE_OLD_BACKUPS"
            disabled={busy}
          />
          <label className="field">
            <span>{t("保留天数")}</span>
            <input
              type="number"
              min={1}
              max={3650}
              value={settings.retentionDays}
              onChange={(event) => setSettings((current) => ({ ...current, retentionDays: Number(event.target.value) }))}
              disabled={busy || !settings.deleteOldBackups}
            />
            <small className="field__hint">OLD_BACKUP_DAYS</small>
          </label>
        </div>
      </section>

      <section className="panel panel--table">
        <header className="panel__header panel__header--padded">
          <div>
            <span className="eyebrow">SNAPSHOTS</span>
            <h3>{t("最近备份")}</h3>
          </div>
        </header>
        <div className="backup-list">
          {backups.map((backup) => (
            <div className="backup-row" key={backup.filename}>
              <div className="backup-row__icon">
                <HardDrive size={18} />
              </div>
              <div className="backup-row__identity">
                <strong>{backup.filename}</strong>
                <span>
                  {formatDateTime(new Date(backup.modifiedUnix * 1000).toISOString(), locale)} · {formatBytes(backup.sizeBytes, locale)}
                </span>
              </div>
              <div className="backup-row__actions">
                <button className="button button--ghost" onClick={() => openAction(backup, "restore")} disabled={busy}>
                  <RotateCcw size={15} />
                  {t("恢复")}
                </button>
                <button className="icon-button icon-button--danger" onClick={() => openAction(backup, "delete")} disabled={busy} aria-label={t("删除备份")}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          {backups.length === 0 && <div className="empty-state">{t("尚无备份")}</div>}
        </div>
      </section>

      <ApplySettingsDialog
        open={applyPromptOpen}
        applying={applyingSettings}
        error={applyError}
        onLater={applyPolicyLater}
        onApply={applyPolicy}
        eyebrow="APPLY BACKUP POLICY"
        title="应用备份策略"
        savedTitle="备份策略已安全写入远程服务器"
        description="需要重新创建容器才能更新自动备份计划；游戏存档和已有备份不会被删除。"
      />

      <BackupActionDialog
        backup={selectedBackup}
        action={selectedAction}
        busy={actionBusy}
        error={actionError}
        onClose={closeAction}
        onConfirm={confirmAction}
      />
    </div>
  );
}
