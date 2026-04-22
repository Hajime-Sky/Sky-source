const SKY_REMINDER_MIGRATION_STATE_KEY = "SKY_STORAGE_MIGRATIONS";
const SKY_REMINDER_STORAGE_MIGRATION_ID = "2026-04-22-unify-storage-v1";

function loadSkyReminderMigrationState() {
  try {
    const raw = readStoredRawValue(SKY_REMINDER_MIGRATION_STATE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_) {
    return {};
  }
}

function saveSkyReminderMigrationState(state) {
  writeStoredRawValue(SKY_REMINDER_MIGRATION_STATE_KEY, JSON.stringify(state || {}, null, 2));
}

function removeLegacyKeychainOnly(key) {
  try {
    const k = String(key || "");
    if (k && Keychain.contains(k)) {
      Keychain.remove(k);
      return true;
    }
  } catch (_) {}
  return false;
}

function migrateLegacyKeychainValueToFile(key) {
  const k = String(key || "");
  if (!k) return { key: k, migrated: false, removedLegacy: false };
  let migrated = false;
  try {
    const raw = readStoredRawValue(k);
    if (raw !== null && raw !== undefined) {
      writeStoredRawValue(k, raw);
      migrated = true;
    }
  } catch (e) {
    try { console.error(`legacy key migration failed: ${k}`, e); } catch (_) {}
  }
  const removedLegacy = removeLegacyKeychainOnly(k);
  Store.clear(k);
  return { key: k, migrated, removedLegacy };
}

function migrateLegacyConstellationImages() {
  const result = { copied: 0, skipped: 0, removedLegacyDir: false };
  try {
    const legacyFm = FileManager.local();
    const legacyDir = legacyFm.joinPath(legacyFm.documentsDirectory(), "sky_constellations_images");
    if (!legacyFm.fileExists(legacyDir)) return result;

    const targetFm = getStorageFileManager();
    const targetDir = getImagesDir(targetFm);
    const names = legacyFm.listContents(legacyDir).filter(name => String(name || "").toLowerCase().endsWith(".png"));
    for (const name of names) {
      const src = legacyFm.joinPath(legacyDir, name);
      const dst = targetFm.joinPath(targetDir, name);
      if (targetFm.fileExists(dst)) {
        result.skipped += 1;
        continue;
      }
      targetFm.write(dst, legacyFm.read(src));
      result.copied += 1;
    }
    legacyFm.remove(legacyDir);
    result.removedLegacyDir = true;
  } catch (e) {
    result.error = String(e || "");
    try { console.error("legacy image migration failed", e); } catch (_) {}
  }
  return result;
}

async function runSkyReminderStorageMigrationsOnce() {
  const state = loadSkyReminderMigrationState();
  const applied = state.applied && typeof state.applied === "object" ? state.applied : {};
  if (applied[SKY_REMINDER_STORAGE_MIGRATION_ID]) return applied[SKY_REMINDER_STORAGE_MIGRATION_ID];

  const legacyKeys = [
    KEYCHAIN_KEY,
    RUNSTATE_KEY_PROD,
    RUNSTATE_KEY_TEST,
    DISABLED_NOTI_KEY_PROD,
    DISABLED_NOTI_KEY_TEST,
    CACHE_KEY,
    BACKUP_PREFIX + KEYCHAIN_KEY,
    MUTEX_KEY,
  ];
  const result = {
    id: SKY_REMINDER_STORAGE_MIGRATION_ID,
    ranAt: new Date().toISOString(),
    keys: legacyKeys.map(migrateLegacyKeychainValueToFile),
    images: migrateLegacyConstellationImages(),
  };
  state.applied = { ...applied, [SKY_REMINDER_STORAGE_MIGRATION_ID]: result };
  saveSkyReminderMigrationState(state);
  return result;
}

await runSkyReminderStorageMigrationsOnce();
