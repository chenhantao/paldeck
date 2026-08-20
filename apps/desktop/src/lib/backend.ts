import { invoke } from "@tauri-apps/api/core";
import type {
  CommandResult,
  ComposeAction,
  ConnectionProbe,
  EnvironmentInspection,
  InitializationOptions,
  LifecycleAction,
  Backup,
  BackupSettings,
  Player,
  ServerProfile,
  ServerSnapshot,
  WorldSettings,
} from "../types/server";

type TauriWindow = Window & { __TAURI_INTERNALS__?: unknown };

export function isDesktopRuntime(): boolean {
  return Boolean((window as TauriWindow).__TAURI_INTERNALS__);
}

const previewResult: CommandResult = {
  success: true,
  stdout: "paldeck-preview",
  stderr: "",
  exitCode: 0,
};

export async function testConnection(
  profile: ServerProfile,
): Promise<CommandResult> {
  if (!isDesktopRuntime()) return previewResult;
  return invoke<CommandResult>("check_connection", { profile });
}

export async function probeConnection(
  profile: ServerProfile,
): Promise<ConnectionProbe> {
  if (!isDesktopRuntime()) {
    return {
      success: true,
      requiresTrust: false,
      message: "Preview：连接检查已模拟完成",
    };
  }
  return invoke<ConnectionProbe>("probe_connection", { profile });
}

export async function inspectEnvironment(
  profile: ServerProfile,
): Promise<EnvironmentInspection> {
  if (!isDesktopRuntime()) {
    return {
      os: "Linux",
      arch: "x86_64",
      dockerInstalled: true,
      dockerUsable: true,
      composeInstalled: true,
      pathSafe: true,
      directoryExists: false,
      directoryEmpty: false,
      managedDirectory: false,
      unexpectedEntries: false,
      composeExists: false,
      envExists: false,
      deploymentValid: false,
      containerRunning: false,
    };
  }
  return invoke<EnvironmentInspection>("inspect_environment", { profile });
}

export async function initializeRemoteServer(
  profile: ServerProfile,
  options: InitializationOptions,
): Promise<CommandResult> {
  if (!isDesktopRuntime()) {
    return {
      ...previewResult,
      stdout: "Preview：远程初始化已模拟完成",
    };
  }
  return invoke<CommandResult>("initialize_server", { profile, options });
}

export async function runComposeAction(
  profile: ServerProfile,
  action: ComposeAction,
): Promise<CommandResult> {
  if (!isDesktopRuntime()) return previewResult;
  return invoke<CommandResult>("compose_action", { profile, action });
}

export async function runServerAction(
  profile: ServerProfile,
  action: "save",
): Promise<CommandResult> {
  if (!isDesktopRuntime()) return previewResult;
  return invoke<CommandResult>("server_action", { profile, action });
}

export async function fetchRemoteLogs(
  profile: ServerProfile,
  tail = 300,
): Promise<CommandResult> {
  if (!isDesktopRuntime()) return previewResult;
  return invoke<CommandResult>("read_logs", { profile, tail });
}

export async function fetchServerSnapshot(
  profile: ServerProfile,
): Promise<ServerSnapshot> {
  if (!isDesktopRuntime()) {
    return {
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
  }
  const snapshot = await invoke<Omit<ServerSnapshot, "metrics"> & {
    cpuPercent: number | null;
    memoryUsedBytes: number | null;
    memoryLimitBytes: number | null;
    fps: number | null;
    uptimeSeconds: number | null;
  }>("server_snapshot", { profile });
  return {
    status: snapshot.status,
    serverName: snapshot.serverName,
    version: snapshot.version,
    onlinePlayers: snapshot.onlinePlayers,
    maxPlayers: snapshot.maxPlayers,
    worldDay: snapshot.worldDay,
    restAvailable: snapshot.restAvailable,
    metrics: {
      cpuPercent: snapshot.cpuPercent,
      memoryUsedBytes: snapshot.memoryUsedBytes,
      memoryLimitBytes: snapshot.memoryLimitBytes,
      fps: snapshot.fps,
      uptimeSeconds: snapshot.uptimeSeconds,
    },
  };
}

export async function fetchOnlinePlayers(
  profile: ServerProfile,
): Promise<Player[]> {
  if (!isDesktopRuntime()) return [];
  return invoke<Player[]>("online_players", { profile });
}

export async function runPlayerAction(
  profile: ServerProfile,
  action: "announce" | "kick" | "ban",
  userId: string | null,
  message: string,
): Promise<CommandResult> {
  if (!isDesktopRuntime()) return previewResult;
  return invoke<CommandResult>("player_action", {
    profile,
    action,
    userId,
    message,
  });
}

export async function runSafeLifecycleAction(
  profile: ServerProfile,
  action: LifecycleAction,
  message: string,
  delaySeconds: number,
): Promise<CommandResult> {
  if (!isDesktopRuntime()) return previewResult;
  return invoke<CommandResult>("safe_lifecycle_action", {
    profile,
    action,
    message,
    delaySeconds,
  });
}

export async function fetchBackups(profile: ServerProfile): Promise<Backup[]> {
  if (!isDesktopRuntime()) return [];
  return invoke<Backup[]>("list_backups", { profile });
}

export async function fetchBackupSettings(
  profile: ServerProfile,
): Promise<BackupSettings> {
  if (!isDesktopRuntime()) {
    return {
      enabled: true,
      cronExpression: "0 3 * * *",
      deleteOldBackups: true,
      retentionDays: 30,
    };
  }
  return invoke<BackupSettings>("read_backup_settings", { profile });
}

export async function saveBackupSettings(
  profile: ServerProfile,
  settings: BackupSettings,
): Promise<CommandResult> {
  if (!isDesktopRuntime()) return previewResult;
  return invoke<CommandResult>("write_backup_settings", { profile, settings });
}

export async function createRemoteBackup(
  profile: ServerProfile,
): Promise<CommandResult> {
  if (!isDesktopRuntime()) return previewResult;
  return invoke<CommandResult>("create_backup", { profile });
}

export async function deleteRemoteBackup(
  profile: ServerProfile,
  filename: string,
): Promise<CommandResult> {
  if (!isDesktopRuntime()) return previewResult;
  return invoke<CommandResult>("delete_backup", { profile, filename });
}

export async function restoreRemoteBackup(
  profile: ServerProfile,
  filename: string,
): Promise<CommandResult> {
  if (!isDesktopRuntime()) return previewResult;
  return invoke<CommandResult>("restore_backup", { profile, filename });
}

export async function fetchWorldSettings(
  profile: ServerProfile,
): Promise<WorldSettings> {
  if (!isDesktopRuntime()) {
    throw new Error("Preview：桌面运行时中才会读取远程配置");
  }
  return invoke<WorldSettings>("read_world_settings", { profile });
}

export async function saveWorldSettings(
  profile: ServerProfile,
  settings: WorldSettings,
): Promise<CommandResult> {
  if (!isDesktopRuntime()) return previewResult;
  return invoke<CommandResult>("write_world_settings", { profile, settings });
}
