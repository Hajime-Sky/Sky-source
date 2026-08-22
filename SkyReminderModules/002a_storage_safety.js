// Keep file-backed Star Reminder state readable when iCloud has offloaded it,
// and leave legacy-directory deletion to the verified migration module.
async function skyReminderPreloadStorageFilesFromICloud() {
  const fm = getStorageFileManager();
  const roots = [STORAGE_DIRNAME, PREVIOUS_STORAGE_DIRNAME, LEGACY_STORAGE_DIRNAME]
    .map(rel => fm.joinPath(fm.documentsDirectory(), rel));
  async function visit(dir) {
    if (!fm.fileExists(dir)) return;
    for (const name of fm.listContents(dir)) {
      const path = fm.joinPath(dir, name);
      try {
        if (typeof fm.isDirectory === "function" && fm.isDirectory(path)) {
          await visit(path);
          continue;
        }
      } catch (_) {}
      try {
        if (typeof fm.isFileDownloaded === "function" && !fm.isFileDownloaded(path)) {
          await fm.downloadFileFromiCloud(path);
        }
      } catch (e) {
        try { console.warn("Star Reminder storage preload failed: " + path + " " + e); } catch (_) {}
      }
    }
  }
  for (const dir of roots) await visit(dir);
}
await skyReminderPreloadStorageFilesFromICloud();

// The loader's old cleanup only checked that the destination directory existed.
// 009_storage_migrations.js now verifies every file before removing a legacy dir.
try {
  if (typeof skyReminderDeleteLegacyDataDirIfMigrated === "function") {
    skyReminderDeleteLegacyDataDirIfMigrated = function () { return false; };
  }
} catch (_) {}
