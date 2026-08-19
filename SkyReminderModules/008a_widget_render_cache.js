// Sky reminder widget render-cache helpers.
// Only truly reusable rendering is cached here; time-dependent event cells keep their live draw path.
const SKY_REMINDER_RENDER_CACHE_REV = "2026-08-19-v1";

function skyReminderRenderCacheEnabled() {
  try {
    const st = typeof loadSettings === "function" ? loadSettings() : null;
    return !(st && st.useCache === false);
  } catch (_) {
    return true;
  }
}

function skyReminderRenderCacheHash(text) {
  let h = 2166136261;
  const s = String(text || "");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

function skyReminderRenderCacheDir() {
  const fm = FileManager.local();
  let dir = fm.documentsDirectory();
  for (const part of ["HajimeSkyTools", "star-reminder", "widget-render-cache", SKY_REMINDER_RENDER_CACHE_REV]) {
    dir = fm.joinPath(dir, part);
    if (!fm.fileExists(dir)) fm.createDirectory(dir, true);
  }
  return { fm, dir };
}

function skyReminderRenderCachePath(kind, payload) {
  const raw = JSON.stringify({ rev: SKY_REMINDER_RENDER_CACHE_REV, kind, payload });
  const { fm, dir } = skyReminderRenderCacheDir();
  return { fm, dir, path: fm.joinPath(dir, skyReminderRenderCacheHash(raw) + ".png") };
}

function skyReminderRenderCacheRead(kind, payload) {
  if (!skyReminderRenderCacheEnabled()) return null;
  try {
    const d = skyReminderRenderCachePath(kind, payload);
    if (!d.fm.fileExists(d.path)) return null;
    return Image.fromFile(d.path);
  } catch (_) {
    return null;
  }
}

function skyReminderRenderCachePrune(dir, fm, keep = 16) {
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

function skyReminderRenderCacheWrite(kind, payload, image) {
  if (!skyReminderRenderCacheEnabled() || !image) return;
  try {
    const d = skyReminderRenderCachePath(kind, payload);
    d.fm.writeImage(d.path, image);
    skyReminderRenderCachePrune(d.dir, d.fm);
  } catch (_) {}
}

(function installSkyReminderWidgetBackgroundCache() {
  if (typeof skyReminderCreateWholeWidgetBackground !== "function") return;
  if (globalThis.__SKY_REMINDER_WIDGET_BG_CACHE_INSTALLED === true) return;
  const nativeCreate = skyReminderCreateWholeWidgetBackground;
  skyReminderCreateWholeWidgetBackground = function(theme, layout, viewMode) {
    if (!skyReminderRenderCacheEnabled()) return nativeCreate(theme, layout, viewMode);
    const logical = typeof skyReminderWidgetLogicalSize === "function"
      ? skyReminderWidgetLogicalSize(layout, viewMode)
      : null;
    const target = typeof skyReminderWidgetBackgroundSize === "function"
      ? skyReminderWidgetBackgroundSize(layout, viewMode)
      : null;
    const payload = {
      theme: String(theme || ""),
      viewMode: String(viewMode || ""),
      cols: Number(layout && layout.cols || 1),
      rows: Number(layout && layout.rows || 1),
      cells: Array.isArray(layout && layout.cells) ? layout.cells : [],
      logical: logical ? { width: Number(logical.width) || 0, height: Number(logical.height) || 0 } : null,
      target: target ? { width: Number(target.width) || 0, height: Number(target.height) || 0 } : null
    };
    const cached = skyReminderRenderCacheRead("whole-background", payload);
    if (cached) return cached;
    const image = nativeCreate(theme, layout, viewMode);
    skyReminderRenderCacheWrite("whole-background", payload, image);
    return image;
  };
  globalThis.__SKY_REMINDER_WIDGET_BG_CACHE_INSTALLED = true;
})();
