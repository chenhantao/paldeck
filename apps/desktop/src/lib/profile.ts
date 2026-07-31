import type { ServerProfile } from "../types/server";

export function createDefaultProfile(name = "我的帕鲁服务器"): ServerProfile {
  return {
    id: crypto.randomUUID(),
    name,
    auth: {
      kind: "openssh",
      sshHost: "",
    },
    remotePath: "~/.palworld",
  };
}

export function profileAddress(profile: ServerProfile, emptyLabel = "尚未配置"): string {
  if (profile.auth.kind === "openssh") {
    return profile.auth.sshHost || emptyLabel;
  }
  const port = profile.auth.port === 22 ? "" : `:${profile.auth.port}`;
  return `${profile.auth.username || "user"}@${profile.auth.host || "server"}${port}`;
}

export function profileNeedsPassword(profile: ServerProfile): boolean {
  return profile.auth.kind === "password" && !profile.auth.password;
}
