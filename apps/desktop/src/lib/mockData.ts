import type {
  Backup,
  LogEntry,
  Player,
  ServerSnapshot,
  WorldSettings,
} from "../types/server";

export const mockSnapshot: ServerSnapshot = {
  status: "online",
  serverName: "翠叶群岛",
  version: "v1.0.3.0",
  onlinePlayers: 3,
  maxPlayers: 8,
  worldDay: 128,
  lastBackupAt: new Date(Date.now() - 42 * 60_000).toISOString(),
  metrics: {
    cpuPercent: 36,
    memoryUsedGb: 7.8,
    memoryTotalGb: 16,
    fps: 59.8,
    uptimeSeconds: 3 * 86_400 + 7 * 3_600 + 22 * 60,
  },
};

export const mockPlayers: Player[] = [
  {
    id: "76561198000000001",
    name: "MossRunner",
    platform: "Steam",
    level: 54,
    joinedAt: new Date(Date.now() - 71 * 60_000).toISOString(),
    pingMs: 26,
  },
  {
    id: "76561198000000002",
    name: "海风与帕鲁",
    platform: "Steam",
    level: 48,
    joinedAt: new Date(Date.now() - 39 * 60_000).toISOString(),
    pingMs: 41,
  },
  {
    id: "xuid-00000003",
    name: "Cloudberry",
    platform: "Xbox",
    level: 31,
    joinedAt: new Date(Date.now() - 12 * 60_000).toISOString(),
    pingMs: 58,
  },
];

export const mockLogs: LogEntry[] = [
  {
    id: "1",
    timestamp: new Date(Date.now() - 14_000).toISOString(),
    level: "info",
    source: "PalServer",
    message: "World autosave completed in 486 ms",
  },
  {
    id: "2",
    timestamp: new Date(Date.now() - 51_000).toISOString(),
    level: "success",
    source: "REST",
    message: "Player list refreshed · 3 players online",
  },
  {
    id: "3",
    timestamp: new Date(Date.now() - 4 * 60_000).toISOString(),
    level: "info",
    source: "PalServer",
    message: "Cloudberry joined the server",
  },
  {
    id: "4",
    timestamp: new Date(Date.now() - 42 * 60_000).toISOString(),
    level: "success",
    source: "Backup",
    message: "Backup created: palworld-2026-07-30_03-00.tar.gz",
  },
  {
    id: "5",
    timestamp: new Date(Date.now() - 58 * 60_000).toISOString(),
    level: "warning",
    source: "Metrics",
    message: "Server FPS briefly dropped below 45",
  },
];

export const mockBackups: Backup[] = [
  {
    id: "backup-1",
    filename: "palworld-2026-07-30_03-00.tar.gz",
    createdAt: new Date(Date.now() - 42 * 60_000).toISOString(),
    sizeMb: 284,
    kind: "automatic",
  },
  {
    id: "backup-2",
    filename: "palworld-2026-07-29_18-24.tar.gz",
    createdAt: new Date(Date.now() - 9 * 3_600_000).toISOString(),
    sizeMb: 279,
    kind: "manual",
  },
  {
    id: "backup-3",
    filename: "palworld-pre-update-2026-07-28.tar.gz",
    createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    sizeMb: 271,
    kind: "pre-update",
  },
];

export const defaultWorldSettings: WorldSettings = {
  serverName: "My Palworld Server",
  serverDescription: "Private Palworld dedicated server",
  serverPassword: "",
  maxPlayers: 8,
  expRate: 1,
  captureRate: 1,
  spawnRate: 1,
  workSpeedRate: 1,
  eggHatchingTime: 1,
  deathPenalty: "Item",
  pvp: false,
  friendlyFire: false,
  fastTravel: true,
  allowClientMod: true,
};
