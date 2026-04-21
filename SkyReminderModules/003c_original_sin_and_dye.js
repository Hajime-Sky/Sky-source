function getLocalSkyDayWindowForLaKey(laKey, settings) {
  const st = settings || loadSettings();
  const base = laBaseZeroFromKey(laKey);
  if (base == null) return null;
  const start = toLocalDate(base, st);
  if (!(start instanceof Date) || Number.isNaN(start.getTime())) return null;
  const endExclusive = new Date(start.getTime() + MS_PER_DAY);
  const endDisplay = new Date(endExclusive.getTime() - 1000);
  return { start, endExclusive, endDisplay };
}
function localSkyDateForLaKeyAndTime(laKey, hour, minute, settings) {
  const win = getLocalSkyDayWindowForLaKey(laKey, settings);
  if (!win) return null;
  const h = Number(hour) || 0;
  const m = Number(minute) || 0;
  let d = new Date(Date.UTC(win.start.getUTCFullYear(), win.start.getUTCMonth(), win.start.getUTCDate(), h, m, 0));
  if (d.getTime() < win.start.getTime()) d = new Date(d.getTime() + MS_PER_DAY);
  return d;
}
function formatLocalSkyWindowLabel(win, settings) {
  const st = settings || loadSettings();
  if (!win || !(win.start instanceof Date) || !(win.endDisplay instanceof Date)) return '不明';
  const fmt = (d) => {
    const ld = toLocalDate(d, st);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(ld.getUTCMonth() + 1)}/${pad(ld.getUTCDate())} ${pad(ld.getUTCHours())}:${pad(ld.getUTCMinutes())}`;
  };
  return `${fmt(win.start)} - ${fmt(win.endDisplay)}`;
}
function dedupeOriginalSinItems(items) {
  const seen = new Set();
  const out = [];
  for (const it of (items || []).sort((a, b) => a.notifyAt.getTime() - b.notifyAt.getTime() || String(a.body || '').localeCompare(String(b.body || '')))) {
    const key = `${it.notifyAt.getTime()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}
function formatDurationMinutesJa(totalMinutes) {
  const mins = Math.max(0, Math.floor(Number(totalMinutes) || 0));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}時間${m}分`;
  if (h > 0) return `${h}時間`;
  return `${m}分`;
}
function getOriginalSinCompletionBusyEnd(type, laKey, blockStart, blockEnd, settings, runState = null) {
  const st = settings || loadSettings();
  const rs = runState || loadRunState(st);
  const day = getDayState(rs, laKey, st);
  const ts = ensureTypeState(day, type);
  const startMs = blockStart instanceof Date ? blockStart.getTime() : Number(blockStart);
  const endMs = blockEnd instanceof Date ? blockEnd.getTime() : Number(blockEnd);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;
  if (type === "pan") {
    const cfg = getActConfig(st, "pan") || {};
    const busyEnds = [];
    const needTreasure = cfg.forestTreasureEnabled !== false;
    const needDaily = cfg.forestDailyEnabled !== false;
    if (needTreasure) {
      const doneAt = parseDateLike(ts.forestTreasureDoneAt);
      if (!(doneAt instanceof Date)) return null;
      const doneMs = doneAt.getTime();
      if (doneMs < startMs || doneMs > endMs) return null;
      const dur = Math.max(0, Number(cfg.forestTreasureDurationMin || cfg.taskDurationMin || 0));
      busyEnds.push(Math.max(startMs, doneMs) + dur * MS_PER_MIN);
    }
    if (needDaily) {
      const doneAt = parseDateLike(ts.forestDailyDoneAt);
      if (!(doneAt instanceof Date)) return null;
      const doneMs = doneAt.getTime();
      if (doneMs < startMs || doneMs > endMs) return null;
      const dur = Math.max(0, Number(cfg.forestDailyDurationMin || cfg.taskDurationMin || 0));
      busyEnds.push(Math.max(startMs, doneMs) + dur * MS_PER_MIN);
    }
    if (!busyEnds.length) return null;
    return new Date(Math.min(endMs, Math.max(...busyEnds)));
  }
  const doneAt = parseDateLike(ts.lastDoneAt);
  if (!(doneAt instanceof Date)) return null;
  const doneMs = doneAt.getTime();
  if (doneMs < startMs || doneMs > endMs) return null;
  let taskMin = 0;
  if (type === "shards") {
    taskMin = Math.max(0, Number(st?.shardTap?.taskDurationMin || 0));
  } else {
    const cfg = getActConfig(st, type) || {};
    taskMin = Math.max(0, Number(cfg.taskDurationMin || 0));
  }
  const busyEndMs = Math.max(startMs, doneMs) + taskMin * MS_PER_MIN;
  return new Date(Math.min(endMs, busyEndMs));
}
function getEffectiveOriginalSinBlockingItemsForType(now, type, laKey, settings, runState = null) {
  const st = settings || loadSettings();
  const rs = runState || loadRunState(st);
  const p = providerForType(type, st);
  if (!p || !p.isEnabled(st)) return [];
  const day = getDayState(rs, laKey, st);
  const ts = ensureTypeState(day, type);
  const limit = getDailyLimitForType(st, type, laKey);
  if (limit > 0 && ts.count >= limit) return [];
  const disabledIds = new Set(loadDisabledList(st).map(x => String(x?.id || '')).filter(Boolean));
  let items = [];
  try { items = (generateSchedules(type, now, laKey, st) || []); } catch (_) { items = []; }
  const out = [];
  for (const it of items) {
    const itId = String(it?.id || '');
    if (!itId || disabledIds.has(itId)) continue;
    const start = isValidDate(it?.blockStart) ? new Date(it.blockStart) : (isValidDate(it?.notifyAt) ? new Date(it.notifyAt) : null);
    const rawEnd = isValidDate(it?.blockEnd) ? new Date(it.blockEnd) : (isValidDate(it?.tapWindowEnd) ? new Date(it.tapWindowEnd) : null);
    if (!start || !rawEnd || rawEnd.getTime() <= start.getTime()) continue;
    let end = rawEnd;
    const busyEnd = getOriginalSinCompletionBusyEnd(type, laKey, start, rawEnd, st, rs);
    if (busyEnd instanceof Date && busyEnd.getTime() >= start.getTime()) end = busyEnd;
    if (end.getTime() <= start.getTime()) continue;
    const shouldBlock = (now instanceof Date)
      ? (now.getTime() < start.getTime() || (now.getTime() >= start.getTime() && now.getTime() <= end.getTime()))
      : true;
    if (!shouldBlock) continue;
    out.push({ type, laKey, start, end, item: it });
  }
  return out;
}
function collectOriginalSinBlockingWindows(now, laKey, settings) {
  const st = settings || loadSettings();
  const rs = loadRunState(st);
  const baseNoon = laNoonDateFromKey(laKey);
  const keys = [laKey];
  if (baseNoon) keys.push(fmtLaKey(new Date(baseNoon.getTime() + MS_PER_DAY)));
  const out = [];
  for (const type of getConfiguredEventTypes(st)) {
    if (type === 'originalSin') continue;
    for (const k of keys) {
      const items = getEffectiveOriginalSinBlockingItemsForType(now, type, k, st, rs);
      for (const it of items) {
        if (!it || !(it.start instanceof Date) || !(it.end instanceof Date)) continue;
        out.push({ type, laKey: k, start: new Date(it.start), end: new Date(it.end) });
      }
    }
  }
  out.sort((a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime());
  return out;
}
function buildOriginalSinScheduleItem(st, laKey, notifyAt, dayStart, dayEnd, body, namespaceBase = 0) {
  const localDayStart = dayStart instanceof Date ? dayStart : (getLocalSkyDayWindowForLaKey(laKey, st)?.start || localDateForLaKeyAndTime(laKey, 0, 0, st));
  const minuteIndex = localDayStart instanceof Date ? Math.max(0, Math.floor((notifyAt.getTime() - localDayStart.getTime()) / MS_PER_MIN)) : 0;
  const idx = namespaceBase + minuteIndex;
  const tapWindowStart = new Date(notifyAt);
  const tapWindowEnd = new Date(Math.min(dayEnd.getTime(), notifyAt.getTime() + 12 * MS_PER_HOUR));
  const bodyWithTime = String(body || '').trim() || `${F.localTimeFormat(notifyAt, st)} 原罪`;
  return {
    type: "originalSin",
    idx,
    id: NOTI_ID.buildId(ID_PREFIX.ACT, "originalSin", laKey, idx, !!st.testMode),
    title: String(getActConfig(st, "originalSin")?.title || "⚖️ 原罪"),
    body: bodyWithTime,
    notifyAt: new Date(notifyAt),
    realNotifyAt: new Date(notifyAt),
    tapWindowStart,
    tapWindowEnd,
    blockStart: new Date(notifyAt),
    blockEnd: new Date(tapWindowEnd),
    openSkyOnTap: true,
  };
}
function generateOriginalSinSchedules(now, laKey, settings) {
  const st = settings || loadSettings();
  const cfg = normalizeOriginalSinConfig(getActConfig(st, "originalSin") || {});
  if (cfg.enabled === false) return [];
  const state = getOriginalSinStateForLaKey(laKey, st);
  if (state.done) return [];
  const skyWindow = getLocalSkyDayWindowForLaKey(laKey, st);
  if (!skyWindow) return [];
  const dayStart = skyWindow.start;
  const dayEnd = skyWindow.endExclusive;
  const out = [];
  if (cfg.fixedEnabled) {
    for (const slot of normalizeOriginalSinFixedTimes(cfg.fixedTimes)) {
      if (slot == null || slot.hour == null || slot.minute == null) continue;
      const notifyAt = localSkyDateForLaKeyAndTime(laKey, slot.hour, slot.minute, st);
      if (!notifyAt || notifyAt.getTime() < dayStart.getTime() || notifyAt.getTime() >= dayEnd.getTime()) continue;
      out.push(buildOriginalSinScheduleItem(st, laKey, notifyAt, dayStart, dayEnd, `${F.localTimeFormat(notifyAt, st)} 定時（原罪）`, 0));
    }
  }
  if (cfg.sinceResetEnabled) {
    for (const slot of normalizeOriginalSinSinceResetTimes(cfg.sinceResetTimes)) {
      if (slot == null || slot.minutesAfterReset == null) continue;
      const base = laBaseZeroFromKey(laKey);
      if (base == null) continue;
      const notifyAt = new Date(base + Number(slot.minutesAfterReset) * MS_PER_MIN);
      if (notifyAt.getTime() < dayStart.getTime() || notifyAt.getTime() >= dayEnd.getTime()) continue;
      out.push(buildOriginalSinScheduleItem(st, laKey, notifyAt, dayStart, dayEnd, `${F.localTimeFormat(notifyAt, st)} 更新+${slot.minutesAfterReset}分`, 10000));
    }
  }
  if (cfg.idleWindowEnabled) {
    const taskDurationMs = Math.max(1, Number(cfg.taskDurationMin || 60)) * MS_PER_MIN;
    const repeatMs = Math.max(5, Number(cfg.repeatEveryMin || 180)) * MS_PER_MIN;
    const searchStart = localSkyDateForLaKeyAndTime(laKey, cfg.searchStartHour, cfg.searchStartMinute, st) || dayStart;
    const allBlocking = collectOriginalSinBlockingWindows(now, laKey, st).filter(it => it && it.end instanceof Date && it.end.getTime() > searchStart.getTime());
    const blocking = allBlocking.filter(it => it.start.getTime() < dayEnd.getTime());
    const nextAfterDayEnd = allBlocking.find(it => it.start.getTime() >= dayEnd.getTime()) || null;
    let cursor = new Date(searchStart);
    const endLimit = dayEnd;
    const addGapItems = (gapStart, gapEnd, displayEnd = gapEnd) => {
      let t = Math.max(gapStart.getTime(), cursor.getTime());
      const latestStart = gapEnd.getTime() - taskDurationMs;
      while (t <= latestStart) {
        const gapMinutes = Math.max(0, Math.floor((displayEnd.getTime() - t) / MS_PER_MIN));
        out.push(buildOriginalSinScheduleItem(st, laKey, new Date(t), dayStart, dayEnd, `${F.localTimeFormat(new Date(t), st)} 空き候補（${formatDurationMinutesJa(gapMinutes)}）`, 20000));
        t += repeatMs;
      }
    };
    for (const it of blocking) {
      const gapEnd = new Date(Math.min(endLimit.getTime(), it.start.getTime()));
      addGapItems(cursor, gapEnd);
      cursor = new Date(Math.max(cursor.getTime(), it.end.getTime()));
      if (cursor.getTime() >= endLimit.getTime()) break;
    }
    addGapItems(cursor, endLimit, nextAfterDayEnd ? nextAfterDayEnd.start : endLimit);
  }
  return dedupeOriginalSinItems(out);
}
function buildOriginalSinDiagnosticText(settings, laKey, refNow = now) {
  const st = settings || loadSettings();
  const cfg = normalizeOriginalSinConfig(getActConfig(st, "originalSin") || {});
  const win = getLocalSkyDayWindowForLaKey(laKey, st);
  if (!win) return '';
  const searchStart = localSkyDateForLaKeyAndTime(laKey, cfg.searchStartHour, cfg.searchStartMinute, st) || win.start;
  const blocks = collectOriginalSinBlockingWindows(refNow instanceof Date ? refNow : getEffectiveNowFromRef(refNow, st), laKey, st)
    .filter(it => it && it.start instanceof Date && it.end instanceof Date && it.start.getTime() < win.endExclusive.getTime() && it.end.getTime() > win.start.getTime());
  const counts = {};
  for (const it of blocks) counts[it.type] = (counts[it.type] || 0) + 1;
  const labels = Object.keys(counts).map(tp => {
    const p = providerForType(tp, st);
    const title = String(p?.fallbackTitle?.(st) || tp).replace(/^\S+\s*/, '');
    return `${title} ${counts[tp]}件`;
  });
