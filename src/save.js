// Единственное место, которое трогает localStorage. Не импортируется в тестах.
import { SAVE_VERSION, migrateProfile, createProfile } from "./profile.js";

const SAVE_KEY = "corovans.save.v1";

export function storageAvailable() {
  try {
    const probe = "__corovans_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

export function readSave() {
  if (!storageAvailable()) return { profile: createProfile(), run: null, savedAt: 0 };
  let raw;
  try {
    raw = window.localStorage.getItem(SAVE_KEY);
  } catch {
    return { profile: createProfile(), run: null, savedAt: 0 };
  }
  if (!raw) return { profile: createProfile(), run: null, savedAt: 0 };

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { profile: createProfile(), run: null, savedAt: 0, corrupt: true };
  }
  if (!parsed || typeof parsed !== "object") {
    return { profile: createProfile(), run: null, savedAt: 0, corrupt: true };
  }

  return {
    profile: migrateProfile(parsed.profile),
    run: parsed.version === SAVE_VERSION ? parsed.run || null : null,
    savedAt: Number.isFinite(parsed.savedAt) ? parsed.savedAt : 0,
    versionMismatch: parsed.version !== SAVE_VERSION,
  };
}

export function writeSave(profile, run, extra = {}) {
  if (!storageAvailable()) return false;
  const payload = {
    version: SAVE_VERSION,
    savedAt: Date.now(),
    profile,
    run,
    ...extra,
  };
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  if (!storageAvailable()) return false;
  try {
    window.localStorage.removeItem(SAVE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function hasSave() {
  if (!storageAvailable()) return false;
  try {
    return Boolean(window.localStorage.getItem(SAVE_KEY));
  } catch {
    return false;
  }
}
