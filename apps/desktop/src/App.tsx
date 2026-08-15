import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConnectionDialog } from "./components/ConnectionDialog";
import { SetupWizard } from "./components/SetupWizard";
import { AppShell, type PageId } from "./components/layout/AppShell";
import { BackupsPage } from "./pages/BackupsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LogsPage } from "./pages/LogsPage";
import { PlayersPage } from "./pages/PlayersPage";
import { SettingsPage } from "./pages/SettingsPage";
import {
  fetchServerSnapshot,
  isDesktopRuntime,
  runComposeAction,
  runServerAction,
} from "./lib/backend";
import { profileNeedsPassword } from "./lib/profile";
import { loadProfile, saveProfile } from "./lib/profileStore";
import type { ServerProfile, ServerSnapshot } from "./types/server";
import { useI18n } from "./i18n/I18nContext";

export function App() {
  const { t, errorMessage } = useI18n();
  const [page, setPage] = useState<PageId>("dashboard");
  const [profile, setProfile] = useState<ServerProfile | null>(() =>
    loadProfile(t("我的帕鲁服务器")),
  );
  const [setupOpen, setSetupOpen] = useState(
    () => loadProfile(t("我的帕鲁服务器")) === null,
  );
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<ServerSnapshot>(emptySnapshot);
  const snapshotError = useRef<string | null>(null);

  const refreshSnapshot = useCallback(async () => {
    if (!profile || profileNeedsPassword(profile)) {
      setSnapshot(emptySnapshot);
      return;
    }
    try {
      setSnapshot(await fetchServerSnapshot(profile));
      snapshotError.current = null;
    } catch (error) {
      setSnapshot(emptySnapshot);
      const message = errorMessage(error);
      if (snapshotError.current !== message) setNotice(message);
      snapshotError.current = message;
    }
  }, [profile, errorMessage]);

  useEffect(() => {
    if (profile && profileNeedsPassword(profile)) {
      setConnectionOpen(true);
    }
  }, [profile]);

  useEffect(() => {
    void refreshSnapshot();
    const timer = window.setInterval(() => void refreshSnapshot(), 15_000);
    return () => window.clearInterval(timer);
  }, [refreshSnapshot]);

  const content = useMemo(() => {
    if (!profile) return null;
    switch (page) {
      case "players":
        return <PlayersPage profile={profile} onNotice={setNotice} />;
      case "logs":
        return <LogsPage profile={profile} onNotice={setNotice} />;
      case "settings":
        return (
          <SettingsPage
            profile={profile}
            onNotice={setNotice}
            onApplySettings={async () => {
              const result = await runComposeAction(profile, "restart");
              if (!result.success) {
                throw new Error(errorMessage(result.stderr || t("远程 Compose 操作失败")));
              }
              await refreshSnapshot();
            }}
          />
        );
      case "backups":
        return <BackupsPage profile={profile} onNotice={setNotice} />;
      default:
        return (
          <DashboardPage
            profile={profile}
            snapshot={snapshot}
            onOpenLogs={() => setPage("logs")}
            onOpenPlayers={() => setPage("players")}
            onNotice={setNotice}
            onComposeAction={async (action) => {
              setNotice(t(composeProgressMessage[action]));
              const result = await runComposeAction(profile, action);
              if (!result.success) {
                throw new Error(errorMessage(result.stderr || t("远程 Compose 操作失败")));
              }
              await refreshSnapshot();
              setNotice(
                isDesktopRuntime()
                  ? t("远程 Compose 操作已完成")
                  : t("Preview：桌面运行时中才会执行远程操作"),
              );
            }}
            onSaveWorld={async () => {
              setNotice(t("正在保存世界…"));
              const result = await runServerAction(profile, "save");
              if (!result.success) {
                throw new Error(errorMessage(result.stderr || t("保存世界失败")));
              }
              setNotice(
                isDesktopRuntime()
                  ? t(
                      result.stdout.includes("PALDECK_SAVE_VERIFIED=1")
                        ? "世界保存完成，已确认存档文件更新"
                        : "世界保存请求已由 REST API 接受",
                    )
                  : t("Preview：桌面运行时中才会发送保存命令"),
              );
            }}
          />
        );
    }
  }, [page, profile, snapshot, t, errorMessage, refreshSnapshot]);

  if (setupOpen || !profile) {
    return (
      <SetupWizard
        initialProfile={profile ?? undefined}
        onComplete={(nextProfile) => {
          saveProfile(nextProfile);
          setProfile(nextProfile);
          setSetupOpen(false);
          setNotice(t("服务器初始化配置已保存"));
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
        status={snapshot.status}
        playerCount={snapshot.onlinePlayers}
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
              ? t("SSH 连接测试成功")
              : t("Preview：配置已保存，桌面运行时才会连接 SSH"),
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

const emptySnapshot: ServerSnapshot = {
  status: "unknown",
  serverName: null,
  version: null,
  onlinePlayers: null,
  maxPlayers: null,
  worldDay: null,
  restAvailable: false,
  metrics: {
    cpuPercent: null,
    memoryUsedBytes: null,
    memoryLimitBytes: null,
    fps: null,
    uptimeSeconds: null,
  },
};

const composeProgressMessage = {
  start: "正在启动服务器…",
  stop: "正在停止服务器…",
  restart: "正在重启服务器…",
  pull: "正在拉取服务器镜像…",
} as const;
