async function runShortcut(now, rawInput, argsObj=args) {
  const getRaw = () => {
    if (rawInput !== undefined && rawInput !== null && String(rawInput).trim() !== "") return rawInput;
    if (argsObj?.plainTexts?.length) return argsObj.plainTexts.join("\n");
    if (argsObj?.texts?.length) return argsObj.texts.join("\n");
    if (argsObj?.allText?.length) return argsObj.allText.join("\n");
    return "";
  };
  const parseMaybeJson = (raw) => {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === "object") return raw;
    if (Array.isArray(raw)) {
      if (raw.length === 1) return parseMaybeJson(raw[0]);
      return raw;
    }
    const s = String(raw).trim();
    if (!s) return null;
    try {
      const v = JSON.parse(s);
      if (typeof v === "string") {
        try { return JSON.parse(v); } catch (_) { return v; }
      }
      return v;
    } catch (e) {
      const kw = s.toLowerCase();
      for (const key of Object.values(ACTION)) {
        if (kw === key) return { action: key };
      }
      return null;
    }
  };
  const extractTargetDates = (obj) => {
    const dateList = uniq([...(obj?.dates || []), ...(obj?.list || []), ...(obj?.datetimes || []), ...(obj?.dateTimes || [])]).map(toDate).filter(Boolean);
    const periodList = expandPeriods(obj?.periods || obj?.ranges || obj?.range || obj?.windows || []);
    return uniq([...dateList, ...periodList].map(d => fmtLaKey(d))).map(k => toDate(k)).filter(Boolean);
  };
  const toDate = (v) => {
    if (!v) return null;
    if (v instanceof Date) return v;
    if (typeof v === "string") {
      const s = v.trim();
      const laNoon = laNoonDateFromKey(s);
      if (laNoon) return laNoon;
      const dt = new Date(s);
      return isNaN(dt.getTime()) ? null : dt;
    }
    if (typeof v === "number") {
      const dt = new Date(v);
      return isNaN(dt.getTime()) ? null : dt;
    }
    return null;
  };
  const expandPeriods = (periods) => {
    const out = [];
    (periods || []).forEach(p => {
      const s = toDate(p?.start ?? p?.from ?? p?.begin);
      const e = toDate(p?.end ?? p?.to ?? p?.until);
      if (!s || !e) return;
      const lo = Math.min(s.getTime(), e.getTime());
      const hi = Math.max(s.getTime(), e.getTime());
      for (let t = lo; t <= hi; t += MS_PER_DAY) out.push(new Date(t));
    });
    return out;
  };
  const buildPlainText = (info) => {
    const header = `${info.type.i}${info.type.l} ${computePlaceName(info.realm, info.map)}`;
    const lines = (info.occurrences || []).map(o => `${formatTimeRange(o.start, o.end)}`);
    return [header, ...lines].join("\n");
  };
  const buildJsonEntry = (info) => {
    const windows = (info.occurrences || []).map(o => {
      const start = F.localTimeFormat(o.start);
      const end = F.localTimeFormat(o.end);
      return { start, end, range: start + " - " + end };
    });
    return {
      emoji: info.type.i,
      colorLabel: info.type.l,
      realm: info.realm,
      map: info.map,
      place: `${computePlaceName(info.realm, info.map)}`,
      reward: info.reward ?? null,
      windows,
      text: buildPlainText(info),
    };
  };
  const raw = getRaw();
  const emit = (payload) => Script.setShortcutOutput(JSON.stringify(payload));
