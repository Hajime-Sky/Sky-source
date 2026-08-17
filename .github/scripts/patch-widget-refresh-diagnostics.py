from pathlib import Path
import json, hashlib, datetime

ROOT = Path('.')

def replace_once(path, old, new, label):
    s = path.read_text(encoding='utf-8')
    if old not in s:
        raise SystemExit('marker missing: ' + label)
    path.write_text(s.replace(old, new, 1), encoding='utf-8')

# --- Star reminder loader: visible, uploadable diagnostics even before module eval ---
loader = ROOT / 'Sky_星の子リマインダー.js'
replace_once(loader,
'''const SKY_REMINDER_FALLBACK_PARTS = [\n''',
'''const SKY_REMINDER_WIDGET_DEBUG_DIR = "HajimeSkyTools/_chatgpt-debug/widget-refresh";\nconst SKY_REMINDER_WIDGET_DEBUG_FILE = "runtime.log";\nfunction skyReminderWidgetDebug(event, detail = {}) {\n  try {\n    const fm = FileManager.iCloud();\n    const root = fm.documentsDirectory();\n    let dir = root;\n    for (const part of SKY_REMINDER_WIDGET_DEBUG_DIR.split("/")) {\n      dir = fm.joinPath(dir, part);\n      if (!fm.fileExists(dir)) fm.createDirectory(dir, true);\n    }\n    const path = fm.joinPath(dir, SKY_REMINDER_WIDGET_DEBUG_FILE);\n    let prev = "";\n    try { if (fm.fileExists(path)) prev = fm.readString(path); } catch (_) {}\n    const env = {\n      runsInWidget: !!config.runsInWidget, runsInApp: !!config.runsInApp,\n      widgetFamily: String(config.widgetFamily || ""),\n      systemVersion: (() => { try { return Device.systemVersion(); } catch (_) { return ""; } })(),\n      scriptName: (() => { try { return Script.name(); } catch (_) { return SKY_REMINDER_MAIN_SCRIPT; } })(),\n    };\n    let payload = "";\n    try { payload = JSON.stringify({ ...env, ...(detail && typeof detail === "object" ? detail : { detail: String(detail) }) }); }\n    catch (_) { payload = String(detail); }\n    const line = `${new Date().toISOString()} [star-reminder] ${String(event)} | ${payload}`;\n    let next = prev ? prev + "\\n" + line : line;\n    if (next.length > 160000) next = next.slice(next.length - 160000);\n    fm.writeString(path, next);\n  } catch (_) {}\n}\n\nconst SKY_REMINDER_FALLBACK_PARTS = [\n''',
'loader debug helper')
replace_once(loader,
'''await skyReminderRunFromParts();''',
'''skyReminderWidgetDebug("loader-start");\ntry {\n  await skyReminderRunFromParts();\n  skyReminderWidgetDebug("loader-complete");\n} catch (error) {\n  skyReminderWidgetDebug("loader-error", { error: String(error && (error.stack || error.message) || error) });\n  throw error;\n}''',
'loader bottom diagnostics')

# --- Star reminder widget construction: explicit refreshAfterDate + diagnostics ---
layout = ROOT / 'SkyReminderModules/004d_widget_layout.js'
replace_once(layout,
'''function runWidget(now) {\n  const settings = loadSettings();\n  const PAL = getPalette(settings.theme);\n  const w = new ListWidget();''',
'''function runWidget(now, options = {}) {\n  const settings = loadSettings();\n  const PAL = getPalette(settings.theme);\n  const w = new ListWidget();\n  const refreshDelayMs = Math.max(60 * 1000, Number(options.refreshDelayMs || 30 * 60 * 1000) || 30 * 60 * 1000);\n  w.refreshAfterDate = new Date(Date.now() + refreshDelayMs);\n  const debugReason = String(options.reason || (config.runsInWidget ? "widget-timeline" : "manual-set"));\n  try { if (typeof skyReminderWidgetDebug === "function") skyReminderWidgetDebug("widget-build-start", { reason: debugReason, refreshAfter: w.refreshAfterDate.toISOString(), effectiveNow: now instanceof Date ? now.toISOString() : String(now) }); } catch (_) {}''',
'reminder runWidget options')
replace_once(layout,
'''  if (!cells.length) { w.addText("None"); Script.setWidget(w); return; }''',
'''  if (!cells.length) { w.addText("None"); Script.setWidget(w); try { if (typeof skyReminderWidgetDebug === "function") skyReminderWidgetDebug("widget-set", { reason: debugReason, family, cells: 0 }); } catch (_) {} return; }''',
'reminder empty widget set log')
replace_once(layout,
'''    Script.setWidget(w);\n    return;''',
'''    Script.setWidget(w);\n    try { if (typeof skyReminderWidgetDebug === "function") skyReminderWidgetDebug("widget-set", { reason: debugReason, family, cells: cells.length }); } catch (_) {}\n    return;''',
'reminder single widget set log')
# final setWidget occurrence
s = layout.read_text(encoding='utf-8')
needle = '''  Script.setWidget(w);\n}\nfunction getPreviewImages'''
if needle not in s:
    raise SystemExit('marker missing: reminder final widget set log')
