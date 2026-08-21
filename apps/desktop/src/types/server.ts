export type ServerStatus =
  | "online"
  | "offline"
  | "starting"
  | "stopping"
  | "unknown";

export type ComposeAction = "start" | "recreate" | "pull";
export type LifecycleAction = "stop" | "restart";

export type Authentication =
  | {
      kind: "openssh";
      host: string;
      username: string;
    }
  | {
      kind: "password";
      host: string;
      port: number;
      username: string;
      password: string;
      trustedHostKey?: string;
    };

export interface ServerProfile {
  id: string;
  name: string;
  auth: Authentication;
  remotePath: string;
}

export interface ConnectionProbe {
  success: boolean;
  requiresTrust: boolean;
  fingerprint?: string;
  hostKey?: string;
  message: string;
}

export interface EnvironmentInspection {
  os: string;
  arch: string;
  dockerInstalled: boolean;
  dockerUsable: boolean;
  composeInstalled: boolean;
  pathSafe: boolean;
  directoryExists: boolean;
  directoryEmpty: boolean;
  managedDirectory: boolean;
  unexpectedEntries: boolean;
  composeExists: boolean;
  envExists: boolean;
  deploymentValid: boolean;
  containerRunning: boolean;
  importCandidate: boolean;
  importCompatible: boolean;
  importComposeValid: boolean;
  importServiceCompatible: boolean;
  importImageCompatible: boolean;
  importDataDirectorySafe: boolean;
  importVolumeCompatible: boolean;
  importBackupAvailable: boolean;
  importImage?: string;
  importDataDirectory?: string;
}

export interface InitializationOptions {
  serverName: string;
  serverPassword: string;
  adminPassword: string;
  dataDirectory: string;
  players: number;
  startAfterInstall: boolean;
}

export interface ServerMetrics {
  cpuPercent: number | null;
  memoryUsedBytes: number | null;
  memoryLimitBytes: number | null;
  fps: number | null;
  uptimeSeconds: number | null;
}

export interface ServerSnapshot {
  status: ServerStatus;
  serverName: string | null;
  version: string | null;
  onlinePlayers: number | null;
  maxPlayers: number | null;
  worldDay: number | null;
  restAvailable: boolean;
  metrics: ServerMetrics;
}

export interface Player {
  id: string;
  playerId: string;
  name: string;
  accountName: string;
  level: number;
  pingMs: number;
}

export interface Backup {
  filename: string;
  modifiedUnix: number;
  sizeBytes: number;
}

export interface BackupSettings {
  enabled: boolean;
  cronExpression: string;
  deleteOldBackups: boolean;
  retentionDays: number;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: "info" | "success" | "warning" | "error";
  source: string;
  message: string;
}

export interface WorldSettings {
  values: Record<string, string>;
}

export interface CommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
}