const handleTapAction = async (obj, defaultAction) => {
  const currentTime = (obj?.at ? toDate(obj.at) : null) || now;
  const currentSettings = loadSettings();
  const r = await withMutex(() => handleCommonTap(currentTime, { ...obj, action: defaultAction }));
  const isOutside = r && r.reason === "outside_window";
  if (!isOutside && currentSettings.openSkyEnabled !== false) {
    try { Safari.open("sky://"); } catch (_) {}
  }
  emit({ ok:true, mode:defaultAction, ...r });
};
const handleOpenOnlyTapAction = async (obj, defaultAction) => {
  const currentTime = (obj?.at ? toDate(obj.at) : null) || now;
  const currentSettings = loadSettings();
  const win = findEventWindowForAction(obj, currentTime, currentSettings);
  const isOutside = !(win && inWindow(currentTime, win.startTime, win.endTime));
  if (!isOutside && currentSettings.openSkyEnabled !== false) {
    try { Safari.open("sky://"); } catch (_) {}
  }
  emit({ ok:true, mode:defaultAction, marked:false, reason: isOutside ? "outside_window" : "opened" });
};
  const SHORTCUT_HANDLERS = Object.freeze({
    [ACTION.SCHEDULE]: async (_obj) => {
      const st = loadSettings();
      await checkAutomationTimeShift(now, st);
      const r = await withMutex(() => scheduleAllEvents(now, st));
      emit({ ok:true, mode:ACTION.SCHEDULE, ...r });
    },
    [ACTION.ALREADY_DONE]: async (obj) => {
      const st = loadSettings();
      const type = String(obj?.type || "").trim();
      if (!type) { emit({ ok:false, mode:ACTION.ALREADY_DONE, reason:"missing_type" }); return; }
      const la = String(obj?.la || fmtLaKey(now)).trim();
      const p = providerForType(type, st);
      if (!p) { emit({ ok:false, mode:ACTION.ALREADY_DONE, reason:"unknown_type", type }); return; }
      const tids = [p.buildThreadId(st, la), p.buildTestThreadId(st, la)];
      const specs = tids.map(tid => ({ kind: "thread", threadId: tid }));
      let removed = [];
      try { removed = await cancelPendingBySpecs(specs); } catch (_) {}
      if (type === "dye") {
        try {
          const rs = loadRunState(st);
          const day = getDayState(rs, la, st);
          const ts = ensureTypeState(day, type);
          ts.pendingIds = [];
          ts.lastDoneAt = now.toISOString();
          if (removed?.length) removeIdsFromRunState(rs, removed, st);
          saveRunState(rs, st);
          clearScheduleCacheByType("originalSin");
          await withMutex(() => scheduleAllEvents(now, st));
        } catch (_) {}
      }
      emit({ ok:true, mode:ACTION.ALREADY_DONE, laKey: la, cleared:true });
    },
    [ACTION.TAP]: (obj) => handleTapAction(obj, ACTION.TAP),
    [ACTION.EVENT_TAP]: (obj) => handleTapAction(obj, ACTION.EVENT_TAP),
    [ACTION.OPEN_ONLY]: (obj) => handleOpenOnlyTapAction(obj, ACTION.OPEN_ONLY),
  });
  let obj = parseMaybeJson(raw);
  const qp = getQueryParameters(argsObj);
  if ((!obj || typeof obj !== "object") && qp) {
    obj = { ...qp };
    if (obj.idx !== undefined) obj.idx = Number(obj.idx);
  }
  if (obj && typeof obj === "object") {
    if (isTruthy(obj.dyeDone) || isTruthy(obj.completeDye)) {
      await SHORTCUT_HANDLERS[ACTION.ALREADY_DONE]({ type: "dye", la: String(obj.la || fmtLaKey(now)) });
      return;
    }
    if (isTruthy(obj.panForestDone) || isTruthy(obj.completePanForestTreasure) || isTruthy(obj.panTreasureDone)) {
      const st = loadSettings();
      markPanForestTreasureDone(now, st);
      clearScheduleCacheByType("originalSin");
      try { await withMutex(() => scheduleAllEvents(now, st)); } catch (_) {}
      emit({ ok:true, mode:"panForestTreasureDone", laKey: fmtLaKey(getEffectiveNow(now, st)), cleared:true });
      return;
    }
    if (isTruthy(obj.panDailyDone) || isTruthy(obj.completePanForestDaily)) {
      const st = loadSettings();
      markPanForestDailyDone(now, st);
      clearScheduleCacheByType("originalSin");
      try { await withMutex(() => scheduleAllEvents(now, st)); } catch (_) {}
      emit({ ok:true, mode:"panForestDailyDone", laKey: fmtLaKey(getEffectiveNow(now, st)), cleared:true });
      return;
    }
    if (isTruthy(obj.originalSinDone) || isTruthy(obj.completeOriginalSin)) {
      const st = loadSettings();
      markOriginalSinDone(now, st);
      clearScheduleCacheByType("originalSin");
      try { await withMutex(() => scheduleAllEvents(now, st)); } catch (_) {}
      emit({ ok:true, mode:"originalSinDone", laKeys: getOriginalSinWeekLaKeys(now, st), cleared:true });
      return;
    }
    if (isTruthy(obj.uncompleteOriginalSin) || isTruthy(obj.originalSinUndone)) {
      const st = loadSettings();
      unmarkOriginalSinDone(now, st);
      clearScheduleCacheByType("originalSin");
      try { await withMutex(() => scheduleAllEvents(now, st)); } catch (_) {}
      emit({ ok:true, mode:"originalSinUndone", laKeys: getOriginalSinWeekLaKeys(now, st), cleared:true });
      return;
    }
    const act = String(obj.action || "").toLowerCase();
    const h = SHORTCUT_HANDLERS[act];
    if (h) { await h(obj); return; }
  }
  if (!obj) {
    await checkAutomationTimeShift(now, loadSettings());
    await withMutex(() => scheduleAllEvents(now, loadSettings()));
    const next = getUpcoming(now, 1)[0];
    Script.setShortcutOutput(next ? buildPlainText(next) : "No Shards");
    return;
  }
  const targets = extractTargetDates(obj);
  const includeNull = obj.includeNull !== false;
  const result = {};
  targets.forEach(d => {
    const key = fmtLaKey(d);
    const info = getShardInfo(d);
    if (!info) {
      if (includeNull) result[key] = null;
      return;
    }
    result[key] = buildJsonEntry(info);
  });
  Script.setShortcutOutput(JSON.stringify(result));
}
async function checkAndApplyTimezoneChange(nowTime) {
  let st = loadSettings();
  if (st.localOffsetAuto !== false) {
    const currentTzOffset = -(nowTime.getTimezoneOffset()) / 60;
    if (st.localOffset !== currentTzOffset) {
      st.localOffset = currentTzOffset;
      st.localOffsetAuto = true;
      saveSettings(st);
      const pending = await fetchAllPendingSafe();
      const ids = pending.map(n => n?.identifier).filter(NOTI_ID.isManagedId);
      if (ids.length > 0) {
        await removePendingIds(ids, pending);
        let rs = loadRunState(st);
        removeIdsFromRunState(rs, ids, st, true);
        saveRunState(rs, st);
      }
    }
  }
}
const GLOBAL_REFERENCE_TIME_MS = Date.now();
const realNow = new Date(GLOBAL_REFERENCE_TIME_MS);
await checkAndApplyTimezoneChange(realNow);
const _initSettings = loadSettings();
let now = getEffectiveNow(realNow, _initSettings);
loadRunState(_initSettings);
loadDisabledList(_initSettings);
if (_initSettings.imageAutoFetchEnabled !== false) {
  try {
    await ensureConstellationImages(CONSTELLATION_REALMS);
  } catch (e) {
    try { console.error(`Failed to auto sync constellation images: ${e}`); } catch (_) {}
    try {
      const st = loadSettings();
      st.imageAutoFetchEnabled = false;
      saveSettings(st);
    } catch (_) {}
  }
}
try { await withMutex(() => scheduleAllEvents(now, loadSettings())); } catch (e) { console.error("Initial schedule failed:", e); }
const qpObj = getQueryParameters(args);
const hasAction = !!(qpObj && String(qpObj.action || "").trim());
if (hasAction) {
  await runShortcut(now, JSON.stringify(qpObj), args);
} else if (config.runsInWidget) {
  await runWidget(now);
} else if (config.runsInApp) {
  await runApp(now);
} else {
  await runShortcut(now, qpObj ? JSON.stringify(qpObj) : args.shortcutParameter, args);
}
Script.complete();