s = s.replace(needle, '''  Script.setWidget(w);\n  try { if (typeof skyReminderWidgetDebug === "function") skyReminderWidgetDebug("widget-set", { reason: debugReason, family, cells: cells.length }); } catch (_) {}\n}\nfunction getPreviewImages''', 1)
layout.write_text(s, encoding='utf-8')

# --- Star reminder dispatcher: refresh after app AND shortcut/action completion ---
entry = ROOT / 'SkyReminderModules/007_shortcut_entrypoint.js'
replace_once(entry,
'''const qpObj = getQueryParameters(args);\nconst hasAction = !!(qpObj && String(qpObj.action || "").trim());''',
'''const qpObj = getQueryParameters(args);\nconst hasAction = !!(qpObj && String(qpObj.action || "").trim());\nasync function requestReminderWidgetRefresh(reason) {\n  try {\n    const refreshSettings = loadSettings();\n    const refreshNow = getEffectiveNow(new Date(), refreshSettings);\n    runWidget(refreshNow, { reason, refreshDelayMs: 60 * 1000 });\n    try { if (typeof skyReminderWidgetDebug === "function") skyReminderWidgetDebug("refresh-requested", { reason }); } catch (_) {}\n    return true;\n  } catch (e) {\n    try { if (typeof skyReminderWidgetDebug === "function") skyReminderWidgetDebug("refresh-request-failed", { reason, error: String(e && (e.stack || e.message) || e) }); } catch (_) {}\n    try { console.error("Widget refresh request failed:", e); } catch (_) {}\n    return false;\n  }\n}''',
'reminder refresh helper')
replace_once(entry,
'''if (hasAction) {\n  await runShortcut(now, JSON.stringify(qpObj), args);\n} else if (config.runsInWidget) {\n  await runWidget(now);\n} else if (config.runsInApp) {\n  await runApp(now);\n  try {\n    const refreshSettings = loadSettings();\n    const refreshNow = getEffectiveNow(new Date(), refreshSettings);\n    await runWidget(refreshNow);\n  } catch (e) {\n    try { console.error("Post-app widget refresh failed:", e); } catch (_) {}\n  }\n} else {\n  await runShortcut(now, qpObj ? JSON.stringify(qpObj) : args.shortcutParameter, args);\n}\nScript.complete();''',
'''if (hasAction) {\n  await runShortcut(now, JSON.stringify(qpObj), args);\n  await requestReminderWidgetRefresh("action-complete");\n} else if (config.runsInWidget) {\n  runWidget(now, { reason: "widget-timeline", refreshDelayMs: 30 * 60 * 1000 });\n} else if (config.runsInApp) {\n  await runApp(now);\n  await requestReminderWidgetRefresh("app-close");\n} else {\n  await runShortcut(now, qpObj ? JSON.stringify(qpObj) : args.shortcutParameter, args);\n  await requestReminderWidgetRefresh("shortcut-complete");\n}\ntry { if (typeof skyReminderWidgetDebug === "function") skyReminderWidgetDebug("script-complete"); } catch (_) {}\nScript.complete();''',
'reminder dispatch refresh')

