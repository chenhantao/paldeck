import type { ServerProfile } from "../types/server";
import { createUuid } from "./id";

const PROFILE_KEY = "paldeck.server-profile.v1";

interface StoredAuthentication {
  kind?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  trustedHostKey?: string;
  sshHost?: string;
}

interface StoredProfile {
  id?: string;
  name?: string;
  remotePath?: string;
  sshHost?: string;
  auth?: StoredAuthentication;
}

export function loadProfile(defaultName = "我的帕鲁服务器"): ServerProfile | null {
  try {
    const serialized = window.localStorage.getItem(PROFILE_KEY);
    if (!serialized) return null;
    const stored = JSON.parse(serialized) as StoredProfile;
    return {
      id: stored.id ?? createUuid(),
      name: stored.name ?? defaultName,
      auth: normalizeAuthentication(stored),
      remotePath: stored.remotePath ?? "~/.palworld",
    };
  } catch {
    return null;
  }
}

function normalizeAuthentication(stored: StoredProfile): ServerProfile["auth"] {
  const auth = stored.auth;
  if (auth?.kind === "password") {
    return {
      kind: "password",
      host: auth.host ?? "",
      port: auth.port ?? 22,
      username: auth.username ?? "",
      password: "",
      trustedHostKey: auth.trustedHostKey,
    };
  }

  const legacyTarget = auth?.sshHost ?? stored.sshHost ?? "";
  const separator = legacyTarget.lastIndexOf("@");
  const legacyUsername = separator > 0 ? legacyTarget.slice(0, separator) : "";
  const legacyHost = separator > 0 ? legacyTarget.slice(separator + 1) : legacyTarget;
  return {
    kind: "openssh",
    host: auth?.host ?? legacyHost,
    username: auth?.username ?? legacyUsername,
  };
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
