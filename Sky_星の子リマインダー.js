// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: yellow; icon-glyph: jedi;
// Sky_星の子リマインダー v2.17 modular loader

const SKY_TOOLS_APP_DIR = "HajimeSkyTools";
const SKY_REMINDER_APP_DIR = "star-reminder";
const SKY_REMINDER_MODULE_DIR = "modules";
const SKY_REMINDER_LEGACY_MODULE_DIR = "SkyReminderModules";
const SKY_REMINDER_MANIFEST = "manifest.json";
const SKY_REMINDER_SETTINGS_KEY = "SKY_SHARDS_SETTINGS";
const SKY_REMINDER_DEFAULT_REMOTE_MANIFEST_URL = "https://raw.githubusercontent.com/Hajime-Sky/Sky-source/main/SkyReminderModules/manifest.json";
const SKY_REMINDER_MAIN_SCRIPT = "Sky_星の子リマインダー.js";
const SKY_REMINDER_STORAGE_DIR = "HajimeSkyTools/star-reminder/data";
const SKY_REMINDER_PREVIOUS_STORAGE_DIR = "SkyReminder/data";
const SKY_REMINDER_LEGACY_STORAGE_DIR = "SkyReminderData";
const SKY_REMINDER_MIGRATION_STATE_KEY = "SKY_STORAGE_MIGRATIONS";
const SKY_REMINDER_KNOWN_MIGRATIONS = Object.freeze({
  "009_storage_migrations.js": "2026-04-22-unify-storage-v1",
});
const SKY_REMINDER_FALLBACK_PARTS = [
  "001_constants_and_navigation.js",
  "002_settings_store_and_cache.js",
  "003a_policy_time_and_common.js",
  "003b_recurring_events_and_pan.js",
  "003c_original_sin_and_dye.js",
  "003d_event_registry.js",
  "003e_scheduler_state.js",
  "004a_tap_and_shard_data.js",
  "004b_signal_rendering.js",
  "004c_draw_modes.js",
  "004d_widget_layout.js",
  "005_app_ui_html_and_client.js",
  "006_app_actions_backup_and_handlers.js",
  "008_github_update_scaffold.js",
  "007_shortcut_entrypoint.js",
];

async function skyReminderReadICloudText(fm, path) {
  if (!fm.fileExists(path)) throw new Error(`Sky reminder module not found: ${path}`);
  try {
    if (typeof fm.isFileDownloaded === "function" && !fm.isFileDownloaded(path)) {
      await fm.downloadFileFromiCloud(path);
    }
  } catch (e) {
    console.warn(`Could not pre-download module: ${path}: ${e}`);
  }
  return fm.readString(path);
}

function skyReminderReadSettings() {
  const readFromFile = () => {
    const fm = FileManager.iCloud();
    const dirs = [SKY_REMINDER_STORAGE_DIR, SKY_REMINDER_PREVIOUS_STORAGE_DIR, SKY_REMINDER_LEGACY_STORAGE_DIR];
    const file = encodeURIComponent(SKY_REMINDER_SETTINGS_KEY).replace(/%/g, "_") + ".json";
    for (const dirName of dirs) {
      const dir = fm.joinPath(fm.documentsDirectory(), dirName);
      const path = fm.joinPath(dir, file);
      if (!fm.fileExists(path)) continue;
      try {
        if (typeof fm.isFileDownloaded === "function" && !fm.isFileDownloaded(path)) {
          fm.downloadFileFromiCloud(path);
        }
      } catch (_) {}
      return fm.readString(path);
    }
    return null;
  };
  try {
    let raw = readFromFile();
    if ((raw === null || raw === undefined) && Keychain.contains(SKY_REMINDER_SETTINGS_KEY)) {
      raw = Keychain.get(SKY_REMINDER_SETTINGS_KEY);
      try {
        const fm = FileManager.iCloud();
        const dir = fm.joinPath(fm.documentsDirectory(), SKY_REMINDER_STORAGE_DIR);
        if (!fm.fileExists(dir)) fm.createDirectory(dir, true);
        const file = encodeURIComponent(SKY_REMINDER_SETTINGS_KEY).replace(/%/g, "_") + ".json";
        fm.writeString(fm.joinPath(dir, file), raw);
      } catch (_) {}
    } else if (raw !== null && raw !== undefined) {
      try {
        const fm = FileManager.iCloud();
        const dir = fm.joinPath(fm.documentsDirectory(), SKY_REMINDER_STORAGE_DIR);
        const file = encodeURIComponent(SKY_REMINDER_SETTINGS_KEY).replace(/%/g, "_") + ".json";
        const path = fm.joinPath(dir, file);
        if (!fm.fileExists(path)) {
          if (!fm.fileExists(dir)) fm.createDirectory(dir, true);
          fm.writeString(path, raw);
        }
      } catch (_) {}
    }
    if (raw === null || raw === undefined) return {};
    const st = JSON.parse(raw);
    return st && typeof st === "object" ? st : {};
  } catch (_) {
    return {};
  }
}

