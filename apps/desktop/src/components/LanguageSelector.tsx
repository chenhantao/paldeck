import { Languages } from "lucide-react";
import { useI18n, type LanguagePreference } from "../i18n/I18nContext";

export function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const { preference, setPreference, t } = useI18n();

  return (
    <label className={compact ? "language-select language-select--compact" : "language-select"}>
      <Languages size={15} />
      <span>{t("语言")}</span>
      <select
        aria-label={t("语言")}
        value={preference}
        onChange={(event) =>
          setPreference(event.target.value as LanguagePreference)
        }
      >
        <option value="system">{t("跟随系统")}</option>
        <option value="zh-CN">{t("简体中文")}</option>
        <option value="en">English</option>
      </select>
    </label>
  );
}