# --- Treasure candle: inline visible diagnostics + explicit refresh schedule ---
candle = ROOT / 'Sky_今日の大キャン案内.js'
replace_once(candle,
'''const UPDATE_POLICIES = Object.freeze(["none", "daily", "always"]);''',
'''const UPDATE_POLICIES = Object.freeze(["none", "daily", "always"]);\nconst WIDGET_DEBUG_DIR = "HajimeSkyTools/_chatgpt-debug/widget-refresh";\nfunction candleWidgetDebug(event, detail = {}) {\n  try {\n    const fm = FileManager.iCloud();\n    let dir = fm.documentsDirectory();\n    for (const part of WIDGET_DEBUG_DIR.split("/")) { dir = fm.joinPath(dir, part); if (!fm.fileExists(dir)) fm.createDirectory(dir, true); }\n    const path = fm.joinPath(dir, "runtime.log");\n    let prev = ""; try { if (fm.fileExists(path)) prev = fm.readString(path); } catch (_) {}\n    const env = { runsInWidget: !!config.runsInWidget, runsInApp: !!config.runsInApp, widgetFamily: String(config.widgetFamily || ""), systemVersion: (() => { try { return Device.systemVersion(); } catch (_) { return ""; } })(), scriptName: (() => { try { return Script.name(); } catch (_) { return SCRIPT_NAME; } })() };\n    let payload = ""; try { payload = JSON.stringify({ ...env, ...(detail && typeof detail === "object" ? detail : { detail: String(detail) }) }); } catch (_) { payload = String(detail); }\n    const line = `${new Date().toISOString()} [treasure-candle] ${String(event)} | ${payload}`;\n    let next = prev ? prev + "\\n" + line : line; if (next.length > 160000) next = next.slice(next.length - 160000);\n    fm.writeString(path, next);\n  } catch (_) {}\n}\ncandleWidgetDebug("script-start");''',
'candle debug helper')
replace_once(candle,
'''async function createWidget() {\n  const res = calcForCurrentLATime();''',
'''async function createWidget(options = {}) {\n  const res = calcForCurrentLATime();''',
'candle createWidget options')
replace_once(candle,
'''  const widget = new ListWidget();\n  widget.url = URLScheme.forRunningScript();''',
'''  const widget = new ListWidget();\n  const refreshDelayMs = Math.max(60 * 1000, Number(options.refreshDelayMs || 30 * 60 * 1000) || 30 * 60 * 1000);\n  widget.refreshAfterDate = new Date(Date.now() + refreshDelayMs);\n  const debugReason = String(options.reason || (config.runsInWidget ? "widget-timeline" : "manual-set"));\n  candleWidgetDebug("widget-build", { reason: debugReason, family, skyYMD: res.skyYMD, pattern: res.pattern.label, refreshAfter: widget.refreshAfterDate.toISOString() });\n  widget.url = URLScheme.forRunningScript();''',
'candle widget refresh date')
# Dispatch patch including shortcut branch.
replace_once(candle,
'''  } else if (config.runsInWidget) {\n  const widget = await createWidget();\n  Script.setWidget(widget);\n  Script.complete();\n} else if (config.runsInApp) {\n  await presentApp();\n  try {\n    const widget = await createWidget();\n    Script.setWidget(widget);\n  } catch (e) {\n    try { console.error("Post-app widget refresh failed:", e); } catch (_) {}\n  }\n  Script.complete();\n} else {\n  const now = getSkyCommonNow();\n  await notifyIfCalledOutsideLaMidnight(now);\n  const meta = readCacheMeta();\n  if (!isCacheUsable(meta) || needsQualityRefresh(meta)) {\n    try {\n      await syncAllImages();\n    } catch (e) {}\n  }\n  Script.complete();\n}''',
'''  } else if (config.runsInWidget) {\n  const widget = await createWidget({ reason: "widget-timeline", refreshDelayMs: 30 * 60 * 1000 });\n  Script.setWidget(widget);\n  candleWidgetDebug("widget-set", { reason: "widget-timeline", family: String(config.widgetFamily || "") });\n  Script.complete();\n} else if (config.runsInApp) {\n  await presentApp();\n  try {\n    const widget = await createWidget({ reason: "app-close", refreshDelayMs: 60 * 1000 });\n    Script.setWidget(widget);\n    candleWidgetDebug("refresh-requested", { reason: "app-close" });\n  } catch (e) {\n    candleWidgetDebug("refresh-request-failed", { reason: "app-close", error: String(e && (e.stack || e.message) || e) });\n    try { console.error("Post-app widget refresh failed:", e); } catch (_) {}\n  }\n  candleWidgetDebug("script-complete", { reason: "app-close" });\n  Script.complete();\n} else {\n  const now = getSkyCommonNow();\n  await notifyIfCalledOutsideLaMidnight(now);\n  const meta = readCacheMeta();\n  if (!isCacheUsable(meta) || needsQualityRefresh(meta)) {\n    try {\n      await syncAllImages();\n    } catch (e) {}\n  }\n  try {\n    const widget = await createWidget({ reason: "shortcut-complete", refreshDelayMs: 60 * 1000 });\n    Script.setWidget(widget);\n    candleWidgetDebug("refresh-requested", { reason: "shortcut-complete" });\n  } catch (e) {\n    candleWidgetDebug("refresh-request-failed", { reason: "shortcut-complete", error: String(e && (e.stack || e.message) || e) });\n  }\n  candleWidgetDebug("script-complete", { reason: "shortcut-complete" });\n  Script.complete();\n}''',
'candle dispatch refresh')

# Manifest hashes, including main script SHA.
mp = ROOT / 'SkyReminderModules/manifest.json'
m = json.loads(mp.read_text(encoding='utf-8'))
for ent in m.get('parts', []):
    if isinstance(ent, dict) and ent.get('file'):
        p = mp.parent / ent['file']
        ent['sha256'] = hashlib.sha256(p.read_bytes()).hexdigest()
main_meta = m.get('mainScriptFile')
if isinstance(main_meta, dict):
    main_meta['sha256'] = hashlib.sha256(loader.read_bytes()).hexdigest()
m['sourceVersion'] = 'v2.23_widget_refresh_diagnostics'
m['generatedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00','Z')
mp.write_text(json.dumps(m, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
