import {
  Archive,
  Blocks,
  ChevronDown,
  CircleGauge,
  FileTerminal,
  PanelLeftClose,
  Radio,
  Settings2,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import type { ServerProfile, ServerStatus } from "../../types/server";
import { profileAddress } from "../../lib/profile";
import { StatusPill } from "../ui/StatusPill";
import { LanguageSelector } from "../LanguageSelector";
import { useI18n } from "../../i18n/I18nContext";

export type PageId =
  | "dashboard"
  | "players"
  | "logs"
  | "settings"
  | "backups";

interface AppShellProps {
  page: PageId;
  onPageChange: (page: PageId) => void;
  profile: ServerProfile;
  status: ServerStatus;
  onOpenConnection: () => void;
  children: ReactNode;
}

const navItems: Array<{
  id: PageId;
  label: string;
  icon: typeof CircleGauge;
}> = [
  { id: "dashboard", label: "总览", icon: CircleGauge },
  { id: "players", label: "玩家", icon: Users },
  { id: "logs", label: "日志", icon: FileTerminal },
  { id: "settings", label: "世界配置", icon: Settings2 },
  { id: "backups", label: "备份", icon: Archive },
];

export function AppShell({
  page,
  onPageChange,
  profile,
  status,
  onOpenConnection,
  children,
}: AppShellProps) {
  const { t } = useI18n();
  return (
    <div className="app-frame">
      <aside className="sidebar">
        <div className="window-drag-region" data-tauri-drag-region />
        <div className="brand">
          <div className="brand__mark">
            <Blocks size={20} strokeWidth={2} />
          </div>
          <div>
            <strong>Paldeck</strong>
            <span>SERVER CONTROL</span>
          </div>
        </div>

        <button className="server-switcher" onClick={onOpenConnection}>
          <span className="server-switcher__icon">
            <Radio size={17} />
          </span>
          <span className="server-switcher__copy">
            <strong>{profile.name}</strong>
            <small>{profileAddress(profile, t("尚未配置"))}</small>
          </span>
          <ChevronDown size={16} />
        </button>

        <nav className="sidebar__nav" aria-label={t("主导航")}>
          <span className="sidebar__eyebrow">{t("管理")}</span>
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={page === id ? "nav-item nav-item--active" : "nav-item"}
              onClick={() => onPageChange(id)}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{t(label)}</span>
              {id === "players" && <em>3</em>}
            </button>
          ))}
        </nav>

        <div className="sidebar__footer">
          <LanguageSelector compact />
          <div className="sidebar-status">
            <span>{t("服务状态")}</span>
            <StatusPill status={status} />
          </div>
          <div className="sidebar-version">
            <span>Paldeck Preview</span>
            <small>v0.1.0</small>
          </div>
        </div>

        <button className="sidebar-collapse" aria-label={t("收起侧边栏")}>
          <PanelLeftClose size={16} />
        </button>
      </aside>

      <main className="main-content">{children}</main>
    </div>
  );
}
