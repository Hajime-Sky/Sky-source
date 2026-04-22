// Sky_星の子リマインダー v1
const MS_PER_SEC  = 1000;
const MS_PER_MIN  = 60 * MS_PER_SEC;
const MS_PER_HOUR = 60 * MS_PER_MIN;
const MS_PER_DAY  = 24 * MS_PER_HOUR;
const TAU         = Math.PI * 2;
const TZ_LA = "America/Los_Angeles";
const UI_NUMBER_LIMITS = Object.freeze({ MIN: -99, MAX: 99 });
const EXTERNAL_URL_SCHEMES = Object.freeze({
  SKY_APP: ["sky://", "sky://open"],
});
const ID_PREFIX = Object.freeze({ SHARDS: "skyshards", ACT: "skynoti" });
const ACTION = Object.freeze({
  TAP: "tap",
  ALREADY_DONE: "alreadydone",
  EVENT_TAP: "eventtap",
  EVENT_TEST: "eventtest",
  OPEN_ONLY: "openonly",
  ADJUST_COUNT: "adjustcount",
  SCHEDULE: "schedule",
});
const WV_ACTION = Object.freeze({
  MODE: "mode",
  KEYCHAIN: "keychain",
  KEYCHAIN_COPY: "keychaincopy",
  HTML_COPY: "htmlcopy",
  NOTIF_LIST: "notif-list",
  NOTIF_DEL_ALL: "notif-deleteall",
  NOTIF_DIS_ALL: "notif-disableall",
  DELETE_KEYCHAIN: "deletekeychain",
  DELETE_ALL_KEYCHAIN: "deleteallkeychain",
  RESET_DAY: "resetday",
  NOTIF_DISABLE: "notif-disable",
  NOTIF_ENABLE: "notif-enable",
  NOTIF_ENABLE_ALL: "notif-enableall",
  SAVE: "save",
  PREVIEW: "preview",
  DYE_COMPLETE: "dyecomplete",
  PAN_TREASURE_COMPLETE: "pantreasurecomplete",
  PAN_DAILY_COMPLETE: "pandailycomplete",
  ORIGINAL_SIN_COMPLETE: "originalsincomplete",
  SAVE_REALM_OVERRIDES: "saverealmoverrides",
  SETTINGS_EXPORT: "settingsexport",
  SETTINGS_IMPORT: "settingsimport",
  APPLY_PRESET: "applypreset",
  GITHUB_UPDATE_NOW: "githubupdatenow",
  SETTING_CHANGE: "setting-change",
});
const NULL_PAYLOAD_ACTIONS = new Set([WV_ACTION.KEYCHAIN, WV_ACTION.KEYCHAIN_COPY, WV_ACTION.HTML_COPY, WV_ACTION.NOTIF_LIST, WV_ACTION.DELETE_ALL_KEYCHAIN, WV_ACTION.DYE_COMPLETE, WV_ACTION.PAN_TREASURE_COMPLETE, WV_ACTION.PAN_DAILY_COMPLETE, WV_ACTION.ORIGINAL_SIN_COMPLETE, WV_ACTION.SETTINGS_EXPORT, WV_ACTION.SETTINGS_IMPORT, WV_ACTION.GITHUB_UPDATE_NOW]);
const RAW_PATH_ACTIONS = new Set([WV_ACTION.NOTIF_DEL_ALL, WV_ACTION.NOTIF_DIS_ALL]);
const APP_SCHEME = Object.freeze({ RUN: "scriptable:///run?scriptName=" });
const WIDGET_BASE_SZ = 160;
const WIDGET_EXP_SZ = 320;
const CLOCK_BASE = Object.freeze({ W: 650, H: 670, PAD: 10, RAD: 140 });
const HELP_VIDEO_IDS = Object.freeze({
  shards: "V6X_ZLdRAv8",
  notify: "V6X_ZLdRAv8",
  manage: "V6X_ZLdRAv8",
  data: "V6X_ZLdRAv8",
  intro: "V6X_ZLdRAv8",
});
const SETTINGS_BACKUP_DIRNAME = "SkyReminderBackups";
const SETTINGS_BACKUP_EXT = ".skybackup.txt";
function sanitizeYouTubeVideoId(videoId) {
  return String(videoId || "").trim().replace(/[^A-Za-z0-9_-]/g, "");
}
function buildYouTubeEmbedHtml(videoId, title = "操作説明動画", compact = false) {
  const safeId = sanitizeYouTubeVideoId(videoId);
  if (!safeId) return "";
  const safeTitle = String(title || "操作説明動画");
  return `<div class="help-video-card${compact ? ' compact' : ''}" style="margin-top:12px; border:1px solid var(--line); border-radius:16px; padding:12px; background:var(--card); box-shadow:var(--shadow-soft);"><div class="rule-subnote" style="margin:0 0 10px 0; font-weight:700;">${safeTitle}</div><div class="js-video-slot" data-video-id="${safeId}" data-video-title="${safeTitle.replace(/"/g, '&quot;')}" data-video-loaded="0" style="position:relative; width:100%; padding-top:56.25%; border-radius:12px; overflow:hidden; background:#000;"><div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; text-align:center; padding:12px; color:rgba(255,255,255,0.82); font-size:12px; line-height:1.6;">動画プレーヤーを読み込み中…</div></div></div>`;
}
const NAV_SCREEN_DEFS = Object.freeze([
  Object.freeze({
    id: "shards",
    label: "ウィジェット",
    helpText: `<h4 style='color:var(--color-primary); margin-top:0;'>🔮 ウィジェット設定</h4><p style='line-height:1.6;'>上のメニューから「表示形式」や「レイアウト」を変えると、この画面の見た目だけでなく、<b>ホーム画面に置くウィジェットの形も一緒に変わります。</b></p><ul style='padding-left: 20px; line-height:1.6; margin-bottom:12px;'><li><b>24h / 12h</b>：1日の流れを時計の形で確認できます。</li><li><b>タイムライン / バー</b>：これからのお知らせを上から下へ見やすく表示します。</li></ul><p style='line-height:1.6;'>大きさとの組み合わせでパズルみたいに形が変わるので、まずは実際に置いてみて、自分が一番見やすい組み合わせを探してみてね！🕊️</p>${buildYouTubeEmbedHtml(HELP_VIDEO_IDS.shards, "ウィジェットの操作動画")}`,
    hasFooter: true,
  }),
  Object.freeze({
    id: "notify",
    label: "お知らせルール",
    helpText: `<h4 style='color:var(--color-primary); margin-top:0;'>🔔 お知らせルール</h4><p style='line-height:1.6;'>「現地にむかう時間」などを設定すると、イベントの時間ピッタリではなく、<b>あなたが飛んでいく時間を逆算して、少し早めにスマホにお知らせ</b>してくれます。</p><ul style='padding-left: 20px; line-height:1.6; margin-bottom:12px;'><li>行きたいイベントを<b>オン</b>にするだけでOK！</li><li><b>目標 参加回数</b>を決めておくと、その回数分おわったらその日はもうお知らせが来なくなります。フレンドとのんびりする時間も大切ですからね☕️</li><li><b>準備のためのおまけ時間</b>は、うっかり忘れていた時のための保険の時間です。</li></ul>${buildYouTubeEmbedHtml(HELP_VIDEO_IDS.notify, "お知らせルールの操作動画")}`,
  }),
  Object.freeze({
    id: "manage",
    label: "予定表",
    helpText: `<h4 style='color:var(--color-primary); margin-top:0;'>📋 これからのお知らせ</h4><p style='line-height:1.6;'>一覧から特定の時間のチェックを外して「お休み」にすると、イベント自体の設定はオンのままでも、<b>その1回分だけお知らせを休むことができます。</b></p><ul style='padding-left: 20px; line-height:1.6; margin-bottom:12px;'><li>「明日の朝のパン焼きは寝ていたいからパス！」「この時間はフレンドと遊ぶからお知らせはいらないや」という時に、ピンポイントでお休みできます。</li><li>やっぱり行きたい時は、下の<b>お休み中のお知らせ</b>リストからいつでも「オン」に戻して予定を復活させることができますよ。</li></ul>${buildYouTubeEmbedHtml(HELP_VIDEO_IDS.manage, "予定表の操作動画")}`,
  }),
  Object.freeze({
    id: "data",
    label: "システム",
    helpText: `<h4 style='color:var(--color-primary); margin-top:0;'>⚙️ システムとデータ</h4><p style='line-height:1.6;'>「タイムトラベル(おためしモード)」をオンにして時間を進めると、<b>未来のお知らせがちゃんと来るか今すぐテスト</b>できます。</p><ul style='padding-left: 20px; line-height:1.6; margin-bottom:12px;'><li>設定がうまくできたか不安な時、わざわざイベントの時間まで待たなくても大丈夫！どんな風にスマホにお知らせが届くか確認してみましょう。<br><span style='font-size:0.9em; opacity:0.8;'>※テストが終わったら必ず「オフ」にして、現実のお空に戻ってきてね🕊️</span></li><li><b>危険な操作：</b>画面の一番下にある赤い枠のボタンは、今までの記録をすべて消してしまう魔法です。普段は触らなくて大丈夫ですよ。</li></ul>${buildYouTubeEmbedHtml(HELP_VIDEO_IDS.data, "システムの操作動画")}`,
  }),
  Object.freeze({
    id: "intro",
    label: "はじめに",
    helpText: `<h4 style='color:var(--color-primary); margin-top:0;'>🌟 はじめに</h4><p style='line-height:1.6;'>iPhoneのホーム画面に「ウィジェット」を追加すると、<b>アプリを開かなくても次のお知らせ時間がひと目でわかる</b>ようになります。</p><ul style='padding-left: 20px; line-height:1.6; margin-bottom:12px;'><li>このアプリは、Skyの世界で毎日起こるイベントの時間を予測して、あなたをサポートするツールです。</li><li>設定を変えたりボタンを押したりしても、スマホやSkyのデータが壊れたりすることはありません。気になったボタンはどんどんタップして遊んでみてくださいね✨</li></ul>${buildYouTubeEmbedHtml(HELP_VIDEO_IDS.intro, "はじめにの動画")}`,
  }),
]);
const DRAW_CONFIG = Object.freeze({
  signal: Object.freeze({
    W: 650, H: 670,
    RAD: 290,
    SIGNAL_FILL_WINDOW_MIN: 240,
    SOON_WINDOW_MIN: 30,
    TIME_Y_OFFSET: -20,
    PLACE_TIME_GAP_BASE: 90,
    PLACE_TIME_GAP_SCALE: 3 / 5,
    PLACE_Y_BASE_OFFSET: -110,
    BADGE_Y_BASE_OFFSET: -187,
    BADGE_W_SCALE: 7 / 8,
    LINE_WIDTH_BASE: 32,
    DOT_RADIUS: 16,
    BADGE_FONT_SIZE: 48,
    BADGE_W_BASE: 50,
    BADGE_H: 72,
    SUB_Y_OFFSET: 93,
    PLACE_FONT_SIZE: 58,
    TIME_FONT_SIZE: 90,
    SUB_FONT_SIZE: 51,
    BADGE_Y_GAP: 12,
  }),
  clock24: Object.freeze({ ...CLOCK_BASE }),
  clock12: Object.freeze({ ...CLOCK_BASE, WAVY: Object.freeze({ wavelength: 27, amp: 6, step: 6 }) }),
  simple: Object.freeze({ W: 650, H: 670, PAD: 25, START_Y: 180, LINE_H: 80, FONT_SIZE: 56, STRIKE_CHAR_W: 34, STRIKE_PAD: 10, STRIKE_Y_OFFSET: 3 }),
  timeline: Object.freeze({
    W: 650,
    H: { normal: 670, expanded: 1340 },
    PAD: 25,
    SCALE: { normal: 1.0, expanded: 1.25 },
    TOP_Y: { normal: 200, expanded: 240 },
    BOTTOM_PAD: { normal: 130, expanded: 150 },
    LINE_X_OFFSET: { normal: 120, expanded: 160 },
    EVENT_LABEL_X_OFFSET: 30,
    EVENT_LABEL_Y_OFFSET: { normal: 26, expanded: 32 },
    EVENT_LABEL_H: 52,
    TICK_LABEL_Y_OFFSET: { normal: 22, expanded: 26 },
    TICK_LABEL_H: 44,
    TICK_LEN: { major: 14, minor: 8 },
    TICK_LABEL_X_PAD: 15,
  }),
  bar: Object.freeze({
    W: { normal: 650, expanded: 1300 },
    H: 670,
    PAD: 25,
    SCALE: { normal: 1.0, expanded: 1.4 },
    BASE_Y: { normal: 380, expanded: 360 },
    HEIGHT: { normal: 40, expanded: 60 },
    X_PAD: { normal: 10, expanded: 30 },
    LABEL_UP: { normal: 60, expanded: 80 },
    TICK_LABEL_W: 60,
    TICK_LABEL_H: 44,
    TICK_LABEL_X_HALF: 30,
    EVENT_LABEL_W: 380,
    EVENT_LABEL_H: 50,
    EVENT_LABEL_LINE_END_Y: 45,
    TICK_LEN: { major: 10, minor: 5 },
    TICK_LABEL_Y_PAD: 15,
  }),
});
function normDeg(deg) {
  const d = Number(deg);
  if (!Number.isFinite(d)) return 0;
  return ((d % 360) + 360) % 360;
}
function polarToPoint(cx, cy, radius, angleRad) {
  const a = Number(angleRad) || 0;
  const r = Number(radius) || 0;
  const x = (Number(cx) || 0) + Math.cos(a) * r;
  const y = (Number(cy) || 0) + Math.sin(a) * r;
  return new Point(x, y);
}
function formatTimeRange(start, end, settings) {
  const st = settings || loadSettings();
  const s = (start instanceof Date) ? F.localTimeFormat(start, st) : String(start ?? "");
  const e = (end instanceof Date) ? F.localTimeFormat(end, st) : String(end ?? "");
  return `${s} - ${e}`;
}
function isValidDate(d) {
  return (d instanceof Date) && !Number.isNaN(d.getTime());
}
function inWindow(now, start, end) {
  return isValidDate(now) && isValidDate(start) && isValidDate(end)
    ? (now.getTime() >= start.getTime() && now.getTime() <= end.getTime())
    : false;
}
const isTruthy = (v) => v === true || v === 1 || v === "1" || String(v).toLowerCase() === "true";
const isPlainObject = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const createEmptyTypeState = () => ({ count: 0, pendingIds: [], notifiedIds: [] });
const _isRedOn = (sn) => !([false, 0, "0", "false"].includes(sn?.redEnabled));
const _isBlackOn = (sn) => isTruthy(sn?.blackEnabled);
const getBaseZeroForOffsetHours = (date, offsetHours = 0) => {
  const d = (date instanceof Date) ? date : new Date(date);
  const offMs = Number(offsetHours || 0) * MS_PER_HOUR;
  const localMs = d.getTime() + offMs;
  return localMs - (localMs % MS_PER_DAY) - offMs;
};
const getLocalAheadState = (now, settings) => {
  const st = settings || loadSettings();
  const baseZeroGameNow = getBaseZeroForTZ(now, TZ_LA);
  const localZeroMs = getBaseZeroForOffsetHours(now, Number(st.localOffset ?? 9));
  return { baseZeroGameNow, isLocalAheadOfGame: localZeroMs > baseZeroGameNow };
};
function drawReward(ctx, info, opts = {}) {
  if (!info || info.reward == null) return false;
    const o = opts || {};
    const W = o.W ?? (ctx?.size?.width ?? 0);
    const H = o.H ?? (ctx?.size?.height ?? 0);
    const s = Number.isFinite(Number(o.s)) ? Number(o.s) : 1;
    const PAD = Number.isFinite(Number(o.PAD)) ? Number(o.PAD)
              : Number.isFinite(Number(o.pad)) ? Number(o.pad)
              : 10;
    const text = (o.text != null) ? String(o.text) : `★ 報酬: ${info.reward}本`;
    const pal = o.PAL;
    const color = o.color ?? pal?.accent;
    const height = Number.isFinite(Number(o.height)) ? Number(o.height)
                  : (o.rect ? o.rect.height : (72 * s));
    const y = Number.isFinite(Number(o.y)) ? Number(o.y)
            : (o.rect ? o.rect.y : (H - height - (18 * s)));
    const rect = o.rect ?? new Rect(PAD, y, Math.max(0, W - (PAD * 2)), height);
    const fontSize = Number.isFinite(Number(o.fontSize)) ? Number(o.fontSize) : (48 * s);
    const font = o.font ?? Font.boldSystemFont(fontSize);
    const align = o.align ?? "left";
    drawTextHelpers.draw(ctx, text, rect, font, color, align);
    return true;
}
