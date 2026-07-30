import { Eye, EyeOff, RotateCcw, Save, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { Toggle } from "../components/ui/Toggle";
import { defaultWorldSettings } from "../lib/mockData";
import type { WorldSettings } from "../types/server";

export function SettingsPage({ onSaved }: { onSaved: () => void }) {
  const [settings, setSettings] = useState(defaultWorldSettings);
  const [showPassword, setShowPassword] = useState(false);
  const update = <K extends keyof WorldSettings>(
    key: K,
    value: WorldSettings[K],
  ) => setSettings((current) => ({ ...current, [key]: value }));

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">WORLD SETTINGS</span>
          <h1>世界配置</h1>
          <p>表单会映射到远程 `.env`；保存前展示差异并执行 Compose 校验。</p>
        </div>
        <div className="page-header__actions">
          <button
            className="button button--ghost"
            onClick={() => setSettings(defaultWorldSettings)}
          >
            <RotateCcw size={17} />
            恢复默认
          </button>
          <button className="button button--primary" onClick={onSaved}>
            <Save size={17} />
            保存更改
          </button>
        </div>
      </header>

      <div className="settings-layout">
        <aside className="settings-nav">
          <button className="settings-nav__item settings-nav__item--active">
            <SlidersHorizontal size={17} />
            基础设置
          </button>
          <button className="settings-nav__item">世界倍率</button>
          <button className="settings-nav__item">基地与公会</button>
          <button className="settings-nav__item">战斗规则</button>
        </aside>

        <div className="settings-content">
          <section className="settings-card">
            <header>
              <h3>服务器信息</h3>
              <p>玩家在服务器列表和连接界面中看到的信息。</p>
            </header>
            <div className="form-grid">
              <label className="field">
                <span>服务器名称</span>
                <input
                  value={settings.serverName}
                  onChange={(event) =>
                    update("serverName", event.target.value)
                  }
                />
              </label>
              <label className="field">
                <span>最大玩家数</span>
                <input
                  type="number"
                  min={1}
                  max={32}
                  value={settings.maxPlayers}
                  onChange={(event) =>
                    update("maxPlayers", Number(event.target.value))
                  }
                />
              </label>
              <label className="field field--wide">
                <span>服务器描述</span>
                <input
                  value={settings.serverDescription}
                  onChange={(event) =>
                    update("serverDescription", event.target.value)
                  }
                />
              </label>
              <label className="field field--wide">
                <span>加入密码</span>
                <div className="password-field">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={settings.serverPassword}
                    onChange={(event) =>
                      update("serverPassword", event.target.value)
                    }
                    placeholder="留空表示无需密码"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "隐藏密码" : "显示密码"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>
            </div>
          </section>

          <section className="settings-card">
            <header>
              <h3>世界倍率</h3>
              <p>1.0 为官方默认值。修改后需要重启服务端生效。</p>
            </header>
            <div className="range-grid">
              <RangeField
                label="经验倍率"
                value={settings.expRate}
                onChange={(value) => update("expRate", value)}
              />
              <RangeField
                label="捕获概率"
                value={settings.captureRate}
                onChange={(value) => update("captureRate", value)}
              />
              <RangeField
                label="帕鲁刷新"
                value={settings.spawnRate}
                onChange={(value) => update("spawnRate", value)}
              />
              <RangeField
                label="工作速度"
                value={settings.workSpeedRate}
                onChange={(value) => update("workSpeedRate", value)}
              />
            </div>
          </section>

          <section className="settings-card">
            <header>
              <h3>游戏规则</h3>
              <p>布尔配置会写入 Palworld 对应的世界设置。</p>
            </header>
            <div className="toggle-list">
              <Toggle
                checked={settings.pvp}
                onChange={(value) => update("pvp", value)}
                label="玩家对战"
                description="允许玩家之间互相造成伤害"
              />
              <Toggle
                checked={settings.friendlyFire}
                onChange={(value) => update("friendlyFire", value)}
                label="友军伤害"
                description="同一公会成员之间可以互相造成伤害"
              />
              <Toggle
                checked={settings.fastTravel}
                onChange={(value) => update("fastTravel", value)}
                label="快速旅行"
                description="允许使用巨鹫之像快速移动"
              />
              <Toggle
                checked={settings.allowClientMod}
                onChange={(value) => update("allowClientMod", value)}
                label="允许客户端模组"
                description="允许玩家使用客户端侧模组"
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function RangeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="range-field">
      <span>
        {label}
        <output>{value.toFixed(1)}×</output>
      </span>
      <input
        type="range"
        min={0.1}
        max={5}
        step={0.1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