function skyReminderSaveSettingsPatch(patch) {
  try {
    const st = skyReminderReadSettings();
    const cur = st.githubUpdate && typeof st.githubUpdate === "object" ? st.githubUpdate : {};
    st.githubUpdate = { ...cur, ...patch };
    const fm = FileManager.iCloud();
    const dir = fm.joinPath(fm.documentsDirectory(), SKY_REMINDER_STORAGE_DIR);
    if (!fm.fileExists(dir)) fm.createDirectory(dir, true);
    const file = encodeURIComponent(SKY_REMINDER_SETTINGS_KEY).replace(/%/g, "_") + ".json";
    fm.writeString(fm.joinPath(dir, file), JSON.stringify(st));
  } catch (e) {
    console.warn(`Could not save GitHub update state: ${e}`);
  }
}

function skyReminderStorageFilePath(fm, key) {
  const dir = fm.joinPath(fm.documentsDirectory(), SKY_REMINDER_STORAGE_DIR);
  const file = encodeURIComponent(String(key || "")).replace(/%/g, "_") + ".json";
  return fm.joinPath(dir, file);
}

function skyReminderLegacyStorageFilePath(fm, key) {
  const dir = fm.joinPath(fm.documentsDirectory(), SKY_REMINDER_LEGACY_STORAGE_DIR);
  const file = encodeURIComponent(String(key || "")).replace(/%/g, "_") + ".json";
  return fm.joinPath(dir, file);
}

function skyReminderPreviousStorageFilePath(fm, key) {
  const dir = fm.joinPath(fm.documentsDirectory(), SKY_REMINDER_PREVIOUS_STORAGE_DIR);
  const file = encodeURIComponent(String(key || "")).replace(/%/g, "_") + ".json";
  return fm.joinPath(dir, file);
}

function skyReminderReadStorageRaw(key) {
  try {
    const fm = FileManager.iCloud();
    const paths = [skyReminderStorageFilePath(fm, key), skyReminderPreviousStorageFilePath(fm, key), skyReminderLegacyStorageFilePath(fm, key)];
    for (const path of paths) {
      if (!fm.fileExists(path)) continue;
      try {
        if (typeof fm.isFileDownloaded === "function" && !fm.isFileDownloaded(path)) {
          fm.downloadFileFromiCloud(path);
        }
      } catch (_) {}
      return fm.readString(path);
    }
    return null;
  } catch (_) {
    return null;
  }
}

function skyReminderAppDir(fm) {
  const toolsDir = fm.joinPath(fm.documentsDirectory(), SKY_TOOLS_APP_DIR);
  if (!fm.fileExists(toolsDir)) fm.createDirectory(toolsDir, true);
  const dir = fm.joinPath(toolsDir, SKY_REMINDER_APP_DIR);
  if (!fm.fileExists(dir)) fm.createDirectory(dir, true);
  return dir;
}

