import { invoke } from "@tauri-apps/api/core";
import type {
  CommandResult,
  ComposeAction,
  ConnectionProbe,
  EnvironmentInspection,
  InitializationOptions,
  ServerProfile,
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
  action: "save" | "backup",
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
