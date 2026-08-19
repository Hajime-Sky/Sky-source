// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: yellow; icon-glyph: jedi;

const SKY_CANDLE_RUNTIME_REL = "HajimeSkyTools/treasure-candles/runtime-v1.js";
const SKY_CANDLE_RUNTIME_URL = "https://raw.githubusercontent.com/Hajime-Sky/Sky-source/main/HajimeSkyTools/treasure-candles/runtime-v1.js";

function skyCandleRuntimeManager() {
  try { return FileManager.iCloud(); } catch (_) { return FileManager.local(); }
}
function skyCandleRuntimePath(fm) {
  let dir = fm.documentsDirectory();
  const parts = SKY_CANDLE_RUNTIME_REL.split("/");
  for (const part of parts.slice(0, -1)) {
    dir = fm.joinPath(dir, part);
    if (!fm.fileExists(dir)) fm.createDirectory(dir, true);
  }
  return fm.joinPath(dir, parts[parts.length - 1]);
}
async function skyCandleLoadRuntime() {
  const fm = skyCandleRuntimeManager();
  const path = skyCandleRuntimePath(fm);
  if (!fm.fileExists(path)) {
    const req = new Request(SKY_CANDLE_RUNTIME_URL);
    req.timeoutInterval = 30;
    const text = await req.loadString();
    if (!text || !text.includes("const TREASURE_CANDLE_CYCLE") || !text.includes("function calcForCurrentLATime")) {
      throw new Error("大キャン案内の本体を取得できませんでした");
    }
    fm.writeString(path, text);
  }
  try {
    if (typeof fm.isFileDownloaded === "function" && !fm.isFileDownloaded(path)) await fm.downloadFileFromiCloud(path);
  } catch (_) {}
  const text = fm.readString(path);
  if (!text || !text.includes("const TREASURE_CANDLE_CYCLE") || !text.includes("function calcForCurrentLATime")) {
    throw new Error("大キャン案内の本体を読み込めませんでした");
  }
  return text;
}
function skyCandlePatchRuntime(source) {
  let s = String(source || "");
  const renderMarker = "function renderWidgetImageWithDate(image, family, dateText) {";
  const helper = `const SKY_CANDLE_WIDGET_RENDER_CACHE_REV = "2026-08-19-v3";
function getTreasureWidgetLocalDateContext(reference = new Date()) {
  const d = reference instanceof Date ? reference : new Date(reference);
  const common = readSkyCommonSettingsSafe();
  if (common && common.timezone && common.timezone.mode === "manual") {
    const offsetHours = Number(common.timezone.utcOffsetHours);
    if (Number.isFinite(offsetHours)) {
      const offsetMinutes = offsetHours * 60;
      const shifted = new Date(d.getTime() + offsetMinutes * 60 * 1000);
      return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate(), offsetMinutes, manual: true };
    }
  }
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(), offsetMinutes: -d.getTimezoneOffset(), manual: false };
}
function formatTreasureWidgetDateText(reference, skyYMD) {
  const local = getTreasureWidgetLocalDateContext(reference);
  const localKey = String(local.year).padStart(4, "0") + "-" + String(local.month).padStart(2, "0") + "-" + String(local.day).padStart(2, "0");
  const skyKey = /^\\d{4}-\\d{2}-\\d{2}$/.test(String(skyYMD || "")) ? String(skyYMD) : localKey;
  let laOffsetMinutes = Number(local.offsetMinutes);
  try {
    const laInfo = getLaOffsetInfo(reference);
    const n = Number(laInfo && laInfo.offsetMinutes);
    if (Number.isFinite(n)) laOffsetMinutes = n;
  } catch (_) {}
  let phase = "更新後";
  if (Number(local.offsetMinutes) > laOffsetMinutes) {
    phase = localKey > skyKey ? "更新前" : "更新後";
  } else if (Number(local.offsetMinutes) < laOffsetMinutes) {
    phase = localKey < skyKey ? "更新後" : "更新前";
  }
  return String(local.month) + "月" + String(local.day) + "日　" + phase;
}
function treasureWidgetRenderCacheEnabled() {
  const common = readSkyCommonSettingsSafe();
  return !(common && common.cache && common.cache.enabled === false);
}
function treasureWidgetRenderCacheHash(text) {
  let h = 2166136261;
  const s = String(text || "");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
function treasureWidgetRenderCacheDir() {
  const fm = getICloudFileManager();
  let dir = fm.documentsDirectory();
  for (const part of ["HajimeSkyTools", "treasure-candles", "widget-render-cache"]) {
    dir = fm.joinPath(dir, part);
    if (!fm.fileExists(dir)) fm.createDirectory(dir, true);
  }
  return { fm, dir };
}
function treasureWidgetCodeSourceStamp() {
  try {
    const fm = getICloudFileManager();
    const root = fm.documentsDirectory();
    const paths = [
      "HajimeSkyTools/common-settings.js",
      "HajimeSkyTools/treasure-candles/runtime-v1.js"
    ];
    try {
      const scriptName = String(Script.name() || "");
      if (scriptName) paths.push(scriptName + ".js");
    } catch (_) {}
    return paths.map(rel => {
      try {
        const path = fm.joinPath(root, rel);
        if (!fm.fileExists(path)) return rel + ":missing";
        const d = typeof fm.modificationDate === "function" ? fm.modificationDate(path) : null;
        const size = typeof fm.fileSize === "function" ? Number(fm.fileSize(path)) || 0 : 0;
        return rel + ":" + String(d instanceof Date ? d.getTime() : 0) + ":" + String(size);
      } catch (_) { return rel + ":error"; }
    }).join("|");
  } catch (_) { return SKY_CANDLE_WIDGET_RENDER_CACHE_REV; }
}
function treasureWidgetCacheGeneration() {
  if (globalThis.__SKY_CANDLE_WIDGET_CACHE_GENERATION) return globalThis.__SKY_CANDLE_WIDGET_CACHE_GENERATION;
  const d = treasureWidgetRenderCacheDir();
  const stamp = treasureWidgetCodeSourceStamp();
  const marker = d.fm.joinPath(d.dir, "source-generation.txt");
  let previous = "";
  try {
    if (d.fm.fileExists(marker)) previous = d.fm.readString(marker);
  } catch (_) {}
  if (previous !== stamp) {
    try {
      for (const name of d.fm.listContents(d.dir)) {
        if (name === "source-generation.txt") continue;
        try { d.fm.remove(d.fm.joinPath(d.dir, name)); } catch (_) {}
      }
    } catch (_) {}
    try { d.fm.writeString(marker, stamp); } catch (_) {}
  }
  globalThis.__SKY_CANDLE_WIDGET_CACHE_GENERATION = stamp;
  return stamp;
}
function treasureWidgetSourceStamp(label) {
  try {
    const fm = getICloudFileManager();
    const path = getImagePath(label);
    if (!fm.fileExists(path)) return "";
    const d = typeof fm.modificationDate === "function" ? fm.modificationDate(path) : null;
    const size = typeof fm.fileSize === "function" ? Number(fm.fileSize(path)) || 0 : 0;
    return String(d instanceof Date ? d.getTime() : "") + ":" + String(size);
  } catch (_) { return ""; }
}
function treasureWidgetDeviceScale() {
  try { return Math.max(1, Number(Device.screenScale()) || 2); } catch (_) { return 2; }
}
function treasureWidgetRenderDescriptor(res, family, reference) {
  const label = String(res && res.pattern && res.pattern.label || "");
  const dateText = formatTreasureWidgetDateText(reference, res && res.skyYMD);
  const raw = JSON.stringify({
    rev: SKY_CANDLE_WIDGET_RENDER_CACHE_REV,
    generation: treasureWidgetCacheGeneration(),
    family: String(family || "medium"),
    label,
    skyYMD: String(res && res.skyYMD || ""),
    dateText,
    scale: treasureWidgetDeviceScale(),
    source: treasureWidgetSourceStamp(label)
  });
  const { fm, dir } = treasureWidgetRenderCacheDir();
  const path = fm.joinPath(dir, treasureWidgetRenderCacheHash(raw) + ".png");
  return { fm, dir, path, dateText, raw };
}
function treasureWidgetHasRenderedCache(res, family, reference) {
  if (!treasureWidgetRenderCacheEnabled()) return false;
  try {
    const d = treasureWidgetRenderDescriptor(res, family, reference);
    return d.fm.fileExists(d.path);
  } catch (_) { return false; }
}
async function treasureWidgetReadRenderedCache(res, family, reference) {
  if (!treasureWidgetRenderCacheEnabled()) return null;
  try {
    const d = treasureWidgetRenderDescriptor(res, family, reference);
    if (!d.fm.fileExists(d.path)) return null;
    try {
      if (typeof d.fm.isFileDownloaded === "function" && !d.fm.isFileDownloaded(d.path)) await d.fm.downloadFileFromiCloud(d.path);
    } catch (_) {}
    return d.fm.readImage(d.path);
  } catch (_) { return null; }
}
function treasureWidgetPruneRenderedCache(dir, fm, keep = 36) {
  try {
    const files = fm.listContents(dir).filter(x => String(x).endsWith(".png"));
    if (files.length <= keep) return;
    const rows = files.map(name => {
      const path = fm.joinPath(dir, name);
      let t = 0;
      try {
        const d = typeof fm.modificationDate === "function" ? fm.modificationDate(path) : null;
        t = d instanceof Date ? d.getTime() : 0;
      } catch (_) {}
      return { path, t };
    }).sort((a, b) => a.t - b.t);
    for (const row of rows.slice(0, Math.max(0, rows.length - keep))) {
      try { fm.remove(row.path); } catch (_) {}
    }
  } catch (_) {}
}
function treasureWidgetWriteRenderedCache(res, family, reference, image) {
  if (!treasureWidgetRenderCacheEnabled() || !image) return false;
  try {
    const d = treasureWidgetRenderDescriptor(res, family, reference);
    d.fm.writeImage(d.path, image);
    treasureWidgetPruneRenderedCache(d.dir, d.fm);
    return d.fm.fileExists(d.path);
  } catch (_) { return false; }
}
function treasureWidgetRenderCurrent(res, family, reference) {
  let image = getCachedImage(res.pattern.label);
  if (!image) return null;
  const rendered = renderWidgetImageWithDate(image, family, formatTreasureWidgetDateText(reference, res.skyYMD));
  image = null;
  treasureWidgetWriteRenderedCache(res, family, reference, rendered);
  return rendered;
}
function treasureWidgetNextLaUpdate(reference) {
  const d = reference instanceof Date ? reference : new Date(reference);
  const la = getCurrentLATimeParts(d);
  const wall = Date.UTC(la.year, la.month - 1, la.day + 1, 0, 1, 0);
  let offset = Number(getLaOffsetInfo(d).offsetMinutes) || -480;
  let ms = wall - offset * 60000;
  for (let i = 0; i < 2; i++) {
    const nextOffset = Number(getLaOffsetInfo(new Date(ms)).offsetMinutes);
    if (!Number.isFinite(nextOffset) || nextOffset === offset) break;
    offset = nextOffset;
    ms = wall - offset * 60000;
  }
  return new Date(ms);
}
function treasureWidgetNextLocalMidnight(reference) {
  const d = reference instanceof Date ? reference : new Date(reference);
  const local = getTreasureWidgetLocalDateContext(d);
  if (local.manual) {
    const wall = Date.UTC(local.year, local.month - 1, local.day + 1, 0, 1, 0);
    return new Date(wall - Number(local.offsetMinutes || 0) * 60000);
  }
  return new Date(local.year, local.month - 1, local.day + 1, 0, 1, 0);
}
function treasureWidgetPendingPrewarms(reference, currentFamily) {
  if (!treasureWidgetRenderCacheEnabled()) return [];
  const now = reference instanceof Date ? reference : new Date(reference);
  const candidates = [
    treasureWidgetNextLocalMidnight(now),
    treasureWidgetNextLaUpdate(now)
  ].filter(d => d instanceof Date && Number.isFinite(d.getTime()) && d.getTime() > now.getTime())
    .sort((a, b) => a.getTime() - b.getTime());
  const families = Array.from(new Set([String(currentFamily || "medium"), "small", "medium", "large"]));
  const pending = [];
  for (const future of candidates) {
    const res = calcForCurrentLATime(future);
    for (const family of families) {
      if (!treasureWidgetHasRenderedCache(res, family, future)) pending.push({ future, res, family });
    }
  }
  return pending;
}
function treasureWidgetPrewarmOne(reference, currentFamily) {
  const pending = treasureWidgetPendingPrewarms(reference, currentFamily);
  if (!pending.length) return { generated: false, remaining: 0 };
  const task = pending[0];
  let rendered = treasureWidgetRenderCurrent(task.res, task.family, task.future);
  const generated = !!rendered;
  rendered = null;
  return { generated, remaining: generated ? Math.max(0, pending.length - 1) : pending.length };
}
`;
  if (!s.includes("function formatTreasureWidgetDateText(")) {
    if (!s.includes(renderMarker)) throw new Error("日付表示の描画位置を確認できませんでした");
    s = s.replace(renderMarker, helper + renderMarker);
  }

  const createStart = s.indexOf("async function createWidget(options = {}) {");
  const createEnd = s.indexOf("async function showSimpleAlert", createStart);
  if (createStart < 0 || createEnd < 0) throw new Error("ウィジェット生成処理を確認できませんでした");
  const createWidget = `async function createWidget(options = {}) {
  const referenceNow = getSkyCommonNow();
  const res = calcForCurrentLATime(referenceNow);
  const meta = readCacheMeta();
  if (!isCacheUsable(meta)) {
    return showErrorWidget("画像の準備が必要", "アプリを一度開いて画像を取得してください。");
  }
  const family = config.widgetFamily || "medium";
  const cacheEnabled = treasureWidgetRenderCacheEnabled();
  if (cacheEnabled) treasureWidgetCacheGeneration();
  const hadRenderedCache = cacheEnabled && treasureWidgetHasRenderedCache(res, family, referenceNow);
  let prewarm = { generated: false, remaining: 0 };
  if (hadRenderedCache) {
    try { prewarm = treasureWidgetPrewarmOne(referenceNow, family); } catch (_) {}
  }
  let bgImage = hadRenderedCache ? await treasureWidgetReadRenderedCache(res, family, referenceNow) : null;
  let generatedCurrent = false;
  if (!bgImage) {
    bgImage = treasureWidgetRenderCurrent(res, family, referenceNow);
    generatedCurrent = true;
    if (!bgImage) return showErrorWidget("画像を表示できません", res.pattern.label);
  }
  const widget = new ListWidget();
  const needSoon = cacheEnabled && (generatedCurrent || prewarm.remaining > 0);
  const defaultDelayMs = needSoon ? 10 * 60 * 1000 : 30 * 60 * 1000;
  const refreshDelayMs = Math.max(60 * 1000, Number(options.refreshDelayMs || defaultDelayMs) || defaultDelayMs);
  widget.refreshAfterDate = new Date(Date.now() + refreshDelayMs);
  const debugReason = String(options.reason || (config.runsInWidget ? "widget-timeline" : "manual-set"));
  candleWidgetDebug("widget-build", { reason: debugReason, family, skyYMD: res.skyYMD, pattern: res.pattern.label, renderedCacheHit: hadRenderedCache, generatedCurrent, prewarmGenerated: prewarm.generated, prewarmRemaining: prewarm.remaining, refreshAfter: widget.refreshAfterDate.toISOString() });
  widget.url = URLScheme.forRunningScript();
  widget.backgroundColor = new Color("#000000");
  widget.backgroundImage = bgImage;
  bgImage = null;
  candleWidgetDebug("widget-return", { reason: debugReason, family });
  return widget;
}
`;
  s = s.slice(0, createStart) + createWidget + s.slice(createEnd);

  const replacements = [
    [
      "async function previewTodayImage() {\n  const res = calcForCurrentLATime();",
      "async function previewTodayImage() {\n  const referenceNow = getSkyCommonNow();\n  const res = calcForCurrentLATime(referenceNow);"
    ],
    [
      'const composed = renderWidgetImageWithDate(image, "large", res.skyYMD);',
      'const composed = renderWidgetImageWithDate(image, "large", formatTreasureWidgetDateText(referenceNow, res.skyYMD));'
    ]
  ];
  for (const [before, after] of replacements) {
    if (s.includes(after)) continue;
    if (!s.includes(before)) throw new Error("日付表示の更新箇所を確認できませんでした");
    s = s.replace(before, after);
  }
  return s;
}
async function skyCandleShowLoaderError(error) {
  const message = String(error && (error.message || error) || "不明なエラー");
  if (typeof config !== "undefined" && config.runsInWidget) {
    const widget = new ListWidget();
    widget.backgroundColor = new Color("#111111");
    widget.setPadding(14, 14, 14, 14);
    widget.addSpacer();
    const title = widget.addText("大キャン案内を表示できません");
    title.font = Font.boldSystemFont(15);
    title.textColor = new Color("#ff453a");
    title.centerAlignText();
    widget.addSpacer(6);
    const body = widget.addText(message);
    body.font = Font.systemFont(10);
    body.textColor = Color.white();
    body.centerAlignText();
    body.lineLimit = 4;
    widget.addSpacer();
    Script.setWidget(widget);
  } else {
    const alert = new Alert();
    alert.title = "大キャン案内を開けませんでした";
    alert.message = message;
    alert.addAction("閉じる");
    await alert.presentAlert();
  }
  Script.complete();
}

try {
  const runtime = skyCandlePatchRuntime(await skyCandleLoadRuntime());
  await eval(`(async()=>{\n${runtime}\n})()`);
} catch (error) {
  await skyCandleShowLoaderError(error);
}