function skyReminderModuleDir(fm) {
  const dir = fm.joinPath(skyReminderAppDir(fm), SKY_REMINDER_MODULE_DIR);
  if (!fm.fileExists(dir)) fm.createDirectory(dir, true);
  return dir;
}

function skyReminderLegacyModuleDir(fm) {
  return fm.joinPath(fm.documentsDirectory(), SKY_REMINDER_LEGACY_MODULE_DIR);
}

async function skyReminderCopyLegacyManifestIfNeeded(fm, moduleDir) {
  const manifestPath = fm.joinPath(moduleDir, SKY_REMINDER_MANIFEST);
  if (fm.fileExists(manifestPath)) return;
  const legacyDir = skyReminderLegacyModuleDir(fm);
  const legacyManifestPath = fm.joinPath(legacyDir, SKY_REMINDER_MANIFEST);
  if (!fm.fileExists(legacyManifestPath)) return;
  try {
    const text = await skyReminderReadICloudText(fm, legacyManifestPath);
    fm.writeString(manifestPath, text);
  } catch (_) {}
}

function skyReminderDeleteLegacyModuleDir(fm, activeModuleDir) {
  try {
    const legacyDir = skyReminderLegacyModuleDir(fm);
    if (legacyDir !== activeModuleDir && fm.fileExists(legacyDir)) fm.remove(legacyDir);
  } catch (e) {
    console.warn(`Could not delete legacy module dir: ${e}`);
  }
}

function skyReminderDeleteLegacyDataDirIfMigrated(fm) {
  try {
    const newDir = fm.joinPath(fm.documentsDirectory(), SKY_REMINDER_STORAGE_DIR);
    const previousDir = fm.joinPath(fm.documentsDirectory(), SKY_REMINDER_PREVIOUS_STORAGE_DIR);
    if (previousDir !== newDir && fm.fileExists(previousDir) && fm.fileExists(newDir)) fm.remove(previousDir);
    const legacyDir = fm.joinPath(fm.documentsDirectory(), SKY_REMINDER_LEGACY_STORAGE_DIR);
    if (legacyDir !== newDir && fm.fileExists(legacyDir) && fm.fileExists(newDir)) fm.remove(legacyDir);
  } catch (e) {
    console.warn(`Could not delete legacy data dir: ${e}`);
  }
}

function skyReminderCleanupLegacyDirs(fm, moduleDir) {
  skyReminderDeleteLegacyModuleDir(fm, moduleDir);
  skyReminderDeleteLegacyDataDirIfMigrated(fm);
}

function skyReminderActiveModuleDir(fm) {
  return skyReminderModuleDir(fm);
}

function skyReminderResolveLocalModuleDirForExistingInstall(fm) {
  const moduleDir = skyReminderActiveModuleDir(fm);
  return moduleDir;
}

function skyReminderWriteStorageRaw(key, value) {
  const fm = FileManager.iCloud();
  const dir = fm.joinPath(fm.documentsDirectory(), SKY_REMINDER_STORAGE_DIR);
  if (!fm.fileExists(dir)) fm.createDirectory(dir, true);
  fm.writeString(skyReminderStorageFilePath(fm, key), String(value ?? ""));
}

