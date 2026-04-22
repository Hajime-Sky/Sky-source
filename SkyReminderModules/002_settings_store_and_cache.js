const NOTI_ID = (() => {
  const LAKEY_RE = /^\d{4}-\d{2}-\d{2}$/;
  const TEST_TAG = "test";
  const PREFIXES = Object.freeze(Object.values(ID_PREFIX));
  const build = (parts) => (Array.isArray(parts) ? parts : [parts])
    .filter(v => v !== undefined && v !== null && String(v) !== "")
    .map(v => String(v))
    .join(":");
  const parse = (id) => {
    const raw = String(id || "");
    const parts = raw.split(":");
    if (parts.length < 3) return null;
    const prefix = String(parts[0] || "");
    const type = String(parts[1] || "");
    const isTest = String(parts[2] || "") === TEST_TAG;
    const offset = isTest ? 3 : 2;
    const laKey = String(parts[offset] || "");
    const idxOrTag = String(parts[offset + 1] ?? "");
    const idx = (!isTest && idxOrTag !== "" && /^-?\\d+$/.test(idxOrTag)) ? Number(idxOrTag) : NaN;
    const tag = isTest ? idxOrTag : "";
    return { prefix, type, test: isTest, laKey, idx, tag, raw, idxOrTag };
  };
  const extractLaKey = (id) => {
    const p = parse(id);
    const lk = p ? String(p.laKey || "") : "";
    return LAKEY_RE.test(lk) ? lk : "";
  };
  const hasManagedPrefix = (str) => {
    const s = String(str || "");
    for (const p of PREFIXES) {
      if (s.startsWith(p + ":")) return true;
    }
    return false;
  };
  const isManagedId = hasManagedPrefix;
  const isManagedThreadId = hasManagedPrefix;
const isTestId = (id) => {
    const p = parse(id);
    return !!(p && p.test);
  };
  const buildThread = (prefix, type, laKey, isTest=false) =>
    build(isTest ? [prefix, type, TEST_TAG, laKey] : [prefix, type, laKey]);
  const buildId = (prefix, type, laKey, idx, isTest=false) =>
    build(isTest ? [prefix, type, TEST_TAG, laKey, idx] : [prefix, type, laKey, idx]);
  const buildTestId = (prefix, type, laKey, tag) =>
    build([prefix, type, TEST_TAG, laKey, tag]);
  return {
    build,
    parse,
    extractLaKey,
    isManagedId,
    isManagedThreadId,
    isTestId,
    LAKEY_RE,
    PREFIXES,
    TEST_TAG,
    buildThread,
    buildId,
    buildTestId,
  };
})();
const extractNotiTriggerDate = (n) => {
  const t = n?.nextTriggerDate || n?.triggerDate || n?.scheduledDate || n?.deliveryDate;
  return isValidDate(t ? new Date(t) : null) ? new Date(t) : null;
};
const KEYCHAIN_KEY = "SKY_SHARDS_SETTINGS";
const CACHE_KEY = "SKY_NOTI_CACHE";
const RUNSTATE_KEY_PROD = "SKY_NOTIFY_RUNSTATE";
const RUNSTATE_KEY_TEST = "SKY_NOTIFY_RUNSTATE_TEST";
const STORAGE_DIRNAME = "HajimeSkyTools/star-reminder/data";
const PREVIOUS_STORAGE_DIRNAME = "SkyReminder/data";
const LEGACY_STORAGE_DIRNAME = "SkyReminderData";
const DEFAULT_SETTINGS = {
  theme: "dark",
  useCache: true,
  imageAutoFetchEnabled: true,
  openSkyEnabled: true,
  backupStorageMode: "iCloud",
  githubUpdate: {
    policy: "daily",
    remoteManifestUrl: "https://raw.githubusercontent.com/Hajime-Sky/Sky-source/main/SkyReminderModules/manifest.json",
    lastCheckedAtMs: 0,
    lastUpdatedAtMs: 0,
    lastUpdateStatus: "",
  },
  presetName: "custom",
  localOffsetAuto: true,
  localOffset: 9,
  viewMode: "timeline",
  layoutMode: "signal",
  testMode: false,
  testOffsetMs: 0,
  eventOrder: ["updateTime", "uni", "pan", "turtle", "race", "originalSin", "shards", "dye"],
  shardNotify: { enabled: true, redEnabled: true, blackEnabled: false },
  shardTap: { moveOffsetMin: 0, taskDurationMin: 10, bufferMin: 3 },
  notify: {
    updateTime: { enabled: false, bufferMin: 3, title: "⏰ 更新時刻" },
    dye: { enabled: false, moveOffsetMin: 0, taskDurationMin: 15, bufferMin: 5, dailyLimit: 0, intervalHours: 1, title: "🎨 染料" },
    uni: { enabled: false, moveOffsetMin: 3, taskDurationMin: 10, bufferMin: 3, dailyLimit: 3, minute: 5, evenPst: true, title: "🦔 ウニ" },
    pan: { enabled: true, moveOffsetMin: 2, taskDurationMin: 8, bufferMin: 3, dailyLimit: 2, minute: 35, evenPst: true, title: "🍞 パン", forestTreasureEnabled: true, forestTreasureDurationMin: 10, forestDailyEnabled: true, forestDailyDurationMin: 10, treasureRealmOverride: null, dailyRealmOverride: null },
    turtle: { enabled: false, moveOffsetMin: 3, taskDurationMin: 7, bufferMin: 3, dailyLimit: 1, minute: 50, evenPst: true, title: "🐢 亀" },
    race: { enabled: false, moveOffsetMin: 5, taskDurationMin: 10, bufferMin: 3, dailyLimit: 1, minute: 0, evenPst: false, title: "🏁 レース" },
    originalSin: {
      enabled: false,
      title: "⚖️ 原罪",
      fixedEnabled: true,
      fixedTimes: [{ hour: 20, minute: 0 }],
      sinceResetEnabled: false,
      sinceResetTimes: [{ minutesAfterReset: 180 }],
      idleWindowEnabled: false,
      taskDurationMin: 60,
      repeatEveryMin: 180,
      searchStartHour: 18,
      searchStartMinute: 0,
    },
  },
};
const SETTINGS_PRESETS = Object.freeze({
  standard: Object.freeze({
    label: "標準",
    patch: {
      shardNotify: JSON.parse(JSON.stringify(DEFAULT_SETTINGS.shardNotify)),
      notify: JSON.parse(JSON.stringify(DEFAULT_SETTINGS.notify)),
    },
  }),
  minimum: Object.freeze({
    label: "最低限",
    patch: {
      shardNotify: { enabled: true, redEnabled: true, blackEnabled: true },
      notify: {
        updateTime: { enabled: true },
        dye: { enabled: false },
        uni: { enabled: false },
        pan: { enabled: false },
        turtle: { enabled: false },
        race: { enabled: false },
        originalSin: { enabled: false, fixedEnabled: false, sinceResetEnabled: false, idleWindowEnabled: false },
      },
    },
  }),
  farm: Object.freeze({
    label: "周回重視",
    patch: {
      shardNotify: { enabled: true, redEnabled: true, blackEnabled: true },
      notify: {
        updateTime: { enabled: false },
        dye: { enabled: true },
        uni: { enabled: true },
        pan: { enabled: true },
        turtle: { enabled: true },
        race: { enabled: true },
        originalSin: { enabled: false, fixedEnabled: false, sinceResetEnabled: false, idleWindowEnabled: false },
      },
    },
  }),
  originalsin: Object.freeze({
    label: "原罪重視",
    patch: {
      shardNotify: { enabled: true, redEnabled: true, blackEnabled: true },
      notify: {
        updateTime: { enabled: false },
        dye: { enabled: false },
        uni: { enabled: false },
        pan: { enabled: true },
        turtle: { enabled: false },
        race: { enabled: false },
        originalSin: { enabled: true, fixedEnabled: false, sinceResetEnabled: false, idleWindowEnabled: true, taskDurationMin: 60, repeatEveryMin: 180, searchStartHour: 18, searchStartMinute: 0 },
      },
    },
  }),
});
function applySettingsPreset(baseSettings, presetKey) {
  const key = String(presetKey || '').trim();
  const preset = SETTINGS_PRESETS[key];
  const st = normalizeSettings(baseSettings || loadSettings());
  if (!preset) return st;
  const next = normalizeSettings(JSON.parse(JSON.stringify(st)));
  if (preset.patch && typeof preset.patch === 'object') {
    if (preset.patch.shardNotify) next.shardNotify = { ...next.shardNotify, ...preset.patch.shardNotify };
    if (preset.patch.notify) {
      for (const tp of Object.keys(preset.patch.notify)) {
        next.notify[tp] = { ...(next.notify[tp] || {}), ...(preset.patch.notify[tp] || {}) };
      }
    }
  }
  next.presetName = key;
  return normalizeSettings(next);
}
function normalizeOriginalSinFixedTimes(list) {
  const arr = Array.isArray(list) ? list : [];
  return arr.slice(0, 10).map(item => {
    const rawHour = item?.hour ?? item?.h;
    const rawMinute = item?.minute ?? item?.m;
    const hasHour = rawHour != null && String(rawHour) !== "";
    const hasMinute = rawMinute != null && String(rawMinute) !== "";
    if (!hasHour || !hasMinute) return { hour: null, minute: null };
    const hour = Math.max(0, Math.min(23, Math.round(Number(rawHour) || 0)));
    const minute = Math.max(0, Math.min(59, Math.round(Number(rawMinute) || 0)));
    return { hour, minute };
  });
}
function normalizeOriginalSinSinceResetTimes(list) {
  const arr = Array.isArray(list) ? list : [];
  return arr.slice(0, 10).map(item => {
    const totalMinutesRaw = item?.minutesAfterReset ?? item?.afterResetMinutes;
    const hasTotal = totalMinutesRaw != null && String(totalMinutesRaw) !== "";
    if (!hasTotal) {
      const legacyHour = item?.hoursAfterReset ?? item?.hours;
      const legacyMinute = item?.minutesAfterResetPart ?? item?.minutes;
      const hasLegacyHour = legacyHour != null && String(legacyHour) !== "";
      const hasLegacyMinute = legacyMinute != null && String(legacyMinute) !== "";
      if (!hasLegacyHour && !hasLegacyMinute) return { minutesAfterReset: null };
      const totalMinutes = ((Math.round(Number(legacyHour) || 0) * 60) + Math.round(Number(legacyMinute) || 0));
      return { minutesAfterReset: Math.max(0, Math.min(4320, totalMinutes)) };
    }
    const totalMinutes = Math.round(Number(totalMinutesRaw) || 0);
    return { minutesAfterReset: Math.max(0, Math.min(4320, totalMinutes)) };
  });
}
function normalizeOriginalSinConfig(cfg) {
  const base = DEFAULT_SETTINGS.notify.originalSin;
  const out = { ...base, ...(isPlainObject(cfg) ? cfg : {}) };
  out.fixedEnabled = out.fixedEnabled !== false;
  out.sinceResetEnabled = !!out.sinceResetEnabled;
  out.idleWindowEnabled = !!out.idleWindowEnabled;
  out.fixedTimes = Array.isArray(out.fixedTimes)
    ? normalizeOriginalSinFixedTimes(out.fixedTimes)
    : normalizeOriginalSinFixedTimes(base.fixedTimes);
  out.sinceResetTimes = Array.isArray(out.sinceResetTimes)
    ? normalizeOriginalSinSinceResetTimes(out.sinceResetTimes)
    : normalizeOriginalSinSinceResetTimes(base.sinceResetTimes);
  out.taskDurationMin = Math.max(1, Math.min(360, Math.round(Number(out.taskDurationMin ?? base.taskDurationMin) || base.taskDurationMin)));
  out.repeatEveryMin = Math.max(5, Math.min(720, Math.round(Number(out.repeatEveryMin ?? base.repeatEveryMin) || base.repeatEveryMin)));
  out.searchStartHour = Math.max(0, Math.min(23, Math.round(Number(out.searchStartHour ?? base.searchStartHour) || base.searchStartHour)));
  out.searchStartMinute = Math.max(0, Math.min(59, Math.round(Number(out.searchStartMinute ?? base.searchStartMinute) || base.searchStartMinute)));
  return out;
}
function normalizeSettings(st) {
  const base = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  if (!isPlainObject(st)) return base;
  const out = { ...base, ...st };
  out.testMode = !!(typeof st.testMode === "boolean" ? st.testMode : st?.testMode?.enabled);
  if (Number.isFinite(Number(st?.testOffsetMs))) out.testOffsetMs = Number(st.testOffsetMs);
  else if (isPlainObject(st?.testMode) && Number.isFinite(Number(st.testMode.testBase)) && Number.isFinite(Number(st.testMode.realBase))) out.testOffsetMs = Number(st.testMode.testBase) - Number(st.testMode.realBase);
  else out.testOffsetMs = 0;
  out.shardNotify = { ...base.shardNotify, ...(isPlainObject(st.shardNotify) ? st.shardNotify : {}) };
  out.shardTap = { ...base.shardTap, ...(isPlainObject(st.shardTap) ? st.shardTap : {}) };
  out.notify = { ...base.notify };
  for (const k of Object.keys(base.notify)) out.notify[k] = { ...base.notify[k], ...(isPlainObject(st?.notify?.[k]) ? st.notify[k] : {}) };
  const githubUpdate = isPlainObject(st.githubUpdate) ? st.githubUpdate : {};
  out.githubUpdate = { ...base.githubUpdate, ...githubUpdate };
  if (!["none", "daily", "always"].includes(String(out.githubUpdate.policy || ""))) out.githubUpdate.policy = base.githubUpdate.policy;
  out.githubUpdate.remoteManifestUrl = String(out.githubUpdate.remoteManifestUrl || base.githubUpdate.remoteManifestUrl).trim();
  out.githubUpdate.lastCheckedAtMs = Math.max(0, Number(out.githubUpdate.lastCheckedAtMs || 0) || 0);
  out.githubUpdate.lastUpdatedAtMs = Math.max(0, Number(out.githubUpdate.lastUpdatedAtMs || 0) || 0);
  out.githubUpdate.lastUpdateStatus = String(out.githubUpdate.lastUpdateStatus || "");
  if (out.notify?.dye) out.notify.dye.intervalHours = normalizeDyeIntervalHours(out.notify.dye.intervalHours);
  if (out.notify?.originalSin) out.notify.originalSin = normalizeOriginalSinConfig(out.notify.originalSin);
  out.backupStorageMode = String(st?.backupStorageMode || base.backupStorageMode) === "local" ? "local" : "iCloud";
  out.presetName = String(st?.presetName || base.presetName || "custom");
  if (!Array.isArray(out.eventOrder) || !out.eventOrder.length) out.eventOrder = base.eventOrder.slice();
  return out;
}
function normalizeRunState(rs) {
  return isPlainObject(rs) ? rs : {};
}
function normalizeDisabledList(list) {
  return Array.isArray(list) ? list : [];
}
function getStorageFileManager() {
  return FileManager.iCloud();
}
function getStorageDir(fm = getStorageFileManager()) {
  const dir = fm.joinPath(fm.documentsDirectory(), STORAGE_DIRNAME);
  if (!fm.fileExists(dir)) fm.createDirectory(dir, true);
  return dir;
}
function getStoragePath(key, fm = getStorageFileManager()) {
  const safe = encodeURIComponent(String(key || "")).replace(/%/g, "_");
  return fm.joinPath(getStorageDir(fm), `${safe}.json`);
}
function getLegacyStoragePath(key, fm = getStorageFileManager()) {
  const safe = encodeURIComponent(String(key || "")).replace(/%/g, "_");
  const dir = fm.joinPath(fm.documentsDirectory(), LEGACY_STORAGE_DIRNAME);
  return fm.joinPath(dir, `${safe}.json`);
}
function getPreviousStoragePath(key, fm = getStorageFileManager()) {
  const safe = encodeURIComponent(String(key || "")).replace(/%/g, "_");
  const dir = fm.joinPath(fm.documentsDirectory(), PREVIOUS_STORAGE_DIRNAME);
  return fm.joinPath(dir, `${safe}.json`);
}
function readStoredRawValue(key) {
  const k = String(key || "");
  if (!k) return null;
  try {
    const fm = getStorageFileManager();
    const paths = [getStoragePath(k, fm), getPreviousStoragePath(k, fm), getLegacyStoragePath(k, fm)];
    for (const path of paths) {
      if (!fm.fileExists(path)) continue;
      try {
        if (typeof fm.isFileDownloaded === "function" && !fm.isFileDownloaded(path)) {
          fm.downloadFileFromiCloud(path);
        }
      } catch (_) {}
      return fm.readString(path);
    }
  } catch (e) {
    try { console.error(`readStoredRawValue file error: ${k}`, e); } catch (_) {}
  }
  try {
    if (Keychain.contains(k)) {
      const raw = Keychain.get(k);
      try { writeStoredRawValue(k, raw); } catch (_) {}
      return raw;
    }
  } catch (_) {}
  return null;
}
function writeStoredRawValue(key, raw) {
  const k = String(key || "");
  if (!k) return;
  const fm = getStorageFileManager();
  fm.writeString(getStoragePath(k, fm), String(raw));
}
function removeStoredRawValue(key) {
  const k = String(key || "");
  if (!k) return false;
  let removed = false;
  try {
    const fm = getStorageFileManager();
    for (const path of [getStoragePath(k, fm), getPreviousStoragePath(k, fm), getLegacyStoragePath(k, fm)]) {
      if (fm.fileExists(path)) {
        fm.remove(path);
        removed = true;
      }
    }
  } catch (e) {
    try { console.error(`removeStoredRawValue file error: ${k}`, e); } catch (_) {}
  }
  try {
    if (Keychain.contains(k)) {
      Keychain.remove(k);
      removed = true;
    }
  } catch (_) {}
  return removed;
}
const Store = {
  _cache: Object.create(null),
  _clone(v) {
    try { return JSON.parse(JSON.stringify(v)); } catch (_) { return v; }
  },
  clear(key) {
    delete this._cache[String(key || "")];
  },
  load(key, defVal, normFn) {
    const k = String(key || "");
    if (Object.prototype.hasOwnProperty.call(this._cache, k)) return this._cache[k];
    let stored = null;
    try {
      const raw = readStoredRawValue(k);
      if (raw !== null && raw !== undefined) stored = JSON.parse(raw);
    } catch (_) {}
    if (stored === null || stored === undefined) {
      stored = this._clone(defVal);
      try { writeStoredRawValue(k, JSON.stringify(stored)); } catch (_) {}
    }
    const finalVal = (typeof normFn === "function") ? normFn(stored) : stored;
    this._cache[k] = finalVal;
    return finalVal;
  },
  save(key, val, normFn) {
    const k = String(key || "");
    const finalVal = (typeof normFn === "function") ? normFn(val) : val;
    this._cache[k] = finalVal;
    try { writeStoredRawValue(k, JSON.stringify(finalVal)); } catch (_) {}
    return finalVal;
  },
};
function _reviveDates(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(obj)) return new Date(obj);
  if (Array.isArray(obj)) return obj.map(_reviveDates);
  if (typeof obj === "object") {
    const out = {};
    for (const k of Object.keys(obj)) out[k] = _reviveDates(obj[k]);
    return out;
  }
  return obj;
}
const CONSTELLATION_REALMS = Object.freeze(["草原", "雨林", "峡谷", "捨て地", "書庫"]);
const CONSTELLATION_IMAGE_REV = 2;
const CONSTELLATION_THEME_ALPHA = { dark: 0.30, light: 0.36 };
const CONSTELLATION_REALM_RGB = Object.freeze({
  "草原": [54, 149, 66],
  "雨林": [72, 150, 184],
  "峡谷": [201, 122, 6],
  "捨て地": [105, 146, 67],
  "書庫": [8, 112, 198]
});
function getImagesDir(fm = getStorageFileManager()) {
  const baseDir = fm.joinPath(fm.documentsDirectory(), STORAGE_DIRNAME);
  if (!fm.fileExists(baseDir)) fm.createDirectory(baseDir, true);
  const dir = fm.joinPath(baseDir, "images");
  if (!fm.fileExists(dir)) fm.createDirectory(dir, true);
  return dir;
}
function getConstellationImagePath(realm, theme = "dark", fm = getStorageFileManager()) {
  const normalizedRealm = String(realm || "").trim();
  const themeKey = theme === "light" ? "light" : "dark";
  return fm.joinPath(getImagesDir(fm), `${normalizedRealm}__${themeKey}__r${CONSTELLATION_IMAGE_REV}.png`);
}
function getConstellationImageUrl(realm) {
  return `https://Hajime-Sky.github.io/Sky-source/constellations/${encodeURIComponent(String(realm || "").trim())}.png`;
}
async function downloadConstellationImage(realm, fm = getStorageFileManager()) {
  const normalizedRealm = String(realm || "").trim();
  if (!normalizedRealm) throw new Error("realm_required");
  const req = new Request(getConstellationImageUrl(normalizedRealm));
  req.timeoutInterval = 30;
  const rawData = await req.load();
  if (!rawData) throw new Error(`image_empty:${normalizedRealm}`);
  const base64Src = rawData.toBase64String();
  const wv = new WebView();
  await wv.loadHTML(`<html><body style="margin:0;background:transparent;"></body></html>`);
  const dataUrl = await wv.evaluateJavaScript(`
    try {
      const img = new Image();
      img.onload = () => {
        try {
          const makeVariant = (rgb, alphaMul) => {
            const c = document.createElement("canvas");
            c.width = img.width;
            c.height = img.height;
            const ctx = c.getContext("2d");
            ctx.drawImage(img, 0, 0);
            const imgData = ctx.getImageData(0, 0, c.width, c.height);
            const d = imgData.data;
            for (let i = 0; i < d.length; i += 4) {
              const lum = Math.max(d[i], d[i + 1], d[i + 2]);
              d[i] = rgb[0];
              d[i + 1] = rgb[1];
              d[i + 2] = rgb[2];
              d[i + 3] = Math.max(0, Math.min(255, Math.floor(lum * alphaMul)));
            }
            ctx.putImageData(imgData, 0, 0);
            return c.toDataURL("image/png");
          };
          const tint = {
            "草原": ${JSON.stringify(CONSTELLATION_REALM_RGB["草原"])},
            "雨林": ${JSON.stringify(CONSTELLATION_REALM_RGB["雨林"])},
            "峡谷": ${JSON.stringify(CONSTELLATION_REALM_RGB["峡谷"])},
            "捨て地": ${JSON.stringify(CONSTELLATION_REALM_RGB["捨て地"])},
            "書庫": ${JSON.stringify(CONSTELLATION_REALM_RGB["書庫"])}
          }[${JSON.stringify(normalizedRealm)}];
          const rgb = Array.isArray(tint) ? tint : [196, 196, 196];
          const out = {
            dark: makeVariant(rgb, ${CONSTELLATION_THEME_ALPHA.dark}),
            light: makeVariant(rgb, ${CONSTELLATION_THEME_ALPHA.light})
          };
          completion(JSON.stringify(out));
        } catch (_) {
          completion(null);
        }
      };
      img.onerror = () => completion(null);
      img.src = "data:image/png;base64,${base64Src}";
    } catch (_) {
      completion(null);
    }
  `, true);
  if (!dataUrl) throw new Error(`image_alpha_convert_failed:${normalizedRealm}`);
  let parsed = null;
  try { parsed = JSON.parse(dataUrl); } catch (_) {}
  if (!parsed || !parsed.dark || !parsed.light) throw new Error(`Invalid rendered data:${normalizedRealm}`);
  const darkB64 = String(parsed.dark).split(",")[1];
  const lightB64 = String(parsed.light).split(",")[1];
  if (!darkB64 || !lightB64) throw new Error(`Invalid base64 payload:${normalizedRealm}`);
  fm.write(getConstellationImagePath(normalizedRealm, "dark", fm), Data.fromBase64String(darkB64));
  fm.write(getConstellationImagePath(normalizedRealm, "light", fm), Data.fromBase64String(lightB64));
}
async function syncAllConstellationImages(realms = CONSTELLATION_REALMS, fm = getStorageFileManager()) {
  const results = [];
  const targets = Array.isArray(realms) ? realms : CONSTELLATION_REALMS;
  for (const realm of targets) {
    try {
      await downloadConstellationImage(realm, fm);
      results.push({ realm, ok: true });
    } catch (e) {
      try { console.error(`Failed to sync constellation image: ${realm} / ${e}`); } catch (_) {}
      results.push({ realm, ok: false, error: String(e || "") });
    }
  }
  return results;
}
function getCachedConstellationImage(realm, theme = "dark", fm = getStorageFileManager()) {
  const normalizedRealm = String(realm || "").trim();
  if (!normalizedRealm) return null;
  const path = getConstellationImagePath(normalizedRealm, theme, fm);
  if (!fm.fileExists(path)) return null;
  try { return fm.readImage(path); } catch (_) { return null; }
}
function hasConstellationImagePair(realm, fm = getStorageFileManager()) {
  const normalizedRealm = String(realm || "").trim();
  return fm.fileExists(getConstellationImagePath(normalizedRealm, "dark", fm)) &&
         fm.fileExists(getConstellationImagePath(normalizedRealm, "light", fm));
}
async function ensureConstellationImages(realms = CONSTELLATION_REALMS, fm = getStorageFileManager()) {
  const targets = Array.isArray(realms) ? realms : CONSTELLATION_REALMS;
  let needsSync = false;
  for (const realm of targets) {
    if (!hasConstellationImagePair(realm, fm)) {
      needsSync = true;
      break;
    }
  }
  if (needsSync) await syncAllConstellationImages(targets, fm);
}
function drawSignalBackgroundImage(ctx, realm, cx, cy, rad, palette) {
  if (!ctx || !realm) return false;
  const themeKey = palette && palette.isDark ? "dark" : "light";
  const img = getCachedConstellationImage(realm, themeKey);
  if (!img) return false;
  const rect = new Rect(cx - rad, cy - rad, rad * 2, rad * 2);
  try { ctx.drawImageInRect(img, rect); } catch (e) {
    try { console.error(`Failed to draw constellation image: ${realm} / ${e}`); } catch (_) {}
    return false;
  }
  return true;
}
function getConstellationBgRadius(W, H, y0 = 0) {
  const safeW = Math.max(0, Number(W) || 0);
  const safeH = Math.max(0, Number(H) || 0);
  return Math.min(safeW, safeH) * 0.45;
}
const CacheManager = {
  load: () => Store.load(CACHE_KEY, {}),
  save: (data) => Store.save(CACHE_KEY, data),
  clear: () => {
    Store.clear(CACHE_KEY);
    removeStoredRawValue(CACHE_KEY);
  },
  clearByPrefix: (prefix) => {
    const keyPrefix = String(prefix || "");
    if (!keyPrefix) return 0;
    const current = CacheManager.load();
    const next = (current && typeof current === 'object' && !Array.isArray(current)) ? { ...current } : {};
    let removed = 0;
    for (const k of Object.keys(next)) {
      if (String(k).startsWith(keyPrefix)) {
        delete next[k];
        removed += 1;
      }
    }
    if (removed > 0) CacheManager.save(next);
    return removed;
  },
  getValidCache: (st, key, now) => {
    if (st.useCache === false) return null;
    const c = CacheManager.load();
    const entry = c[key];
    if (!entry) return null;
    const ahead = getLocalAheadState(now, st);
    if (entry.baseZeroGameNow !== ahead.baseZeroGameNow ||
        entry.isLocalAheadOfGame !== ahead.isLocalAheadOfGame ||
        entry.localOffset !== st.localOffset ||
        !!entry.testMode !== !!st.testMode ||
        entry.testOffsetMs !== st.testOffsetMs) return null;
    return _reviveDates(entry.data);
  },
  setCache: (st, key, now, data) => {
    if (st.useCache === false) return;
    const c = CacheManager.load();
    const ahead = getLocalAheadState(now, st);
    c[key] = {
      timestamp: Date.now(),
      baseZeroGameNow: ahead.baseZeroGameNow,
      isLocalAheadOfGame: ahead.isLocalAheadOfGame,
      localOffset: st.localOffset,
      testMode: !!st.testMode,
      testOffsetMs: st.testOffsetMs,
      data: JSON.parse(JSON.stringify(data))
    };
    CacheManager.save(c);
  }
};
const BACKUP_PREFIX = "SKY_BACKUP_";
function _backupKeychainValue(srcKey, dstKey) {
  try {
    const raw = readStoredRawValue(srcKey);
    if (raw !== null && raw !== undefined) {
      writeStoredRawValue(dstKey, raw);
    } else {
      removeStoredRawValue(dstKey);
    }
  } catch (_) {}
}
function _restoreKeychainValue(srcKey, dstKey) {
  try {
    const raw = readStoredRawValue(srcKey);
    if (raw !== null && raw !== undefined) {
      writeStoredRawValue(dstKey, raw);
      removeStoredRawValue(srcKey);
    }
  } catch (_) {}
}
function _clearStoredKey(key) {
  try { removeStoredRawValue(key); } catch (_) {}
  try { Store.clear(key); } catch (_) {}
}
function getReferenceTimeMs(baseTime = null) {
  if (baseTime instanceof Date) return baseTime.getTime();
  if (baseTime === null || typeof baseTime === "undefined" || baseTime === "") return Date.now();
  const n = Number(baseTime);
  return Number.isFinite(n) ? n : Date.now();
}
function getReferenceDate(baseTime = null) {
  return new Date(getReferenceTimeMs(baseTime));
}
function getEffectiveNowFromRef(baseTime = null, settings = null) {
  return getEffectiveNow(getReferenceDate(baseTime), settings || loadSettings());
}
function getDayContext(baseTime = null, settings = null) {
  const st = settings || loadSettings();
  const effectiveNow = getEffectiveNowFromRef(baseTime, st);
  return { settings: st, effectiveNow, laKey: fmtLaKey(effectiveNow) };
}
function getTodayNextLaKeysForRef(baseTime = null, settings = null) {
  const st = settings || loadSettings();
  const effectiveNow = getEffectiveNowFromRef(baseTime, st);
  const laKeyToday = fmtLaKey(effectiveNow);
  const noonToday = laNoonDateFromKey(laKeyToday);
  const laKeyNext = noonToday ? fmtLaKey(new Date(noonToday.getTime() + MS_PER_DAY)) : fmtLaKey(new Date(effectiveNow.getTime() + MS_PER_DAY));
  return normalizeLaKeyArray([laKeyToday, laKeyNext]);
}
function resetTypeScheduleState(rs, laKeys, type, settings = null) {
  const st = settings || loadSettings();
  const list = normalizeLaKeyArray(laKeys);
  for (const laKey of list) {
    const day = getDayState(rs, laKey, st);
    const ts = ensureTypeState(day, type);
    ts.pendingIds = [];
    ts.notifiedIds = [];
  }
  return rs;
}
function normalizeDyeIntervalHours(v) {
  return Number(v) === 2 ? 2 : 1;
}
function normalizeLaKeyArray(values) {
  const arr = Array.isArray(values) ? values : [values];
  return Array.from(new Set(arr.filter(isLaKey).map(v => String(v))));
}
function resolveOperateLaKey(candidateLaKey = null, baseTime = null, settings = null) {
  if (isLaKey(candidateLaKey)) return String(candidateLaKey);
  return getDayContext(baseTime, settings).laKey;
}
function mergeManagedNotificationLists(primary, fallback) {
  const seen = new Set();
  return [...(primary || []), ...(fallback || [])].filter(n => {
    const id = String(n?.id || n?.identifier || '');
    if (!NOTI_ID.isManagedId(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
function buildSyncOptions(targetType = null, anchorLaKeys = [], extra = null) {
  const out = { targetType: targetType || null, anchorLaKeys: normalizeLaKeyArray(anchorLaKeys) };
  if (extra && typeof extra === 'object') Object.assign(out, extra);
  return out;
}
function clearScheduleCacheByType(type) {
  const tp = String(type || '').trim();
  if (!tp) return 0;
  return CacheManager.clearByPrefix(`sched:${tp}:`);
}
function resetTypeScheduleStateAllDays(rs, type, settings = null, extraLaKeys = []) {
  const st = settings || loadSettings();
  const knownLaKeys = Array.from(new Set([
    ...Object.keys(rs || {}).filter(isLaKey).map(String),
    ...normalizeLaKeyArray(extraLaKeys),
  ]));
  return resetTypeScheduleState(rs, knownLaKeys, type, st);
}
function resetTypePendingState(rs, laKeys, type, settings = null) {
  const st = settings || loadSettings();
  const list = normalizeLaKeyArray(laKeys);
  for (const laKey of list) {
    const day = getDayState(rs, laKey, st);
    const ts = ensureTypeState(day, type);
    ts.pendingIds = [];
  }
  return rs;
}
function resetTypePendingStateAllDays(rs, type, settings = null, extraLaKeys = []) {
  const st = settings || loadSettings();
  const knownLaKeys = Array.from(new Set([
    ...Object.keys(rs || {}).filter(isLaKey).map(String),
    ...normalizeLaKeyArray(extraLaKeys),
  ]));
  return resetTypePendingState(rs, knownLaKeys, type, st);
}
async function cancelPendingNotificationsByType(type, settings = null) {
  const tp = String(type || '').trim();
  if (!tp) return [];
  const st = settings || loadSettings();
  const pending = await fetchAllPendingSafe();
  const ids = (pending || [])
    .map(n => String(n?.identifier || ''))
    .filter(Boolean)
    .filter(id => String(NOTI_ID.parse(id)?.type || '') === tp);
  if (!ids.length) return [];
  const removed = await removePendingIds(ids, pending);
  if (removed?.length) {
    const rs = loadRunState(st);
    removeIdsFromRunState(rs, removed, st);
    saveRunState(rs, st);
  }
  return removed || [];
}
function safeRemoveKeychainKey(key, logErrors = true) {
  if (!key) return false;
  try {
    return removeStoredRawValue(key);
  } catch (e) {
    if (logErrors) console.error(e);
    return false;
  }
}
function getManagedPendingIds(pending) {
  return (pending || []).map(n => String(n?.identifier || "")).filter(id => NOTI_ID.isManagedId(id));
}
async function fetchManagedPendingContext() {
  const pending = await fetchAllPendingSafe();
  const managedIds = getManagedPendingIds(pending);
  return { pending, managedIds };
}
function loadSettings() { return Store.load(KEYCHAIN_KEY, DEFAULT_SETTINGS, normalizeSettings); }
function saveSettings(newSettings) {
  const snapSettings = Store.load(KEYCHAIN_KEY, DEFAULT_SETTINGS, normalizeSettings);
  let snapRunStateProd = null;
  let snapDisabledProd = null;
  try { snapRunStateProd = readStoredRawValue(RUNSTATE_KEY_PROD); } catch (_) {}
  try { snapDisabledProd = readStoredRawValue(DISABLED_NOTI_KEY_PROD); } catch (_) {}
  try {
    Store.save(KEYCHAIN_KEY, newSettings, normalizeSettings);
    return normalizeSettings(newSettings);
  } catch (e) {
    console.error("Transaction failed during saveSettings. Rolling back.", e);
    try {
      Store.save(KEYCHAIN_KEY, snapSettings, normalizeSettings);
      if (snapRunStateProd !== null) writeStoredRawValue(RUNSTATE_KEY_PROD, snapRunStateProd);
      if (snapDisabledProd !== null) writeStoredRawValue(DISABLED_NOTI_KEY_PROD, snapDisabledProd);
    } catch (rbError) {
      console.error("Rollback also failed. System may be in inconsistent state.", rbError);
    }
    throw e;
  }
}
const DISABLED_NOTI_KEY_PROD = "SKY_NOTI_DISABLED";
const DISABLED_NOTI_KEY_TEST = "SKY_NOTI_DISABLED_TEST";
const getRunStateKey = (st) => (st && st.testMode) ? RUNSTATE_KEY_TEST : RUNSTATE_KEY_PROD;
function getDisabledNotiKey(st) {
  return (st && st.testMode) ? DISABLED_NOTI_KEY_TEST : DISABLED_NOTI_KEY_PROD;
}
function loadDisabledList(st) {
  try {
    const k = getDisabledNotiKey(st || loadSettings());
    const raw = readStoredRawValue(k);
    if (raw !== null && raw !== undefined) return normalizeDisabledList(JSON.parse(raw) || []);
  } catch (e) { console.error("loadDisabledList error:", e); }
  return [];
}
function saveDisabledList(list, st, baseTime = null) {
  try {
    const k = getDisabledNotiKey(st || loadSettings());
    const nowMs = getReferenceTimeMs(baseTime);
    const filtered = (Array.isArray(list) ? list : []).filter(x => Number(x?.ts || 0) > nowMs - 3 * MS_PER_DAY);
    const normalized = normalizeDisabledList(filtered);
    writeStoredRawValue(k, JSON.stringify(normalized));
    return normalized;
  } catch (e) { console.error("saveDisabledList error:", e); }
  return [];
}
function loadRunState(st) {
  const key = getRunStateKey(st || loadSettings());
  const rs = Store.load(key, {}, normalizeRunState);
  return rs;
}
function reloadRunState(st) {
  const key = getRunStateKey(st || loadSettings());
  Store.clear(key);
  return Store.load(key, {}, normalizeRunState);
}
function saveRunState(rs, st) {
  const settings = st || loadSettings();
  const key = getRunStateKey(settings);
  const finalVal = normalizeRunState(rs);
  Store._cache[key] = finalVal;
  try { writeStoredRawValue(key, JSON.stringify(finalVal)); } catch (e) { console.error(`saveRunState failed: ${key}`, e); throw e; }
  Store.clear(key);
  const loaded = Store.load(key, {}, normalizeRunState);
  return loaded;
}
