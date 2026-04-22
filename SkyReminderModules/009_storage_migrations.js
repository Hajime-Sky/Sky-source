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

function copyDirectoryContentsIfMissing(fm, srcDir, dstDir, result) {
  if (!fm.fileExists(dstDir)) fm.createDirectory(dstDir, true);
  const names = fm.listContents(srcDir);
  for (const name of names) {
    const src = fm.joinPath(srcDir, name);
    const dst = fm.joinPath(dstDir, name);
    if (fm.isDirectory && fm.isDirectory(src)) {
      copyDirectoryContentsIfMissing(fm, src, dst, result);
      continue;
    }
    if (fm.fileExists(dst)) {
      result.skipped += 1;
      continue;
    }
    try {
      fm.write(dst, fm.read(src));
      result.copied += 1;
    } catch (e) {
      result.errors.push(`${name}:${String(e || "")}`);
    }
  }
}

function migrateLegacyStorageFolder() {
  const result = { copied: 0, skipped: 0, removedLegacyDir: false, errors: [] };
  try {
    const fm = getStorageFileManager();
    const legacyDir = fm.joinPath(fm.documentsDirectory(), "SkyReminderData");
    const targetDir = getStorageDir(fm);
    if (!fm.fileExists(legacyDir) || legacyDir === targetDir) return result;
    copyDirectoryContentsIfMissing(fm, legacyDir, targetDir, result);
    try {
      fm.remove(legacyDir);
      result.removedLegacyDir = true;
    } catch (e) {
      result.errors.push(`remove:${String(e || "")}`);
    }
  } catch (e) {
    result.errors.push(String(e || ""));
    try { console.error("legacy storage folder migration failed", e); } catch (_) {}
  }
  return result;
}

function migratePreviousUnifiedStorageFolder() {
  const result = { copied: 0, skipped: 0, removedLegacyDir: false, errors: [] };
  try {
    const fm = getStorageFileManager();
    const previousDir = fm.joinPath(fm.documentsDirectory(), "SkyReminder/data");
    const targetDir = getStorageDir(fm);
    if (!fm.fileExists(previousDir) || previousDir === targetDir) return result;
    copyDirectoryContentsIfMissing(fm, previousDir, targetDir, result);
    try {
      fm.remove(previousDir);
      result.removedLegacyDir = true;
    } catch (e) {
      result.errors.push(`remove:${String(e || "")}`);
    }
  } catch (e) {
    result.errors.push(String(e || ""));
    try { console.error("previous storage folder migration failed", e); } catch (_) {}
  }
  return result;
}

async function runSkyReminderStorageMigrationsOnce() {
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
  return {
    ranAt: new Date().toISOString(),
    keys: legacyKeys.map(migrateLegacyKeychainValueToFile),
    previousStorage: migratePreviousUnifiedStorageFolder(),
    storage: migrateLegacyStorageFolder(),
    images: migrateLegacyConstellationImages(),
  };
}

await runSkyReminderStorageMigrationsOnce();
