import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConnectionDialog } from "./components/ConnectionDialog";
import { ServerManagerDialog } from "./components/ServerManagerDialog";
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
  runSafeLifecycleAction,
  runServerAction,
} from "./lib/backend";
import { profileNeedsPassword } from "./lib/profile";
import {
  loadProfileCollection,
  saveProfileCollection,
  type ProfileCollection,
} from "./lib/profileStore";
import type { ServerProfile, ServerSnapshot } from "./types/server";
import { useI18n } from "./i18n/I18nContext";

export function App() {
  const { t, errorMessage } = useI18n();
  const [page, setPage] = useState<PageId>("dashboard");
  const [profileCollection, setProfileCollection] = useState<ProfileCollection>(() =>
    loadProfileCollection(t("我的帕鲁服务器")),
  );
  const profile = useMemo(
    () =>
      profileCollection.profiles.find(
        ({ id }) => id === profileCollection.activeProfileId,
      ) ?? null,
    [profileCollection],
  );
  const [setupMode, setSetupMode] = useState<"initial" | "add" | null>(() =>
    profileCollection.profiles.length === 0 ? "initial" : null,
  );
  const [serverManagerOpen, setServerManagerOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ServerProfile | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<ServerSnapshot>(emptySnapshot);
  const snapshotError = useRef<string | null>(null);
  const snapshotRequest = useRef(0);

  const commitProfileCollection = useCallback((next: ProfileCollection) => {
    saveProfileCollection(next);
    setProfileCollection(next);
  }, []);

  const upsertAndActivateProfile = useCallback(
    (nextProfile: ServerProfile) => {
      const existing = profileCollection.profiles.some(
        ({ id }) => id === nextProfile.id,
      );
      const profiles = existing
        ? profileCollection.profiles.map((candidate) =>
            candidate.id === nextProfile.id ? nextProfile : candidate,
          )
        : [...profileCollection.profiles, nextProfile];
      commitProfileCollection({ profiles, activeProfileId: nextProfile.id });
    },
    [profileCollection, commitProfileCollection],
  );

  const resetSnapshot = useCallback(() => {
    snapshotRequest.current += 1;
    snapshotError.current = null;
    setSnapshot(emptySnapshot);
  }, []);

  const refreshSnapshot = useCallback(async () => {
    const requestId = ++snapshotRequest.current;
    if (!profile || profileNeedsPassword(profile)) {
      if (requestId === snapshotRequest.current) setSnapshot(emptySnapshot);
      return;
    }
    try {
      const nextSnapshot = await fetchServerSnapshot(profile);
      if (requestId !== snapshotRequest.current) return;
      setSnapshot(nextSnapshot);
      snapshotError.current = null;
    } catch (error) {
      if (requestId !== snapshotRequest.current) return;
      setSnapshot(emptySnapshot);
      const message = errorMessage(error);
      if (snapshotError.current !== message) setNotice(message);
      snapshotError.current = message;
    }
  }, [profile, errorMessage]);

  useEffect(() => {
    if (profile && profileNeedsPassword(profile)) {
      setEditingProfile(profile);
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
              const result = await runComposeAction(profile, "recreate");
              if (!result.success) {
                throw new Error(errorMessage(result.stderr || t("远程 Compose 操作失败")));
              }
              await refreshSnapshot();
            }}
          />
        );
      case "backups":
        return (
          <BackupsPage
            profile={profile}
            onNotice={setNotice}
            onApplySettings={async () => {
              const result = await runComposeAction(profile, "recreate");
              if (!result.success) {
                throw new Error(errorMessage(result.stderr || t("远程 Compose 操作失败")));
              }
              await refreshSnapshot();
            }}
            onServerChanged={refreshSnapshot}
          />
        );
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
            onLifecycleAction={async (action, message, delaySeconds) => {
              setNotice(t(action === "restart" ? "正在安全重启服务器…" : "正在安全停止服务器…"));
              const result = await runSafeLifecycleAction(
                profile,
                action,
                message,
                delaySeconds,
              );
              if (!result.success) {
                throw new Error(errorMessage(result.stderr || t("安全停服操作失败")));
              }
              await refreshSnapshot();
              setNotice(
                isDesktopRuntime()
                  ? t(action === "restart" ? "世界已保存，服务器已重启" : "世界已保存，服务器已停止")
                  : t("Preview：桌面运行时中才会执行安全停服操作"),
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

  if (setupMode || !profile) {
    return (
      <SetupWizard
        key={setupMode ?? "initial"}
        onCancel={profileCollection.profiles.length > 0 ? () => setSetupMode(null) : undefined}
        onComplete={(nextProfile) => {
          upsertAndActivateProfile(nextProfile);
          setSetupMode(null);
          setPage("dashboard");
          resetSnapshot();
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
        onOpenServerManager={() => setServerManagerOpen(true)}
      >
        {content}
      </AppShell>

      <ServerManagerDialog
        open={serverManagerOpen}
        profiles={profileCollection.profiles}
        activeProfileId={profileCollection.activeProfileId}
        onClose={() => setServerManagerOpen(false)}
        onSelect={(nextProfile) => {
          commitProfileCollection({
            profiles: profileCollection.profiles,
            activeProfileId: nextProfile.id,
          });
          setServerManagerOpen(false);
          setPage("dashboard");
          resetSnapshot();
          setNotice(t("已切换到服务器“{name}”", { name: nextProfile.name }));
        }}
        onAdd={() => {
          setServerManagerOpen(false);
          setSetupMode("add");
        }}
        onEdit={(nextProfile) => {
          setServerManagerOpen(false);
          setEditingProfile(nextProfile);
        }}
        onDelete={(deletedProfile) => {
          const profiles = profileCollection.profiles.filter(
            ({ id }) => id !== deletedProfile.id,
          );
          const activeProfileId =
            profileCollection.activeProfileId === deletedProfile.id
              ? profiles[0]?.id ?? null
              : profileCollection.activeProfileId;
          commitProfileCollection({ profiles, activeProfileId });
          resetSnapshot();
          setServerManagerOpen(false);
          setNotice(t("已删除本地服务器记录“{name}”", { name: deletedProfile.name }));
          if (profiles.length === 0) {
            setSetupMode("initial");
          }
        }}
      />

      {editingProfile && (
        <ConnectionDialog
          open
          profile={editingProfile}
          onClose={() => setEditingProfile(null)}
          onSave={async (nextProfile) => {
            upsertAndActivateProfile(nextProfile);
            setEditingProfile(null);
            setPage("dashboard");
            resetSnapshot();
            setNotice(
              isDesktopRuntime()
                ? t("SSH 连接测试成功")
                : t("Preview：配置已保存，桌面运行时才会连接 SSH"),
            );
          }}
        />
      )}

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
  recreate: "正在重新创建服务器容器…",
  pull: "正在拉取服务器镜像…",
} as const;
