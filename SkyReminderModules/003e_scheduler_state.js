  });
  const order = Array.isArray(st?.eventOrder) ? st.eventOrder.map(x => String(x).trim()).filter(Boolean) : [];
  if (!order.length) return list;
  const byType = new Map(list.map(x => [x.type, x]));
  const out = [];
  const seen = new Set();
  for (const t of order) {
    const it = byType.get(t);
    if (it && !seen.has(it.type)) { out.push(it); seen.add(it.type); }
  }
  for (const it of list) {
    if (!seen.has(it.type)) { out.push(it); seen.add(it.type); }
  }
  return out;
}
let __providerCacheSettings = null;
let __providerCacheMap = null;
function getProviderMap(st) {
  if (__providerCacheSettings === st && __providerCacheMap) return __providerCacheMap;
  __providerCacheSettings = st;
  const list = buildEventProviders(st);
  const out = Object.create(null);
  for (const it of list) out[it.type] = it;
  __providerCacheMap = out;
  return out;
}
function providerForType(type, settings) {
  const st = settings || loadSettings();
  const m = getProviderMap(st);
  const t = String(type || "").trim();
  return t ? (m[t] || null) : null;
}
function getAllProviderTypes(settings) {
  return buildEventProviders(settings || loadSettings()).map(p => String(p?.type || "")).filter(Boolean);
}
function _settingsPartChanged(a, b) {
  try { return JSON.stringify(a) !== JSON.stringify(b); } catch (_) { return true; }
}
function buildSettingsReschedulePlan(prevSettings, nextSettings) {
  const prev = normalizeSettings(prevSettings || DEFAULT_SETTINGS);
  const next = normalizeSettings(nextSettings || DEFAULT_SETTINGS);
  const allTypes = getAllProviderTypes(next);
  const changedTypes = new Set();
  let forceAll = false;
  if (_settingsPartChanged(prev.shardNotify, next.shardNotify) || _settingsPartChanged(prev.shardTap, next.shardTap)) changedTypes.add('shards');
  for (const type of allTypes) {
    if (type === 'shards') continue;
    if (_settingsPartChanged(prev?.notify?.[type], next?.notify?.[type])) changedTypes.add(type);
  }
  const originalSinCfg = normalizeOriginalSinConfig(next?.notify?.originalSin || DEFAULT_SETTINGS.notify.originalSin);
  if (originalSinCfg.enabled !== false && originalSinCfg.idleWindowEnabled) {
    const affectsOriginalSin = Array.from(changedTypes).some(tp => tp !== 'originalSin');
    if (affectsOriginalSin) changedTypes.add('originalSin');
  }
  if (_settingsPartChanged(prev.openSkyEnabled, next.openSkyEnabled) || _settingsPartChanged(prev.localOffset, next.localOffset) || _settingsPartChanged(prev.localOffsetAuto, next.localOffsetAuto)) forceAll = true;
  const testModeChanged = _settingsPartChanged(prev.testMode, next.testMode) || _settingsPartChanged(prev.testOffsetMs, next.testOffsetMs);
  if (testModeChanged && !forceAll && changedTypes.size === 0) {
    return { types: [], targetType: null, anchorLaKeys: [], reason: ['test-mode-only'] };
  }
  const types = forceAll ? allTypes : Array.from(changedTypes);
  return {
    types,
    targetType: (!forceAll && types.length === 1) ? types[0] : null,
    anchorLaKeys: types.length ? getTodayNextLaKeysForRef(null, next) : [],
    reason: forceAll ? ['global-setting-change'] : types,
  };
}
function hashStringForCache(str) {
  let h = 2166136261 >>> 0;
  const s = String(str || "");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}
