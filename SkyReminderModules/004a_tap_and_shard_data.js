function _findActiveSchedule(schedules, now, idxHint, isTestTap) {
  const hasIdx = !Number.isNaN(idxHint);
  if (hasIdx) {
    const byIdx = schedules.find(it => it.idx === idxHint);
    if (byIdx && inWindow(now, byIdx.tapWindowStart, byIdx.tapWindowEnd)) return byIdx;
  }
  const inWin = schedules.find(it => inWindow(now, it.tapWindowStart, it.tapWindowEnd));
  if (inWin) return inWin;
  if (isTestTap && schedules.length) {
    return (hasIdx ? schedules.find(it => it.idx === idxHint) : null) || schedules[0];
  }
  return null;
}
async function handleCommonTap(now, params) {
  const st = loadSettings();
  const actionRaw = String(params?.action || "").trim();
  const action = (actionRaw === ACTION.EVENT_TAP) ? ACTION.TAP : actionRaw;
  const type = String(params?.type || "").trim();
  const laKey = String(params?.la || fmtLaKey(now)).trim();
  const idxHint = Number(params?.idx);
  const isTestTap = String(params?.test || "") === "1";
  if (!action) return { ok:false, reason:"missing_action" };
  if (!type) return { ok:false, reason:"missing_type" };
  if (!(action === ACTION.TAP || action === ACTION.ALREADY_DONE)) return { ok:false, reason:"bad_action", action };
  if (!isLaKey(laKey)) return { ok:false, reason:"bad_lakey" };
  const p = providerForType(type, st);
  if (!p) return { ok:false, reason:"unknown_type" };
  let rs = loadRunState(st);
  const day = getDayState(rs, laKey, st);
  const ts = ensureTypeState(day, type);
  const isEnabled = p.isEnabled(st);
  const limit = isEnabled ? getDailyLimitForType(st, type, laKey) : 0;
  let removedThisTap = [];
  const cleanupPendingAndSync = async () => {
    const pending = await fetchAllPendingSafe();
    const toRemove = new Set(_normalizeIdList(ts.pendingIds || []));
    const tid = st.testMode ? p.buildTestThreadId(st, laKey) : p.buildThreadId(st, laKey);
    for (const id of _collectIdsByThreadFromPending(pending, tid)) toRemove.add(String(id));
    const removed = await removePendingIds(Array.from(toRemove), pending);
    if (removed?.length) {
      removeIdsFromRunState(rs, removed, st);
      const rm = new Set(removed.map(String));
      ts.pendingIds = (ts.pendingIds || []).map(String).filter(Boolean).filter(id => !rm.has(id));
    }
    return removed || [];
  };
  const mergeAndSave = () => {
    try { rs = mergeRunState(loadRunState(st), rs, removedThisTap, st); } catch (_) {}
    saveRunState(rs, st);
  };
  if (limit === 0 || ts.count >= limit) {
    const removed = await cleanupPendingAndSync();
    if (removed?.length) removedThisTap = removedThisTap.concat(removed);
    mergeAndSave();
    return { ok:true, marked:false, reason:"already_reached_cleaned", count: ts.count, limit };
  }
  const schedulesAll = generateSchedules(type, now, laKey, st);
  const schedules = schedulesAll.filter(it => NOTI_ID.extractLaKey(it.id) === laKey);
  const active = _findActiveSchedule(schedules, now, idxHint, isTestTap);
  if (!active && !isTestTap) {
    const hint = (!Number.isNaN(idxHint) ? schedules.find(it => it.idx === idxHint) : null) || schedules[0] || null;
    return {
      ok: true, marked: false, reason: "outside_window",
      window: hint ? { start: hint.tapWindowStart?.toISOString?.() || null, end: hint.tapWindowEnd?.toISOString?.() || null } : undefined,
    };
  }
  const panForestTriggered = (type === "pan" && !!active?.forestTreasureCollectDeadline && now.getTime() <= active.forestTreasureCollectDeadline.getTime());
  if (panForestTriggered) {
    ts.forestTreasureDone = true;
    ts.forestTreasureDoneAt = now.toISOString();
  }
  const panDailyTriggered = (type === "pan" && !!active?.forestDailyCollectDeadline && now.getTime() <= active.forestDailyCollectDeadline.getTime());
  if (panDailyTriggered) {
    ts.forestDailyDone = true;
    ts.forestDailyDoneAt = now.toISOString();
  }
  if (active?.id) {
    const activeId = String(active.id);
    ts.notifiedIds = Array.from(new Set([...(ts.notifiedIds || []).map(String).filter(Boolean), activeId]));
    ts.pendingIds = (ts.pendingIds || []).map(String).filter(Boolean).filter(id => id !== activeId);
  }
  if (type !== "originalSin" && type !== "updateTime") ts.lastDoneAt = now.toISOString();
  ts.count = Number(ts.count || 0) + 1;
  if (ts.count >= limit) {
    const removed = await cleanupPendingAndSync();
    if (removed?.length) removedThisTap = removedThisTap.concat(removed);
  }
  mergeAndSave();
  if (type !== "originalSin") {
    try {
      clearScheduleCacheByType("originalSin");
      await scheduleAllEvents(now, st);
    } catch (e) {
      console.error("OriginalSin reschedule failed after tap", e);
    }
  }
  return { ok:true, marked:true, reason:"marked", count: ts.count, limit, panForestTreasureDone: panForestTriggered, panForestDailyDone: panDailyTriggered };
}
function fmtLaKey(d) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ_LA, year:"numeric", month:"2-digit", day:"2-digit"
  }).format(d);
}
function laNoonDateFromKey(key) {
  const m = String(key || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  return new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
}
function uniq(arr) {
  const out = [];
  const seen = new Set();
  for (const v of (arr || [])) {
    const k = String(v);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}
async function openSkyApp() {
  try {
    Safari.open("sky://");
    return true;
  } catch (_) {
    return false;
  }
}
async function fetchAllPendingSafe() {
  try { return await Notification.allPending(); } catch (_) { return []; }
}
function _normalizeIdList(ids) {
  const list = (Array.isArray(ids) ? ids : [ids]).filter(Boolean).map(v => String(v));
  return Array.from(new Set(list));
}
function _collectIdsByThreadFromPending(pending, threadId) {
  const tid = String(threadId || "");
  if (!tid) return [];
  const ids = [];
  for (const n of (pending || [])) {
    if (String(n?.threadIdentifier || "") !== tid) continue;
    const id = String(n?.identifier || "");
    if (id) ids.push(id);
  }
  return ids;
}
function _collectPruneOutsideWindowIdsFromPending(pending, now, daysThreshold = 7) {
  const base = (now instanceof Date) ? now : new Date(now);
  const baseMs = base.getTime();
  const ms = (Number(daysThreshold) || 7) * MS_PER_DAY;
  const cutoffMs = baseMs + ms;
  const ids = [];
  for (const n of (pending || [])) {
    const id = String(n?.identifier || "");
    const th = String(n?.threadIdentifier || "");
    if (!id) continue;
    if (!NOTI_ID.isManagedId(id) && !NOTI_ID.isManagedThreadId(th)) continue;
    const dt = extractNotiTriggerDate(n);
    if (!dt) continue;
    const dtMs = dt.getTime();
    if (Number.isNaN(dtMs)) continue;
    if (dtMs < baseMs || dtMs >= cutoffMs) ids.push(id);
  }
  return ids;
}
async function removePendingIds(ids, pendingSnapshot=null) {
  const list = _normalizeIdList(ids);
  if (!list.length) return [];
  try {
    Notification.removePending(list);
  } catch (_) {
    for (const id of list) {
      try { Notification.removePending([id]); } catch (_) {}
    }
  }
  let pendingNow = null;
  try { pendingNow = await Notification.allPending(); } catch (_) { pendingNow = pendingSnapshot; }
  if (!pendingNow) return [];
  const pendingSet = new Set((pendingNow || []).map(n => String(n?.identifier || "")).filter(Boolean));
  return list.filter(id => !pendingSet.has(String(id)));
}
function _collectRemovalIdsFromSpecs(pending, specs) {
  const out = new Set();
  const list = Array.isArray(specs) ? specs : (specs ? [specs] : []);
  const HANDLERS = Object.freeze({
    ids: (sp) => { for (const id of _normalizeIdList(sp.ids || sp.id || [])) out.add(id); },
    thread: (sp) => { for (const id of _collectIdsByThreadFromPending(pending, sp.threadId)) out.add(String(id)); },
    pruneOutside: (sp) => { for (const id of _collectPruneOutsideWindowIdsFromPending(pending, sp.now, sp.daysThreshold || 7)) out.add(String(id)); },
  });
  for (const sp of list) {
    if (!sp) continue;
    const handler = HANDLERS[String(sp.kind || "")];
    if (handler) handler(sp);
  }
  return Array.from(out);
}
async function cancelPendingBySpecs(specs, pendingSnapshot=null) {
  const list = Array.isArray(specs) ? specs : (specs ? [specs] : []);
  const needsPending = list.some(sp => sp && String(sp.kind || "") !== "ids");
  const pending = needsPending ? (pendingSnapshot || await fetchAllPendingSafe()) : (pendingSnapshot || null);
  const ids = _collectRemovalIdsFromSpecs(pending || [], list);
  return await removePendingIds(ids, pending);
}
const GAME = {
  realms: ["草原", "雨林", "峡谷", "捨て地", "書庫"],
  patterns: [{skip:[6,7],off:110,maps:["蝶々の住処","小川","スケートリンク","倒壊した祠","星月夜の砂漠"],ac:0},{skip:[7,1],off:130,maps:["草原の村","晴れ間","スケートリンク","戦場","星月夜の砂漠"],ac:0},{skip:[1,2],off:460,maps:["洞窟","神殿奥","夢見の町","墓所","クラゲの入り江"],ac:2.5},{skip:[2,3],off:140,maps:["鳥の塔","ツリーハウス","夢見の町","難破船","クラゲの入り江"],ac:3.5},{skip:[3,4],off:210,maps:["楽園の島々","高台広場","隠者の峠","忘れられた方舟","クラゲの入り江"],ac:3.5}],
  shardConfig: { landOffsetMs: 520000, intervalMin: { red: 360, black: 480 }, durationMin: 240 }
};
const createEmptyEventInfo = (baseZ=0, lbl="", diff=0) => ({ isRed: false, baseZero: baseZ, type: { i:"", l:"" }, realm: "", map: "", placeName: computePlaceName("", ""), reward: null, occurrences: [], displayDate: new Date((baseZ || 0) + 1000), label: lbl, isToday: diff === 0 });
const C = (hex, alpha=1) => new Color(hex, alpha);
function getPalette(theme) {
  const isDark = theme === "dark";
  return {
    isDark,
    bgCtx: isDark ? [C("#1c1c1e"), C("#2c2c2e")] : [C("#f2f2f7"), C("#ffffff")],
    red: C("#ff3b30"),
    redDim: isDark ? C("#5e1c1c") : C("#ffcccc"),
    redFill: isDark ? C("#ff453a", 0.6) : C("#ff3b30", 0.3),
    black: isDark ? C("#d1d1d6") : C("#3a3a3c"),
    blackDim: isDark ? C("#7c7c80", 0.92) : C("#9a9aa0", 0.92),
    blackFill: isDark ? C("#f2f2f7", 0.42) : C("#1c1c1e", 0.42),
    signalTrack: isDark ? C("#48484a", 0.96) : C("#d1d1d6", 0.98),
    accent: C("#ffd60a"),
    text: isDark ? C("#ffffff") : C("#000000"),
    sub: C("#8e8e93"),
    ring: isDark ? C("#3a3a3c") : C("#e5e5ea"),
    active: C("#30d158"),
    cyan: isDark ? C("#00ffff") : C("#007aff"),
    orange: C("#ff9f0a"),
    signalWater: { red: C("#ff3b30", 0.85), green: C("#30d158", 0.85), orange: C("#ff9f0a", 0.85), blue: C("#0a84ff", 0.85) },
    handActive: C("#30d158"),
    handFuture: isDark ? C("#8e8e93", 0.98) : C("#c7c7cc", 0.98),
    ui: {
      bg: isDark ? "#1c1c1e" : "#f2f2f7",
      cardBg: isDark ? "#2c2c2e" : "#ffffff",
      text: isDark ? "#ffffff" : "#000000",
      border: isDark ? "#3a3a3c" : "#d1d1d6",
      btnBg: isDark ? "rgba(10,132,255,0.22)" : "rgba(10,132,255,0.12)",
      btnDangerBg: isDark ? "rgba(255,69,58,0.22)" : "rgba(255,59,48,0.14)",
      active: "#30d158",
      fabBg: "#0a84ff",
      fabFg: "#ffffff",
      fabRing: "rgba(10,132,255,0.35)",
      navGlassBg: isDark ? "rgba(28,28,30,0.75)" : "rgba(242,242,247,0.75)",
      footerGlassBg: isDark ? "rgba(44,44,46,0.85)" : "rgba(255,255,255,0.85)",
    },
    realms: {
      "草原": C("#4cd964"), "雨林": C("#64d2ff"), "峡谷": C("#ff9f0a"),
      "捨て地": C("#88c057"), "書庫": C("#0a84ff")
    }
  };
}
function drawEventLabels(ctx, drawFn, labels, isToday, PAL, s, align="left") {
  drawFn = (typeof drawFn === 'function') ? drawFn : drawTextHelpers.draw;
  if (!labels || !labels.length) return;
  labels.forEach(l => {
    const c = (isToday && l.isNow)
      ? (PAL.isDark ? C('#ffffff', 1.0) : C('#111111', 1.0))
      : (!isToday ? PAL.blackDim : l.isPast ? PAL.blackDim : PAL.text);
    drawFn(ctx, l.txt, l.r, l.font, c, align);
  });
}
const getClockRewardOpts = (PAD, y0, RAD, W, PAL) => ({ rect: new Rect(PAD, y0 + (RAD * 2) + 100, W - PAD, 72), font: Font.boldSystemFont(48), color: PAL.accent });
function drawClockHeaderBlock(ctx, info, W, PAL, PAD) {
  let y = 0;
  drawTextHelpers.draw(ctx, `${info.type.i}${info.type.l}${info.label}`, new Rect(PAD, y, W * 0.6, 84), Font.heavySystemFont(56), info.isRed ? PAL.red : PAL.text);
  drawTextHelpers.draw(ctx, F.dateLAFormat(info.displayDate), new Rect(W / 2, y, W / 2 - PAD, 84), Font.systemFont(56), PAL.sub, "right");
  y += 74;
  drawTextHelpers.draw(ctx, info.placeName, new Rect(PAD, y, W - PAD, 67), Font.boldSystemFont(48), PAL.realms[info.realm] || PAL.text);
  y += 67 + 50;
  return y;
}
function drawClockDialBase(ctx, cx, cy, RAD, PAL) {
  ctx.setStrokeColor(PAL.ring);
  ctx.setLineWidth(10);
  ctx.strokeEllipse(new Rect(cx - RAD, cy - RAD, RAD * 2, RAD * 2));
  [0.25, 0.5, 0.75].forEach(r => {
    const a = r * TAU - Math.PI / 2;
    const p = new Path();
    p.move(polarToPoint(cx, cy, (RAD - 10), a));
    p.addLine(polarToPoint(cx, cy, (RAD + 5), a));
    ctx.setStrokeColor(Color.gray());
    ctx.setLineWidth(2);
    ctx.addPath(p);
    ctx.strokePath();
  });
}
function makeCyclicTimeToRad(baseZero, cycleMs) {
  const bz = Number(baseZero || 0);
  const cyc = Number(cycleMs || MS_PER_DAY);
  return (d) => {
    let df = (d.getTime() - bz) % cyc;
    df = (df < 0) ? (df + cyc) : df;
    return (df / cyc) * TAU - (Math.PI / 2);
  };
}
function strokeOuterArcShared(ctx, cx, cy, r, sRad, eRad, color, lineWidth = 10, step = 0.12) {
  if (eRad < sRad) eRad += TAU;
  const p = new Path();
  p.move(polarToPoint(cx, cy, r, sRad));
  for (let a = sRad; a < eRad; a += step) p.addLine(polarToPoint(cx, cy, r, a));
  p.addLine(polarToPoint(cx, cy, r, eRad));
  ctx.setStrokeColor(color);
  ctx.setLineWidth(lineWidth);
  ctx.addPath(p);
  ctx.strokePath();
}
function drawClockHand(ctx, cx, cy, len, rad, color, lineWidth, dotR) {
  const hp = new Path();
  hp.move(new Point(cx, cy));
  hp.addLine(polarToPoint(cx, cy, len, rad));
  ctx.setStrokeColor(color);
  ctx.setLineWidth(lineWidth);
  ctx.addPath(hp);
  ctx.strokePath();
  ctx.setFillColor(color);
  ctx.fillEllipse(new Rect(cx - dotR, cy - dotR, dotR * 2, dotR * 2));
}
function drawCurrentTimeHand(ctx, cx, cy, RAD, PAL, timeRad, index, activeIndex) {
  const indices = Array.isArray(activeIndex) ? activeIndex : [activeIndex];
  const primaryIndex = Number(indices[0]);
  const secondaryIndex = Number(indices[1]);
  if (index !== primaryIndex && index !== secondaryIndex) return;
  const isPrimary = (index === primaryIndex);
  drawClockHand(
    ctx,
    cx,
    cy,
    RAD - 5,
    timeRad,
    isPrimary ? PAL.handActive : PAL.handFuture,
    isPrimary ? 5 : 5,
    isPrimary ? 6 : 6
  );
}
function drawClockTicksAndLabels(ctx, cx, cy, RAD, PAL, positions, angleForPos, opts) {
  const o = opts || {};
  const font = o.font || Font.systemFont(18);
  const labelColor = o.labelColor || PAL.text;
  const align = o.align || "center";
  for (const pos of positions) {
    const a = angleForPos(pos);
    if (!o.tickPredicate || o.tickPredicate(pos)) {
      const p = new Path();
      p.move(polarToPoint(cx, cy, RAD - (o.tickInner || 12), a));
      p.addLine(polarToPoint(cx, cy, RAD - (o.tickOuter || 2), a));
      ctx.setStrokeColor(o.tickColor || PAL.sub);
      ctx.setLineWidth(o.tickLineWidth || 2);
      ctx.addPath(p);
      ctx.strokePath();
    }
    if (o.labelText) {
      const txt = String(o.labelText(pos) ?? "");
      const r = (typeof o.labelRadius === "number") ? o.labelRadius : (RAD - 28);
      const w = (typeof o.labelW === "number") ? o.labelW : 40;
      const h = (typeof o.labelH === "number") ? o.labelH : 28;
      const ox = (typeof o.labelOX === "number") ? o.labelOX : (w / 2);
      const oy = (typeof o.labelOY === "number") ? o.labelOY : (h / 2);
      const pt = polarToPoint(cx, cy, r, a);
      drawTextHelpers.draw(ctx, txt, new Rect(pt.x - ox, pt.y - oy, w, h), font, labelColor, align);
    }
  }
}
function drawNumerals24(ctx, cx, cy, RAD, PAL, info) {
  const nf = Font.heavySystemFont(22);
  const baseHourLocal = F.localBaseHour(info.baseZero);
  const positions = Array.from({ length: 24 }, (_, h) => h);
  drawClockTicksAndLabels(ctx, cx, cy, RAD, PAL, positions, (h) => (h / 24) * TAU - Math.PI / 2, {
    font: nf,
    tickPredicate: (h) => (h % 2 === 0),
    tickInner: 12, tickOuter: 2, tickLineWidth: 2, tickColor: PAL.sub,
    labelRadius: RAD - 28, labelW: 36, labelH: 28, labelOX: 18, labelOY: 14,
    labelText: (h) => {
      let disp = (baseHourLocal + h) % 24;
      if (disp === 0) disp = 24;
      return disp;
    }
  });
}
function drawNumerals12(ctx, cx, cy, RAD, PAL) {
  const nf = Font.heavySystemFont(34);
  const positions = Array.from({ length: 12 }, (_, i) => i + 1);
  drawClockTicksAndLabels(ctx, cx, cy, RAD, PAL, positions, (n) => (n / 12) * TAU - Math.PI / 2, {
    font: nf,
    tickPredicate: () => true,
    tickInner: 12, tickOuter: 2, tickLineWidth: 2, tickColor: PAL.sub,
    labelRadius: RAD - 46, labelW: 44, labelH: 44, labelOX: 22, labelOY: 22,
    labelText: (n) => n
  });
}
function toLocalDate(val, settings) {
  const st = settings || loadSettings();
  return new Date((val instanceof Date ? val.getTime() : Number(val)) + Number(st.localOffset ?? 9) * MS_PER_HOUR);
}
const _LA_DATE_FMT = new Intl.DateTimeFormat("ja-JP", { timeZone: TZ_LA, month:'numeric', day:'numeric', weekday:'short' });
const WEEKDAYS_JA = Object.freeze(["日", "月", "火", "水", "木", "金", "土"]);
const F = {
  _getParts: function(d, settings) {
    const ld = toLocalDate(d, settings);
    return {
      y: ld.getUTCFullYear(),
      mo: String(ld.getUTCMonth() + 1).padStart(2, '0'),
      da: String(ld.getUTCDate()).padStart(2, '0'),
      h: String(ld.getUTCHours()).padStart(2, '0'),
      mi: String(ld.getUTCMinutes()).padStart(2, '0'),
      se: String(ld.getUTCSeconds()).padStart(2, '0'),
      wk: WEEKDAYS_JA[ld.getUTCDay()]
    };
  },
  localFullFormat: function(d, settings) {
    const p = this._getParts(d, settings);
    return `${p.y}/${p.mo}/${p.da} (${p.wk}) ${p.h}:${p.mi}:${p.se}`;
  },
  localBaseHour: function(baseZero, settings) {
    return toLocalDate(baseZero, settings).getUTCHours();
  },
  localTimeFormat: function(d, settings) {
    const p = this._getParts(d, settings);
    return `${p.h}:${p.mi}`;
  },
  dateLAFormat: function(d) {
    return _LA_DATE_FMT.format(d);
  },
  localInputFormat: function(d, settings) {
    const p = this._getParts(d, settings);
    return `${p.y}-${p.mo}-${p.da}T${p.h}:${p.mi}`;
  }
};
function getBaseZeroForTZ(date, tz) {
  const d = (date instanceof Date) ? date : new Date(date);
  const p = getVisualUTC(d, tz);
  const utcGuessMs = Date.UTC(p.y, p.mo - 1, p.d, 0, 0, 0);
  let guess = new Date(utcGuessMs);
  let off1 = tzOffsetMinutes(guess, tz);
  let res = new Date(utcGuessMs + off1 * MS_PER_MIN);
  let off2 = tzOffsetMinutes(res, tz);
  if (off2 !== off1) res = new Date(utcGuessMs + off2 * MS_PER_MIN);
  return res.getTime();
}
function computePlaceName(realm, map) {
  const r = String(realm || "").trim();
  const m = String(map || "").trim();
  if (!r) return "—";
  if (m && m !== "—") return `${r} - ${m}`;
  return r;
}
const _SHARD_INFO_CACHE = new Map();
function getShardInfo(targetDate) {
  const t = new Date(targetDate);
  const cacheKey = fmtLaKey(t);
  if (_SHARD_INFO_CACHE.has(cacheKey)) return _SHARD_INFO_CACHE.get(cacheKey);
  const p = getVisualUTC(t, TZ_LA);
  const wk = { Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6, Sun:7 }[p.weekday];
  const pY = p.y, pM = p.mo, pD = p.d;
  const isRed = (pD % 2 !== 0);
  const pIdx = isRed ? (Math.floor((pD - 1) / 2) % 3) + 2 : Math.floor(pD / 2) % 2;
  const ptrn = GAME.patterns[pIdx];
  if (ptrn.skip.includes(wk)) {
    _SHARD_INFO_CACHE.set(cacheKey, null);
    return null;
  }
  const baseZero = Date.UTC(pY, pM - 1, pD) + (t.getTime() - p.visualUTC);
  const sc = GAME.shardConfig;
  const interval = isRed ? sc.intervalMin.red : sc.intervalMin.black;
  const realm = GAME.realms[(pD - 1) % 5];
  const map = ptrn.maps[(pD - 1) % 5];
  const placeName = computePlaceName(realm, map);
  const nextBaseZero = getBaseZeroForTZ(new Date(baseZero + 26 * MS_PER_HOUR), TZ_LA);
  const occurrences = [0, 1, 2].map(i => {
    const s = baseZero + (ptrn.off + interval * i) * MS_PER_MIN;
    const rawStartMs = s + sc.landOffsetMs;
    const rawEndMs = s + sc.durationMin * MS_PER_MIN;
    const cStartMs = Math.max(rawStartMs, baseZero);
    const cEndMs = Math.min(rawEndMs, nextBaseZero);
    return (cStartMs < cEndMs) ? { start: new Date(cStartMs), end: new Date(cEndMs) } : null;
  }).filter(Boolean);
  const info = {
    isRed, baseZero,
    type: isRed ? { i:"🔴", l:"[赤] " } : { i:"⚫️", l:"[黒] " },
    realm, map, placeName,
    reward: isRed ? ptrn.ac : null,
    occurrences
  };
  _SHARD_INFO_CACHE.set(cacheKey, info);
  return info;
}
function getRelativeDayLabel(diff, isLocalAheadOfGame) {
  if (diff === 0) return "今日";
  if (diff === 1) return isLocalAheadOfGame ? "更新後" : "明日";
  const adj = isLocalAheadOfGame ? (diff - 1) : diff;
  if (adj === 1) return "明日";
  if (adj === 2) return "明後日";
  return `${adj}日後`;
}
function fetchDayInfoWithLabel(baseZeroGameNow, isLocalAheadOfGame, diffOffset) {
  const diff = Number(diffOffset) || 0;
  const checkBaseZero = baseZeroGameNow + diff * MS_PER_DAY;
  const checkDate = new Date(checkBaseZero + 12 * MS_PER_HOUR);
  const realBaseZero = getBaseZeroForTZ(checkDate, TZ_LA);
  const info = getShardInfo(checkDate);
  const label = getRelativeDayLabel(diff, isLocalAheadOfGame);
  return { diff, label, info, baseZero: realBaseZero, checkDate };
}
const _enhanceDayInfo = (info, diff, label) => {
  if (!info || typeof info !== "object") return info;
  info.displayDate = new Date(info.baseZero + 1000);
  info.label = label;
  info.isToday = (diff === 0);
  return info;
};
function getUpcoming(now, count) {
  const list = [];
  const { baseZeroGameNow, isLocalAheadOfGame } = getLocalAheadState(now, loadSettings());
  let off = 0;
  while (list.length < count && off < 15) {
    const dayInfo = fetchDayInfoWithLabel(baseZeroGameNow, isLocalAheadOfGame, off);
    const info = dayInfo.info;
    if (info) {
      const hasFuture = info.occurrences.some(o => o.end > now);
      if (dayInfo.diff >= 0 && (hasFuture || dayInfo.diff === 0)) {
        list.push(_enhanceDayInfo(info, dayInfo.diff, dayInfo.label));
      }
    }
    off++;
  }
  return list;
}
function getUpcomingFixedDays(now, count) {
  const { baseZeroGameNow, isLocalAheadOfGame } = getLocalAheadState(now, loadSettings());
  const out = [];
  for (let diff = 0; diff < count; diff++) {
    const dayInfo = fetchDayInfoWithLabel(baseZeroGameNow, isLocalAheadOfGame, diff);
    const info = dayInfo.info;
    if (info) {
      out.push(_enhanceDayInfo(info, dayInfo.diff, dayInfo.label));
    } else {
      out.push(createEmptyEventInfo(dayInfo.baseZero, dayInfo.label, dayInfo.diff));
    }
  }
  return out;
}
function build12hWindows(now, count) {
  const win = [];
  const MS_12H = 12 * MS_PER_HOUR;
  const updateBase = getBaseZeroForTZ(now, TZ_LA);
  const splitBoundaries = new Set([updateBase + MS_12H, updateBase + MS_12H * 3]);
  const todayInfo = getShardInfo(new Date(updateBase + 1000));
  const tomorrowInfo = getShardInfo(new Date(updateBase + 36 * MS_PER_HOUR));
  const daysToScan = 10;
  const all = [];
  for (let off = 0; off < daysToScan; off++) {
    const d = new Date(updateBase + off * MS_PER_DAY + 12 * MS_PER_HOUR);
    const info = getShardInfo(d);
    if (!info) continue;
    info.occurrences.forEach(o => all.push({ start: o.start, end: o.end, isRed: info.isRed }));
  }
  for (let i = 0; i < count; i++) {
    const ws = updateBase + i * MS_12H;
    const we = ws + MS_12H;
    const header = (i < 2 ? todayInfo : tomorrowInfo) || createEmptyEventInfo(ws, "", i === 0 ? 0 : i);
    const occ = all.filter(e => e.start.getTime() < we && e.end.getTime() > ws).sort((a,b) => a.start - b.start).map(e => {
        const segStart = new Date(Math.max(e.start.getTime(), ws));
        const segEnd   = new Date(Math.min(e.end.getTime(), we));
        const cutAtStart = e.start.getTime() < ws;
        const cutAtEnd   = e.end.getTime() > we;
        let boundaryLabelText = null, boundaryLabelTime = null, dashedBoundaryTime = null;
        if (splitBoundaries.has(we) && cutAtEnd) {
          boundaryLabelText = `~${F.localTimeFormat(e.end)}`; boundaryLabelTime = new Date(we); dashedBoundaryTime = new Date(we);
        } else if (splitBoundaries.has(ws) && cutAtStart) {
          boundaryLabelText = `${F.localTimeFormat(e.start)}~`; boundaryLabelTime = new Date(ws); dashedBoundaryTime = new Date(ws);
        }
        return { start: segStart, end: segEnd, isRed: e.isRed, origStart: e.start, origEnd: e.end, boundaryLabelText, boundaryLabelTime, dashedBoundaryTime };
      });
    win.push({
      updateBase, baseZero: ws, isRed: header.isRed, type: header.type, realm: header.realm, map: header.map, placeName: computePlaceName(header.realm, header.map), reward: header.reward ?? null,
      occurrences: occ, displayDate: new Date(ws), label: (header.label ? header.label : "") + (i % 2 === 0 ? "前半" : "後半"), isToday: (i === 0)
    });
  }
  return win;
}
function getSignalState(now, scanDays = 5) {
  const days = getUpcomingFixedDays(now, Math.max(2, Number(scanDays) || 5));
  const entries = [];
  (Array.isArray(days) ? days : []).forEach((info) => {
    if (!info || !Array.isArray(info.occurrences) || !info.occurrences.length) return;
    info.occurrences.forEach((o) => {
      if (!o || !isValidDate(o.start) || !isValidDate(o.end) || o.end.getTime() <= o.start.getTime()) return;
      entries.push({ start: o.start, end: o.end, isRed: !!info.isRed, realm: info.realm, map: info.map });
    });
  });
  entries.sort((a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime());
  let activeEvent = null;
  let nextEvent = null;
  for (const entry of entries) {
    if (!activeEvent && now >= entry.start && now < entry.end) {
      activeEvent = entry;
      continue;
    }
    if (now < entry.start) {
      nextEvent = entry;
      break;
    }
  }
  return { activeEvent, nextEvent, displayEvent: activeEvent || nextEvent || null, entries };
}
