import type { ServerProfile } from "../types/server";
import { createUuid } from "./id";

export function createDefaultProfile(name = "我的帕鲁服务器"): ServerProfile {
  return {
    id: createUuid(),
    name,
    auth: {
      kind: "openssh",
      host: "",
      username: "",
    },
    remotePath: "~/.palworld",
  };
}

export function profileAddress(profile: ServerProfile, emptyLabel = "尚未配置"): string {
  if (profile.auth.kind === "openssh") {
    if (!profile.auth.host) return emptyLabel;
    return `${profile.auth.username || "user"}@${profile.auth.host}`;
  }
  const port = profile.auth.port === 22 ? "" : `:${profile.auth.port}`;
  return `${profile.auth.username || "user"}@${profile.auth.host || "server"}${port}`;
}

export function profileNeedsPassword(profile: ServerProfile): boolean {
  return profile.auth.kind === "password" && !profile.auth.password;
}
