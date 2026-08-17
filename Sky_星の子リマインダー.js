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

function skyReminderUtf8Bytes(text) {
  const out = [];
  const s = String(text ?? "");
  for (let i = 0; i < s.length; i++) {
    let cp = s.codePointAt(i);
    if (cp > 0xffff) i++;
    if (cp <= 0x7f) out.push(cp);
    else if (cp <= 0x7ff) out.push(0xc0 | (cp >>> 6), 0x80 | (cp & 0x3f));
    else if (cp <= 0xffff) out.push(0xe0 | (cp >>> 12), 0x80 | ((cp >>> 6) & 0x3f), 0x80 | (cp & 0x3f));
    else out.push(0xf0 | (cp >>> 18), 0x80 | ((cp >>> 12) & 0x3f), 0x80 | ((cp >>> 6) & 0x3f), 0x80 | (cp & 0x3f));
  }
  return out;
}

function skyReminderSha256Text(text) {
  const K = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
  ];
  const H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const bytes = skyReminderUtf8Bytes(text);
  const bitLenHi = Math.floor(bytes.length / 0x20000000);
  const bitLenLo = (bytes.length << 3) >>> 0;
  bytes.push(0x80);
  while ((bytes.length % 64) !== 56) bytes.push(0);
  bytes.push((bitLenHi >>> 24) & 255, (bitLenHi >>> 16) & 255, (bitLenHi >>> 8) & 255, bitLenHi & 255);
  bytes.push((bitLenLo >>> 24) & 255, (bitLenLo >>> 16) & 255, (bitLenLo >>> 8) & 255, bitLenLo & 255);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  const w = new Array(64);
  for (let off = 0; off < bytes.length; off += 64) {
    for (let i = 0; i < 16; i++) {
      const j = off + i * 4;
      w[i] = ((bytes[j] << 24) | (bytes[j + 1] << 16) | (bytes[j + 2] << 8) | bytes[j + 3]) >>> 0;
    }
    for (let i = 16; i < 64; i++) {
      const x = w[i - 15], y = w[i - 2];
      const s0 = (rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3)) >>> 0;
      const s1 = (rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10)) >>> 0;
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a,b,c,d,e,f,g,h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
      const ch = ((e & f) ^ ((~e) & g)) >>> 0;
      const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0]=(H[0]+a)>>>0; H[1]=(H[1]+b)>>>0; H[2]=(H[2]+c)>>>0; H[3]=(H[3]+d)>>>0;
    H[4]=(H[4]+e)>>>0; H[5]=(H[5]+f)>>>0; H[6]=(H[6]+g)>>>0; H[7]=(H[7]+h)>>>0;
  }
  return H.map(v => v.toString(16).padStart(8, "0")).join("");
}

async function skyReminderLocalSha256(fm, path) {
  if (!fm.fileExists(path)) return "";
  const text = await skyReminderReadICloudText(fm, path);
  return skyReminderSha256Text(text);
}

function skyReminderVerifyDownloadedText(text, expectedSha, label) {
  const expected = String(expectedSha || "").trim().toLowerCase();
  if (!expected) return;
  const actual = skyReminderSha256Text(text);
  if (actual !== expected) throw new Error(`SHA-256 mismatch for ${label}: expected=${expected} actual=${actual}`);
}

async function skyReminderWriteTransaction(fm, entries) {
  const unique = [];
  const seen = new Set();
  for (const entry of entries) {
    if (!entry || !entry.path || seen.has(entry.path)) continue;
    seen.add(entry.path);
    unique.push(entry);
  }
  const originals = [];
  for (const entry of unique) {
    const existed = fm.fileExists(entry.path);
    originals.push({ path: entry.path, existed, text: existed ? await skyReminderReadICloudText(fm, entry.path) : null });
  }
  try {
    for (const entry of unique) fm.writeString(entry.path, entry.text);
  } catch (writeError) {
    const rollbackErrors = [];
    for (let i = originals.length - 1; i >= 0; i--) {
      const original = originals[i];
      try {
        if (original.existed) fm.writeString(original.path, original.text);
        else if (fm.fileExists(original.path)) fm.remove(original.path);
      } catch (rollbackError) {
        rollbackErrors.push(String(rollbackError));
      }
    }
    if (rollbackErrors.length) throw new Error(`Update write failed: ${writeError}; rollback failed: ${rollbackErrors.join(" | ")}`);
    throw writeError;
  }
}