function buildScheduleCacheKey(type, laKey, settings) {
  const st = settings || loadSettings();
  const p = providerForType(type, st);
  const signature = { type: String(type || ""), laKey: String(laKey || "") };
  try {
    signature.cfg = p && typeof p.getConfig === "function" ? (p.getConfig(st) || {}) : {};
  } catch (_) {
    signature.cfg = {};
  }
  if (String(type || "") === "pan") {
    try {
      const rs = loadRunState(st);
      const day = getDayState(rs, String(laKey || ""), st);
      const ts = ensureTypeState(day, "pan");
      signature.forestTreasureDone = !!ts.forestTreasureDone;
      signature.forestDailyDone = !!ts.forestDailyDone;
    } catch (_) {}
  }
  if (String(type || "") === "originalSin") {
    try {
      const rs = loadRunState(st);
      const day = getDayState(rs, String(laKey || ""), st);
      const ts = ensureTypeState(day, "originalSin");
      signature.weekDone = !!ts.weekDone;
    } catch (_) {}
  }
  return `sched:${type}:${laKey}:${hashStringForCache(JSON.stringify(signature))}`;
}
function generateSchedules(type, now, laKey, settings) {
  const st = settings || loadSettings();
  const attachRealNotifyAt = (items) => {
    const effectiveNowMs = getReferenceTimeMs(now);
    const realNow = effectiveNowMs - (st.testMode ? Number(st.testOffsetMs || 0) : 0);
    return (items || []).map(it => {
      if (!it || !isValidDate(it.notifyAt)) return it;
      const delayMs = it.notifyAt.getTime() - effectiveNowMs;
      return { ...it, realNotifyAt: new Date(realNow + delayMs) };
    });
  };
  const cacheKey = buildScheduleCacheKey(type, laKey, st);
  const cached = CacheManager.getValidCache(st, cacheKey, now);
  if (cached) return attachRealNotifyAt(cached);
  const p = providerForType(type, st);
  const res = p ? (p.generate(now, laKey, st) || []) : [];
  CacheManager.setCache(st, cacheKey, now, res);
  return attachRealNotifyAt(res);
}
function getDailyLimitForType(settings, type, laKey) {
  const st = settings || loadSettings();
  const p = providerForType(type, st);
  return p ? Number(p.getDailyLimit(st, laKey) || 0) : 0;
}
function buildRemainInfo(settings, runState, laKey) {
  const st = settings || loadSettings();
  const rs = runState || loadRunState(st);
  const key = String(laKey || fmtLaKey(getReferenceDate()));
  const day = getDayState(rs, key, st);
  const out = {};
  for (const tp of getConfiguredEventTypes(st)) {
    const p = providerForType(tp, st);
    const isEnabled = p ? p.isEnabled(st) : false;
    let limit = getDailyLimitForType(st, tp, key);
    if (!isEnabled) limit = 0;
    let count = Number(day?.[tp]?.count || 0);
    if (limit > 0 && count > limit) count = limit;
    const remain = (limit > 0) ? Math.max(0, limit - count) : 0;
    out[tp] = { remain, count, limit };
  }
  return { laKey: key, day, info: out };
}
function pruneRunStateDays(rs, keepDays=3, anchorLaKeys=[]) {
  const keys = Object.keys(rs).filter(isLaKey).sort();
  const anchors = Array.from(new Set((Array.isArray(anchorLaKeys) ? anchorLaKeys : [anchorLaKeys]).filter(isLaKey).map(String)));
  const mustKeep = new Set(anchors.filter(k => keys.includes(k)));
  const need = Math.max(Number(keepDays) || 0, mustKeep.size);
  if (keys.length <= need) return { keys, toDrop: [] };
  const anchorIdxs = Array.from(mustKeep).map(k => keys.indexOf(k)).filter(i => i >= 0);
  const scored = keys.map((k, i) => {
    const dist = anchorIdxs.length ? Math.min(...anchorIdxs.map(a => Math.abs(a - i))) : Math.abs(keys.length - 1 - i);
    return { k, i, dist };
  }).sort((a, b) => a.dist - b.dist || a.i - b.i);
  for (const item of scored) {
    if (mustKeep.size >= need) break;
    mustKeep.add(item.k);
  }
  return { keys, toDrop: keys.filter(k => !mustKeep.has(k)) };
}
function removeIdsFromRunState(rs, removedIds, settings, includeNotified = false) {
  const rm = new Set((removedIds || []).map(String));
  if (!rm.size) return;
  const st = settings || loadSettings();
  for (const laKey of Object.keys(rs)) {
    if (!isLaKey(laKey)) continue;
    const day = getDayState(rs, laKey, st);
    for (const tp of getEventTypesForDay(st, day)) {
      if (day?.[tp]?.pendingIds?.length) {
        day[tp].pendingIds = day[tp].pendingIds.filter(id => !rm.has(String(id)));
      }
      if (includeNotified && day?.[tp]?.notifiedIds?.length) {
        day[tp].notifiedIds = day[tp].notifiedIds.filter(id => !rm.has(String(id)));
      }
    }
  }
}
function mergeRunState(latest, planned, removedIds = [], settings) {
  const out = (latest && typeof latest === "object" && !Array.isArray(latest)) ? { ...latest } : {};
  const rm = new Set((removedIds || []).map(String));
  const st = settings || loadSettings();
  for (const laKey of Object.keys(planned || {})) {
    if (!isLaKey(laKey)) continue;
    const dayPlanned = getDayState(planned, laKey, st);
    const dayOut = getDayState(out, laKey, st);
    for (const tp of getEventTypesForDay(st, { ...dayOut, ...dayPlanned })) {
      const a = dayOut?.[tp] || createEmptyTypeState();
      const b = dayPlanned?.[tp] || createEmptyTypeState();
      const ids = new Set([...(a.pendingIds || []), ...(b.pendingIds || [])].map(String).filter(Boolean));
      const notified = new Set([...(a.notifiedIds || []), ...(b.notifiedIds || [])].map(String).filter(Boolean));
      dayOut[tp] = {
        ...a,
        ...b,
        count: Math.max(Number(a.count)||0, Number(b.count)||0),
        pendingIds: Array.from(ids),
        notifiedIds: Array.from(notified),
      };
    }
  }
  if (rm.size) removeIdsFromRunState(out, removedIds, st);
  return out;
}
function cloneRunState(rs) {
  try { return JSON.parse(JSON.stringify(isValidRunState(rs) ? rs : {})); } catch (_) { return isValidRunState(rs) ? { ...rs } : {}; }
}
async function createAndScheduleNotification({ id, threadId, title, body, openURL, triggerDate, sound = "default", userInfo = null }) {
  const n = new Notification();
  n.identifier = String(id || "");
  if (threadId) n.threadIdentifier = String(threadId);
  if (sound) n.sound = sound;
  n.title = String(title || "");
  n.body = String(body || "");
  if (openURL) n.openURL = String(openURL);
  if (userInfo) n.userInfo = userInfo;
  const dt = (triggerDate instanceof Date) ? triggerDate : new Date(triggerDate);
  n.setTriggerDate(dt);
  try { await n.schedule(); } catch (e) { console.error(e); }
  return n;
}
function _buildNotificationPayload(itId, threadId, it, openURL, triggerDate) {
  return {
    id: itId,
    threadId,
    title: it.title,
    body: it.body,
    openURL,
    triggerDate,
    userInfo: { labelDateMs: it.notifyAt.getTime() },
  };
}
function _classifyScheduleItems({ items, now, realNowMs, disabledIds, prevPending, prevNotified, threadId, provider, type, laKey }) {
  const nextPending = [];
  const nextNotified = new Set(prevNotified);
  const newSchedules = [];
  for (const it of items) {
    const itId = String(it?.id || "");
    if (!itId || disabledIds.has(itId)) continue;
    if (prevNotified.has(itId)) {
      nextNotified.add(itId);
      continue;
    }
    const openURL = buildRunURL({ action: provider.tapAction, type, la: laKey, idx: String(it.idx) });
    if (now >= it.tapWindowStart && now <= it.tapWindowEnd) {
      if (type !== 'originalSin' && !nextNotified.has(itId) && !prevPending.has(itId)) {
        newSchedules.push(_buildNotificationPayload(itId, threadId, it, openURL, new Date(realNowMs + 1000)));
      }
      nextNotified.add(itId);
    } else if (now < it.notifyAt) {
      nextPending.push(itId);
      const trigger = (it.realNotifyAt instanceof Date) ? it.realNotifyAt : it.notifyAt;
      newSchedules.push(_buildNotificationPayload(itId, threadId, it, openURL, trigger));
    } else {
      nextNotified.add(itId);
    }
  }
  return { nextPending, nextNotified, newSchedules };
}
async function scheduleAllEvents(now, settings, targetType = null, anchorLaKeys = []) {
  const st = settings || loadSettings();
  const realNowMs = getReferenceTimeMs(now) - (st.testMode ? Number(st.testOffsetMs || 0) : 0);
  const isTest = !!st.testMode;
  const laKeyToday = fmtLaKey(now);
  const noonToday = laNoonDateFromKey(laKeyToday);
  const laKeyNext = noonToday
    ? fmtLaKey(new Date(noonToday.getTime() + MS_PER_DAY))
    : fmtLaKey(new Date(now.getTime() + MS_PER_DAY));
  let rs = loadRunState(st);
  const pending = await fetchAllPendingSafe();
  const managedPending = (pending || []).filter(n => NOTI_ID.isManagedId(n?.identifier));
  const toSchedule = [];
  const toRemove = [];
  const disabledIds = new Set(loadDisabledList(st).map(x => String(x?.id || "")).filter(Boolean));
  const types = getConfiguredEventTypes(st);
  for (const type of types) {
    if (targetType && targetType !== type) continue;
    const p = providerForType(type, st);
    if (!p) continue;
    const pendingForType = managedPending.filter(n => String(NOTI_ID.parse(n?.identifier || "")?.type || "") === type);
    const plannedRs = cloneRunState(rs);
    try {
      const laKeysToProcess = p.laKeys({ now, laKeyToday, laKeyNext, settings: st }) || [];
      for (const laKey of laKeysToProcess) {
        const day = getDayState(plannedRs, laKey, st);
        const ts = ensureTypeState(day, type);
        const prevPending = new Set(_normalizeIdList(ts.pendingIds || []));
        const prevNotified = new Set(_normalizeIdList(ts.notifiedIds || []));
        const threadId = isTest ? p.buildTestThreadId(st, laKey) : p.buildThreadId(st, laKey);
        if (!p.isEnabled(st)) { ts.pendingIds = []; continue; }
        const limit = getDailyLimitForType(st, type, laKey);
        if (limit > 0 && ts.count >= limit) { ts.pendingIds = []; continue; }
        const items = generateSchedules(type, now, laKey, st);
        const result = _classifyScheduleItems({
          items, now, realNowMs, disabledIds,
          prevPending, prevNotified, threadId,
          provider: p, type, laKey,
        });
        toSchedule.push(...result.newSchedules);
        ts.pendingIds = Array.from(new Set(result.nextPending.map(String).filter(Boolean)));
        ts.notifiedIds = Array.from(result.nextNotified);
      }
      rs = plannedRs;
      for (const n of pendingForType) {
        const id = String(n?.identifier || "");
        if (id) toRemove.push(id);
      }
    } catch (e) {
      console.error(`scheduleAllEvents type failed: ${type}`, e);
      continue;
    }
  }
  const anchorSet = Array.from(new Set([laKeyToday, laKeyNext, ...(Array.isArray(anchorLaKeys) ? anchorLaKeys : [anchorLaKeys])].filter(isLaKey).map(String)));
  const { toDrop } = pruneRunStateDays(rs, 4, anchorSet);
  for (const k of toDrop) delete rs[k];
  const removeIds = Array.from(new Set(toRemove.map(String).filter(Boolean)));
  try {
    if (typeof setManagePendingFallback === 'function') {
      const removeSet = new Set(removeIds);
      const mergedFallback = mergeManagedNotificationLists(managedPending.filter(n => !removeSet.has(String(n?.identifier || ""))), toSchedule);
      setManagePendingFallback(mergedFallback);
    }
  } catch (_) {}
  if (removeIds.length > 0) await removePendingIds(removeIds, pending);
  await Promise.all(toSchedule.map(it => createAndScheduleNotification(it)));
  saveRunState(rs, st);
  return { laKey: laKeyToday, scheduledCount: toSchedule.length, scheduledItems: toSchedule.slice() };
}
