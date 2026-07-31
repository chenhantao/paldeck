import {
  Archive,
  Download,
  HardDrive,
  MoreHorizontal,
  Plus,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { formatDateTime } from "../lib/format";
import { mockBackups } from "../lib/mockData";
import { useI18n } from "../i18n/I18nContext";

const kindLabel = {
  automatic: "自动",
  manual: "手动",
  "pre-update": "更新前",
};

export function BackupsPage() {
  const { t, locale } = useI18n();
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">SAVE PROTECTION</span>
          <h1>{t("备份")}</h1>
          <p>{t("管理远程存档快照；执行恢复前会额外创建安全备份。")}</p>
        </div>
        <button className="button button--primary">
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
          <strong>{t("每天 03:00 自动备份")}</strong>
          <p>{t("保留最近 30 天 · 当前占用约 834 MB")}</p>
        </div>
        <div className="backup-summary__health">
          <ShieldCheck size={17} />
          {t("策略正常")}
        </div>
      </div>

      <section className="panel panel--table">
        <header className="panel__header panel__header--padded">
          <div>
            <span className="eyebrow">SNAPSHOTS</span>
            <h3>{t("最近备份")}</h3>
          </div>
          <button className="icon-button">
            <MoreHorizontal size={18} />
          </button>
        </header>
        <div className="backup-list">
          {mockBackups.map((backup) => (
            <div className="backup-row" key={backup.id}>
              <div className="backup-row__icon">
                <HardDrive size={18} />
              </div>
              <div className="backup-row__identity">
                <strong>{backup.filename}</strong>
                <span>
                  {formatDateTime(backup.createdAt, locale)} · {backup.sizeMb} MB
                </span>
              </div>
              <span className={`backup-kind backup-kind--${backup.kind}`}>
                {t(kindLabel[backup.kind])}
              </span>
              <div className="row-actions">
                <button title={t("下载到本机")}>
                  <Download size={16} />
                </button>
                <button title={t("恢复此备份")}>
                  <RotateCcw size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
