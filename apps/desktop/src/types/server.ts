export type ServerStatus =
  | "online"
  | "offline"
  | "starting"
  | "stopping"
  | "unknown";

export type ComposeAction = "start" | "stop" | "restart" | "pull";

export type Authentication =
  | {
      kind: "openssh";
      sshHost: string;
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
  cpuPercent: number;
  memoryUsedGb: number;
  memoryTotalGb: number;
  fps: number;
  uptimeSeconds: number;
}

export interface ServerSnapshot {
  status: ServerStatus;
  serverName: string;
  version: string;
  onlinePlayers: number;
  maxPlayers: number;
  worldDay: number;
  lastBackupAt: string | null;
  metrics: ServerMetrics;
}

export interface Player {
  id: string;
  name: string;
  platform: "Steam" | "Xbox" | "PS5" | "Mac";
  level: number;
  joinedAt: string;
  pingMs: number;
}

export interface Backup {
  id: string;
  filename: string;
  createdAt: string;
  sizeMb: number;
  kind: "automatic" | "manual" | "pre-update";
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: "info" | "success" | "warning" | "error";
  source: string;
  message: string;
}

export interface WorldSettings {
  serverName: string;
  serverDescription: string;
  serverPassword: string;
  maxPlayers: number;
  expRate: number;
  captureRate: number;
  spawnRate: number;
  workSpeedRate: number;
  eggHatchingTime: number;
  deathPenalty: "None" | "Item" | "ItemAndEquipment" | "All";
  pvp: boolean;
  friendlyFire: boolean;
  fastTravel: boolean;
  allowClientMod: boolean;
}

export interface CommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
}
