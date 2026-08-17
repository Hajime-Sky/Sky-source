from pathlib import Path
import hashlib, json, datetime

root = Path('.')
mod = root / 'SkyReminderModules'

def replace_once(path, old, new, label):
    s = path.read_text(encoding='utf-8')
    if old not in s:
        raise SystemExit(f'marker missing: {label}')
    path.write_text(s.replace(old, new, 1), encoding='utf-8')

p = mod / '005_app_ui_html_and_client.js'
replace_once(p,
    '<div class="screen-subnote">共通設定、通知プリセット、削除・初期化を役割ごとに分けています。</div>',
    '<div class="screen-subnote">星の子リマインダー固有の通知プリセットと保存データを管理します。</div>',
    'system subnote')
replace_once(p,
    '<div class="rule-subnote">システム設定と保守操作はSky共通設定で管理します。通知プリセットとデータ削除だけこの画面に残します。</div>',
    '<div class="rule-subnote">表示・時刻・地方上書き・キャッシュ・画像取得・更新・バックアップなど、Sky系アプリ共通の設定を開きます。</div>',
    'common settings card')
replace_once(p,
    '<div class="rule-subnote">画像の再取得はSky共通設定へ移動しました。ここでは画像の保存データ削除だけ行えます。</div>',
    '<div class="rule-subnote">保存済みの画像データを削除できます。</div>',
    'image migration note')

p = mod / '001_constants_and_navigation.js'
replace_once(p,
    'Sky系で共通化できる設定と保守操作は<b>Sky共通設定</b>にまとめています。この画面には通知プリセットと、このアプリ固有データの削除・初期化だけを残しています。',
    'この画面では、星の子リマインダー固有の通知プリセットと保存データを管理します。Sky系アプリ共通の設定は<b>Sky共通設定</b>から変更できます。',
    'help migration paragraph')
replace_once(p,
    '<li><b>Sky共通設定：</b>時刻、タイムトラベル、地方上書き、キャッシュ、画像取得、更新、バックアップを管理します。</li>',
    '<li><b>Sky共通設定：</b>表示、時刻、タイムトラベル、地方上書き、キャッシュ、画像取得、更新、バックアップを管理します。</li>',
    'help common bullet')
replace_once(p,
    '<li><b>削除・初期化：</b>このアプリの保存データを消す操作なので、この画面に残しています。</li>',
    '<li><b>削除・初期化：</b>このアプリの保存データを削除・初期化します。</li>',
    'help delete bullet')

mp = mod / 'manifest.json'
m = json.loads(mp.read_text(encoding='utf-8'))
for ent in m.get('parts', []):
    if isinstance(ent, dict) and ent.get('file'):
        fp = mod / ent['file']
        ent['sha256'] = hashlib.sha256(fp.read_bytes()).hexdigest()
m['sourceVersion'] = 'v2.21_settings_ui_cleanup'
m['generatedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00','Z')
mp.write_text(json.dumps(m, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

for path in [mod/'001_constants_and_navigation.js', mod/'005_app_ui_html_and_client.js']:
    text = path.read_text(encoding='utf-8')
    for bad in ['へ移動しました', 'だけを残しています', 'この画面に残しています']:
        if bad in text:
            raise SystemExit(f'stale migration wording remains in {path}: {bad}')
