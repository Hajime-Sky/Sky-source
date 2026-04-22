}
const DRAW_HANDLERS = Object.freeze({
  signal: ({ now, theme }) => drawSignalMode(now, theme),
  timeline: ({ info, now, theme, isExpanded }) => drawTimelineMode(info, now, theme, isExpanded),
  bar: ({ info, now, theme, isExpanded }) => drawBarMode(info, now, theme, isExpanded),
  simple: ({ info, now, theme }) => drawSimpleMode(info, now, theme),
  clock12: ({ info, now, theme, index }) => drawClockFace12(info, now, theme, index),
  clock24: ({ info, now, theme, index }) => drawClockFace24(info, now, theme, index),
});
function generateImage(info, now, theme, mode, index, isExpanded) {
  const key = String(mode || "").trim() || "clock24";
  const handler = DRAW_HANDLERS[key] || DRAW_HANDLERS.clock24;
  return handler({ info, now, theme, mode: key, index, isExpanded });
}
const WIDGET_LAYOUT_RULES = Object.freeze({
  small: [
    { when: { layoutMode: "signal" }, cfg: { cols: 1, rows: 1, cells: [{ src: "signal", mode: "signal", isExp: false }] } },
    { when: { }, cfg: { cols: 1, rows: 1, cells: [{ src: "item", isExp: false }] } },
  ],
  medium: [
    { when: { viewMode: "bar", layoutMode: "expanded" }, cfg: { cols: 1, rows: 1, cells: [{ src: "item", isExp: true }] } },
    { when: { layoutMode: "signal" }, cfg: { cols: 2, rows: 1, cells: [{ src: "signal", mode: "signal", isExp: false }, { src: "item", isExp: false }] } },
    { when: { }, cfg: { cols: 2, rows: 1, cells: [{ src: "item", isExp: false }, { src: "item", isExp: false }] } },
  ],
  large: [
    { when: { viewMode: "timeline", layoutMode: "expanded" }, cfg: { cols: 2, rows: 1, cells: [{ src: "item", isExp: true }, { src: "item", isExp: true }] } },
    { when: { viewMode: "bar", layoutMode: "expanded" }, cfg: { cols: 1, rows: 2, cells: [{ src: "item", isExp: true }, { src: "item", isExp: true }] } },
    { when: { layoutMode: "signal" }, cfg: { cols: 2, rows: 2, cells: [{ src: "signal", mode: "signal", isExp: false }, { src: "item", isExp: false }, { src: "item", isExp: false }, { src: "item", isExp: false }] } },
    { when: { }, cfg: { cols: 2, rows: 2, cells: [{ src: "item", isExp: false }, { src: "item", isExp: false }, { src: "item", isExp: false }, { src: "item", isExp: false }] } },
  ],
  default: [
    { when: { }, cfg: { cols: 1, rows: 1, cells: [{ src: "item", isExp: false }] } },
  ],
});
function resolveWidgetLayout(family, viewMode, layoutMode) {
  const rules = WIDGET_LAYOUT_RULES[family] || WIDGET_LAYOUT_RULES.default;
  const vm = String(viewMode || "");
  const lm = String(layoutMode || "");
  for (const r of rules) {
    const w = r.when || {};
    const ok = (!w.viewMode || w.viewMode === vm) && (!w.layoutMode || w.layoutMode === lm);
    if (ok) {
      const cfg = r.cfg || {};
      const cols = Number(cfg.cols) || 1;
      const rows = Number(cfg.rows) || 1;
      const cells = Array.isArray(cfg.cells) ? cfg.cells.slice() : [];
      return { cols, rows, cells };
    }
  }
  return WIDGET_LAYOUT_RULES.default[0].cfg;
}
const WIDGET_IMAGE_SIZES = Object.freeze({
  base: new Size(WIDGET_BASE_SZ, WIDGET_BASE_SZ),
  expanded: Object.freeze({
    timeline: new Size(WIDGET_BASE_SZ, WIDGET_EXP_SZ),
    bar: new Size(WIDGET_EXP_SZ, WIDGET_BASE_SZ),
  }),
});
const ITEM_SOURCES = Object.freeze({
  clock12: build12hWindows,
  default: getUpcomingFixedDays,
});
const WIDGET_DATA_CACHE_REV = "2026-04-22-shard-label-v3";
function getWidgetDataCached(now, viewMode, need, settings) {
  const st = settings || loadSettings();
  const cacheKey = `widget:${WIDGET_DATA_CACHE_REV}:${viewMode}:${need}`;
  const cached = CacheManager.getValidCache(st, cacheKey, now);
  if (cached) return cached;
  const src = ITEM_SOURCES[String(viewMode || "")] || ITEM_SOURCES.default;
  const res = src(now, need) || [];
  CacheManager.setCache(st, cacheKey, now, res);
  return res;
}
function buildCellRenders(now, viewMode, layout, settings) {
  const st = settings || loadSettings();
  const cells = Array.isArray(layout?.cells) ? layout.cells : [];
  const need = cells.reduce((a, c) => a + (String(c?.src || "item") === "item" ? 1 : 0), 0);
  const items = getWidgetDataCached(now, viewMode, need, st);
  let itemPos = 0;
  let clockIndex = 0;
  const out = [];
  for (const cell of cells) {
    const cellSrc = String(cell?.src || "item");
    const mode = String(cell?.mode || viewMode || "clock24");
    const isExp = !!cell?.isExp;
    if (cellSrc === "item") {
      const info = items[itemPos++] || null;
      out.push({ info, mode, index: clockIndex++, isExpanded: isExp });
    } else {
      out.push({ info: null, mode, index: 0, isExpanded: isExp });
    }
  }
  return out;
}
function runWidget(now) {
  const settings = loadSettings();
  const PAL = getPalette(settings.theme);
  const w = new ListWidget();
  w.backgroundGradient = new LinearGradient(PAL.bgCtx, [0, 1]);
  w.setPadding(0, 0, 0, 0);
  const family = String(config.widgetFamily || "small");
  const viewMode = settings.viewMode;
  const layoutMode = settings.layoutMode;
  const layout = resolveWidgetLayout(family, viewMode, layoutMode);
  const cells = buildCellRenders(now, viewMode, layout, settings);
  const makeImg = (c) => generateImage(c?.info || null, now, settings.theme, c?.mode || viewMode, c?.index || 0, !!c?.isExpanded);
  if (!cells.length) { w.addText("None"); Script.setWidget(w); return; }
  const stack = w.addStack();
  if (layout.cols === 1 && layout.rows === 1) {
    const cell = cells[0];
    stack.addImage(makeImg(cell, 0));
    Script.setWidget(w);
    return;
  }
  stack.layoutVertically();
  for (let r = 0; r < layout.rows; r++) {
    const row = stack.addStack();
    row.layoutHorizontally();
    for (let c = 0; c < layout.cols; c++) {
      const idx = r * layout.cols + c;
      const cell = cells[idx];
      if (!cell) continue;
      const img = makeImg(cell, idx);
      const iNode = row.addImage(img);
      let size = WIDGET_IMAGE_SIZES.base;
      if (cell.isExpanded) size = WIDGET_IMAGE_SIZES.expanded[String(viewMode || "")] || size;
      iNode.imageSize = size;
      if (c < layout.cols - 1) row.addSpacer(0);
    }
    if (r < layout.rows - 1) stack.addSpacer(0);
  }
  Script.setWidget(w);
}
function getPreviewImages(baseNow, settings) {
  const st = settings || loadSettings();
  const now = baseNow;
  const viewMode = st.viewMode;
  const layout = resolveWidgetLayout("large", viewMode, st.layoutMode);
  const cells = buildCellRenders(now, viewMode, layout, st);
  return cells.map((cell, idx) => {
    const img = generateImage(cell.info, now, st.theme, cell.mode || viewMode, cell.index || 0, !!cell.isExpanded);
    return { id: `card-${idx}`, base64: Data.fromPNG(img).toBase64String() };
  });
}
function generateCardsHtml(images, settings) {
  const st = settings || loadSettings();
  const viewMode = st.viewMode;
  const layout = resolveWidgetLayout("large", viewMode, st.layoutMode);
  const cols = Number(layout?.cols) || 2;
  const cells = Array.isArray(layout?.cells) ? layout.cells : [];
  const gridStyle = `grid-template-columns: repeat(${cols}, 1fr);`;
  const cards = images.map((d, i) => {
    const cell = cells[i] || {};
    const mode = String(cell?.mode || viewMode || "clock24");
    let cardAspect = "1 / 1";
    const sz = cell?.isExp ? (WIDGET_IMAGE_SIZES.expanded[mode] || WIDGET_IMAGE_SIZES.base) : WIDGET_IMAGE_SIZES.base;
    cardAspect = `${sz.width} / ${sz.height}`;
    return `<div class="card" style="aspect-ratio: ${cardAspect};"><img id="${d.id}" src="data:image/png;base64,${d.base64}" /></div>`;
  }).join("");
  return `<div class="grid" id="grid-container" style="${gridStyle}">${cards}</div>`;
}