function skyReminderReadAppliedMigrationIds() {
  try {
    const raw = skyReminderReadStorageRaw(SKY_REMINDER_MIGRATION_STATE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    if (Array.isArray(parsed?.applied)) return parsed.applied.map(String).filter(Boolean);
    if (parsed?.applied && typeof parsed.applied === "object") return Object.keys(parsed.applied).filter(Boolean);
  } catch (_) {}
  return [];
}

function skyReminderSaveAppliedMigrationIds(ids) {
  const unique = Array.from(new Set((Array.isArray(ids) ? ids : []).map(String).filter(Boolean))).sort();
  skyReminderWriteStorageRaw(SKY_REMINDER_MIGRATION_STATE_KEY, JSON.stringify({ applied: unique }, null, 2));
}

function skyReminderMarkMigrationApplied(id) {
  const key = String(id || "").trim();
  if (!key) return;
  const ids = skyReminderReadAppliedMigrationIds();
  if (!ids.includes(key)) {
    ids.push(key);
    skyReminderSaveAppliedMigrationIds(ids);
  }
}

function skyReminderGetUpdateConfig(manifest) {
  const st = skyReminderReadSettings();
  const cfg = st.githubUpdate && typeof st.githubUpdate === "object" ? st.githubUpdate : {};
  const mfUpdate = manifest && manifest.update && typeof manifest.update === "object" ? manifest.update : {};
  const remoteManifestUrl = String(cfg.remoteManifestUrl || mfUpdate.remoteManifestUrl || SKY_REMINDER_DEFAULT_REMOTE_MANIFEST_URL).trim();
  const policy = ["none", "daily", "always"].includes(String(cfg.policy || "")) ? String(cfg.policy) : "daily";
  const lastCheckedAtMs = Number(cfg.lastCheckedAtMs || 0) || 0;
  return { remoteManifestUrl, policy, lastCheckedAtMs };
}

async function skyReminderLoadManifest(fm, moduleDir) {
  const manifestPath = fm.joinPath(moduleDir, SKY_REMINDER_MANIFEST);
  if (!fm.fileExists(manifestPath)) return null;
  const raw = await skyReminderReadICloudText(fm, manifestPath);
  try { return JSON.parse(raw); }
  catch (e) { throw new Error(`Sky reminder manifest is invalid JSON: ${e}`); }
}

function skyReminderManifestParts(manifest) {
  const parts = manifest && Array.isArray(manifest.parts) && manifest.parts.length
    ? manifest.parts.map((p) => typeof p === "string" ? p : p.file).filter(Boolean)
    : SKY_REMINDER_FALLBACK_PARTS;
  return parts.filter((file) => !SKY_REMINDER_KNOWN_MIGRATIONS[String(file || "")]);
}

function skyReminderManifestMigrations(manifest) {
  const byId = Object.create(null);
  const addMigration = (migration) => {
    if (!migration || !migration.id || !migration.file) return;
    byId[String(migration.id)] = migration;
  };
  if (manifest && Array.isArray(manifest.migrations)) {
    for (const migration of manifest.migrations) addMigration(migration);
  }
  if (manifest && Array.isArray(manifest.parts)) {
    for (const part of manifest.parts) {
      const file = String((typeof part === "string" ? part : part?.file) || "");
      const id = SKY_REMINDER_KNOWN_MIGRATIONS[file];
      if (id) addMigration({ ...(typeof part === "object" && part ? part : {}), id, file });
    }
  }
  return Object.values(byId);
}

function skyReminderHasMissingFiles(fm, moduleDir, manifest) {
  const manifestPath = fm.joinPath(moduleDir, SKY_REMINDER_MANIFEST);
  if (!manifest || !fm.fileExists(manifestPath)) return true;
  const parts = skyReminderManifestParts(manifest);
  return parts.some((part) => !fm.fileExists(fm.joinPath(moduleDir, part)));
}

function skyReminderResolvePartUrl(remoteManifestUrl, part) {
  const partUrl = String(part && part.url || "").trim();
  if (/^https?:\/\//i.test(partUrl)) return partUrl;
  const file = encodeURIComponent(String(part && part.file || partUrl || "")).replace(/%2F/g, "/");
  const base = String(remoteManifestUrl || "").replace(/[^/]*$/, "");
  return base + file;
}

async function skyReminderLoadMigrationSource(fm, moduleDir, manifest, migration) {
  const cfg = skyReminderGetUpdateConfig(manifest);
  const path = fm.joinPath(moduleDir, String(migration.file));
  try {
    return await skyReminderFetchText(skyReminderResolvePartUrl(cfg.remoteManifestUrl, migration));
  } catch (e) {
    if (fm.fileExists(path)) return await skyReminderReadICloudText(fm, path);
    throw e;
  }
}

function skyReminderDeleteLocalMigrationFiles(fm, moduleDir, manifest) {
  const files = new Set(["009_storage_migrations.js"]);
  for (const migration of skyReminderManifestMigrations(manifest)) files.add(String(migration.file));
  for (const file of files) {
    try {
      const path = fm.joinPath(moduleDir, file);
      if (fm.fileExists(path)) fm.remove(path);
    } catch (e) {
      console.warn(`Could not delete migration module ${file}: ${e}`);
    }
  }
}

async function skyReminderBuildMigrationChunks(fm, moduleDir, manifest) {
  const applied = new Set(skyReminderReadAppliedMigrationIds());
  const chunks = [];
  for (const migration of skyReminderManifestMigrations(manifest)) {
    const id = String(migration.id || "").trim();
    if (!id || applied.has(id)) continue;
    const source = await skyReminderLoadMigrationSource(fm, moduleDir, manifest, migration);
    chunks.push(`\n// ---- migration:${id}:${migration.file} ----\ntry {\n${source}\nskyReminderMarkMigrationApplied(${JSON.stringify(id)});\n} catch (e) {\n  try { console.error(${JSON.stringify(`Sky reminder migration failed: ${id}`)}, e); } catch (_) {}\n  throw e;\n}\n`);
  }
  return chunks;
}

function skyReminderResolveMainScriptUrl(remoteManifestUrl, remoteManifest) {
  const meta = remoteManifest && remoteManifest.mainScriptFile && typeof remoteManifest.mainScriptFile === "object" ? remoteManifest.mainScriptFile : {};
  const explicit = String(meta.url || "").trim();
  if (/^https?:\/\//i.test(explicit)) return explicit;
  return String(remoteManifestUrl || "").replace(/SkyReminderModules\/[^/]*$/, encodeURIComponent(SKY_REMINDER_MAIN_SCRIPT));
}

async function skyReminderFetchJson(url) {
  const req = new Request(url);
  req.timeoutInterval = 20;
  const text = await req.loadString();
  return JSON.parse(text);
}

async function skyReminderFetchText(url) {
  const req = new Request(url);
  req.timeoutInterval = 30;
  return await req.loadString();
}

function skyReminderRestartScript() {
  try {
    Safari.open("scriptable:///run?scriptName=" + encodeURIComponent(SKY_REMINDER_MAIN_SCRIPT));
  } catch (e) {
    console.warn(`Could not restart Sky reminder: ${e}`);
  }
}

async function skyReminderUpdateFromGitHubIfNeeded(fm, moduleDir, localManifest, options = {}) {
  const missing = skyReminderHasMissingFiles(fm, moduleDir, localManifest);
  const cfg = skyReminderGetUpdateConfig(localManifest);
  if (!cfg.remoteManifestUrl) return localManifest;
  const nowMs = Date.now();
  const dailyDue = nowMs - cfg.lastCheckedAtMs >= 24 * 60 * 60 * 1000;
  const force = options && options.force === true;
  const shouldCheck = force || missing || cfg.policy === "always" || (cfg.policy === "daily" && dailyDue);
  if (!shouldCheck) return localManifest;
  try {
    const remoteManifest = await skyReminderFetchJson(cfg.remoteManifestUrl);
    if (!remoteManifest || !Array.isArray(remoteManifest.parts) || !remoteManifest.parts.length) throw new Error("remote manifest has no parts");
    const remoteParts = remoteManifest.parts.filter((p) => p && p.file);
    const localByFile = Object.create(null);
    if (localManifest && Array.isArray(localManifest.parts)) {
      for (const p of localManifest.parts) if (p && p.file) localByFile[String(p.file)] = p;
    }
    const changed = missing ? remoteParts : remoteParts.filter((p) => {
      const file = String(p.file);
      const path = fm.joinPath(moduleDir, file);
      const local = localByFile[file] || null;
      return !fm.fileExists(path) || String(local?.sha256 || "") !== String(p.sha256 || "");
    });
    const mainMeta = remoteManifest.mainScriptFile && typeof remoteManifest.mainScriptFile === "object" ? remoteManifest.mainScriptFile : null;
    const mainHashChanged = mainMeta && String(mainMeta.sha256 || "") && String(localManifest?.mainScriptFile?.sha256 || "") !== String(mainMeta.sha256 || "");
    if (changed.length > 0 || mainHashChanged) {
      if (!fm.fileExists(moduleDir)) fm.createDirectory(moduleDir, true);
      for (const part of changed) {
        const file = String(part.file);
        const text = await skyReminderFetchText(skyReminderResolvePartUrl(cfg.remoteManifestUrl, part));
        fm.writeString(fm.joinPath(moduleDir, file), text);
      }
      if (mainHashChanged) {
        const text = await skyReminderFetchText(skyReminderResolveMainScriptUrl(cfg.remoteManifestUrl, remoteManifest));
        fm.writeString(fm.joinPath(fm.documentsDirectory(), SKY_REMINDER_MAIN_SCRIPT), text);
      }
      fm.writeString(fm.joinPath(moduleDir, SKY_REMINDER_MANIFEST), JSON.stringify(remoteManifest, null, 2));
      skyReminderSaveSettingsPatch({ lastCheckedAtMs: nowMs, lastUpdatedAtMs: nowMs, lastUpdateStatus: `updated:parts=${changed.length},main=${mainHashChanged ? 1 : 0}` });
      if (options && options.restartOnUpdated === true) skyReminderRestartScript();
      return remoteManifest;
    }
    skyReminderSaveSettingsPatch({ lastCheckedAtMs: nowMs, lastUpdateStatus: "no-update" });
    return remoteManifest;
  } catch (e) {
    skyReminderSaveSettingsPatch({ lastCheckedAtMs: nowMs, lastUpdateStatus: `error:${String(e).slice(0, 160)}` });
    console.warn(`GitHub update skipped: ${e}`);
    return localManifest;
  }
}

async function skyReminderManualGithubUpdateAndRestart() {
  const fm = FileManager.iCloud();
  const moduleDir = skyReminderResolveLocalModuleDirForExistingInstall(fm);
  await skyReminderCopyLegacyManifestIfNeeded(fm, moduleDir);
  const localManifest = await skyReminderLoadManifest(fm, moduleDir);
  return await skyReminderUpdateFromGitHubIfNeeded(fm, moduleDir, localManifest, { force: true, restartOnUpdated: true });
}

async function skyReminderRunFromParts() {
  const fm = FileManager.iCloud();
  const moduleDir = skyReminderResolveLocalModuleDirForExistingInstall(fm);
  await skyReminderCopyLegacyManifestIfNeeded(fm, moduleDir);
  let manifest = await skyReminderLoadManifest(fm, moduleDir);
  manifest = await skyReminderUpdateFromGitHubIfNeeded(fm, moduleDir, manifest);
  const parts = skyReminderManifestParts(manifest);
  if (!parts.length) throw new Error("Sky reminder manifest has no parts.");

  const chunks = [];
  const migrationChunks = await skyReminderBuildMigrationChunks(fm, moduleDir, manifest);
  let insertedMigrations = false;
  for (const part of parts) {
    if (!insertedMigrations && part === "007_shortcut_entrypoint.js") {
      chunks.push(...migrationChunks);
      insertedMigrations = true;
    }
    const partPath = fm.joinPath(moduleDir, part);
    const text = await skyReminderReadICloudText(fm, partPath);
    chunks.push(`\n// ---- ${part} ----\n${text}\n`);
  }
  if (!insertedMigrations) chunks.push(...migrationChunks);
  skyReminderDeleteLocalMigrationFiles(fm, moduleDir, manifest);
  skyReminderDeleteLegacyModuleDir(fm, moduleDir);

  const source = `(async () => {\n${chunks.join("\n")}\n})()`;
  const result = await eval(source);
  skyReminderDeleteLegacyDataDirIfMigrated(fm);
  return result;
}

await skyReminderRunFromParts();
