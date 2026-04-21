const INPUT_SAVE_POLICY = Object.freeze({
  immediatePaths: Object.freeze([
    "viewMode", "layoutMode", "theme", "useCache",
    "localOffsetAuto", "testMode",
    "testSignal.redEnabled", "testSignal.blackEnabled",
    "notify.dye.intervalHours",
    "notify.pan.forestTreasureEnabled",
    "notify.pan.forestDailyEnabled",
  ]),
  debouncePaths: Object.freeze([
    "localOffset", "testOffsetMs",
    "redReminderOffsetMin", "blackReminderOffsetMin",
    "redDurationMin", "blackDurationMin",
  ]),
  explicitPaths: Object.freeze([
    "notify.pan.treasureRealmOverride",
    "notify.pan.dailyRealmOverride",
  ]),
});
const ARCHITECTURE_POLICY = Object.freeze({
  entrySsot: Object.freeze({
    managed: Object.freeze([
      "save", "setcount", "resetday",
      "notif-enable", "notif-enable-all", "notif-disable", "notif-dis-all",
      "deletekeychain", "deleteallkeychain", "clearcache", "deleteimages", "dyecomplete"
    ]),
    readOnly: Object.freeze(["keychain", "keychaincopy", "notif-list"]),
    unresolved: Object.freeze(["trigger routing still handler-based; not all state changes are funneled through a single declarative command schema"]),
  }),
  dataBoundary: Object.freeze([
    Object.freeze({ key: "settings", policy: "shared", note: "test/prod share UI settings and offsets" }),
    Object.freeze({ key: "runstate", policy: "split", note: "resolved via getRunStateKey(testMode)" }),
    Object.freeze({ key: "disabled", policy: "split", note: "resolved via getDisabledNotiKey(testMode)" }),
    Object.freeze({ key: "CACHE_KEY", policy: "shared-volatile", note: "shared transient cache; cleared on destructive cache operations" }),
    Object.freeze({ key: "constellationImages", policy: "shared-asset", note: "theme-specific image assets are shared across modes" }),
  ]),
  uiInjectionPaths: Object.freeze([
    Object.freeze({ path: "safeEvalJsWithGen -> updateCountUI", guarded: true }),
    Object.freeze({ path: "safeEvalJsWithGen -> updateGridUI", guarded: true }),
    Object.freeze({ path: "safeEvalJsWithGen -> persistSettingsAndSyncUI", guarded: true }),
    Object.freeze({ path: "safeEvalJsWithGen -> pushManageNotifications", guarded: true }),
    Object.freeze({ path: "safeEvalJsWithGen -> KEYCHAIN", guarded: true }),
    Object.freeze({ path: "wv.evaluateJavaScript -> pullPendingSettingsSafe", guarded: false }),
  ]),
});
function getInputSavePolicy(path, el) {
  const key = String(path || "").trim();
  if (INPUT_SAVE_POLICY.immediatePaths.includes(key)) return "immediate";
  if (INPUT_SAVE_POLICY.explicitPaths.includes(key)) return "explicit";
  if (INPUT_SAVE_POLICY.debouncePaths.includes(key)) return "debounce";
  if (el && (el.type === "checkbox" || el.type === "radio" || el.tagName === "SELECT")) return "immediate";
  return "debounce";
}
function buildArchitectureReview() {
  return {
    entrySsot: {
      currentState: "state-changing handlers are centralized through commitMutationAndSync except intentionally read-only actions",
      achieved: ARCHITECTURE_POLICY.entrySsot.managed,
      unresolved: ARCHITECTURE_POLICY.entrySsot.unresolved,
      codeLocations: ["commitMutationAndSync", "WEBVIEW_HANDLERS[save]", "WEBVIEW_HANDLERS[setcount]", "WEBVIEW_HANDLERS[resetday]", "WEBVIEW_HANDLERS[notif-*]", "WEBVIEW_HANDLERS[delete*]"],
    },
    atomicity: {
      currentState: "settings/runstate/disabled/cache snapshots are rolled back together before user feedback",
      achieved: ["settings", "runstate(prod/test)", "disabled(prod/test)", "CACHE_KEY"],
      unresolved: ["pending notification deletion and file-system side effects remain best-effort after commit"],
      codeLocations: ["commitMutationAndSync"],
    },
    timeSsot: {
      currentState: "mutation and preview refresh paths use transaction time helpers and reference-date wrappers",
      achieved: ["GLOBAL_REFERENCE_TIME_MS", "syncSchedulesAndManageUI", "updatePreviewCards", "setcount/resetday"],
      unresolved: ["some legacy utility helpers still accept external Date inputs"],
      codeLocations: ["GLOBAL_REFERENCE_TIME_MS", "getEffectiveNow", "scheduleAllEvents", "syncSchedulesAndManageUI"],
    },
    scriptableWebViewSync: {
      currentState: "generation-guarded UI injections are centralized around safeEvalJsWithGen with fallback manage-list hydration",
      achieved: ARCHITECTURE_POLICY.uiInjectionPaths.filter(x => x.guarded).map(x => x.path),
      unresolved: ARCHITECTURE_POLICY.uiInjectionPaths.filter(x => !x.guarded).map(x => x.path),
      codeLocations: ["safeEvalJsWithGen", "persistSettingsAndSyncUI", "pushManageNotifications", "KEYCHAIN"],
    },
    dataBoundary: {
      currentState: "settings shared; runstate/disabled split; caches documented separately",
      achieved: ARCHITECTURE_POLICY.dataBoundary,
      unresolved: ["shared-volatile caches still rely on operational policy rather than hard isolation"],
      codeLocations: ["getRunStateKey", "getDisabledNotiKey", "CacheManager", "getImagesDir"],
    },
    inputPolicy: {
      currentState: "save timing is path-aware before falling back to element-type heuristics",
      achieved: INPUT_SAVE_POLICY,
      unresolved: ["remaining field-specific policy tuning is still manual"],
      codeLocations: ["getInputSavePolicy", "handleSettingChange", "setLocalOffsetAuto", "save"],
    },
  };
}
function getEffectiveNow(baseDate, settings) {
  const actualNow = getReferenceDate(baseDate);
  const st = settings || loadSettings();
  if (st.testMode && Number.isFinite(Number(st.testOffsetMs))) {
    return new Date(actualNow.getTime() + Number(st.testOffsetMs));
  }
  return actualNow;
}
function getConfiguredEventTypes(settings) {
  const st = settings || loadSettings();
  const list = buildEventProviders(st);
  return list.map(x => x.type);
}
function getEventTypesForDay(settings, dayObj) {
  const base = getConfiguredEventTypes(settings);
  const out = base.slice();
  const seen = new Set(out);
  if (isPlainObject(dayObj)) {
    for (const k of Object.keys(dayObj)) {
      if (!k || seen.has(k)) continue;
      if (!isPlainObject(dayObj[k])) continue;
      out.push(k);
      seen.add(k);
    }
  }
  return out;
}
function ensureTypeState(day, type) {
  if (!isPlainObject(day[type])) day[type] = createEmptyTypeState();
  if (!Number.isFinite(day[type].count)) day[type].count = 0;
  if (!Array.isArray(day[type].pendingIds)) day[type].pendingIds = [];
  if (!Array.isArray(day[type].notifiedIds)) day[type].notifiedIds = [];
  if (type === "pan" && typeof day[type].forestTreasureDone !== "boolean") day[type].forestTreasureDone = false;
  if (type === "pan" && typeof day[type].forestDailyDone !== "boolean") day[type].forestDailyDone = false;
  if (type === "originalSin" && typeof day[type].weekDone !== "boolean") day[type].weekDone = false;
  return day[type];
}
function isLaKey(k) {
  return NOTI_ID.LAKEY_RE.test(String(k || "").trim());
}
function isValidRunState(rs) {
  return !!rs && typeof rs === "object" && !Array.isArray(rs);
}
const MUTEX_KEY = "SKY_NOTIFY_MUTEX";
function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function withMutex(fn, opts={}) {
  if (config.runsInWidget) return await fn();
  const _getLock = () => { try { return Keychain.contains(MUTEX_KEY) ? JSON.parse(Keychain.get(MUTEX_KEY) || "null") : null; } catch (_) { return null; } };
  const ttlMs = Number.isFinite(opts.ttlMs) ? opts.ttlMs : 7000;
  const waitMs = Number.isFinite(opts.waitMs) ? opts.waitMs : 6000;
  const token = String(Date.now()) + ":" + String(Math.random()).slice(2);
  const start = Date.now();
  while (true) {
    let lock = _getLock();
    const expired = !lock || !lock.expiresAt || (Number(lock.expiresAt) <= Date.now());
    if (expired) {
      try { Keychain.set(MUTEX_KEY, JSON.stringify({ token, expiresAt: Date.now() + ttlMs })); } catch (_) {}
      let check = _getLock();
      if (check && check.token === token) break;
    }
    if (Date.now() - start > waitMs) break; // give up; best-effort
    await _sleep(80);
  }
  try {
    return await fn();
  } finally {
    try {
      const cur = JSON.parse(Keychain.get(MUTEX_KEY) || "null");
      if (cur && cur.token === token) Keychain.remove(MUTEX_KEY);
    } catch (_) {}
  }
}
function getDayState(rs, laKey, settings) {
  if (!isPlainObject(rs)) rs = {};
  if (!isPlainObject(rs[laKey])) rs[laKey] = {};
  const day = rs[laKey];
  const types = getEventTypesForDay(settings, day);
  for (const t of types) ensureTypeState(day, t);
  return day;
}
async function resetNotificationState() {
  try {
    const pending = await Notification.allPending();
    for (const n of (pending || [])) {
      const id = n?.identifier || "";
      if (!id) continue;
try { Notification.removePending([id]); } catch (_) {}
    }
  } catch (_) {}
  safeRemoveKeychainKey(RUNSTATE_KEY_PROD, false)
  safeRemoveKeychainKey(RUNSTATE_KEY_TEST, false)
}
const _TZ_FMT_CACHE = Object.create(null);
const _STD_OFFSET_CACHE = Object.create(null);
function getVisualUTC(date, tz) {
  const d = (date instanceof Date) ? date : new Date(date);
  const z = String(tz || "UTC");
  let fmt = _TZ_FMT_CACHE[z];
  if (!fmt) {
    fmt = _TZ_FMT_CACHE[z] = new Intl.DateTimeFormat("en-US", {
      timeZone: z,
      hour12: false,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }
  const parts = fmt.formatToParts(d);
  const m = {};
  for (const p of parts) m[p.type] = p.value;
  const y  = parseInt(m.year  || "0", 10) || 0;
  const mo = parseInt(m.month || "0", 10) || 0;
  const da = parseInt(m.day   || "0", 10) || 0;
  const h  = parseInt(m.hour  || "0", 10) || 0;
  const mi = parseInt(m.minute|| "0", 10) || 0;
  const se = parseInt(m.second|| "0", 10) || 0;
  const visualUTC = Date.UTC(y, mo - 1, da, h, mi, se);
  return { y, mo, d: da, h, mi, se, weekday: m.weekday, visualUTC };
}
function tzOffsetMinutes(date, tz) {
  const d = (date instanceof Date) ? date : new Date(date);
  const p = getVisualUTC(d, tz);
  return Math.round((d.getTime() - p.visualUTC) / MS_PER_MIN);
}
function isDstAt(date, tz) {
  const d = (date instanceof Date) ? date : new Date(date);
  if (!isValidDate(d)) return false;
  const z = String(tz || "UTC");
  const y = Number(getVisualUTC(d, z).y || d.getUTCFullYear());
  const key = z + ":" + y;
  let std = _STD_OFFSET_CACHE[key];
  if (!Number.isFinite(std)) {
    const offA = tzOffsetMinutes(new Date(Date.UTC(y, 0, 15, 12, 0, 0)), z);
    const offB = tzOffsetMinutes(new Date(Date.UTC(y, 6, 15, 12, 0, 0)), z);
    std = Math.max(offA, offB);
    _STD_OFFSET_CACHE[key] = std;
  }
  const off = tzOffsetMinutes(d, z);
  return off !== std;
}
function laBaseZeroFromKey(laKey) {
  const noon = laNoonDateFromKey(laKey);
  if (!noon) return null;
  return getBaseZeroForTZ(noon, TZ_LA);
}
function addMs(d, ms) { return new Date(d.getTime() + ms); }
function getActConfig(settings, type) {
  const st = settings || loadSettings();
  const def = DEFAULT_SETTINGS.notify?.[type] || {};
  const raw = st?.notify?.[type] || def;
  const moveOffsetMin = Number.isFinite(Number(raw.moveOffsetMin)) ? Number(raw.moveOffsetMin) : Number(def.moveOffsetMin ?? 5);
  const taskDurationMin = Number.isFinite(Number(raw.taskDurationMin)) ? Number(raw.taskDurationMin) : Number(def.taskDurationMin ?? 10);
  const bufferMin = Number.isFinite(Number(raw.bufferMin)) ? Number(raw.bufferMin) : Number(def.bufferMin ?? 3);
  const out = { ...raw, moveOffsetMin, taskDurationMin, bufferMin };
  if (String(type || '').trim() === 'dye') out.intervalHours = normalizeDyeIntervalHours(out.intervalHours);
  return Object.freeze(out);
}
function computeTapWindow(baseStart, baseEnd, cfg) {
  const c = cfg || {};
  if (!isValidDate(baseStart) || !isValidDate(baseEnd)) return null;
  const moveOffsetMin = Number.isFinite(Number(c.moveOffsetMin)) ? Number(c.moveOffsetMin) : 0;
  const bufferMin = Number.isFinite(Number(c.bufferMin)) ? Number(c.bufferMin) : 3;
  const start = addMs(baseStart, -(moveOffsetMin + bufferMin) * MS_PER_MIN);
  const taskDurationMin = Number.isFinite(Number(c.taskDurationMin)) ? Number(c.taskDurationMin) : 10;
  const end = addMs(baseEnd, -(taskDurationMin + moveOffsetMin) * MS_PER_MIN);
  return { start, end };
}
function generateEventSchedules(type, now, laKey, settings) {
  const st = settings || loadSettings();
  const t = String(type || "").trim();
  const meta = EVENT_META_REGISTRY[t];
  if (!meta) return [];
  const cfg = meta.getConfig(st) || {};
  if (cfg.enabled === false) return [];
  const pack = meta.collect(laKey, st, cfg) || {};
  const items = Array.isArray(pack.items) ? pack.items : [];
  const title = String(pack.title || meta.fallbackTitle(st) || t);
  const out = [];
  for (let idx = 0; idx < items.length; idx++) {
    const o = items[idx];
    const slotIndex = Number.isFinite(Number(o?.slotIndex)) ? Number(o.slotIndex) : idx;
    if (!o || !isValidDate(o.start)) continue;
    const baseEnd = isValidDate(o.end) ? o.end : o.start;
    const taskDurationMin = Number.isFinite(Number(cfg.taskDurationMin)) ? Number(cfg.taskDurationMin) : 10;
    if (baseEnd.getTime() - o.start.getTime() < taskDurationMin * MS_PER_MIN) continue;
    const w = computeTapWindow(o.start, baseEnd, cfg);
    if (!w) continue;
    const notifyAt = w.start;
    if (w.end.getTime() < w.start.getTime()) continue;
    const body = (typeof meta.formatBody === "function")
      ? String(meta.formatBody({ occ: o, win: w, laKey, settings: st, cfg }) || "")
      : String(o.body || "");
    out.push({
      type: t,
      idx,
      id: NOTI_ID.buildId(meta.prefix, t, laKey, idx, !!st.testMode),
      title,
      body,
      notifyAt,
      realNotifyAt: notifyAt,
      tapWindowStart: w.start,
      tapWindowEnd: w.end,
      blockStart: notifyAt,
      blockEnd: baseEnd,
      openSkyOnTap: true,
    });
  }
  return out;
}
function tapWindowForStart(baseStart, baseEnd, cfg) {
  return computeTapWindow(baseStart, baseEnd, cfg);
}
function actNotifyTimeForStart(eventStart, eventEnd, cfg) {
  const win = computeTapWindow(eventStart, eventEnd, cfg);
  return win ? win.start : eventStart;
}
function generateUpdateTimeSchedules(now, laKey, settings) {
  const st = settings || loadSettings();
  const cfg = getActConfig(st, "updateTime") || {};
  if (cfg.enabled === false) return [];
  const base = laBaseZeroFromKey(laKey);
  if (base == null) return [];
  const updateAt = new Date(base);
  const bufferMin = Number.isFinite(Number(cfg.bufferMin)) ? Math.max(0, Number(cfg.bufferMin)) : 3;
  const notifyAt = addMs(updateAt, -bufferMin * MS_PER_MIN);
  const title = String(cfg.title || "⏰ 更新時刻");
  return [{
    type: "updateTime",
    idx: 0,
    id: NOTI_ID.buildId(ID_PREFIX.ACT, "updateTime", laKey, 0, !!st.testMode),
    title,
    body: `更新時刻 ${F.localTimeFormat(updateAt, st)} の少し前です`,
    notifyAt,
    realNotifyAt: notifyAt,
    tapWindowStart: notifyAt,
    tapWindowEnd: updateAt,
    blockStart: notifyAt,
    blockEnd: updateAt,
    openSkyOnTap: true,
  }];
}
function buildRunURL(query) {
  let url = `${APP_SCHEME.RUN}${encodeURIComponent(Script.name())}`;
  const q = query || {};
  for (const k of Object.keys(q)) {
