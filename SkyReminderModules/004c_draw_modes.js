function resolveRadialLabelCollisions(labels) {
  if (!Array.isArray(labels) || labels.length === 0) return labels;
  labels.forEach(l => {
    if (!l) return;
    if (l.deg >= 270 || l.deg <= 90) {
      const t = Math.max(0, 1 - (Math.min(l.deg, 360 - l.deg) / 90));
      l.dist += -40 * (t * t * (3 - 2 * t));
    }
  });
  const bots = labels.filter(l => l && l.deg >= 140 && l.deg <= 220);
  if (bots.length >= 2) {
    bots.forEach(l => { l._s = ((l.deg - 180 + 540) % 360) - 180; });
    bots.sort((a, b) => a._s - b._s);
    for (let i = 0; i < bots.length - 1; i++) {
      if ((bots[i + 1]._s - bots[i]._s) <= 40) {
        const mid = (bots[i]._s + bots[i + 1]._s) / 2;
        (mid < 0 ? bots[i] : bots[i + 1]).dist = Math.min(bots[0].dist - 15, (mid < 0 ? bots[i] : bots[i + 1]).dist);
        (mid < 0 ? bots[i + 1] : bots[i]).dist = Math.max(bots[0].dist + 10, (mid < 0 ? bots[i + 1] : bots[i]).dist);
      }
    }
  }
  labels.forEach(l => { if (l && l._extraOut) l.dist += l._extraOut; });
  return labels;
}
const drawTextHelpers = {
  palette: null,
  setPalette: (pal) => {
    drawTextHelpers.palette = pal || null;
  },
  _getUnderlayColor: (size) => {
    const pal = drawTextHelpers.palette;
    const isDark = !!pal?.isDark;
    const alpha = Math.max(0.10, Math.min(0.20, 0.08 + (size / 260)));
    const darkBgHex = String(pal?.ui?.bg || "#1c1c1e");
    return isDark ? C(darkBgHex, alpha) : C("#ffffff", alpha);
  },
  _getOffsets: (size) => {
    const near = Math.max(2, Math.min(5, Math.round(size * 0.070)));
    const mid = Math.max(near + 1, Math.min(7, Math.round(size * 0.105)));
    const far = Math.max(mid + 1, Math.min(9, Math.round(size * 0.145)));
    return [
      [-near, 0], [near, 0], [0, -near], [0, near],
      [-near, -near], [near, -near], [-near, near], [near, near],
      [-mid, 0], [mid, 0], [0, -mid], [0, mid],
      [-mid, -near], [mid, -near], [-mid, near], [mid, near],
      [-near, -mid], [near, -mid], [-near, mid], [near, mid],
      [-far, 0], [far, 0], [0, -far], [0, far],
      [-far, -near], [far, -near], [-far, near], [far, near],
      [-near, -far], [near, -far], [-near, far], [near, far],
      [-mid, -mid], [mid, -mid], [-mid, mid], [mid, mid]
    ];
  },
  draw: (ctx, txt, r, f, c, align = "left") => {
    const s = (txt === null || txt === undefined) ? "" : String(txt);
    if (!s) return;
    const size = Math.max(12, Number(f?.size || 18));
    const underlay = drawTextHelpers._getUnderlayColor(size);
    const offsets = drawTextHelpers._getOffsets(size);
    ctx.setFont(f);
    align === "right" ? ctx.setTextAlignedRight()
      : align === "center" ? ctx.setTextAlignedCenter()
      : ctx.setTextAlignedLeft();
    ctx.setTextColor(underlay);
    for (const [ox, oy] of offsets) {
      ctx.drawTextInRect(s, new Rect(r.x + ox, r.y + oy, r.width, r.height));
    }
    ctx.setTextColor(c);
    ctx.drawTextInRect(s, r);
  }
};
function drawRadialLabels(ctx, labels, cx, cy, PAL, textKey) {
  labels.forEach(l => {
    const col = l.active ? PAL.active : (l.past ? Color.gray() : PAL.text);
    const lp = polarToPoint(cx, cy, l.dist, l.rad);
    const txt = textKey === "d" ? F.localTimeFormat(l[textKey]) : l[textKey];
    drawTextHelpers.draw(ctx, txt, new Rect(lp.x - 120, lp.y - 35, 240, 70), Font.boldSystemFont(45), col, "center");
  });
}
function drawCommonHeader(ctx, info, W, PAL, PAD) {
  let y = 10;
  const headH = 62 * 1.4;
  drawTextHelpers.draw(
    ctx,
    `${info.type.i}${info.type.l}${info.label}`,
    new Rect(PAD, y, W * 0.6, headH),
    Font.heavySystemFont(62),
    info.isRed ? PAL.red : PAL.text
  );
  drawTextHelpers.draw(
    ctx,
    F.dateLAFormat(info.displayDate),
    new Rect(W / 2, y, W / 2 - PAD, headH),
    Font.systemFont(62),
    PAL.sub,
    "right"
  );
  y += headH - 10;
  drawTextHelpers.draw(
    ctx,
    info.placeName,
    new Rect(PAD, y, W, 56 * 1.4),
    Font.boldSystemFont(56),
    PAL.realms[info.realm] || PAL.text
  );
  return y;
}
function createDrawContext({ theme, info, W, H, PAD = 25, scale = 1.0, headerFn = drawCommonHeader }) {
  const PAL = getPalette(theme);
  drawTextHelpers.setPalette(PAL);
  const ctx = new DrawContext();
  ctx.size = new Size(W, H);
  ctx.opaque = false;
  const y0 = (typeof headerFn === "function") ? headerFn(ctx, info, W, PAL, PAD) : 0;
  return { ctx, PAL, W, H, PAD, s: scale, y0 };
}
function drawClockFace24(info, now, theme, index) {
  const { W, H, PAD, RAD } = DRAW_CONFIG.clock24;
  const { ctx, PAL, y0 } = createDrawContext({ theme, info, W, H, PAD, scale: 1.0, headerFn: drawClockHeaderBlock });
  const bgRad = getConstellationBgRadius(W, H, y0);
  if (info && info.realm) drawSignalBackgroundImage(ctx, info.realm, W / 2, y0 + RAD, bgRad, PAL);
  const isCurrentGameCycle = (now.getTime() >= info.baseZero && now.getTime() < info.baseZero + MS_PER_DAY);
  const cx = W / 2;
  const cy = y0 + RAD;
  const timeToRad = makeCyclicTimeToRad(info.baseZero, MS_PER_DAY);
  const labels = [];
  const baseDist = RAD + 70;
  (info.occurrences || []).forEach(o => {
    let sRad = timeToRad(o.start);
    let eRad = timeToRad(o.end);
    if (eRad < sRad) eRad += TAU;
    const isActive = isCurrentGameCycle && now >= o.start && now <= o.end;
    const isPast = isCurrentGameCycle && now > o.end;
    const p = new Path();
    p.move(new Point(cx, cy));
    for (let a = sRad; a < eRad; a += 0.05) p.addLine(polarToPoint(cx, cy, (RAD - 5), a));
    p.addLine(polarToPoint(cx, cy, (RAD - 5), eRad));
    p.closeSubpath();
    ctx.addPath(p);
    const fillColor = !isCurrentGameCycle
      ? (info.isRed ? PAL.redFill : PAL.blackFill)
      : isPast ? (info.isRed ? PAL.redDim : PAL.blackDim)
      : (info.isRed ? PAL.redFill : PAL.blackFill);
    ctx.setFillColor(fillColor);
    ctx.fillPath();
    if (isActive) strokeOuterArcShared(ctx, cx, cy, RAD - 5, sRad, eRad, PAL.active);
    labels.push({ d: o.start, rad: sRad, deg: normDeg((sRad + Math.PI / 2) * 180 / Math.PI), dist: baseDist, active: isActive, past: isPast });
    labels.push({ d: o.end,   rad: eRad, deg: normDeg((eRad + Math.PI / 2) * 180 / Math.PI), dist: baseDist, active: isActive, past: isPast });
  });
  drawClockDialBase(ctx, cx, cy, RAD, PAL);
  resolveRadialLabelCollisions(labels);
  {
    const p = new Path();
    p.move(new Point(cx, cy));
    p.addLine(new Point(cx, cy - RAD + 5));
    ctx.setStrokeColor(PAL.cyan);
    ctx.setLineWidth(4);
    ctx.addPath(p);
    ctx.strokePath();
  }
  drawRadialLabels(ctx, labels, cx, cy, PAL, "d");
  drawCurrentTimeHand(ctx, cx, cy, RAD, PAL, timeToRad(now), index, [0, 1]);
  drawNumerals24(ctx, cx, cy, RAD, PAL, info);
  drawReward(ctx, info, getClockRewardOpts(PAD, y0, RAD, W, PAL));
  return ctx.getImage();
}
function drawClockFace12(info, now, theme, index) {
  const { W, H, PAD, RAD } = DRAW_CONFIG.clock12;
  const { ctx, PAL, y0 } = createDrawContext({ theme, info, W, H, PAD, scale: 1.0, headerFn: drawClockHeaderBlock });
  const bgRad = getConstellationBgRadius(W, H, y0);
  if (info && info.realm) drawSignalBackgroundImage(ctx, info.realm, W / 2, y0 + RAD, bgRad, PAL);
  const MS_12H = 12 * MS_PER_HOUR;
  const cx = W / 2;
  const cy = y0 + RAD;
  const localMidnightUTC = getBaseZeroForOffsetHours(now, Number(loadSettings().localOffset ?? 9));
  const timeToRad = (d) => {
    let ms = (d.getTime() - localMidnightUTC) % MS_PER_DAY;
    ms = (ms < 0) ? (ms + MS_PER_DAY) : ms;
    return ((ms % MS_12H) / MS_12H) * TAU - (Math.PI / 2);
  };
  const WAVY = DRAW_CONFIG.clock12.WAVY;
  const getWavyRadialPoints = (radAngle, fromCenterToOuter = true) => {
    const maxR = RAD - 5;
    const ruX = Math.cos(radAngle), ruY = Math.sin(radAngle);
    const puX = -ruY, puY = ruX;
    const pts = [];
    for (let r = 0; r <= maxR; r += WAVY.step) {
      const phase = (r / WAVY.wavelength) * TAU;
      const off = Math.sin(phase) * WAVY.amp;
      pts.push(new Point(cx + ruX * r + puX * off, cy + ruY * r + puY * off));
    }
    return fromCenterToOuter ? pts : pts.reverse();
  };
  const strokeWavyRadial = (radAngle, color) => {
    const p = new Path();
    getWavyRadialPoints(radAngle, true).forEach((pt, i) => (i === 0 ? p.move(pt) : p.addLine(pt)));
    ctx.setStrokeColor(color);
    ctx.setLineWidth(4);
    ctx.addPath(p);
    ctx.strokePath();
  };
  const labels = [];
  const baseDist = RAD + 70;
  (info.occurrences || []).forEach(o => {
    let sRad = timeToRad(o.start);
    let eRad = timeToRad(o.end);
    if (eRad < sRad) eRad += TAU;
    const isActive = (now >= o.origStart && now <= o.origEnd);
    const isPast = (now > o.origEnd);
    const isRed = !!o.isRed;
    const fillColor = isPast ? (isRed ? PAL.redDim : PAL.blackDim) : (isRed ? PAL.redFill : PAL.blackFill);
    const outerR = RAD - 5;
    const wavyAtStart = !!(o.dashedBoundaryTime && o.start.getTime() === o.dashedBoundaryTime.getTime());
    const wavyAtEnd = !!(o.dashedBoundaryTime && o.end.getTime() === o.dashedBoundaryTime.getTime());
    const p = new Path();
    p.move(new Point(cx, cy));
    if (wavyAtStart) getWavyRadialPoints(sRad, true).forEach(pt => p.addLine(pt));
    else p.addLine(polarToPoint(cx, cy, outerR, sRad));
    for (let a = sRad; a < eRad; a += 0.05) p.addLine(polarToPoint(cx, cy, outerR, a));
    p.addLine(polarToPoint(cx, cy, outerR, eRad));
    if (wavyAtEnd) getWavyRadialPoints(eRad, false).forEach(pt => p.addLine(pt));
    else p.addLine(new Point(cx, cy));
    p.closeSubpath();
    ctx.addPath(p);
    ctx.setFillColor(fillColor);
    ctx.fillPath();
    if (isActive) strokeOuterArcShared(ctx, cx, cy, outerR, sRad, eRad, PAL.active);
    if (wavyAtStart) strokeWavyRadial(sRad, fillColor);
    if (wavyAtEnd) strokeWavyRadial(eRad, fillColor);
    if (o.boundaryLabelText && o.boundaryLabelTime) {
      const isBndEnd = (o.end.getTime() === o.boundaryLabelTime.getTime());
      const isBndStart = (o.start.getTime() === o.boundaryLabelTime.getTime());
      const normDeg = (rad) => (((rad + Math.PI / 2) * 180 / Math.PI) + 360) % 360;
      const distToV = (deg) => Math.min(Math.min(deg, 360 - deg), Math.abs(deg - 180));
      let startLabel = null, endLabel = null, boundaryLabel = null;
      if (!isBndStart) labels.push(startLabel = { text: F.localTimeFormat(o.origStart), rad: sRad, deg: normDeg(sRad), dist: baseDist, active: isActive, past: isPast });
      if (!isBndEnd)   labels.push(endLabel   = { text: F.localTimeFormat(o.origEnd),   rad: eRad, deg: normDeg(eRad), dist: baseDist, active: isActive, past: isPast });
      const bRad = timeToRad(o.boundaryLabelTime);
      labels.push(boundaryLabel = { text: o.boundaryLabelText, rad: bRad, deg: normDeg(bRad), dist: baseDist, active: isActive, past: isPast });
      const degSpan = Math.abs((eRad - sRad) * 180 / Math.PI);
      const arcDeg = (degSpan > 180) ? (360 - degSpan) : degSpan;
      if (arcDeg <= 40 && boundaryLabel) {
        const other = startLabel || endLabel;
        if (other) {
          const tgt = (distToV(boundaryLabel.deg) <= distToV(other.deg)) ? boundaryLabel : other;
          const t = Math.max(0, 1 - (distToV(tgt.deg) / 90));
          tgt._extraOut = (tgt._extraOut || 0) + 30 * (t * t * (3 - 2 * t));
        }
      }
    } else {
      labels.push({ text: F.localTimeFormat(o.start), rad: sRad, deg: normDeg((sRad + Math.PI / 2) * 180 / Math.PI), dist: baseDist, active: isActive, past: isPast });
      labels.push({ text: F.localTimeFormat(o.end),   rad: eRad, deg: normDeg((eRad + Math.PI / 2) * 180 / Math.PI), dist: baseDist, active: isActive, past: isPast });
    }
  });
  drawClockDialBase(ctx, cx, cy, RAD, PAL);
  resolveRadialLabelCollisions(labels);
  labels.forEach(l => { if (l._extraOut) l.dist += l._extraOut; });
  drawRadialLabels(ctx, labels, cx, cy, PAL, "text");
  const winPos = Math.floor((now.getTime() - info.updateBase) / MS_12H);
  const greenIdx = Math.max(0, Math.min(3, winPos));
  const grayIdx = greenIdx + 1;
  drawCurrentTimeHand(ctx, cx, cy, RAD, PAL, timeToRad(now), index, [greenIdx, grayIdx]);
  drawReward(ctx, info, getClockRewardOpts(PAD, y0, RAD, W, PAL));
  drawNumerals12(ctx, cx, cy, RAD, PAL);
  return ctx.getImage();
}
function drawSimpleMode(info, now, theme) {
  const { W, H, PAD, START_Y, LINE_H, FONT_SIZE } = DRAW_CONFIG.simple;
  const { ctx, PAL } = createDrawContext({ theme, info, W, H, PAD, scale: 1.0, headerFn: drawCommonHeader });
  if (info && info.realm) drawSignalBackgroundImage(ctx, info.realm, W / 2, H / 2, getConstellationBgRadius(W, H), PAL);
  let curY = START_Y; const fList = new Font("Menlo-Bold", FONT_SIZE), lHeight = LINE_H;
  if (!info.occurrences || info.occurrences.length === 0) { drawTextHelpers.draw(ctx, "（なし）", new Rect(PAD, curY, W - PAD, lHeight), fList, PAL.blackDim); return ctx.getImage(); }
  info.occurrences.forEach((t, i) => {
    const isPast = info.isToday && now > t.end, isNow = info.isToday && now >= t.start && now <= t.end;
    let color = !info.isToday ? PAL.blackDim : isNow ? PAL.active : isPast ? PAL.blackDim : PAL.text;
    const txt = `${i+1}. ${formatTimeRange(t.start, t.end)}`;
    drawTextHelpers.draw(ctx, txt, new Rect(PAD, curY, W - PAD, lHeight), fList, color);
    if (info.isToday && isPast) {
      const lineY = curY + (lHeight / 2) - 3, path = new Path(); path.move(new Point(PAD - 10, lineY)); path.addLine(new Point(PAD + (txt.length * 34) + 10, lineY));
      ctx.setStrokeColor(PAL.blackDim); ctx.setLineWidth(5); ctx.addPath(path); ctx.strokePath();
    }
    curY += lHeight;
  });
  drawReward(ctx, info, { rect: new Rect(PAD, curY + 20, W-PAD, 80), font: Font.boldSystemFont(52), color: PAL.accent });
  return ctx.getImage();
}
function forEachTimeTick(isExpanded, fn) {
  const tickStep = isExpanded ? 1 : 2;
  const labelStep = isExpanded ? 3 : 6;
  for (let h = 0; h <= 24; h += tickStep) fn(h, (h % labelStep === 0));
}
function drawTimeRangeBackground(ctx, eventData, styleType) {
  const data = eventData || {};
  const PAL = data.PAL;
  if (styleType === "timeline") {
    (data.events || []).forEach(ev => {
      const p = new Path();
      p.move(new Point(data.lineX, ev.start));
      p.addLine(new Point(data.lineX, ev.end));
      ctx.setStrokeColor(ev.color);
      ctx.setLineWidth(data.eventLineWidth);
      ctx.addPath(p);
      ctx.strokePath();
    });
    return;
  }
  if (styleType === "bar") {
    const bgPath = new Path();
    bgPath.addRect(new Rect(data.startX, data.barY, data.endX - data.startX, data.barH));
    ctx.setFillColor(PAL.ring);
    ctx.addPath(bgPath);
    ctx.fillPath();
    (data.events || []).forEach(ev => {
      const p = new Path();
      p.addRect(new Rect(ev.start, data.barY, ev.end - ev.start, data.barH));
      ctx.setFillColor(ev.color);
      ctx.addPath(p);
      ctx.fillPath();
    });
  }
}
function drawMainSkeleton(ctx, eventData, styleType) {
  const data = eventData || {};
  const PAL = data.PAL;
  if (styleType === "timeline") {
    const axis = new Path();
    axis.move(new Point(data.lineX, data.topY));
    axis.addLine(new Point(data.lineX, data.bottomY));
    ctx.setStrokeColor(PAL.ring);
    ctx.setLineWidth(data.axisLineWidth);
    ctx.addPath(axis);
    ctx.strokePath();
    return;
  }
  if (styleType === "bar") {
    const border = new Path();
    border.addRect(new Rect(data.startX, data.barY, data.endX - data.startX, data.barH));
    ctx.setStrokeColor(PAL.ring);
    ctx.setLineWidth(data.borderLineWidth);
    ctx.addPath(border);
    ctx.strokePath();
  }
}
function drawTicks(ctx, eventData, styleType) {
  const data = eventData || {};
  (data.ticks || []).forEach(tick => {
    if (styleType === "timeline") {
      if (tick.label && tick.labelRect) drawTextHelpers.draw(ctx, tick.label, tick.labelRect, tick.font, tick.color);
      const p = new Path();
      p.move(new Point(tick.x1, tick.y));
      p.addLine(new Point(tick.x2, tick.y));
      ctx.setStrokeColor(tick.color);
      ctx.setLineWidth(tick.lineWidth);
      ctx.addPath(p);
      ctx.strokePath();
      return;
    }
    if (styleType === "bar") {
      if (tick.label && tick.labelRect) drawTextHelpers.draw(ctx, tick.label, tick.labelRect, tick.font, tick.color);
      const p = new Path();
      p.move(new Point(tick.x, tick.y1));
      p.addLine(new Point(tick.x, tick.y2));
      ctx.setStrokeColor(tick.color);
      ctx.setLineWidth(tick.lineWidth);
      ctx.addPath(p);
      ctx.strokePath();
    }
  });
}
function drawCurrentTimeIndicator(ctx, currentTime, eventData, styleType) {
  const data = eventData || {};
  const indicator = data.currentIndicator;
  if (!indicator) return;
  if (styleType === "timeline") {
    const p = new Path();
    p.move(new Point(indicator.startX, indicator.y));
    p.addLine(new Point(indicator.endX, indicator.y));
    ctx.setStrokeColor(indicator.color);
    ctx.setLineWidth(indicator.lineWidth);
    ctx.addPath(p);
    ctx.strokePath();
    ctx.setFillColor(indicator.color);
    ctx.fillEllipse(indicator.dotRect);
    return;
  }
  if (styleType === "bar") {
    const p = new Path();
    p.move(new Point(indicator.x, indicator.top));
    p.addLine(new Point(indicator.x, indicator.bottom));
    ctx.setStrokeColor(indicator.outlineColor);
    ctx.setLineWidth(indicator.outlineWidth);
    ctx.addPath(p);
    ctx.strokePath();
    ctx.setStrokeColor(indicator.color);
    ctx.setLineWidth(indicator.lineWidth);
    ctx.addPath(p);
    ctx.strokePath();
    const tri = new Path();
    tri.move(new Point(indicator.x, indicator.top));
    tri.addLine(new Point(indicator.x - indicator.outerTriangleHalfW, indicator.outerTriangleY));
    tri.addLine(new Point(indicator.x + indicator.outerTriangleHalfW, indicator.outerTriangleY));
    tri.closeSubpath();
    ctx.setFillColor(indicator.outlineColor);
    ctx.addPath(tri);
    ctx.fillPath();
    const tri2 = new Path();
    tri2.move(new Point(indicator.x, indicator.innerTriangleTop));
    tri2.addLine(new Point(indicator.x - indicator.innerTriangleHalfW, indicator.innerTriangleY));
    tri2.addLine(new Point(indicator.x + indicator.innerTriangleHalfW, indicator.innerTriangleY));
    tri2.closeSubpath();
    ctx.setFillColor(indicator.color);
    ctx.addPath(tri2);
    ctx.fillPath();
  }
}
function drawTimelineMode(info, now, theme, isExpanded = false) {
  const { W, H: HEIGHT, PAD, SCALE, TOP_Y, BOTTOM_PAD, LINE_X_OFFSET, EVENT_LABEL_X_OFFSET, EVENT_LABEL_Y_OFFSET, EVENT_LABEL_H, TICK_LABEL_Y_OFFSET, TICK_LABEL_H } = DRAW_CONFIG.timeline;
  const H = isExpanded ? HEIGHT.expanded : HEIGHT.normal;
  const s = isExpanded ? SCALE.expanded : SCALE.normal;
  const { ctx, PAL } = createDrawContext({ theme, info, W, H, PAD, scale: s, headerFn: drawCommonHeader });
  if (info && info.realm) drawSignalBackgroundImage(ctx, info.realm, W / 2, H / 2, getConstellationBgRadius(W, H), PAL);
  const topY = (isExpanded ? TOP_Y.expanded : TOP_Y.normal) * s;
  const botY = H - (isExpanded ? BOTTOM_PAD.expanded * s : BOTTOM_PAD.normal);
  const lineX = PAD + (isExpanded ? LINE_X_OFFSET.expanded : LINE_X_OFFSET.normal);
  const msDay = MS_PER_DAY;
  const baseHourLocal = F.localBaseHour(info.baseZero);
  const getY = (date) => topY + Math.max(0, Math.min(1, (date.getTime() - info.baseZero) / msDay)) * (botY - topY);
  const evLabels = [];
  const events = [];
  if (info.occurrences && info.occurrences.length > 0) {
    info.occurrences.forEach((o) => {
      const sy = getY(o.start);
      const ey = getY(o.end);
      const isPast = info.isToday && now > o.end;
      const isNow = info.isToday && now >= o.start && now <= o.end;
      events.push({ start: sy, end: ey, color: isNow ? PAL.active : (info.isRed ? PAL.redFill : PAL.blackFill) });
      const txt = `${formatTimeRange(o.start, o.end)}`;
      const evS = isExpanded ? 1.4 : 1.0;
      const labelYOffset = isExpanded ? EVENT_LABEL_Y_OFFSET.expanded : EVENT_LABEL_Y_OFFSET.normal;
      const r = new Rect(lineX + (EVENT_LABEL_X_OFFSET * s), ((sy + ey) / 2) - (labelYOffset * s), W - lineX - (EVENT_LABEL_X_OFFSET * s), EVENT_LABEL_H * evS);
      evLabels.push({ txt, r, font: Font.boldSystemFont(46 * evS), isNow, isPast });
    });
  }
  const ticks = [];
  forEachTimeTick(isExpanded, (h, isLabel) => {
    const ty = topY + (h / 24) * (botY - topY);
    const tLen = isLabel ? (14 * s) : (8 * s);
    const tick = {
      x1: lineX - tLen,
      x2: lineX + tLen,
      y: ty,
      lineWidth: isLabel ? (3 * s) : (1.5 * s),
      color: PAL.sub,
      label: "",
      labelRect: null,
      font: null,
    };
    if (isLabel) {
      const dispStr = String((baseHourLocal + h) % 24).padStart(2, '0');
      const tickLabelYOffset = isExpanded ? TICK_LABEL_Y_OFFSET.expanded : TICK_LABEL_Y_OFFSET.normal;
      tick.label = `${dispStr}:00`;
      tick.labelRect = new Rect(PAD, ty - (tickLabelYOffset * s), lineX - PAD - 15, TICK_LABEL_H * s);
      tick.font = Font.boldSystemFont(36 * s);
    }
    ticks.push(tick);
  });
  const currentIndicator = (now.getTime() >= info.baseZero && now.getTime() <= info.baseZero + msDay)
    ? {
        y: getY(now),
        startX: lineX - (20 * s),
        endX: W - PAD,
        lineWidth: 4 * s,
        color: PAL.handActive,
        dotRect: new Rect(lineX - (8 * s), getY(now) - (8 * s), 16 * s, 16 * s),
      }
    : null;
  const layerData = {
    PAL,
    lineX,
    topY,
    bottomY: botY,
    axisLineWidth: 6 * s,
    eventLineWidth: 16 * s,
    events,
    ticks,
    currentIndicator,
  };
  drawMainSkeleton(ctx, layerData, "timeline");
  drawTimeRangeBackground(ctx, layerData, "timeline");
  drawCurrentTimeIndicator(ctx, now, layerData, "timeline");
  drawTicks(ctx, layerData, "timeline");
  drawEventLabels(ctx, drawTextHelpers.draw, evLabels, info.isToday, PAL, s, "left");
  drawReward(ctx, info, { rect: new Rect(PAD, botY + 30 * s, W - PAD, 80 * s), font: Font.boldSystemFont(52 * s), color: PAL.accent });
  return ctx.getImage();
}
function drawBarMode(info, now, theme, isExpanded = false) {
  const { W: WIDTH, H, PAD, SCALE, BASE_Y, HEIGHT, X_PAD, LABEL_UP, TICK_LABEL_W, TICK_LABEL_H, TICK_LABEL_X_HALF, EVENT_LABEL_W, EVENT_LABEL_H, EVENT_LABEL_LINE_END_Y } = DRAW_CONFIG.bar;
  const W = isExpanded ? WIDTH.expanded : WIDTH.normal;
  const s = isExpanded ? SCALE.expanded : SCALE.normal;
  const { ctx, PAL } = createDrawContext({ theme, info, W, H, PAD, scale: s, headerFn: drawCommonHeader });
  if (info && info.realm) drawSignalBackgroundImage(ctx, info.realm, W / 2, H / 2, getConstellationBgRadius(W, H), PAL);
  const baseBarY = isExpanded ? BASE_Y.expanded : BASE_Y.normal;
  const barH = isExpanded ? HEIGHT.expanded : HEIGHT.normal;
  const barShift = Math.round(barH * 0.6);
  const barY = baseBarY + barShift;
  const curStartX = PAD + (isExpanded ? X_PAD.expanded : X_PAD.normal);
  const curEndX = W - PAD - (isExpanded ? X_PAD.expanded : X_PAD.normal);
  const msDay = MS_PER_DAY;
  const baseHourLocal = F.localBaseHour(info.baseZero);
  const getX = (date) => curStartX + Math.max(0, Math.min(1, (date.getTime() - info.baseZero) / msDay)) * (curEndX - curStartX);
  const ticks = [];
  forEachTimeTick(isExpanded, (h, isLabel) => {
    const tx = curStartX + (h / 24) * (curEndX - curStartX);
    const tLen = isLabel ? (10 * s) : (5 * s);
    const tick = {
      x: tx,
      y1: barY + barH,
      y2: barY + barH + tLen,
      lineWidth: isLabel ? (3 * s) : (1.5 * s),
      color: PAL.sub,
      label: "",
      labelRect: null,
      font: null,
    };
    if (isLabel) {
      const dispStr = String((baseHourLocal + h) % 24).padStart(2, '0');
      tick.label = `${dispStr}`;
      tick.labelRect = new Rect(tx - (TICK_LABEL_X_HALF * s), barY + barH + (15 * s), TICK_LABEL_W * s, TICK_LABEL_H * s);
      tick.font = Font.boldSystemFont(36 * s);
    }
    ticks.push(tick);
  });
  const events = [];
  const evLabels = [];
  if (info.occurrences && info.occurrences.length > 0) {
    info.occurrences.forEach((o, i) => {
      const sx = getX(o.start);
      const ex = getX(o.end);
      const isPast = info.isToday && now > o.end;
      const isNow = info.isToday && now >= o.start && now <= o.end;
      events.push({ start: sx, end: ex, color: isNow ? PAL.active : (info.isRed ? PAL.redFill : PAL.blackFill) });
      const midX = (sx + ex) / 2;
      const tUp = isExpanded ? LABEL_UP.expanded : LABEL_UP.normal;
      const textY = (baseBarY - barShift) - tUp - (i % 2 === 1 ? tUp : 0);
      const line = new Path();
      line.move(new Point(midX, barY));
      line.addLine(new Point(midX, textY + (EVENT_LABEL_LINE_END_Y * s)));
      ctx.setStrokeColor(PAL.ring);
      ctx.setLineWidth(2 * s);
      ctx.addPath(line);
      ctx.strokePath();
      const txtW = EVENT_LABEL_W * s;
      evLabels.push({ txt: `${formatTimeRange(o.start, o.end)}`, r: new Rect(midX - (txtW / 2), textY, txtW, EVENT_LABEL_H * s), font: Font.boldSystemFont(44 * s), isNow, isPast });
    });
  }
  const currentIndicator = (now.getTime() >= info.baseZero && now.getTime() <= info.baseZero + msDay)
    ? {
        x: getX(now),
        top: barY - (20 * s),
        bottom: barY + barH + (20 * s),
        color: PAL.handActive,
        outlineColor: PAL.isDark ? C("#000000", 0.7) : C("#ffffff", 0.95),
        outlineWidth: 9 * s,
        lineWidth: 4.5 * s,
        outerTriangleHalfW: 12 * s,
        outerTriangleY: barY - (40 * s),
        innerTriangleTop: barY - (22 * s),
        innerTriangleHalfW: 10 * s,
        innerTriangleY: barY - (38 * s),
      }
    : null;
  const layerData = {
    PAL,
    startX: curStartX,
    endX: curEndX,
    barY,
    barH,
    borderLineWidth: 2 * s,
    events,
    ticks,
    currentIndicator,
  };
  drawMainSkeleton(ctx, layerData, "bar");
  drawTimeRangeBackground(ctx, layerData, "bar");
  drawCurrentTimeIndicator(ctx, now, layerData, "bar");
  drawTicks(ctx, layerData, "bar");
  drawEventLabels(ctx, drawTextHelpers.draw, evLabels, info.isToday, PAL, s, "center");
  drawReward(ctx, info, { rect: new Rect(PAD, H - (110 * s), W - PAD, 80 * s), font: Font.boldSystemFont(52 * s), color: PAL.accent });
  return ctx.getImage();
