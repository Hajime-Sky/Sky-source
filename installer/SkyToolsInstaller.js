// HajimeSky Tools Installer for Scriptable.
// This file is loaded by a tiny bootstrap pasted into Scriptable.

const INSTALLER_VERSION = "2026-04-23.1";
const REPO_RAW_BASE = "https://raw.githubusercontent.com/Hajime-Sky/Sky-source/main/";
const REPO_PAGE_BASE = "https://github.com/Hajime-Sky/Sky-source";
const TOOLS_DIR = "HajimeSkyTools";

const TOOLS = Object.freeze({
  starReminder: Object.freeze({
    title: "星の子リマインダー",
    scriptName: "Sky_星の子リマインダー.js",
    manifestUrl: REPO_RAW_BASE + "SkyReminderModules/manifest.json",
    moduleDir: `${TOOLS_DIR}/star-reminder/modules`,
    validateMain: "Sky_星の子リマインダー",
  }),
  treasureCandles: Object.freeze({
    title: "今日の大キャン案内",
    scriptName: "Sky_今日の大キャン案内.js",
    scriptUrl: REPO_RAW_BASE + "Sky_%E4%BB%8A%E6%97%A5%E3%81%AE%E5%A4%A7%E3%82%AD%E3%83%A3%E3%83%B3%E6%A1%88%E5%86%85.js",
    validateMain: "Sky_今日の大キャン案内",
  }),
});

function icloud() {
  return FileManager.iCloud();
}

function joinDoc(fm, rel) {
  const parts = String(rel || "").split("/").filter(Boolean);
  let p = fm.documentsDirectory();
  for (const part of parts) p = fm.joinPath(p, part);
  return p;
}

function ensureDir(fm, path) {
  if (!fm.fileExists(path)) fm.createDirectory(path, true);
  return path;
}

function resolveUrl(baseUrl, fileOrUrl) {
  const value = String(fileOrUrl || "").trim();
  if (/^https?:\/\//i.test(value)) return value;
  return String(baseUrl || "").replace(/[^/]*$/, "") + encodeURIComponent(value).replace(/%2F/g, "/");
}

async function fetchText(url) {
  const req = new Request(url);
  req.timeoutInterval = 30;
  return await req.loadString();
}

async function fetchJson(url) {
  const text = await fetchText(url);
  return JSON.parse(text);
}

async function alertMessage(title, message, actions) {
  const alert = new Alert();
  alert.title = title;
  alert.message = message;
  const list = Array.isArray(actions) && actions.length ? actions : ["OK"];
  for (const action of list) alert.addAction(action);
  return await alert.present();
}

function writeScriptFile(fm, scriptName, source) {
  if (!String(source || "").trim()) throw new Error(`${scriptName} is empty`);
  fm.writeString(fm.joinPath(fm.documentsDirectory(), scriptName), source);
}

async function installStarReminder() {
  const tool = TOOLS.starReminder;
  const fm = icloud();
  const manifest = await fetchJson(tool.manifestUrl);
  if (!manifest || !Array.isArray(manifest.parts) || !manifest.parts.length) {
    throw new Error("星の子リマインダーのmanifestが不正です");
  }

  const moduleDir = ensureDir(fm, joinDoc(fm, tool.moduleDir));
  const mainMeta = manifest.mainScriptFile || {};
  const mainUrl = resolveUrl(tool.manifestUrl, mainMeta.url || mainMeta.file || tool.scriptName);
  const mainText = await fetchText(mainUrl);
  if (!mainText.includes(tool.validateMain)) throw new Error("星の子リマインダー本体の検証に失敗しました");

  const moduleFiles = [];
  for (const part of manifest.parts) {
    if (!part || !part.file) continue;
    const file = String(part.file);
    const text = await fetchText(resolveUrl(tool.manifestUrl, part.url || file));
    fm.writeString(fm.joinPath(moduleDir, file), text);
    moduleFiles.push(file);
  }
  if (Array.isArray(manifest.migrations)) {
    const seen = new Set(moduleFiles);
    for (const migration of manifest.migrations) {
      if (!migration || !migration.file || seen.has(String(migration.file))) continue;
      const file = String(migration.file);
      const text = await fetchText(resolveUrl(tool.manifestUrl, migration.url || file));
      fm.writeString(fm.joinPath(moduleDir, file), text);
      seen.add(file);
    }
  }
  fm.writeString(fm.joinPath(moduleDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  writeScriptFile(fm, tool.scriptName, mainText);
  return `${tool.scriptName}\nmodules: ${moduleFiles.length}`;
}

async function installTreasureCandles() {
  const tool = TOOLS.treasureCandles;
  const fm = icloud();
  const text = await fetchText(tool.scriptUrl);
  if (!text.includes(tool.validateMain)) throw new Error("今日の大キャン案内の検証に失敗しました");
  writeScriptFile(fm, tool.scriptName, text);
  return tool.scriptName;
}

async function runInstalledScript(scriptName) {
  try {
    Safari.open("scriptable:///run?scriptName=" + encodeURIComponent(scriptName));
  } catch (e) {
    await alertMessage("起動できませんでした", String(e), ["OK"]);
  }
}

async function installAll() {
  const results = [];
  results.push(await installStarReminder());
  results.push(await installTreasureCandles());
  return results;
}

async function main() {
  const action = await alertMessage(
    "Sky Tools Installer",
    [
      `version: ${INSTALLER_VERSION}`,
      "GitHubから最新版をiCloud Scriptableフォルダへ保存します。",
      "既存の設定・画像・キャッシュは各ツール側の保存場所をそのまま使います。",
    ].join("\n"),
    ["星の子リマインダー", "今日の大キャン案内", "両方インストール", "GitHubを開く", "キャンセル"]
  );

  try {
    if (action === 0) {
      const result = await installStarReminder();
      const next = await alertMessage("インストール完了", result, ["起動する", "閉じる"]);
      if (next === 0) await runInstalledScript(TOOLS.starReminder.scriptName);
    } else if (action === 1) {
      const result = await installTreasureCandles();
      const next = await alertMessage("インストール完了", result, ["起動する", "閉じる"]);
      if (next === 0) await runInstalledScript(TOOLS.treasureCandles.scriptName);
    } else if (action === 2) {
      const results = await installAll();
      const next = await alertMessage("インストール完了", results.join("\n\n"), ["星の子リマインダーを起動", "閉じる"]);
      if (next === 0) await runInstalledScript(TOOLS.starReminder.scriptName);
    } else if (action === 3) {
      Safari.open(REPO_PAGE_BASE);
    }
  } catch (e) {
    await alertMessage("インストール失敗", String((e && e.stack) || e), ["OK"]);
    throw e;
  }
}

await main();
