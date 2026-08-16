import type { ServerProfile } from "../types/server";
import { createUuid } from "./id";

const LEGACY_PROFILE_KEY = "paldeck.server-profile.v1";
const PROFILE_COLLECTION_KEY = "paldeck.server-profiles.v2";

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

interface StoredProfileCollection {
  version?: number;
  activeProfileId?: string | null;
  profiles?: StoredProfile[];
}

export interface ProfileCollection {
  profiles: ServerProfile[];
  activeProfileId: string | null;
}

export function loadProfileCollection(
  defaultName = "我的帕鲁服务器",
): ProfileCollection {
  try {
    const serialized = window.localStorage.getItem(PROFILE_COLLECTION_KEY);
    if (serialized) {
      const stored = JSON.parse(serialized) as StoredProfileCollection;
      if (stored.version === 2 && Array.isArray(stored.profiles)) {
        return normalizeCollection(stored, defaultName);
      }
    }

    const legacySerialized = window.localStorage.getItem(LEGACY_PROFILE_KEY);
    if (!legacySerialized) return emptyCollection();

    const profile = normalizeProfile(
      JSON.parse(legacySerialized) as StoredProfile,
      defaultName,
    );
    const migrated = {
      profiles: [profile],
      activeProfileId: profile.id,
    };
    saveProfileCollection(migrated);
    return migrated;
  } catch {
    return emptyCollection();
  }
}

export function saveProfileCollection(collection: ProfileCollection): void {
  const profileIds = new Set(collection.profiles.map(({ id }) => id));
  const activeProfileId =
    collection.activeProfileId && profileIds.has(collection.activeProfileId)
      ? collection.activeProfileId
      : collection.profiles[0]?.id ?? null;
  const stored: StoredProfileCollection = {
    version: 2,
    activeProfileId,
    profiles: collection.profiles.map(stripSecrets),
  };

  try {
    window.localStorage.setItem(PROFILE_COLLECTION_KEY, JSON.stringify(stored));
    window.localStorage.removeItem(LEGACY_PROFILE_KEY);
  } catch {
    // Keep the in-memory collection usable when WebView storage is unavailable.
  }
}

function normalizeCollection(
  stored: StoredProfileCollection,
  defaultName: string,
): ProfileCollection {
  const ids = new Set<string>();
  const profiles = (stored.profiles ?? []).map((profile) => {
    const normalized = normalizeProfile(profile, defaultName);
    if (ids.has(normalized.id)) normalized.id = createUuid();
    ids.add(normalized.id);
    return normalized;
  });
  const activeProfileId =
    stored.activeProfileId && ids.has(stored.activeProfileId)
      ? stored.activeProfileId
      : profiles[0]?.id ?? null;
  return { profiles, activeProfileId };
}

function normalizeProfile(
  stored: StoredProfile,
  defaultName: string,
): ServerProfile {
  return {
    id: stored.id ?? createUuid(),
    name: stored.name ?? defaultName,
    auth: normalizeAuthentication(stored),
    remotePath: stored.remotePath ?? "~/.palworld",
  };
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

function stripSecrets(profile: ServerProfile): ServerProfile {
  if (profile.auth.kind !== "password") return profile;
  return {
    ...profile,
    auth: {
      ...profile.auth,
      password: "",
    },
  };
}

function emptyCollection(): ProfileCollection {
  return { profiles: [], activeProfileId: null };
}
