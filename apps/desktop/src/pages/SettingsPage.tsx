import { Eye, EyeOff, LoaderCircle, RotateCcw, Save, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ApplySettingsDialog } from "../components/ApplySettingsDialog";
import { LanguageSelector } from "../components/LanguageSelector";
import { Toggle } from "../components/ui/Toggle";
import { useI18n } from "../i18n/I18nContext";
import { fetchWorldSettings, saveWorldSettings } from "../lib/backend";
import {
  defaultWorldSettingValues,
  worldSettingFields,
  worldSettingGroups,
  type WorldSettingField,
  type WorldSettingGroup,
} from "../lib/worldSettings";
import type { ServerProfile, WorldSettings } from "../types/server";

export function SettingsPage({ profile, onNotice, onApplySettings }: {
  profile: ServerProfile;
  onNotice: (message: string) => void;
  onApplySettings: () => Promise<void>;
}) {
  const [settings, setSettings] = useState<WorldSettings>(() => ({ values: defaultWorldSettingValues() }));
  const [activeGroup, setActiveGroup] = useState<WorldSettingGroup>("server");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyPromptOpen, setApplyPromptOpen] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const { t, errorMessage } = useI18n();
  const busy = loading || saving || applying;

  useEffect(() => {
    setLoading(true);
    void fetchWorldSettings(profile)
      .then(setSettings)
      .catch((error) => onNotice(errorMessage(error)))
      .finally(() => setLoading(false));
  }, [profile, onNotice, errorMessage]);

  const save = async () => {
    setSaving(true);
    onNotice(t("正在保存、验证并升级配置模板…"));
    try {
      const result = await saveWorldSettings(profile, settings);
      if (!result.success) throw new Error(result.stderr || t("保存配置失败"));
      setApplyError(null);
      setApplyPromptOpen(true);
      onNotice(t("世界配置已保存，等待应用"));
    } catch (error) {
      onNotice(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const applySettings = async () => {
    setApplying(true);
    setApplyError(null);
    onNotice(t("正在重新创建服务器容器并应用配置…"));
    try {
      await onApplySettings();
      setApplyPromptOpen(false);
      onNotice(t("世界配置已应用，服务器状态已刷新"));
    } catch (error) {
      const message = errorMessage(error);
      setApplyError(message);
      onNotice(message);
    } finally {
      setApplying(false);
    }
  };

  const applyLater = () => {
    if (applying) return;
    setApplyPromptOpen(false);
    setApplyError(null);
    onNotice(t("世界配置已保存，稍后重启服务器即可应用"));
  };

  const update = (key: string, value: string) => {
    setSettings((current) => ({ values: { ...current.values, [key]: value } }));
  };

  const fields = useMemo(() => worldSettingFields.filter((field) => field.group === activeGroup), [activeGroup]);
  const valueFields = fields.filter((field) => field.type !== "boolean");
  const toggleFields = fields.filter((field) => field.type === "boolean");
  const activeLabel = worldSettingGroups.find((group) => group.id === activeGroup)?.label ?? "";

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">WORLD SETTINGS</span>
          <h1>{t("世界配置")}</h1>
          <p>{t("完整管理当前容器版本支持的世界参数；保存时会安全升级受管 Compose 模板。")}</p>
        </div>
        <div className="page-header__actions">
          <button className="button button--ghost" onClick={() => setSettings({ values: defaultWorldSettingValues() })} disabled={busy}>
            <RotateCcw size={17} />
            {t("恢复默认")}
          </button>
          <button className="button button--primary" onClick={() => void save()} disabled={busy}>
            {saving ? <LoaderCircle size={17} className="spin" /> : <Save size={17} />}
            {t(saving ? "正在保存配置…" : "保存更改")}
          </button>
        </div>
      </header>

      <div className="settings-layout">
        <aside className="settings-nav">
          {worldSettingGroups.map((group, index) => (
            <button
              key={group.id}
              className={`settings-nav__item${activeGroup === group.id ? " settings-nav__item--active" : ""}`}
              onClick={() => setActiveGroup(group.id)}
            >
              {index === 0 && <SlidersHorizontal size={17} />}
              {t(group.label)}
            </button>
          ))}
          <LanguageSelector />
        </aside>

        <div className="settings-content">
          <section className="settings-card">
            <header>
              <h3>{t(activeLabel)}</h3>
              <p>{t("修改后需要重新创建服务器容器才能生效；游戏存档不会被删除。")}</p>
            </header>

            {valueFields.length > 0 && (
              <div className="form-grid settings-field-grid">
                {valueFields.map((field) => (
                  <SettingInput
                    key={field.key}
                    field={field}
                    value={settings.values[field.key] ?? field.defaultValue}
                    showPassword={showPassword}
                    onTogglePassword={() => setShowPassword((current) => !current)}
                    onChange={(value) => update(field.key, value)}
                    disabled={busy}
                    t={t}
                  />
                ))}
              </div>
            )}

            {toggleFields.length > 0 && (
              <div className="toggle-list settings-toggle-list">
                {toggleFields.map((field) => (
                  <Toggle
                    key={field.key}
                    checked={(settings.values[field.key] ?? field.defaultValue).toLowerCase() === "true"}
                    onChange={(value) => update(field.key, String(value))}
                    label={t(field.label)}
                    description={field.key}
                    disabled={busy}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <ApplySettingsDialog
        open={applyPromptOpen}
        applying={applying}
        error={applyError}
        onLater={applyLater}
        onApply={applySettings}
      />
    </div>
  );
}

function SettingInput({ field, value, showPassword, onTogglePassword, onChange, disabled, t }: {
  field: WorldSettingField;
  value: string;
  showPassword: boolean;
  onTogglePassword: () => void;
  onChange: (value: string) => void;
  disabled: boolean;
  t: (key: string) => string;
}) {
  const input = field.type === "select" ? (
    <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
      {field.options?.map((option) => (
        <option key={`${field.key}-${option.value}`} value={option.value}>{t(option.label)}</option>
      ))}
    </select>
  ) : (
    <input
      type={field.type === "password" && !showPassword ? "password" : field.type === "number" ? "number" : "text"}
      value={value}
      min={field.min}
      max={field.max}
      step={field.step}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      autoComplete={field.type === "password" ? "new-password" : "off"}
    />
  );

  return (
    <label className={`field${field.wide ? " field--wide" : ""}`}>
      <span>{t(field.label)}</span>
      {field.type === "password" ? (
        <div className="password-field">
          {input}
          <button type="button" onClick={onTogglePassword} aria-label={t(showPassword ? "隐藏密码" : "显示密码")}>
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      ) : input}
      <small className="field__hint">{field.key}</small>
    </label>
  );
}
