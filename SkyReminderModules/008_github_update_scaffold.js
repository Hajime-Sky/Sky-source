const SKY_REMINDER_UPDATE_SCAFFOLD = Object.freeze({
  enabled: true,
  manifestUrl: "https://raw.githubusercontent.com/Hajime-Sky/Sky-source/main/SkyReminderModules/manifest.json",
  hashAlgorithm: "sha256",
  policies: Object.freeze(["none", "daily", "always"]),
});
function skyReminderHex(r, g, b) {
  return "#" + ((1 << 24) + (Math.max(0, Math.min(255, r)) << 16) + (Math.max(0, Math.min(255, g)) << 8) + Math.max(0, Math.min(255, b))).toString(16).slice(1);
}
function skyReminderDrawStarryCanvasBackground(ctx, W, H, PAL) {
  const isDark = !!PAL?.isDark;
  const top = isDark ? { r: 6, g: 8, b: 13 } : { r: 125, g: 211, b: 252 };
  const bot = isDark ? { r: 15, g: 25, b: 40 } : { r: 240, g: 249, b: 255 };
  for (let y = 0; y < H; y += 4) {
    const ratio = H <= 1 ? 0 : y / H;
    const r = Math.round(top.r + (bot.r - top.r) * ratio);
    const g = Math.round(top.g + (bot.g - top.g) * ratio);
    const b = Math.round(top.b + (bot.b - top.b) * ratio);
    ctx.setFillColor(new Color(skyReminderHex(r, g, b), 1));
    ctx.fillRect(new Rect(0, y, W, Math.min(4, H - y)));
  }
  if (!isDark) return;
  let seed = 88;
  const stars = [];
  const rnd = () => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };
  const scale = Math.max(0.18, Math.min(1.35, (W * H) / (800 * 800)));
  const specs = [[55, 34, 3.2], [135, 16, 2.2], [240, 7, 1.45]].map(s => [Math.max(1, Math.round(s[0] * scale)), s[1], s[2]]);
  for (const spec of specs) {
    for (let i = 0; i < spec[0]; i++) {
      let x = 0, y = 0, ok = false;
      for (let a = 0; a < 55 && !ok; a++) {
        x = Math.floor(rnd() * W);
        y = Math.floor(rnd() * H);
        ok = stars.every(s => ((s.x - x) ** 2 + (s.y - y) ** 2) > spec[1] ** 2);
      }
      if (!ok) continue;
      stars.push({ x, y });
      const alpha = spec[2] >= 3 ? 0.50 + rnd() * 0.35 : spec[2] >= 2 ? 0.28 + rnd() * 0.34 : 0.16 + rnd() * 0.26;
      ctx.setFillColor(new Color("#ffffff", alpha));
      ctx.fillEllipse(new Rect(x, y, spec[2], spec[2]));
      if (spec[2] >= 2.2) {
        ctx.setFillColor(new Color("#ffffff", alpha * 0.28));
        ctx.fillEllipse(new Rect(x - 1.2, y - 1.2, spec[2] + 2.4, spec[2] + 2.4));
      }
    }
  }
}
function skyReminderCellSizeForBackground(cell, viewMode) {
  let size = WIDGET_IMAGE_SIZES.base;
  const mode = String(cell?.mode || viewMode || "clock24");
  if (cell?.isExpanded) size = WIDGET_IMAGE_SIZES.expanded[mode] || size;
  return size;
}
function skyReminderWidgetLogicalSize(layout, viewMode) {
  const cells = Array.isArray(layout?.cells) ? layout.cells : [];
  const cols = Math.max(1, Number(layout?.cols) || 1);
  const rows = Math.max(1, Number(layout?.rows) || 1);
  const colWidths = new Array(cols).fill(Number(WIDGET_BASE_SZ || 160));
  const rowHeights = new Array(rows).fill(Number(WIDGET_BASE_SZ || 160));
  cells.forEach((cell, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const size = skyReminderCellSizeForBackground(cell, viewMode);
    colWidths[col] = Math.max(colWidths[col], Number(size?.width) || Number(WIDGET_BASE_SZ || 160));
    rowHeights[row] = Math.max(rowHeights[row], Number(size?.height) || Number(WIDGET_BASE_SZ || 160));
  });
  return new Size(Math.max(1, colWidths.reduce((a, b) => a + b, 0)), Math.max(1, rowHeights.reduce((a, b) => a + b, 0)));
}
function skyReminderWidgetBackgroundSize(layout, viewMode) {
  const logical = skyReminderWidgetLogicalSize(layout, viewMode);
  const lw = Math.max(1, Number(logical?.width) || 1);
  const lh = Math.max(1, Number(logical?.height) || 1);
  const longSide = Math.max(lw, lh);
  const targetLongSide = Math.min(640, Math.max(320, longSide * 2));
  const scale = targetLongSide / longSide;
  return new Size(Math.max(1, Math.round(lw * scale)), Math.max(1, Math.round(lh * scale)));
}
function skyReminderCreateWholeWidgetBackground(theme, layout, viewMode) {
  const PAL = getPalette(theme);
  const size = skyReminderWidgetBackgroundSize(layout, viewMode);
  const W = Math.max(1, Math.round(Number(size?.width) || 800));
  const H = Math.max(1, Math.round(Number(size?.height) || 800));
  const ctx = new DrawContext();
  ctx.size = new Size(W, H);
  ctx.opaque = true;
  ctx.respectScreenScale = false;
  skyReminderDrawStarryCanvasBackground(ctx, W, H, PAL);
  return ctx.getImage();
}
function skyReminderResolveWebTheme() {
  try {
    const st = typeof loadSettings === "function" ? loadSettings() : {};
    const pal = typeof getPalette === "function" ? getPalette(st.theme) : null;
    if (pal && typeof pal.isDark === "boolean") return pal.isDark ? "dark" : "light";
    if (String(st.theme || "") === "light") return "light";
  } catch (_) {}
  return "dark";
}
function skyReminderBuildStarryWebViewStyle() {
  const defaultTheme = skyReminderResolveWebTheme();
  const defaultLight = defaultTheme === "light";
  const darkBg = "radial-gradient(circle at 9% 13%,rgba(255,255,255,.72) 0 1.2px,transparent 1.8px),radial-gradient(circle at 73% 21%,rgba(255,255,255,.45) 0 1.1px,transparent 1.7px),radial-gradient(circle at 28% 67%,rgba(255,255,255,.38) 0 1px,transparent 1.6px),radial-gradient(circle at 87% 78%,rgba(255,255,255,.28) 0 1px,transparent 1.5px),linear-gradient(180deg,#06080d 0%,#0f1928 100%)";
  const lightBg = "linear-gradient(180deg,#7dd3fc 0%,#f0f9ff 100%)";
  const defaultBg = defaultLight ? lightBg : darkBg;
  const defaultRootBg = defaultLight ? "#f0f9ff" : "#06080d";
  const defaultCard = defaultLight ? "rgba(255,255,255,.16)" : "rgba(12,16,24,.18)";
  const defaultLine = defaultLight ? "rgba(15,23,42,.16)" : "rgba(255,255,255,.12)";
  const cards = ".card,.card-like,.notify-summary-card,.rule-progress-card,.rule-common-card,.rule-specific-card,.originalsin-card,.schedule-card,.manage-card,.manage-group,.manage-item,.status-card,.setting-card,.data-card,.cache-card,.backup-card,.preview-card,.help-video-card,.event-panel,.event-card,.panel,.section-card,.common-setting-row,.field-row,.osi-list-row";
  return `<style data-sky-reminder-starry-bg="1">
html,body{min-height:100%;background:${defaultRootBg}!important;}
html{--sky-starry-card:${defaultCard};--sky-starry-line:${defaultLine};--card:${defaultCard};--line:${defaultLine};--shadow-soft:none;}
body{position:relative;isolation:isolate;background:transparent!important;}
body::before{content:"";position:fixed;inset:0;pointer-events:none;z-index:0;background:${defaultBg};background-size:142px 142px,96px 96px,118px 118px,74px 74px,100% 100%;background-position:0 0,18px 37px,41px 11px,9px 22px,0 0;}
body::after{content:"";position:fixed;inset:-20%;pointer-events:none;z-index:0;background:radial-gradient(circle at 50% 18%,rgba(88,214,199,.16),transparent 32%),radial-gradient(circle at 18% 85%,rgba(125,211,252,.10),transparent 28%);filter:blur(2px);}
body>*{position:relative;z-index:1;}
${cards}{background:var(--sky-starry-card)!important;background-color:var(--sky-starry-card)!important;-webkit-backdrop-filter:blur(1px) saturate(1.06)!important;backdrop-filter:blur(1px) saturate(1.06)!important;border-color:var(--sky-starry-line)!important;box-shadow:none!important;}
html[data-sky-reminder-theme="light"]{--sky-starry-card:rgba(255,255,255,.16);--sky-starry-line:rgba(15,23,42,.16);--card:rgba(255,255,255,.16);--line:rgba(15,23,42,.16);background:#f0f9ff!important;}
html[data-sky-reminder-theme="light"] body::before{background:${lightBg};background-size:100% 100%;background-position:0 0;}
html[data-sky-reminder-theme="dark"]{--sky-starry-card:rgba(12,16,24,.18);--sky-starry-line:rgba(255,255,255,.12);--card:rgba(12,16,24,.18);--line:rgba(255,255,255,.12);background:#06080d!important;}
html[data-sky-reminder-theme="dark"] body::before{background:${darkBg};background-size:142px 142px,96px 96px,118px 118px,74px 74px,100% 100%;background-position:0 0,18px 37px,41px 11px,9px 22px,0 0;}
</style>`;
}
function skyReminderBuildThemeSyncScript() {
  const fallback = skyReminderResolveWebTheme();
  return `<script data-sky-reminder-theme-sync="1">(()=>{const fallback=${JSON.stringify(fallback)};const pick=()=>{const html=document.documentElement;const body=document.body;const attr=(html&&html.getAttribute('data-theme'))||(body&&body.getAttribute('data-theme'))||(html&&html.getAttribute('data-mode'))||(body&&body.getAttribute('data-mode'))||'';if(/light/i.test(attr))return 'light';if(/dark/i.test(attr))return 'dark';const cls=((html&&html.className)||'')+' '+((body&&body.className)||'');if(/light/i.test(cls))return 'light';if(/dark/i.test(cls))return 'dark';const selected=document.querySelector('#seg-theme .opt.selected,[data-setting-key="theme"].selected');const val=(selected&&(selected.dataset.settingValue||selected.dataset.value||selected.textContent))||'';if(/ライト|light/i.test(val))return 'light';if(/ダーク|dark/i.test(val))return 'dark';return fallback;};const apply=()=>{document.documentElement.setAttribute('data-sky-reminder-theme',pick());};const start=()=>{apply();try{new MutationObserver(apply).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','data-theme','data-mode','data-setting-value']});}catch(_){}};document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start,{once:true}):start();})();</script>`;
}
function skyReminderInjectStarryWebViewBackground(html) {
  const raw = String(html ?? "");
  if (!raw || raw.includes('data-sky-reminder-starry-bg="1"')) return raw;
  const style = skyReminderBuildStarryWebViewStyle() + skyReminderBuildThemeSyncScript();
  if (raw.includes("</head>")) return raw.replace("</head>", `${style}</head>`);
  if (raw.includes("</body>")) return raw.replace("</body>", `${style}</body>`);
  return style + raw;
}
(function installSkyReminderStarryWebViewBackground() {
  try {
    if (globalThis.__SKY_REMINDER_STARRY_WEBVIEW_BG_INSTALLED === true) return;
    if (typeof WebView === "undefined" || !WebView || !WebView.prototype) return;
    const nativeLoadHTML = WebView.prototype.loadHTML;
    if (typeof nativeLoadHTML !== "function") return;
    WebView.prototype.loadHTML = function(html, ...rest) {
      return nativeLoadHTML.call(this, skyReminderInjectStarryWebViewBackground(html), ...rest);
    };
    globalThis.__SKY_REMINDER_STARRY_WEBVIEW_BG_INSTALLED = true;
  } catch (_) {}
})();
function buildSkyReminderUpdatePlan(localManifest, remoteManifest) {
  const localParts = Array.isArray(localManifest?.parts) ? localManifest.parts : [];
  const remoteParts = Array.isArray(remoteManifest?.parts) ? remoteManifest.parts : [];
  const localByFile = Object.create(null);
  for (const part of localParts) {
    if (part && part.file) localByFile[String(part.file)] = part;
  }
  return remoteParts
    .filter(part => part && part.file)
    .map(part => {
      const local = localByFile[String(part.file)] || null;
      const changed = !local || String(local.sha256 || "") !== String(part.sha256 || "");
      return { file: String(part.file), url: String(part.url || ""), sha256: String(part.sha256 || ""), changed };
    })
    .filter(item => item.changed);
}
async function skyReminderCheckForGithubUpdateDisabled() {
  throw new Error("GitHub update is implemented in the root loader so it can run before module loading. Configure settings.githubUpdate from the app UI.");
}
