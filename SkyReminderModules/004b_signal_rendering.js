function drawSignalMode(now, theme) {
  const PAL = getPalette(theme);
  drawTextHelpers.setPalette(PAL);
  const { W, H, RAD, SIGNAL_FILL_WINDOW_MIN, SOON_WINDOW_MIN, TIME_Y_OFFSET, PLACE_TIME_GAP_BASE, PLACE_TIME_GAP_SCALE, PLACE_Y_BASE_OFFSET, BADGE_Y_BASE_OFFSET, BADGE_W_SCALE, LINE_WIDTH_BASE, DOT_RADIUS } = DRAW_CONFIG.signal;
  const ctx = new DrawContext();
  ctx.size = new Size(W, H); ctx.opaque = false;
  const { activeEvent, nextEvent, displayEvent } = getSignalState(now);
  let strokeColor, waterColor;
  let realmText = "", mapText = "", statusBadge = "", mainLabel = "", timeText = "", subText = "";
  let ratio = 0;
  const formatTimeShort = (ms) => {
    const m = Math.floor(ms / MS_PER_MIN);
    const h = Math.floor(m / 60);
    const remM = m % 60;
    return h > 0 ? `${h}時間${String(remM).padStart(2, '0')}分` : `${remM}分`;
  };
  const SIGNAL_FILL_WINDOW_MS = SIGNAL_FILL_WINDOW_MIN * MS_PER_MIN;
  const SOON_WINDOW_MS = SOON_WINDOW_MIN * MS_PER_MIN;
  const signalTarget = activeEvent || nextEvent || null;
  const isRedShard = signalTarget ? !!signalTarget.isRed : false;
  const shardColorTxt = isRedShard ? "🔴 赤" : "⚫️ 黒";
  if (activeEvent) {
    const leftMs = activeEvent.end - now;
    waterColor = activeEvent.isRed ? PAL.signalWater.red : PAL.signalWater.green;
    strokeColor = activeEvent.isRed ? PAL.red : PAL.active;
    realmText = activeEvent.realm;
    mapText = activeEvent.map && activeEvent.map !== "—" ? activeEvent.map : "";
    statusBadge = shardColorTxt;
    mainLabel = "▼ 終了まで";
    timeText = formatTimeShort(leftMs);
    subText = `終了 ${F.localTimeFormat(activeEvent.end)}`;
    ratio = Math.max(0, Math.min(1.0, leftMs / (activeEvent.end - activeEvent.start)));
  } else if (nextEvent) {
    const leftMs = nextEvent.start - now;
    realmText = nextEvent.realm;
    mapText = nextEvent.map && nextEvent.map !== "—" ? nextEvent.map : "";
    mainLabel = "▲ 開始まで";
    timeText = formatTimeShort(leftMs);
    subText = `開始 ${F.localTimeFormat(nextEvent.start)}`;
    ratio = Math.max(0, Math.min(1.0, leftMs / SIGNAL_FILL_WINDOW_MS));
    if (leftMs <= SOON_WINDOW_MS) {
      waterColor = PAL.signalWater.orange;
      strokeColor = PAL.orange;
      statusBadge = `${shardColorTxt} (まもなく)`;
    } else {
      waterColor = PAL.signalWater.blue;
      strokeColor = PAL.cyan;
      statusBadge = `${shardColorTxt} (待機中)`;
    }
  } else {
    strokeColor = PAL.sub;
    statusBadge = "終了";
    mainLabel = "本日終了";
    timeText = "—";
    subText = "";
    ratio = 0;
    waterColor = C("#000000", 0);
  }
  const cx = W / 2, cy = H / 2;
  drawSignalBackgroundImage(ctx, (displayEvent && displayEvent.realm) ? displayEvent.realm : realmText, cx, cy, RAD, PAL);

  const ringWidth = Math.max(1, LINE_WIDTH_BASE / 2);
  const outerRad = RAD + ringWidth / 2;
  const innerRad = RAD - ringWidth / 2;
  const rDot = Math.max(1, DOT_RADIUS / 2);
  const drawRing = (ringRatio, ringColor, rad) => {
    ctx.setStrokeColor(PAL.signalTrack);
    ctx.setLineWidth(ringWidth);
    ctx.strokeEllipse(new Rect(cx - rad, cy - rad, rad * 2, rad * 2));
    if (ringRatio > 0) {
      const eRad = -Math.PI / 2; // 常に12時方向が終点
      const sRad = eRad - (Math.PI * 2 * ringRatio);
      const p = new Path();
      p.move(polarToPoint(cx, cy, rad, sRad));
      for (let a = sRad; a < eRad; a += 0.05) p.addLine(polarToPoint(cx, cy, rad, a));
      p.addLine(polarToPoint(cx, cy, rad, eRad));
      ctx.setStrokeColor(ringColor);
      ctx.setLineWidth(ringWidth);
      ctx.addPath(p);
      ctx.strokePath();
      ctx.setFillColor(ringColor);
      const ptStart = polarToPoint(cx, cy, rad, sRad);
      const ptEnd = polarToPoint(cx, cy, rad, eRad);
      ctx.fillEllipse(new Rect(ptStart.x - rDot, ptStart.y - rDot, rDot * 2, rDot * 2));
      ctx.fillEllipse(new Rect(ptEnd.x - rDot, ptEnd.y - rDot, rDot * 2, rDot * 2));
    }
  };
  const longLeftMs = (!activeEvent && nextEvent) ? Math.max(0, nextEvent.start - now) : 0;
  const longRatio = (longLeftMs <= 24 * MS_PER_HOUR && longLeftMs > SIGNAL_FILL_WINDOW_MS)
    ? Math.max(0, Math.min(1.0, (longLeftMs - SIGNAL_FILL_WINDOW_MS) / (20 * MS_PER_HOUR)))
    : 0;
  drawRing(ratio, strokeColor, outerRad);
  drawRing(longRatio, C("#bf5af2"), innerRad);

  const textMain = PAL.isDark ? C("#ffffff") : C("#111111");
  const textSub  = PAL.isDark ? C("#f2f2f7") : C("#3c3c43");
  const outlineC = PAL.isDark ? C("#000000", 0.85) : C("#ffffff", 0.9);
  const TIME_Y = cy + TIME_Y_OFFSET;
  const PLACE_TIME_GAP = Math.round(PLACE_TIME_GAP_BASE * PLACE_TIME_GAP_SCALE);
  const PLACE_Y = TIME_Y - PLACE_TIME_GAP;
  const PLACE_SHIFT = PLACE_Y - (cy + PLACE_Y_BASE_OFFSET);
  const BADGE_Y = (cy + BADGE_Y_BASE_OFFSET) + PLACE_SHIFT;
  const dTxtOutline = (txt, y, f, c, _borderC) => {
    if (!txt) return;
    const h = f.size * 1.25;
    drawTextHelpers.draw(ctx, txt, new Rect(0, y, W, h), f, c, "center");
  };
if (statusBadge) {
  const badgeFont = Font.boldSystemFont(48);
  const badgeW0 = statusBadge.length * 48 + 50;
  const badgeW = Math.round(badgeW0 * BADGE_W_SCALE);
  const badgeH = 72;
  const badgeY = BADGE_Y;
  const pPath = new Path();
  pPath.addRoundedRect(new Rect(cx - badgeW/2, badgeY, badgeW, badgeH), badgeH/2, badgeH/2);
  ctx.setFillColor(PAL.isDark ? C("#000000", 0.4) : C("#ffffff", 0.7));
  ctx.addPath(pPath);
  ctx.fillPath();
  ctx.setStrokeColor(strokeColor);
  ctx.setLineWidth(4);
  ctx.addPath(pPath);
  ctx.strokePath();
  drawTextHelpers.draw(ctx, statusBadge, new Rect(0, badgeY + 12, W, badgeH), badgeFont, strokeColor, "center");
}
const placeText = mapText ? `${realmText} - ${mapText}` : realmText;
const placeColor = (PAL.realms && realmText && PAL.realms[realmText]) ? PAL.realms[realmText] : textMain;
dTxtOutline(placeText, PLACE_Y, Font.boldSystemFont(58), placeColor, outlineC);
dTxtOutline(timeText, TIME_Y, Font.heavySystemFont(90), textMain, outlineC);
dTxtOutline(subText, cy + 93, Font.systemFont(51), PAL.sub, outlineC);
return ctx.getImage();
}
