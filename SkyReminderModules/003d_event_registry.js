  const generated = generateOriginalSinSchedules(refNow instanceof Date ? refNow : getEffectiveNowFromRef(refNow, st), laKey, st);
  return `このSky日: ${laKey}<br>ローカル窓: ${formatLocalSkyWindowLabel(win, st)}<br>探索開始: ${F.localTimeFormat(searchStart, st)} / 有効な拘束: ${labels.length ? labels.join(' / ') : 'なし'} / 生成候補: ${generated.length}件`;
}
function generateDyeSchedules(now, laKey, settings) {
  const st = settings || loadSettings();
  const cfg = getActConfig(st, "dye") || {};
  if (cfg.enabled === false) return [];
  const pack = collectDyeItemsForLaKey(laKey, st, cfg) || {};
  const items = Array.isArray(pack.items) ? pack.items : [];
  const title = String(pack.title || "🎨 染料");
  const out = [];
  const intervalHours = normalizeDyeIntervalHours(cfg.intervalHours);
  for (let idx = 0; idx < items.length; idx++) {
    const o = items[idx];
    if (!o || !isValidDate(o.start) || !isValidDate(o.end) || o.end.getTime() <= o.start.getTime()) continue;
    const slotIndex = Number.isFinite(Number(o?.slotIndex)) ? Number(o.slotIndex) : idx;
    const moveOffsetMin = Number.isFinite(Number(cfg.moveOffsetMin)) ? Number(cfg.moveOffsetMin) : 0;
    const bufferMin = Number.isFinite(Number(cfg.bufferMin)) ? Number(cfg.bufferMin) : 5;
    const taskDurationMin = Number.isFinite(Number(cfg.taskDurationMin)) ? Number(cfg.taskDurationMin) : 15;
    const tapWindowStart = (intervalHours === 2)
      ? addMs(o.end, -(moveOffsetMin + taskDurationMin + bufferMin) * MS_PER_MIN)
      : addMs(o.start, -(moveOffsetMin + bufferMin) * MS_PER_MIN);
    const tapWindowEnd = addMs(o.end, -(moveOffsetMin + taskDurationMin) * MS_PER_MIN);
    if (tapWindowEnd.getTime() < tapWindowStart.getTime()) continue;
    out.push({
      type: "dye",
      idx: slotIndex,
      id: NOTI_ID.buildId(ID_PREFIX.ACT, "dye", laKey, slotIndex, !!st.testMode),
      title,
      body: `${formatTimeRange(tapWindowStart, tapWindowEnd, st)}`,
      notifyAt: tapWindowStart,
      realNotifyAt: tapWindowStart,
      tapWindowStart,
      tapWindowEnd,
      blockStart: tapWindowStart,
      blockEnd: o.end,
      openSkyOnTap: true,
    });
  }
  return out;
}
const EVENT_META_REGISTRY = Object.freeze({
  shards: Object.freeze({
    type: "shards",
    prefix: ID_PREFIX.SHARDS,
    tapAction: ACTION.TAP,
    laKeys: ({ laKeyToday, laKeyNext }) => (laKeyNext && laKeyNext !== laKeyToday) ? [laKeyToday, laKeyNext] : [laKeyToday],
    getConfig: (s) => {
      const st = s || loadSettings();
      const shardNotify = st?.shardNotify || DEFAULT_SETTINGS.shardNotify;
      const shardTap = st?.shardTap || DEFAULT_SETTINGS.shardTap;
      const redOn = _isRedOn(shardNotify);
      const blackOn = _isBlackOn(shardNotify);
      return {
        enabled: shardNotify?.enabled !== false,
        moveOffsetMin: Number.isFinite(Number(shardTap?.moveOffsetMin)) ? Number(shardTap.moveOffsetMin) : Number(DEFAULT_SETTINGS.shardTap?.moveOffsetMin ?? 0),
        taskDurationMin: Number.isFinite(Number(shardTap?.taskDurationMin)) ? Number(shardTap.taskDurationMin) : Number(DEFAULT_SETTINGS.shardTap?.taskDurationMin ?? 10),
        bufferMin: Number.isFinite(Number(shardTap?.bufferMin)) ? Number(shardTap.bufferMin) : Number(DEFAULT_SETTINGS.shardTap?.bufferMin ?? 3),
        redEnabled: redOn,
        blackEnabled: blackOn,
        dailyLimit: 1,
      };
    },
    getDailyLimit: (_s, laKey) => {
      const st = _s || loadSettings();
      const shardNotify = st?.shardNotify || DEFAULT_SETTINGS.shardNotify;
      if (shardNotify?.enabled === false) return 0;
      if (!laKey) return 1;
      const d = laNoonDateFromKey(laKey);
      const info = d ? getShardInfo(d) : null;
      if (!info || !Array.isArray(info.occurrences) || !info.occurrences.length) return 0;
      const redOn = _isRedOn(shardNotify);
      const blackOn = _isBlackOn(shardNotify);
      if (info.isRed && !redOn) return 0;
      if (!info.isRed && !blackOn) return 0;
      return 1;
    },
    isEnabled: (s) => (s || loadSettings())?.shardNotify?.enabled !== false,
    fallbackTitle: (_s) => "☄ 闇の破片",
    collect: (laKey, s, _cfg) => {
      const d = laNoonDateFromKey(laKey);
      const info = d ? getShardInfo(d) : null;
      if (!info || !Array.isArray(info.occurrences) || !info.occurrences.length) return { title: "☄ 闇の破片", items: [] };
      if ((info.isRed && !_cfg?.redEnabled) || (!info.isRed && !_cfg?.blackEnabled)) return { title: "☄ 闇の破片", items: [] };
      const title = `${info.type.i}${info.type.l} ${info.realm} ${info.map}`;
      const items = info.occurrences.map(o => ({ start: o.start, end: o.end, occ: o }));
      return { title, items };
    },
    formatBody: ({ occ }) => {
      const o = occ?.occ || occ;
      if (!o) return "";
      return `${formatTimeRange(o.start, o.end)}`;
    },
    ui: Object.freeze({
      title: (_s) => "☄ 闇の破片",
      desc: '独自のスケジュールで落下します。<br>※期間限定イベントと場所が重なる日は、落下場所が変更される場合があります。（詳しくは <a href="https://sky-shards.pages.dev/ja" target="_blank" style="color:var(--fab-bg);text-decoration:underline;">こちら</a> を参照）',
      hideMainToggle: true,
      enabledPath: "shardNotify.enabled",
      fields: Object.freeze([
        Object.freeze({ label: "🔴 赤の破片", path: "shardNotify.redEnabled", type: "boolean", def: true }),
        Object.freeze({ label: "⚫️ 黒の破片", path: "shardNotify.blackEnabled", type: "boolean", def: false }),
        Object.freeze({ type: "count", label: "本日の完了回数", path: `_count.shards` }),
        ...getCommonOffsetFields("shardTap.moveOffsetMin", "shardTap.taskDurationMin", "shardTap.bufferMin", 0, 10, 3, 240),
      ]),
    }),
  }),
  updateTime: Object.freeze({
    type: "updateTime",
    prefix: ID_PREFIX.ACT,
    tapAction: ACTION.OPEN_ONLY,
    laKeys: ({ laKeyToday, laKeyNext }) => (laKeyNext && laKeyNext !== laKeyToday) ? [laKeyToday, laKeyNext] : [laKeyToday],
    getConfig: (s) => getActConfig(s || loadSettings(), "updateTime"),
    getDailyLimit: (_s) => 0,
    isEnabled: (s) => {
      const cfg = getActConfig(s || loadSettings(), "updateTime");
      return !!cfg && cfg.enabled !== false;
    },
    fallbackTitle: (s) => String(getActConfig(s || loadSettings(), "updateTime")?.title || "⏰ 更新時刻"),
    generate: (now, laKey, s2) => generateUpdateTimeSchedules(now, laKey, s2),
    ui: Object.freeze({
      title: (_s) => "⏰ 更新時刻",
      desc: "デイリー更新時刻の少し前に通知します。<br>必要な設定は <b>オン/オフ</b> と <b>保険時間</b> だけです。",
      enabledPath: "notify.updateTime.enabled",
      hideRemain: true,
      fields: Object.freeze([
        Object.freeze({ label: "保険時間(分)", path: "notify.updateTime.bufferMin", def: 3, min: 0, max: 99 }),
      ]),
    }),
  }),
  originalSin: Object.freeze({
    type: "originalSin",
    prefix: ID_PREFIX.ACT,
    tapAction: ACTION.OPEN_ONLY,
    laKeys: ({ laKeyToday, laKeyNext }) => (laKeyNext && laKeyNext !== laKeyToday) ? [laKeyToday, laKeyNext] : [laKeyToday],
    getConfig: (s) => normalizeOriginalSinConfig(getActConfig(s || loadSettings(), "originalSin") || {}),
    getDailyLimit: (_s) => 0,
    isEnabled: (s) => {
      const cfg = getActConfig(s || loadSettings(), "originalSin");
      return !!cfg && cfg.enabled !== false;
    },
    fallbackTitle: (s) => String(getActConfig(s || loadSettings(), "originalSin")?.title || "⚖️ 原罪"),
    generate: (now, laKey, s2) => generateOriginalSinSchedules(now, laKey, s2),
    ui: Object.freeze({
      title: (_s) => "⚖️ 原罪",
      desc: "毎週日曜の更新で完了状態がリセットされます。<br>未完了の間だけ、定時 / 更新からの相対時刻 / 空き時間探索で通知できます。",
      enabledPath: "notify.originalSin.enabled",
      hideRemain: true,
      fields: Object.freeze([
        Object.freeze({ type: "button", label: "完了", action: "originalsincomplete", text: "今週の原罪を完了扱いにする", stateKey: "weekDone" }),
        Object.freeze({ type: "boolean", label: "定時実行", path: "notify.originalSin.fixedEnabled", def: true }),
        Object.freeze({ type: "timeList", label: "定時実行の時刻", path: "notify.originalSin.fixedTimes" }),
        Object.freeze({ type: "boolean", label: "更新時刻からの相対通知", path: "notify.originalSin.sinceResetEnabled", def: false }),
        Object.freeze({ type: "offsetList", label: "相対通知の時刻", path: "notify.originalSin.sinceResetTimes" }),
        Object.freeze({ type: "boolean", label: "空き時間探索", path: "notify.originalSin.idleWindowEnabled", def: false }),
        Object.freeze({ label: "原罪完了に必要な時間(分)", path: "notify.originalSin.taskDurationMin", def: 60, min: 1, max: 360 }),
        Object.freeze({ label: "再通知間隔(分)", path: "notify.originalSin.repeatEveryMin", def: 180, min: 5, max: 720 }),
        Object.freeze({ label: "開始時刻(時)", path: "notify.originalSin.searchStartHour", def: 18, min: 0, max: 23 }),
        Object.freeze({ label: "開始時刻(分)", path: "notify.originalSin.searchStartMinute", def: 0, min: 0, max: 59 }),
      ]),
    }),
  }),
  dye: Object.freeze({
    type: "dye",
    prefix: ID_PREFIX.ACT,
    tapAction: ACTION.OPEN_ONLY,
    laKeys: ({ laKeyToday, laKeyNext }) => (laKeyNext && laKeyNext !== laKeyToday) ? [laKeyToday, laKeyNext] : [laKeyToday],
    getConfig: (s) => {
      const cfg = getActConfig(s || loadSettings(), "dye");
      return { ...cfg, intervalHours: Number(cfg.intervalHours) === 2 ? 2 : 1 };
    },
    getDailyLimit: (_s) => 0,
    isEnabled: (s) => {
      const cfg = getActConfig(s || loadSettings(), "dye");
      return !!cfg && cfg.enabled !== false;
    },
    fallbackTitle: (s) => String(getActConfig(s || loadSettings(), "dye")?.title || "🎨 染料"),
    generate: (now, laKey, s2) => generateDyeSchedules(now, laKey, s2),
    ui: Object.freeze({
      title: (_s) => "🎨 染料",
      desc: "毎時間 <b>00分〜59分</b> に発生します。<br>通知頻度は <b>1時間に1回</b> または <b>2時間に1回</b> を選択できます。",
      enabledPath: "notify.dye.enabled",
      hideRemain: true,
      fields: Object.freeze([
        Object.freeze({
          type: "choice",
          label: "通知頻度",
          path: "notify.dye.intervalHours",
          def: 1,
          options: Object.freeze([{ value: 1, label: "1時間に1回" }, { value: 2, label: "2時間に1回" }]),
        }),
        ...getCommonOffsetFields("notify.dye.moveOffsetMin", "notify.dye.taskDurationMin", "notify.dye.bufferMin", 0, 15, 5, 59),
        Object.freeze({ type: "button", label: "完了", action: "dyecomplete", text: "この周期の通知を完了扱いにする" }),
      ]),
    }),
  }),
  uni: makeActMeta("uni", "uni", "デイリー更新時刻から 2時間ごと の <b>05分〜15分</b>", 10, null, 3, 10, 3),
  pan: Object.freeze({
    ...makeActMeta("pan", "pan", "デイリー更新時刻から 2時間ごと の <b>35分〜45分</b>", 10, null, 2, 10, 3),
    collect: (laKey, s, cfg) => collectPanItemsForLaKey(laKey, s, cfg),
    generate: (now, laKey, s2) => generatePanSchedules(now, laKey, s2),
    ui: Object.freeze({
      title: (s) => String(getActConfig(s || loadSettings(), "pan")?.title || "🍞 パン"),
      desc: "デイリー更新時刻から 2時間ごと の <b>35分〜45分</b>。<br>雨林に大キャンまたはデイリーがある日は、必要に応じて通知を前倒しできます。",
      enabledPath: "notify.pan.enabled",
      fields: Object.freeze([
        Object.freeze({ type: "count", label: "本日の完了回数", path: `_count.pan` }),
        Object.freeze({ label: "1日の目標完了回数", path: "notify.pan.dailyLimit", def: 2, min: 0 }),
        Object.freeze({ type: "boolean", label: "雨林大キャン前倒し", path: "notify.pan.forestTreasureEnabled", def: true }),
        Object.freeze({ label: "雨林大キャン回収に必要な時間(分)", path: "notify.pan.forestTreasureDurationMin", def: 10, min: 0, max: 99 }),
        Object.freeze({ type: "button", label: "完了", action: "pantreasurecomplete", text: "雨林大キャン回収を完了扱いにする", stateKey: "forestTreasureDone" }),
        Object.freeze({ type: "boolean", label: "雨林デイリー前倒し", path: "notify.pan.forestDailyEnabled", def: true }),
        Object.freeze({ label: "雨林デイリーに必要な時間(分)", path: "notify.pan.forestDailyDurationMin", def: 10, min: 0, max: 99 }),
        Object.freeze({ type: "button", label: "完了", action: "pandailycomplete", text: "雨林デイリーを完了扱いにする", stateKey: "forestDailyDone" }),
        ...getCommonOffsetFields("notify.pan.moveOffsetMin", "notify.pan.taskDurationMin", "notify.pan.bufferMin", 2, 8, 3, 10),
      ]),
    }),
  }),
  turtle: makeActMeta("turtle", "turtle", "デイリー更新時刻から 2時間ごと の <b>50分〜00分</b>", 10, null, 3, 7, 3),
  race: Object.freeze({
    ...makeActMeta("race", "race", "オーロラコンサート以外の時間（通常は <b>58分〜翌10分</b>、DST切替日は変動）", 72, { evenPst: true, minute: 58 }, 5, 10, 3),
    collect: (laKey, s, cfg) => collectRaceItemsForLaKey(laKey, s, cfg),
  }),
});
function buildEventProviders(settings) {
  const st = settings || loadSettings();
  const makeIdBuilders = (meta) => ({
    buildThreadId: (_s, laKey) => NOTI_ID.buildThread(meta.prefix, meta.type, laKey, false),
    buildTestThreadId: (_s, laKey) => NOTI_ID.buildThread(meta.prefix, meta.type, laKey, true),
    buildTestId: (_s, laKey, tag) => NOTI_ID.buildTestId(meta.prefix, meta.type, laKey, tag),
    buildId: (s, laKey, idx) => NOTI_ID.buildId(meta.prefix, meta.type, laKey, idx, !!(s||loadSettings()).testMode),
  });
  const metas = Object.keys(EVENT_META_REGISTRY).map(k => EVENT_META_REGISTRY[k]);
  const list = metas.map(meta => {
    const ui = meta.ui || {};
    return {
      ...makeIdBuilders(meta),
      type: meta.type,
      prefix: meta.prefix,
      tapAction: meta.tapAction,
      laKeys: meta.laKeys,
      isEnabled: meta.isEnabled,
      getDailyLimit: (s, laKey) => meta.getDailyLimit(s, laKey),
      fallbackTitle: meta.fallbackTitle,
      generate: (typeof meta.generate === "function")
        ? ((now, laKey, s2) => meta.generate(now, laKey, s2))
        : ((now, laKey, s2) => generateEventSchedules(meta.type, now, laKey, s2)),
      ui: {
        title: (typeof ui.title === "function") ? ui.title(st) : String(ui.title || meta.fallbackTitle(st) || meta.type),
        desc: (typeof ui.desc === "function") ? String(ui.desc(st) || "") : String(ui.desc || ""),
        hideMainToggle: !!ui.hideMainToggle,
        enabledPath: String(ui.enabledPath || ""),
        fields: Array.isArray(ui.fields) ? ui.fields : [],
      },
    };
