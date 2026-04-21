    const v = q[k];
    if (v === undefined || v === null) continue;
    url += `&${encodeURIComponent(String(k))}=${encodeURIComponent(String(v))}`;
  }
  return url;
}
const getCommonOffsetFields = (mPath, tPath, bPath, defM, defT, defB, maxTaskDuration) => [
  Object.freeze({ label: "移動に必要な時間(分)", path: mPath, def: defM, min: 0, max: 99 }),
  Object.freeze({ label: "保険時間(分)", path: bPath, def: defB, min: 0, max: 99 }),
  Object.freeze({ label: "タスク完了に必要な時間(分)", path: tPath, def: defT, min: 0, max: Math.min(maxTaskDuration, 99) }),
];
const makeActMeta = (type, defaultTitle, defaultDesc = "", durationMin = 10, forceOverrides = null, defMove = 5, defTask = 10, defBuf = 3) => {
  const resolveTitle = (s) => String(getActConfig(s || loadSettings(), type)?.title || defaultTitle || type);
  return Object.freeze({
    type,
    prefix: ID_PREFIX.ACT,
    tapAction: ACTION.EVENT_TAP,
    laKeys: ({ laKeyToday, laKeyNext }) => (laKeyNext && laKeyNext !== laKeyToday) ? [laKeyToday, laKeyNext] : [laKeyToday],
    getConfig: (s) => getActConfig(s || loadSettings(), type),
    getDailyLimit: (s) => Number(getActConfig(s || loadSettings(), type)?.dailyLimit || 0),
    isEnabled: (s) => {
      const cfg = getActConfig(s || loadSettings(), type);
      return !!cfg && cfg.enabled !== false;
    },
    fallbackTitle: resolveTitle,
    collect: (laKey, s, cfg) => {
      const st = s || loadSettings();
      let c = cfg || getActConfig(st, type) || {};
      if (forceOverrides) c = { ...c, ...forceOverrides };
      const title = String(c.title || defaultTitle || type);
      const base = laBaseZeroFromKey(laKey);
      const nextBase = base != null ? getBaseZeroForTZ(new Date(base + 26 * MS_PER_HOUR), TZ_LA) : null;
      if (base == null || nextBase == null) return { title, items: [] };
      const minuteRaw = Number(c.minute);
      const minute = Number.isFinite(minuteRaw) ? (((minuteRaw % 60) + 60) % 60) : 0;
      const wantsEvenPst = (c.evenPst === true);
      const wantsOddPst  = (c.evenPst === false);
      const items = [];
      const tz = TZ_LA;
      for (let i = -4; i <= 28; i++) {
        const d = new Date(base + i * MS_PER_HOUR);
        const p = getVisualUTC(d, tz);
        const pstParity = (p.h & 1);
        const ok = wantsEvenPst ? (pstParity === 0) : (wantsOddPst ? (pstParity === 1) : false);
        if (ok) {
          const rawStartMs = d.getTime() + minute * MS_PER_MIN;
          const rawEndMs = rawStartMs + durationMin * MS_PER_MIN;
          const cStartMs = Math.max(rawStartMs, base);
          const cEndMs = Math.min(rawEndMs, nextBase);
          if (cStartMs < cEndMs) {
            items.push({ start: new Date(cStartMs), end: new Date(cEndMs) });
          }
        }
      }
      return { title, items };
    },
    formatBody: ({ win }) => `受付期間: ${formatTimeRange(win.start, win.end)}`,
    ui: Object.freeze({
      title: resolveTitle,
      desc: String(defaultDesc || ""),
      enabledPath: `notify.${type}.enabled`,
      fields: Object.freeze([
        Object.freeze({ type: "count", label: "本日の完了回数", path: `_count.${type}` }),
        Object.freeze({ label: "1日の目標完了回数", path: `notify.${type}.dailyLimit`, def: 0, min: 0 }),
        ...getCommonOffsetFields(`notify.${type}.moveOffsetMin`, `notify.${type}.taskDurationMin`, `notify.${type}.bufferMin`, defMove, defTask, defBuf, durationMin),
      ]),
    }),
  });
};
function collectRaceItemsForLaKey(laKey, settings, cfg) {
  const st = settings || loadSettings();
  const c = cfg || getActConfig(st, "race") || {};
  const title = String(c.title || "🏁 レース");
  const base = laBaseZeroFromKey(laKey);
  const nextBase = base != null ? getBaseZeroForTZ(new Date(base + 26 * MS_PER_HOUR), TZ_LA) : null;
  if (base == null || nextBase == null) return { title, items: [] };
  const concertWindows = [];
  for (let i = -4; i <= 28; i++) {
    const d = new Date(base + i * MS_PER_HOUR);
    const p = getVisualUTC(d, TZ_LA);
    if ((p.h & 1) !== 0) continue;
    concertWindows.push({
      startMs: d.getTime() + 10 * MS_PER_MIN,
      endMs: d.getTime() + 58 * MS_PER_MIN,
    });
  }
  concertWindows.sort((a, b) => a.startMs - b.startMs);
  const items = [];
  let cursor = base;
  for (const w of concertWindows) {
    if (w.endMs <= base) continue;
    if (w.startMs >= nextBase) break;
    const gapStart = Math.max(cursor, base);
    const gapEnd = Math.min(w.startMs, nextBase);
    if (gapStart < gapEnd) items.push({ start: new Date(gapStart), end: new Date(gapEnd) });
    if (w.endMs > cursor) cursor = w.endMs;
  }
  const tailStart = Math.max(cursor, base);
  if (tailStart < nextBase) items.push({ start: new Date(tailStart), end: new Date(nextBase) });
  return { title, items };
}
function collectDyeItemsForLaKey(laKey, settings, cfg) {
  const st = settings || loadSettings();
  const c = cfg || getActConfig(st, "dye") || {};
  const title = String(c.title || "🎨 染料");
  const base = laBaseZeroFromKey(laKey);
  const nextBase = base != null ? getBaseZeroForTZ(new Date(base + 26 * MS_PER_HOUR), TZ_LA) : null;
  if (base == null || nextBase == null) return { title, items: [] };
  const intervalHours = normalizeDyeIntervalHours(c.intervalHours);
  const items = [];
  for (let slotStartMs = base, idx = 0; slotStartMs < nextBase; slotStartMs += MS_PER_HOUR, idx++) {
    if (intervalHours === 2 && (idx % 2) !== 0) continue;
    const slotEndMs = Math.min(slotStartMs + MS_PER_HOUR, nextBase);
    if (slotEndMs <= slotStartMs) continue;
    items.push({ start: new Date(slotStartMs), end: new Date(slotEndMs), slotIndex: idx });
  }
  return { title, items };
}
function collectPanItemsForLaKey(laKey, settings, cfg) {
  const st = settings || loadSettings();
  const c = cfg || getActConfig(st, "pan") || {};
  const title = String(c.title || "🍞 パン");
  const base = laBaseZeroFromKey(laKey);
  const nextBase = base != null ? getBaseZeroForTZ(new Date(base + 26 * MS_PER_HOUR), TZ_LA) : null;
  if (base == null || nextBase == null) return { title, items: [] };
  const minuteRaw = Number(c.minute);
  const minute = Number.isFinite(minuteRaw) ? (((minuteRaw % 60) + 60) % 60) : 35;
  const durationMin = 10;
  const items = [];
  for (let i = -4; i <= 28; i++) {
    const d = new Date(base + i * MS_PER_HOUR);
    const p = getVisualUTC(d, TZ_LA);
    if ((p.h & 1) !== 0) continue;
    const rawStartMs = d.getTime() + minute * MS_PER_MIN;
    const rawEndMs = rawStartMs + durationMin * MS_PER_MIN;
    const cStartMs = Math.max(rawStartMs, base);
    const cEndMs = Math.min(rawEndMs, nextBase);
    if (cStartMs < cEndMs) {
      items.push({ start: new Date(cStartMs), end: new Date(cEndMs) });
    }
  }
  return { title, items };
}
const TREASURE_REALM_ROTATION = Object.freeze(["prairie", "forest", "valley", "waste", "vault"]);
function getTreasureServerDateFromLaKey(laKey) {
  const m = String(laKey || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0));
}
function getTreasureRealmKeyForLaKey(laKey) {
  const serverDate = getTreasureServerDateFromLaKey(laKey);
  if (!serverDate) return null;
  const rawIndex = Math.floor((serverDate.getTime() / 86400000) - 18569.625);
  const realmIndex = ((rawIndex % TREASURE_REALM_ROTATION.length) + TREASURE_REALM_ROTATION.length) % TREASURE_REALM_ROTATION.length;
  return TREASURE_REALM_ROTATION[realmIndex] || null;
}
function isForestTreasureCandleDay(laKey, settings) {
  return getEffectiveTreasureRealmKey(laKey, settings) === "forest";
}
const DAILY_REALM_ROTATION = Object.freeze(["prairie", "forest", "valley", "waste", "vault"]);
function getDailyRealmKeyForLaKey(laKey) {
  const serverDate = getTreasureServerDateFromLaKey(laKey);
  if (!serverDate) return null;
  const rawIndex = Math.floor((serverDate.getTime() / 86400000) - 18570.625);
  const realmIndex = ((rawIndex % DAILY_REALM_ROTATION.length) + DAILY_REALM_ROTATION.length) % DAILY_REALM_ROTATION.length;
  return DAILY_REALM_ROTATION[realmIndex] || null;
}
function isForestDailyCandleDay(laKey, settings) {
  return getEffectiveDailyRealmKey(laKey, settings) === "forest";
}
function getEffectiveTreasureRealmKey(laKey, settings) {
  const st = settings || loadSettings();
  const override = st?.notify?.pan?.treasureRealmOverride;
  if (override && TREASURE_REALM_ROTATION.includes(override)) return override;
  return getTreasureRealmKeyForLaKey(laKey);
}
function getEffectiveDailyRealmKey(laKey, settings) {
  const st = settings || loadSettings();
  const override = st?.notify?.pan?.dailyRealmOverride;
  if (override && DAILY_REALM_ROTATION.includes(override)) return override;
  return getDailyRealmKeyForLaKey(laKey);
}
function getPanForestTreasureState(laKey, settings, cfg, runState) {
  const st = settings || loadSettings();
  const c = cfg || getActConfig(st, "pan") || {};
  const enabled = c.forestTreasureEnabled !== false;
  const durationMin = Number.isFinite(Number(c.forestTreasureDurationMin)) ? Math.max(0, Number(c.forestTreasureDurationMin)) : 10;
  const isForestDay = enabled && durationMin > 0 && isForestTreasureCandleDay(laKey, st);
  const rs = runState || loadRunState(st);
  const day = getDayState(rs, laKey, st);
  const ts = ensureTypeState(day, "pan");
  const done = !!ts.forestTreasureDone;
  const advanceMin = (isForestDay && !done) ? durationMin : 0;
  return { enabled, durationMin, isForestDay, done, advanceMin };
}
function getPanForestDailyState(laKey, settings, cfg, runState) {
  const st = settings || loadSettings();
  const c = cfg || getActConfig(st, "pan") || {};
  const enabled = c.forestDailyEnabled !== false;
  const durationMin = Number.isFinite(Number(c.forestDailyDurationMin)) ? Math.max(0, Number(c.forestDailyDurationMin)) : 10;
  const isForestDay = enabled && durationMin > 0 && isForestDailyCandleDay(laKey, st);
  const rs = runState || loadRunState(st);
  const day = getDayState(rs, laKey, st);
  const ts = ensureTypeState(day, "pan");
  const done = !!ts.forestDailyDone;
  const advanceMin = (isForestDay && !done) ? durationMin : 0;
  return { enabled, durationMin, isForestDay, done, advanceMin };
}
function combinePanAdvanceMinutes(forestState, dailyState) {
  const forestMin = Math.max(0, Number(forestState?.advanceMin || 0));
  const dailyMin = Math.max(0, Number(dailyState?.advanceMin || 0));
  if (forestMin > 0 && dailyMin > 0) return Math.max(forestMin, dailyMin);
  return forestMin + dailyMin;
}
function generatePanSchedules(now, laKey, settings) {
  const st = settings || loadSettings();
  const cfg = getActConfig(st, "pan") || {};
  if (cfg.enabled === false) return [];
  const pack = collectPanItemsForLaKey(laKey, st, cfg) || {};
  const items = Array.isArray(pack.items) ? pack.items : [];
  const title = String(pack.title || "🍞 パン");
  const rs = loadRunState(st);
  const forestState = getPanForestTreasureState(laKey, st, cfg, rs);
  const dailyState = getPanForestDailyState(laKey, st, cfg, rs);
  const taskDurationMin = Number.isFinite(Number(cfg.taskDurationMin)) ? Number(cfg.taskDurationMin) : 8;
  const advanceMin = combinePanAdvanceMinutes(forestState, dailyState);
  const advanceMs = advanceMin * MS_PER_MIN;
  const out = [];
  for (let idx = 0; idx < items.length; idx++) {
    const o = items[idx];
    if (!o || !isValidDate(o.start) || !isValidDate(o.end) || o.end.getTime() <= o.start.getTime()) continue;
    const normalWin = computeTapWindow(o.start, o.end, cfg);
    if (!normalWin) continue;
    const notifyAt = addMs(normalWin.start, -advanceMs);
    const tapWindowStart = notifyAt;
    const tapWindowEnd = normalWin.end;
    if (tapWindowEnd.getTime() < tapWindowStart.getTime()) continue;
    const forestCollectDeadline = forestState.isForestDay
      ? addMs(o.end, -(taskDurationMin + forestState.durationMin) * MS_PER_MIN)
      : null;
    const dailyCollectDeadline = dailyState.isForestDay
      ? addMs(o.end, -(taskDurationMin + dailyState.durationMin) * MS_PER_MIN)
      : null;
    out.push({
      type: "pan",
      idx,
      id: NOTI_ID.buildId(ID_PREFIX.ACT, "pan", laKey, idx, !!st.testMode),
      title,
      body: `受付期間: ${formatTimeRange(tapWindowStart, tapWindowEnd, st)}`,
      notifyAt,
      realNotifyAt: notifyAt,
      tapWindowStart,
      tapWindowEnd,
      openSkyOnTap: true,
      forestTreasureAdvanceMin: forestState.advanceMin,
      forestTreasureCollectDeadline: forestCollectDeadline,
      forestDailyAdvanceMin: dailyState.advanceMin,
      forestDailyCollectDeadline: dailyCollectDeadline,
      combinedAdvanceMin: advanceMin,
      baseNotifyAt: normalWin.start,
      baseTapWindowStart: normalWin.start,
      baseTapWindowEnd: normalWin.end,
    });
  }
  return out;
}
function markPanForestTreasureDone(targetNow, settings) {
  const st = settings || loadSettings();
  const current = getReferenceDate(targetNow);
  const effectiveNow = getEffectiveNow(current, st);
  const laKey = fmtLaKey(effectiveNow);
  const rs = loadRunState(st);
  const day = getDayState(rs, laKey, st);
  const ts = ensureTypeState(day, "pan");
  ts.forestTreasureDone = true;
  ts.forestTreasureDoneAt = current.toISOString();
  saveRunState(rs, st);
  return { laKey, changed: true };
}
function unmarkPanForestTreasureDone(targetNow, settings) {
  const st = settings || loadSettings();
  const current = getReferenceDate(targetNow);
  const effectiveNow = getEffectiveNow(current, st);
  const laKey = fmtLaKey(effectiveNow);
  const rs = loadRunState(st);
  const day = getDayState(rs, laKey, st);
  const ts = ensureTypeState(day, "pan");
  ts.forestTreasureDone = false;
  delete ts.forestTreasureDoneAt;
  saveRunState(rs, st);
  return { laKey, changed: true };
}
function markPanForestDailyDone(targetNow, settings) {
  const st = settings || loadSettings();
  const current = getReferenceDate(targetNow);
  const effectiveNow = getEffectiveNow(current, st);
  const laKey = fmtLaKey(effectiveNow);
  const rs = loadRunState(st);
  const day = getDayState(rs, laKey, st);
  const ts = ensureTypeState(day, "pan");
  ts.forestDailyDone = true;
  ts.forestDailyDoneAt = current.toISOString();
  saveRunState(rs, st);
  return { laKey, changed: true };
}
function unmarkPanForestDailyDone(targetNow, settings) {
  const st = settings || loadSettings();
  const current = getReferenceDate(targetNow);
  const effectiveNow = getEffectiveNow(current, st);
  const laKey = fmtLaKey(effectiveNow);
  const rs = loadRunState(st);
  const day = getDayState(rs, laKey, st);
  const ts = ensureTypeState(day, "pan");
  ts.forestDailyDone = false;
  delete ts.forestDailyDoneAt;
  saveRunState(rs, st);
  return { laKey, changed: true };
}
function parseDateLike(v) {
  if (v instanceof Date) return isValidDate(v) ? new Date(v) : null;
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    return isValidDate(d) ? d : null;
  }
  return null;
}
function getOriginalSinWeekLaKeys(targetNow, settings) {
  const st = settings || loadSettings();
  const current = getReferenceDate(targetNow);
  const effectiveNow = getEffectiveNow(current, st);
  const baseLaKey = fmtLaKey(effectiveNow);
  const baseNoon = laNoonDateFromKey(baseLaKey);
  if (!baseNoon) return [baseLaKey];
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const weekday = weekdayMap[String(getVisualUTC(baseNoon, TZ_LA).weekday || 'Sun')] ?? 0;
  const sundayNoon = new Date(baseNoon.getTime() - weekday * MS_PER_DAY);
  const out = [];
  for (let i = 0; i < 7; i++) out.push(fmtLaKey(new Date(sundayNoon.getTime() + i * MS_PER_DAY)));
  return Array.from(new Set(out.filter(isLaKey)));
}
function getOriginalSinStateForLaKey(laKey, settings, runState) {
  const st = settings || loadSettings();
  const rs = runState || loadRunState(st);
  const day = getDayState(rs, String(laKey || fmtLaKey(getEffectiveNow(getReferenceDate(), st))), st);
  const ts = ensureTypeState(day, "originalSin");
  return { done: !!ts.weekDone, day, ts };
}
function setOriginalSinWeekDone(targetNow, settings, isDone) {
  const st = settings || loadSettings();
  const current = getReferenceDate(targetNow);
  const rs = loadRunState(st);
  const laKeys = getOriginalSinWeekLaKeys(current, st);
  for (const laKey of laKeys) {
    const day = getDayState(rs, laKey, st);
    const ts = ensureTypeState(day, "originalSin");
    ts.weekDone = !!isDone;
    if (isDone) ts.weekDoneAt = current.toISOString();
    else delete ts.weekDoneAt;
  }
  saveRunState(rs, st);
  return { laKeys, changed: true };
}
function markOriginalSinDone(targetNow, settings) {
  return setOriginalSinWeekDone(targetNow, settings, true);
}
function unmarkOriginalSinDone(targetNow, settings) {
  return setOriginalSinWeekDone(targetNow, settings, false);
}
function localDateForLaKeyAndTime(laKey, hour, minute, settings) {
  const st = settings || loadSettings();
  const base = laBaseZeroFromKey(laKey);
  if (base == null) return null;
  const localRef = toLocalDate(base, st);
  const y = localRef.getUTCFullYear();
  const mo = localRef.getUTCMonth();
  const da = localRef.getUTCDate();
  const offsetMs = Number(st.localOffset ?? 9) * MS_PER_HOUR;
  return new Date(Date.UTC(y, mo, da, Number(hour) || 0, Number(minute) || 0, 0) - offsetMs);
}
