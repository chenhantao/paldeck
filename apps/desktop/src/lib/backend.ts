import { invoke } from "@tauri-apps/api/core";
import type {
  CommandResult,
  ComposeAction,
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
