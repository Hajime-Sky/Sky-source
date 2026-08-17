from pathlib import Path
import json, hashlib, re, datetime
ROOT=Path('.')
def read(p): return (ROOT/p).read_text()
def write(p,t): (ROOT/p).write_text(t)
def rep(t,o,n,label):
    if n in t: return t
    if o not in t: raise SystemExit(label+' marker not found')
    return t.replace(o,n,1)

p=Path('SkyReminderModules/001_constants_and_navigation.js'); t=read(p)
t=rep(t,'  GITHUB_UPDATE_NOW: "githubupdatenow",\n  SETTING_CHANGE: "setting-change",','  GITHUB_UPDATE_NOW: "githubupdatenow",\n  OPEN_COMMON_SETTINGS: "opencommonsettings",\n  SETTING_CHANGE: "setting-change",','action')
t=rep(t,'WV_ACTION.SETTINGS_EXPORT, WV_ACTION.SETTINGS_IMPORT, WV_ACTION.GITHUB_UPDATE_NOW]);','WV_ACTION.SETTINGS_EXPORT, WV_ACTION.SETTINGS_IMPORT, WV_ACTION.GITHUB_UPDATE_NOW, WV_ACTION.OPEN_COMMON_SETTINGS]);','null payload'); write(p,t)

p=Path('SkyReminderModules/002_settings_store_and_cache.js'); t=read(p)
marker='const DEFAULT_SETTINGS = {'
insert='''let SKY_COMMON_SETTINGS = null;\ntry { SKY_COMMON_SETTINGS = importModule("HajimeSkyTools/common-settings"); } catch (_) {}\nfunction applySkyCommonSettingsSafe(settings) {\n  if (!SKY_COMMON_SETTINGS || typeof SKY_COMMON_SETTINGS.applyToReminderSettings !== "function") return settings;\n  try { return SKY_COMMON_SETTINGS.applyToReminderSettings(settings); }\n  catch (e) { try { console.warn("Sky common settings could not be applied: " + e); } catch (_) {} return settings; }\n}\n'''
if insert not in t:
    if marker not in t: raise SystemExit('common import marker not found')
    t=t.replace(marker,insert+marker,1)
t=rep(t,'  if (!isPlainObject(st)) return base;\n  const out = { ...base, ...st };','  if (!isPlainObject(st)) return applySkyCommonSettingsSafe(base);\n  const out = { ...base, ...st };','normalize empty')
t=rep(t,'  if (!Array.isArray(out.eventOrder) || !out.eventOrder.length) out.eventOrder = base.eventOrder.slice();\n  return out;\n}\nfunction normalizeRunState','  if (!Array.isArray(out.eventOrder) || !out.eventOrder.length) out.eventOrder = base.eventOrder.slice();\n  return applySkyCommonSettingsSafe(out);\n}\nfunction normalizeRunState','normalize final'); write(p,t)

p=Path('SkyReminderModules/005_app_ui_html_and_client.js'); t=read(p)
anchor='''      <div class="screen-subnote">本番 / テストの状態、保存データ、危険操作を混ぜずに確認できるよう整理しています。</div>\n      <div class="section zone-virtual system-card">'''
new='''      <div class="screen-subnote">本番 / テストの状態、保存データ、危険操作を混ぜずに確認できるよう整理しています。</div>\n      <div class="section system-card">\n        <h3>Sky共通設定</h3>\n        <div class="rule-subnote">時差、地方の上書き、GitHub更新頻度、バックアップ保存先はSky系アプリで共通管理します。</div>\n        <div class="system-stack-actions" style="margin-top:12px;">\n          <div class="btn secondary" onclick="sendCommand('scriptable-opencommonsettings://1', this)">Sky共通設定を開く</div>\n        </div>\n      </div>\n      <div class="section zone-virtual system-card">'''
t=rep(t,anchor,new,'common card')
pat=r'''      <div class="section system-card">\n        <h3>海外との時差設定</h3>.*?      <div class="section system-card">\n        <h3>通知プリセット</h3>'''; m=re.search(pat,t,re.S)
if m: t=t[:m.start()]+'      <div class="section system-card">\n        <h3>通知プリセット</h3>'+t[m.end():]
elif '<h3>海外との時差設定</h3>' in t or '<h3>地方の上書き設定</h3>' in t: raise SystemExit('duplicate sections removal failed')
pat=r'''        <div class="minirow" style="margin-top:12px;">\n          <div class="label">更新タイミング</div>.*?        </div>\n        <div class="system-stack-actions" style="margin-top:12px;">'''; m=re.search(pat,t,re.S)
if m: t=t[:m.start()]+'''        <div class="rule-subnote" style="margin-top:12px;">更新タイミングはSky共通設定で管理します。現在: ${settings.githubUpdate?.policy === 'none' ? '更新しない' : settings.githubUpdate?.policy === 'always' ? '毎回' : '24時間'}</div>\n        <div class="system-stack-actions" style="margin-top:12px;">'''+t[m.end():]
elif '<div class="label">更新タイミング</div>' in t: raise SystemExit('update policy removal failed')
pat=r'''        <div class="minirow" style="margin-top:12px;">\n          <div class="label">バックアップ保存先</div>.*?        </div>\n        <div class="rule-subnote" id="settings-backup-path-note"'''; m=re.search(pat,t,re.S)
if m: t=t[:m.start()]+'''        <div class="rule-subnote" style="margin-top:12px;">保存先はSky共通設定で変更できます。</div>\n        <div class="rule-subnote" id="settings-backup-path-note"'''+t[m.end():]
elif '<div class="label">バックアップ保存先</div>' in t: raise SystemExit('backup selector removal failed')
write(p,t)

p=Path('SkyReminderModules/006_app_actions_backup_and_handlers.js'); t=read(p)
anchor='WEBVIEW_HANDLERS[WV_ACTION.GITHUB_UPDATE_NOW] = async (_r) => {'
handler='''WEBVIEW_HANDLERS[WV_ACTION.OPEN_COMMON_SETTINGS] = async (_r) => {\n  try {\n    const common = importModule("HajimeSkyTools/common-settings");\n    if (common && typeof common.open === "function") common.open();\n    else Safari.open("scriptable:///run?scriptName=" + encodeURIComponent("Sky_共通設定"));\n  } catch (_) {\n    Safari.open("scriptable:///run?scriptName=" + encodeURIComponent("Sky_共通設定"));\n  }\n};\n'''
if handler not in t:
    if anchor not in t: raise SystemExit('handler marker not found')
    t=t.replace(anchor,handler+anchor,1)
write(p,t)

manifest_path=Path('SkyReminderModules/manifest.json'); manifest=json.loads(read(manifest_path))
for e in manifest.get('parts',[]):
    fp=manifest_path.parent/e['file']
    if fp.exists(): e['sha256']=hashlib.sha256(fp.read_bytes()).hexdigest()
manifest['sourceVersion']='v2.19_common_settings'; manifest['generatedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00','Z')
write(manifest_path,json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
