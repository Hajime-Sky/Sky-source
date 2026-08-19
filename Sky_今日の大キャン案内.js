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
  const helper = `function getTreasureWidgetLocalDateParts(reference = new Date()) {
  const d = reference instanceof Date ? reference : new Date(reference);
  const common = readSkyCommonSettingsSafe();
  if (common && common.timezone && common.timezone.mode === "manual") {
    const offsetHours = Number(common.timezone.utcOffsetHours);
    if (Number.isFinite(offsetHours)) {
      const shifted = new Date(d.getTime() + offsetHours * 60 * 60 * 1000);
      return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
    }
  }
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}
function formatTreasureWidgetDateText(reference, skyYMD) {
  const local = getTreasureWidgetLocalDateParts(reference);
  const localKey = String(local.year).padStart(4, "0") + "-" + String(local.month).padStart(2, "0") + "-" + String(local.day).padStart(2, "0");
  const skyKey = /^\\d{4}-\\d{2}-\\d{2}$/.test(String(skyYMD || "")) ? String(skyYMD) : localKey;
  const phase = localKey > skyKey ? "更新前" : "更新後";
  return String(local.month) + "月" + String(local.day) + "日　" + phase;
}
`;
  if (!s.includes("function formatTreasureWidgetDateText(")) {
    if (!s.includes(renderMarker)) throw new Error("日付表示の描画位置を確認できませんでした");
    s = s.replace(renderMarker, helper + renderMarker);
  }
  const replacements = [
    [
      "async function createWidget(options = {}) {\n  const res = calcForCurrentLATime();",
      "async function createWidget(options = {}) {\n  const referenceNow = getSkyCommonNow();\n  const res = calcForCurrentLATime(referenceNow);"
    ],
    [
      "let bgImage = renderWidgetImageWithDate(image, family, res.skyYMD);",
      "let bgImage = renderWidgetImageWithDate(image, family, formatTreasureWidgetDateText(referenceNow, res.skyYMD));"
    ],
    [
      "async function previewTodayImage() {\n  const res = calcForCurrentLATime();",
      "async function previewTodayImage() {\n  const referenceNow = getSkyCommonNow();\n  const res = calcForCurrentLATime(referenceNow);"
    ],
    [
      "const composed = renderWidgetImageWithDate(image, \"large\", res.skyYMD);",
      "const composed = renderWidgetImageWithDate(image, \"large\", formatTreasureWidgetDateText(referenceNow, res.skyYMD));"
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
