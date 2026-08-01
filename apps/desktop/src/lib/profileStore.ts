import type { ServerProfile } from "../types/server";
import { createUuid } from "./id";

const PROFILE_KEY = "paldeck.server-profile.v1";

export function loadProfile(defaultName = "我的帕鲁服务器"): ServerProfile | null {
  try {
    const serialized = window.localStorage.getItem(PROFILE_KEY);
    if (!serialized) return null;
    const stored = JSON.parse(serialized) as Partial<ServerProfile> & {
      sshHost?: string;
    };
    const profile: ServerProfile =
      stored.auth && stored.id && stored.name && stored.remotePath
        ? (stored as ServerProfile)
        : {
            id: stored.id ?? createUuid(),
            name: stored.name ?? defaultName,
            auth: {
              kind: "openssh",
              sshHost: stored.sshHost ?? "",
            },
            remotePath: stored.remotePath ?? "~/.palworld",
          };
    if (profile.auth.kind === "password") {
      profile.auth.password = "";
    }
    return profile;
  } catch {
    return null;
  }
}

export function saveProfile(profile: ServerProfile): void {
  const safeProfile: ServerProfile =
    profile.auth.kind === "password"
      ? {
          ...profile,
          auth: {
            ...profile.auth,
            password: "",
          },
        }
      : profile;
  window.localStorage.setItem(PROFILE_KEY, JSON.stringify(safeProfile));
}