function skyReminderBuildRestartUrl() {
  try {
    if (typeof URLScheme !== "undefined" && URLScheme && typeof URLScheme.forRunningScript === "function") {
      const url = String(URLScheme.forRunningScript() || "").trim();
      if (url) return url;
    }
  } catch (_) {}
  return "scriptable:///run?scriptName=" + encodeURIComponent(SKY_REMINDER_MAIN_SCRIPT);
}

function skyReminderRestartScript() {
  try {
    globalThis.__SKY_REMINDER_RESTART_AFTER_WEBVIEW = true;
  } catch (_) {}
  try {
    Safari.open(skyReminderBuildRestartUrl());
  } catch (e) {
    console.warn(`Could not restart Sky reminder: ${e}`);
  }
}

async function skyReminderRestartAfterWebViewIfRequested() {
  let requested = false;
  try { requested = globalThis.__SKY_REMINDER_RESTART_AFTER_WEBVIEW === true; } catch (_) {}
  if (!requested) return;
  try { globalThis.__SKY_REMINDER_RESTART_AFTER_WEBVIEW = false; } catch (_) {}
  await new Promise(resolve => Timer.schedule(0.7, false, resolve));
  try {
    Safari.open(skyReminderBuildRestartUrl());
  } catch (e) {
    console.warn(`Could not restart Sky reminder after WebView: ${e}`);
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
    const forceSyncAll = force === true;
    const changed = [];
    for (const part of remoteParts) {
      const file = String(part.file);
      const path = fm.joinPath(moduleDir, file);
      const expected = String(part.sha256 || "").trim().toLowerCase();
      const actual = await skyReminderLocalSha256(fm, path);
      if (forceSyncAll || !actual || (expected && actual !== expected)) changed.push(part);
    }
    const mainMeta = remoteManifest.mainScriptFile && typeof remoteManifest.mainScriptFile === "object" ? remoteManifest.mainScriptFile : null;
    const mainPath = fm.joinPath(fm.documentsDirectory(), SKY_REMINDER_MAIN_SCRIPT);
    const mainExpected = String(mainMeta?.sha256 || "").trim().toLowerCase();
    const mainActual = mainMeta ? await skyReminderLocalSha256(fm, mainPath) : "";
    const mainHashChanged = Boolean(mainMeta && (forceSyncAll || !mainActual || (mainExpected && mainActual !== mainExpected)));
    if (changed.length > 0 || mainHashChanged) {
      if (!fm.fileExists(moduleDir)) fm.createDirectory(moduleDir, true);
      const stagedWrites = [];
      for (const part of changed) {
        const file = String(part.file);
        const text = await skyReminderFetchText(skyReminderResolvePartUrl(cfg.remoteManifestUrl, part));
        skyReminderVerifyDownloadedText(text, part.sha256, file);
        stagedWrites.push({ path: fm.joinPath(moduleDir, file), text });
      }
      if (mainHashChanged) {
        const text = await skyReminderFetchText(skyReminderResolveMainScriptUrl(cfg.remoteManifestUrl, remoteManifest));
        skyReminderVerifyDownloadedText(text, mainMeta.sha256, SKY_REMINDER_MAIN_SCRIPT);
        stagedWrites.push({ path: mainPath, text });
      }
      stagedWrites.push({ path: fm.joinPath(moduleDir, SKY_REMINDER_MANIFEST), text: JSON.stringify(remoteManifest, null, 2) });
      await skyReminderWriteTransaction(fm, stagedWrites);
      skyReminderSaveSettingsPatch({ lastCheckedAtMs: nowMs, lastUpdatedAtMs: nowMs, lastUpdateStatus: `${forceSyncAll ? "synced" : "updated"}:parts=${changed.length},main=${mainHashChanged ? 1 : 0}` });
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
  return await skyReminderUpdateFromGitHubIfNeeded(fm, moduleDir, localManifest, { force: true, restartOnUpdated: false });
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
