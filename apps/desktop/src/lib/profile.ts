import type { ServerProfile } from "../types/server";

export function createDefaultProfile(): ServerProfile {
  return {
    id: crypto.randomUUID(),
    name: "我的帕鲁服务器",
    auth: {
      kind: "openssh",
      sshHost: "",
    },
    remotePath: "~/.palworld",
  };
}

export function profileAddress(profile: ServerProfile): string {
  if (profile.auth.kind === "openssh") {
    return profile.auth.sshHost || "尚未配置";
  }
  const port = profile.auth.port === 22 ? "" : `:${profile.auth.port}`;
  return `${profile.auth.username || "user"}@${profile.auth.host || "server"}${port}`;
}

export function profileNeedsPassword(profile: ServerProfile): boolean {
  return profile.auth.kind === "password" && !profile.auth.password;
}
