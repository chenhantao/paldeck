import {
  Archive,
  HardDrive,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { formatBytes, formatDateTime } from "../lib/format";
import { fetchBackups, runServerAction } from "../lib/backend";
import type { Backup, ServerProfile } from "../types/server";
import { useI18n } from "../i18n/I18nContext";

export function BackupsPage({ profile, onNotice }: { profile: ServerProfile; onNotice: (message: string) => void }) {
  const { t, locale, errorMessage } = useI18n();
  const [backups, setBackups] = useState<Backup[]>([]);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      setBackups(await fetchBackups(profile));
    } catch (error) {
      onNotice(errorMessage(error));
    }
  }, [profile, onNotice, errorMessage]);
  useEffect(() => void load(), [load]);
  const createBackup = async () => {
    setBusy(true);
    onNotice(t("正在创建备份…"));
    try {
      const result = await runServerAction(profile, "backup");
      if (!result.success) throw new Error(result.stderr || t("创建备份失败"));
      await load();
      onNotice(t("备份创建完成"));
    } catch (error) {
      onNotice(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  const totalBytes = backups.reduce((sum, backup) => sum + backup.sizeBytes, 0);
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">SAVE PROTECTION</span>
          <h1>{t("备份")}</h1>
          <p>{t("读取容器的真实备份目录，并按需创建新的存档备份。")}</p>
        </div>
        <button className="button button--primary" onClick={() => void createBackup()} disabled={busy}>
          <Plus size={17} />
          {t("立即备份")}
        </button>
      </header>

      <div className="backup-summary">
        <div className="backup-summary__visual">
          <Archive size={30} />
          <span />
        </div>
        <div>
          <span>{t("备份策略")}</span>
          <strong>{t("容器备份目录")}</strong>
          <p>{t("共 {count} 个备份 · 占用 {size}", { count: backups.length, size: formatBytes(totalBytes, locale) })}</p>
        </div>
        <div className="backup-summary__health">
          <ShieldCheck size={17} />
          {t("已读取真实备份")}
        </div>
      </div>

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
            </div>
          ))}
          {backups.length === 0 && <div className="empty-state">{t("尚无备份")}</div>}
        </div>
      </section>
    </div>
  );
}
