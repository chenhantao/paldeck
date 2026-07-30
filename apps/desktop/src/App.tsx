import { useEffect, useMemo, useState } from "react";
import { ConnectionDialog } from "./components/ConnectionDialog";
import { SetupWizard } from "./components/SetupWizard";
import { AppShell, type PageId } from "./components/layout/AppShell";
import { BackupsPage } from "./pages/BackupsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LogsPage } from "./pages/LogsPage";
import { PlayersPage } from "./pages/PlayersPage";
import { SettingsPage } from "./pages/SettingsPage";
import { mockSnapshot } from "./lib/mockData";
import {
  isDesktopRuntime,
  runComposeAction,
  runServerAction,
} from "./lib/backend";
import { profileNeedsPassword } from "./lib/profile";
import { loadProfile, saveProfile } from "./lib/profileStore";
import type { ServerProfile } from "./types/server";

export function App() {
  const [page, setPage] = useState<PageId>("dashboard");
  const [profile, setProfile] = useState<ServerProfile | null>(() =>
    loadProfile(),
  );
  const [setupOpen, setSetupOpen] = useState(() => loadProfile() === null);
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (profile && profileNeedsPassword(profile)) {
      setConnectionOpen(true);
    }
  }, [profile]);

  const content = useMemo(() => {
    if (!profile) return null;
    switch (page) {
      case "players":
        return <PlayersPage />;
      case "logs":
        return <LogsPage />;
      case "settings":
        return <SettingsPage onSaved={() => setNotice("配置草稿已保存")} />;
      case "backups":
        return <BackupsPage />;
      default:
        return (
          <DashboardPage
            snapshot={mockSnapshot}
            onOpenLogs={() => setPage("logs")}
            onNotice={setNotice}
            onComposeAction={async (action) => {
              const result = await runComposeAction(profile, action);
              if (!result.success) {
                throw new Error(result.stderr || "远程 Compose 操作失败");
              }
              setNotice(
                isDesktopRuntime()
                  ? "远程 Compose 操作已完成"
                  : "Preview：桌面运行时中才会执行远程操作",
              );
            }}
            onSaveWorld={async () => {
              const result = await runServerAction(profile, "save");
              if (!result.success) {
                throw new Error(result.stderr || "保存世界失败");
              }
              setNotice(
                isDesktopRuntime()
                  ? "世界保存完成"
                  : "Preview：桌面运行时中才会发送保存命令",
              );
            }}
          />
        );
    }
  }, [page, profile]);

  if (setupOpen || !profile) {
    return (
      <SetupWizard
        initialProfile={profile ?? undefined}
        onComplete={(nextProfile) => {
          saveProfile(nextProfile);
          setProfile(nextProfile);
          setSetupOpen(false);
          setNotice("服务器初始化配置已保存");
        }}
      />
    );
  }

  return (
    <>
      <AppShell
        page={page}
        onPageChange={setPage}
        profile={profile}
        status={mockSnapshot.status}
        onOpenConnection={() => setConnectionOpen(true)}
      >
        {content}
      </AppShell>

      <ConnectionDialog
        open={connectionOpen}
        profile={profile}
        onClose={() => setConnectionOpen(false)}
        onSave={async (nextProfile) => {
          saveProfile(nextProfile);
          setProfile(nextProfile);
          setConnectionOpen(false);
          setNotice(
            isDesktopRuntime()
              ? "SSH 连接测试成功"
              : "Preview：配置已保存，桌面运行时才会连接 SSH",
          );
        }}
      />

      {notice && (
        <button className="toast" onClick={() => setNotice(null)}>
          <span />
          {notice}
        </button>
      )}
    </>
  );
}
