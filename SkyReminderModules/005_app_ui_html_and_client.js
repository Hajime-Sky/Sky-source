async function runApp(now) {
  const qp = (args && args.queryParameters) ? args.queryParameters : {};
  const allowedScreens = new Set([...NAV_SCREEN_DEFS.map(d => d.id), "help"]); const initialScreen = allowedScreens.has(String(qp.screen||"").trim()) ? String(qp.screen).trim() : "shards";
  const settings = loadSettings();
  const ui = getPalette(settings.theme).ui;
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const palettesForWeb = { light: getPalette("light").ui, dark: getPalette("dark").ui };
  const isDark = settings.theme === 'dark';
  const initialImages = getPreviewImages(now, settings);
  const num = (v, def) => (v === undefined || v === null || v === "" || Number.isNaN(Number(v))) ? def : Number(v);
  const __rsForRemain = loadRunState(settings);
  const __remainLaKey = fmtLaKey(now);
  const __remainPack = buildRemainInfo(settings, __rsForRemain, __remainLaKey);
  const __remainInfo = __remainPack.info;
const __eventTitles = (() => {
  const out = {};
  for (const p of buildEventProviders(settings)) {
    out[p.type] = String(p?.ui?.title || p.fallbackTitle(settings) || p.type);
  }
  return out;
})();
const __notiIdConfig = Object.freeze({
  testTag: String(NOTI_ID.TEST_TAG || ""),
});
const __originalSinResetBaseUtcMs = (() => {
  try {
    const effectiveNow = getEffectiveNow(getReferenceDate(), settings);
    const laKey = fmtLaKey(effectiveNow);
    return Number(laBaseZeroFromKey(laKey) || 0);
  } catch (_) {
    return 0;
  }
})();
const __originalSinWindowMap = (() => {
  const out = {};
  try {
    const baseNow = getEffectiveNowFromRef(now, settings);
    const startBase = laBaseZero(baseNow) - (14 * MS_PER_DAY);
    for (let i = 0; i < 31; i++) {
      const base = startBase + (i * MS_PER_DAY);
      const lk = fmtLaKey(base);
      if (!lk || out[lk]) continue;
      const win = getLocalSkyDayWindowForLaKey(lk, settings);
      if (!win) continue;
      out[lk] = {
        label: formatLocalSkyWindowLabel(win, settings),
        startMs: win.start.getTime(),
        endMs: win.endExclusive.getTime(),
      };
    }
  } catch (_) {}
  return out;
})();
const __appContext = Object.freeze({
  remainInfo: __remainInfo,
  remainLaKey: __remainLaKey,
  eventTitles: __eventTitles,
  notiIdConfig: __notiIdConfig,
  palettes: palettesForWeb,
  navScreens: NAV_SCREEN_DEFS,
  settings,
  numberLimits: UI_NUMBER_LIMITS,
  originalSinResetBaseUtcMs: __originalSinResetBaseUtcMs,
  originalSinWindowMap: __originalSinWindowMap,
});
function getPathValue(obj, path) {
  const parts = String(path || "").split(".").filter(Boolean);
  let cur = obj;
  for (const k of parts) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = cur[k];
  }
  return cur;
}
function buildSectionSpecs(settings) {
  const st = settings || loadSettings();
  const rs = loadRunState(st);
  const laKey = fmtLaKey(now);
  const day = getDayState(rs, laKey, st);
  const specs = [];
  const list = buildEventProviders(st);
  for (const p of list) {
    const uiSpec = p?.ui || {};
    const enabledPath = String(uiSpec.enabledPath || "");
    const enabledVal = enabledPath ? getPathValue(st, enabledPath) : true;
    const fields = (uiSpec.fields || []).map(f => {
      const base = {
        label: f.label,
        path: f.path,
        type: f.type || "number",
        value: (f.type === "boolean") ? (getPathValue(st, f.path) ?? f.def)
          : ((f.type === "choice") ? (getPathValue(st, f.path) ?? f.def)
          : ((f.type === "timeList" || f.type === "offsetList") ? (getPathValue(st, f.path) ?? f.def ?? [])
          : num(getPathValue(st, f.path), f.def))),
        text: String(f.text || ""),
        action: String(f.action || ""),
        stateKey: String(f.stateKey || ""),
        options: Array.isArray(f.options) ? f.options.map(opt => ({ value: opt.value, label: String(opt.label || opt.value) })) : [],
        pairPath: String(f.pairPath || ""),
        pairRole: String(f.pairRole || ""),
        minGap: Number(f.minGap || 0),
        min: Number.isFinite(Number(f.min)) ? Number(f.min) : undefined,
        max: Number.isFinite(Number(f.max)) ? Number(f.max) : undefined,
      };
      if (f.type === "realmDisplay") {
        const rotArr = f.rotationRef === "daily" ? DAILY_REALM_ROTATION : TREASURE_REALM_ROTATION;
        const rawKey = f.rotationRef === "daily"
          ? getDailyRealmKeyForLaKey(laKey)
          : getTreasureRealmKeyForLaKey(laKey);
        base.currentRealmKey = rawKey || "";
        base.overridePath = String(f.overridePath || "");
        base.overrideValue = getPathValue(st, String(f.overridePath || "")) || null;
        base.rotationKeys = Array.from(rotArr);
      }
      if (f.type === "button" && f.stateKey) {
        const ts = ensureTypeState(day, p.type);
        base.stateDone = !!ts[f.stateKey];
        if (f.stateKey === "forestTreasureDone") {
          base.isActiveDay = isForestTreasureCandleDay(laKey, st);
        } else if (f.stateKey === "forestDailyDone") {
          base.isActiveDay = isForestDailyCandleDay(laKey, st);
        } else if (f.stateKey === "weekDone") {
          base.isActiveDay = true;
        }
      }
      return base;
    });
    const limitVal = Number(typeof p.getDailyLimit === "function" ? p.getDailyLimit(st, laKey) : 0) || 0;
    const countVal = Number(day?.[p.type]?.count || 0);
    specs.push({
      type: p.type,
      title: String(uiSpec.title || p.fallbackTitle(st) || p.type),
      desc: String(p.type === "originalSin" ? buildOriginalSinDiagnosticText(st, laKey, now) : (uiSpec.desc || "")),
      hideMainToggle: !!uiSpec.hideMainToggle,
      hideRemain: !!uiSpec.hideRemain,
      countVal,
      limitVal,
      remainVal: limitVal > 0 ? Math.max(0, limitVal - countVal) : 0,
      enabledVal,
      enabledPath,
      fields,
    });
  }
  return specs;
}
function renderOriginalSinTimeListHtml(path, value) {
  const list = normalizeOriginalSinFixedTimes(value);
  const rows = list.map((item, idx) => {
    const hh = (item && item.hour != null && String(item.hour) !== "") ? String(item.hour).padStart(2, "0") : "";
    const mm = (item && item.minute != null && String(item.minute) !== "") ? String(item.minute).padStart(2, "0") : "";
    const timeVal = (hh && mm) ? `${hh}:${mm}` : "";
    return `<div class="osi-list-row card-like">
      <div class="manage-item-content">
        <div class="manage-item-title">時刻 ${idx + 1}</div>
        <div class="manage-item-time"><input class="osi-time-input" type="time" step="60" value="${timeVal}" onchange="handleOriginalSinTimeInput('${path}', ${idx}, this.value, this)" onblur="commitOriginalSinTimeInput('${path}', ${idx}, this.value, this)"></div>
      </div>
      <div class="btn small del-btn" onclick="removeOriginalSinListItem('${path}', ${idx}, this)">削除</div>
    </div>`;
  }).join("");
  const addBtn = list.length >= 10 ? "" : `<div class="btn small" onclick="addOriginalSinListItem('${path}', 'time', this)">＋追加</div>`;
  return `<div class="osi-list-wrap">${rows || `<div class="rule-subnote">時刻がありません。＋追加で登録できます。</div>`}<div class="osi-list-actions">${addBtn}</div></div>`;
}
function renderOriginalSinOffsetListHtml(path, value) {
  const list = normalizeOriginalSinSinceResetTimes(value);
  const rows = list.map((item, idx) => {
      const offsetVal = (item && item.minutesAfterReset != null && String(item.minutesAfterReset) !== "") ? String(item.minutesAfterReset) : "";
      return `<div class="osi-list-row card-like offset">
      <div class="manage-item-content">
        <div class="manage-item-title">相対通知 ${idx + 1}</div>
        <div class="manage-item-time"><input class="num osi-minute-input" type="number" inputmode="numeric" min="0" max="4320" step="1" value="${offsetVal}" onchange="handleOriginalSinListInput('${path}', ${idx}, 'minutesAfterReset', this.value, this)"><span class="osi-list-unit">分後</span></div>
      </div>
      <div class="btn small del-btn" onclick="removeOriginalSinListItem('${path}', ${idx}, this)">削除</div>
    </div>`;
  }).join("");
  const addBtn = list.length >= 10 ? "" : `<div class="btn small" onclick="addOriginalSinListItem('${path}', 'offset', this)">＋追加</div>`;
  return `<div class="osi-list-wrap">${rows || `<div class="rule-subnote">相対時刻がありません。＋追加で登録できます。</div>`}<div class="osi-list-actions">${addBtn}</div></div>`;
}
function buildUiFieldHtml(f, eventId, countVal) {
  if (f.type === "count") {
    return `<div class="form-row ui-field ui-field-number field-row field-row-count">
      <span class="form-label">${f.label}</span>
      <div class="stepper">
        <div class="btn pm" onclick="adjustCount('${eventId}', -1, this)">-</div>
        <input class="num" type="text" value="${countVal}" id="count-${eventId}" onchange="setCountAbsolute('${eventId}', this.value, this)">
        <div class="btn pm" onclick="adjustCount('${eventId}', 1, this)">+</div>
      </div>
    </div>`;
  }
  if (f.type === "boolean") {
    const on = f.value !== false;
    const extraClass = eventId === 'shards' ? ' field-row-shards' : '';
    return `<div class="form-row ui-field ui-field-toggle field-row field-row-boolean${extraClass}"><span class="form-label">${f.label}</span>${renderToggleHtml(on, `handleSettingChange('${f.path}', true, this)`, `handleSettingChange('${f.path}', false, this)`)}</div>`;
  }
  if (f.type === "choice") {
    const opts = (Array.isArray(f.options) ? f.options : []).map(opt => {
      const selected = String(f.value) === String(opt.value);
      const safeValue = String(opt.value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
      return `<div class="opt ${selected ? 'selected' : ''}" onclick="handleSettingChange('${f.path}', '${safeValue}', this)">${opt.label}</div>`;
    }).join("");
    return `<div class="form-row ui-field ui-field-choice"><span class="form-label">${f.label}</span><div class="segmented narrow">${opts}</div></div>`;
  }
  if (f.type === "timeList") {
    return `<div class="ui-field ui-field-list field-row field-row-list"><div class="form-label">${f.label}</div><div class="osi-list-field" data-list-kind="time" data-list-path="${f.path}">${renderOriginalSinTimeListHtml(f.path, f.value)}</div></div>`;
  }
  if (f.type === "offsetList") {
    return `<div class="ui-field ui-field-list field-row field-row-list"><div class="form-label">${f.label}</div><div class="osi-list-field" data-list-kind="offset" data-list-path="${f.path}">${renderOriginalSinOffsetListHtml(f.path, f.value)}</div></div>`;
  }
  if (f.type === "realmDisplay") {
    const REALM_KEY_TO_JA = { prairie: "草原", forest: "雨林", valley: "峡谷", waste: "捨て地", vault: "書庫" };
    const realmKey = f.currentRealmKey || "";
    const overridePath = String(f.overridePath || "");
    const overrideVal = f.overrideValue || null;
    const shownRealmKey = overrideVal || realmKey;
    const realmJa = REALM_KEY_TO_JA[shownRealmKey] || "不明";
    const isForest = shownRealmKey === "forest";
    const rotation = Array.isArray(f.rotationKeys) ? f.rotationKeys : ["prairie", "forest", "valley", "waste", "vault"];
    const options = rotation.map(k => {
      const label = REALM_KEY_TO_JA[k] || k;
      const selected = (overrideVal === k || (!overrideVal && realmKey === k));
      const newVal = overrideVal === k ? 'null' : `'${k}'`;
      return `<div class="opt ${selected ? 'selected' : ''}" data-realm-value="${k}" onclick="handleSettingChange('${overridePath}', ${newVal}, this)">${label}</div>`;
    }).join("");
    return `<div class="realm-display-field" data-override-path="${overridePath}" data-current-realm-key="${realmKey}" data-label-prefix="${f.label}" style="margin-bottom:12px;">
      <div class="form-label" style="margin-bottom:8px;">${f.label}: <b style="color:${isForest ? 'var(--color-active)' : 'var(--text-main)'}">${realmJa}</b>${overrideVal ? ' <span style="font-size:11px; opacity:0.7;">(上書き中)</span>' : ''}</div>
      <div class="segmented narrow" style="font-size:11px;">${options}</div>
    </div>`;
  }
  if (f.type === "button") {
    if (f.stateKey && f.isActiveDay === false) {
      return `<div class="rule-subnote" style="margin-top:8px; opacity:0.6;">今日は該当日ではありません</div>`;
    }
    const isDone = !!f.stateDone;
    const btnText = isDone
      ? String(f.text || f.label || '').replace('を完了扱いにする', 'を未完了にする').replace('を完了扱い', 'を未完了')
      : (f.text || f.label || eventId);
    const btnClass = isDone ? "btn btn-action-temp flash-ok" : "btn btn-action-temp";
    const dayLabel = (f.stateKey === "forestTreasureDone") ? "🌲 今日は雨林大キャンの日です"
                    : (f.stateKey === "forestDailyDone") ? "🌲 今日は雨林デイリーの日です"
                    : "";
    const dayLabelHtml = dayLabel ? `<div class="rule-subnote" style="margin-top:8px; color:var(--color-active); font-weight:700;">${dayLabel}</div>` : "";
    return `${dayLabelHtml}<div class="${btnClass}" onclick="triggerEventAction('${eventId}', '${f.action}', this)">${btnText}</div>`;
  }
  const minVal = Number.isFinite(f.min) ? f.min : UI_NUMBER_LIMITS.MIN;
  const maxVal = Number.isFinite(f.max) ? f.max : UI_NUMBER_LIMITS.MAX;
  const idStr = 'input-' + String(f.path).split('.').join('-');
  const pairPathAttr = f.pairPath ? ` data-pair-path="${String(f.pairPath)}"` : "";
  const pairRoleAttr = f.pairRole ? ` data-pair-role="${String(f.pairRole)}"` : "";
  const minGapAttr = f.minGap != null ? ` data-min-gap="${f.minGap}"` : '';
  return `<div class="form-row ui-field ui-field-number field-row field-row-number">
    <span class="form-label">${f.label}</span>
    <div class="stepper">
      <div class="btn pm" onclick="adjustSettingNumber('${f.path}', -1, this)">-</div>
      <input class="num" type="text" value="${f.value}" id="${idStr}" data-last-valid="${f.value}" data-min="${minVal}" data-max="${maxVal}" ${pairPathAttr}${pairRoleAttr}${minGapAttr}
      onfocus="this.dataset.lastValid = this.value;"
      onblur="handleNumericInputBlur(this, '${f.path}', ${minVal}, ${maxVal})"
      onkeydown="if(event.key === 'Enter') this.blur();">
      <div class="btn pm" onclick="adjustSettingNumber('${f.path}', 1, this)">+</div>
    </div>
  </div>`;
}
function buildRealmDisplayHtml(settings) {
  const st = settings || loadSettings();
  const laKey = fmtLaKey(now);
  const fields = [
    { label: "今日の大キャン地方", overridePath: "notify.pan.treasureRealmOverride", rotationRef: "treasure" },
    { label: "今日のデイリー地方", overridePath: "notify.pan.dailyRealmOverride", rotationRef: "daily" },
  ].map(f => {
    const rotationKeys = Array.from(f.rotationRef === "daily" ? DAILY_REALM_ROTATION : TREASURE_REALM_ROTATION);
    const currentRealmKey = f.rotationRef === "daily"
      ? (getDailyRealmKeyForLaKey(laKey) || "")
      : (getTreasureRealmKeyForLaKey(laKey) || "");
    return {
      type: "realmDisplay",
      label: f.label,
      overridePath: String(f.overridePath || ""),
      overrideValue: getPathValue(st, String(f.overridePath || "")) || null,
      currentRealmKey,
      rotationKeys,
    };
  });
  return fields.map(f => buildUiFieldHtml(f, "system", 0)).join("");
}
const renderToggleHtml = (isOn, onclickOn, onclickOff, labelOn="オン", labelOff="オフ") => `<div class="segmented narrow two-col"><div class="opt ${isOn?'selected':''}" onclick="${onclickOn}">${labelOn}</div><div class="opt ${!isOn?'selected':''}" onclick="${onclickOff}">${labelOff}</div></div>`;
const COMMON_SETTING_SPECS = Object.freeze([
  Object.freeze({
    key: "viewMode", label: "表示形式", segmentedId: "seg-view", segmentedClass: "segmented", rowStyle: "margin-top: 10px;",
    options: [{ value: "clock24", label: "24h" }, { value: "clock12", label: "12h" }, { value: "simple", label: "リスト" }, { value: "timeline", label: "タイムライン" }, { value: "bar", label: "バー" }],
  }),
  Object.freeze({
    key: "layoutMode", label: "レイアウト", rowId: "row-layout", segmentedId: "seg-layout", segmentedClass: "segmented",
    options: [{ value: "normal", label: "通常" }, { value: "expanded", label: "拡大" }, { value: "signal", label: "シグナル" }],
  }),
  Object.freeze({
    key: "theme", label: "テーマ", segmentedId: "seg-theme", segmentedClass: "segmented narrow",
    options: [{ value: "light", label: "ライト" }, { value: "dark", label: "ダーク" }],
  }),
]);
function buildCommonSettingsHtml(st) {
  return COMMON_SETTING_SPECS.map(spec => {
    const rowIdAttr = spec.rowId ? ` id="${spec.rowId}"` : "";
    const segIdAttr = spec.segmentedId ? ` id="${spec.segmentedId}"` : "";
    const rowStyleAttr = spec.rowStyle ? ` style="${spec.rowStyle}"` : "";
    const currentVal = Object.prototype.hasOwnProperty.call(st || {}, spec.key) ? st[spec.key] : DEFAULT_SETTINGS[spec.key];
    const opts = (spec.options || []).map(opt => `<div class="opt ${(currentVal === opt.value) ? 'selected' : ''}" data-setting-key="${spec.key}" data-setting-value="${String(opt.value)}">${opt.label}</div>`).join("");
    return `<div class="row preview-form-row"${rowIdAttr}${rowStyleAttr}><span class="label preview-form-label">${spec.label}</span><div class="preview-form-control"><div class="${spec.segmentedClass || 'segmented'}"${segIdAttr}>${opts}</div></div></div>`;
  }).join("");
}
function renderEventSection(spec, index = 0) {
  const on = spec.enabledVal !== false;
  const fields = Array.isArray(spec.fields) ? spec.fields : [];
  const countField = fields.find(f => f.type === "count") || null;
  const commonFields = [];
  const specificFields = [];
  const actionFields = [];
  fields.forEach(f => {
    if (!f) return;
    if (f.type === "count") return;
    if (f.type === "button") { actionFields.push(f); return; }
    const path = String(f.path || "");
    if (spec.type === "shards" && f.type === "boolean") { specificFields.push(f); return; }
    if (spec.type === "dye" && f.type === "choice") { specificFields.push(f); return; }
    if (spec.type === "pan" && (path.indexOf("forestTreasure") >= 0 || path.indexOf("forestDaily") >= 0)) { specificFields.push(f); return; }
    commonFields.push(f);
  });
  const toneClass = ({
    pan: "tone-green",
    dye: "tone-orange",
    shards: "tone-red",
    uni: "tone-green",
    turtle: "tone-green",
    race: "tone-blue",
    updateTime: "tone-blue",
    originalSin: "tone-blue",
  })[String(spec.type || "")] || "tone-blue";
  const specialTitle = ({
    pan: "パン固有設定",
    dye: "染料固有設定",
    shards: "破片のオン / オフ",
    updateTime: "更新時刻の設定",
    originalSin: "原罪の設定",
  })[String(spec.type || "")] || "";
  const progressHtml = countField ? `
      <div class="progress-strip">
        <div class="progress-chip" id="count-chip-${spec.type}">
          今日の完了 <br><span class="progress-num" id="count-num-${spec.type}">${spec.countVal}</span>
        </div>
        ${spec.hideRemain ? "" : `<div class="progress-chip highlight" id="remain-chip-${spec.type}">残り <br><span class="progress-num" id="remain-num-${spec.type}">${spec.remainVal}</span></div>`}
        ${spec.limitVal > 0 ? `<div class="progress-chip" id="limit-chip-${spec.type}">目標 <br><span class="progress-num" id="limit-num-${spec.type}">${spec.limitVal}</span></div>` : ""}
      </div>` : "";
  const countControlHtml = countField ? `
      <div class="card rule-progress-card">
        <div class="card-header">今日の進行</div>
        <div class="rule-subnote">ここだけは恒久設定ではなく、その日の進み具合を操作します。</div>
        ${buildUiFieldHtml(countField, spec.type, spec.countVal)}
      </div>` : "";
  const commonHtml = commonFields.length ? `
      <div class="card rule-common-card">
        <div class="card-header">共通設定</div>
        ${commonFields.map(f => buildUiFieldHtml(f, spec.type, spec.countVal)).join("")}
      </div>` : "";
  const specificCardNote = spec.type === "shards"
    ? `<div class="rule-subnote shard-specific-note">赤と黒は別々に止められます。片方だけ残したいときはここで切り替えます。</div>`
    : "";
  const specificHtml = (specificFields.length || actionFields.length) ? `
      <div class="card rule-specific-card ${spec.type === 'shards' ? 'rule-specific-card-shards' : ''}">
        <div class="card-header">${specialTitle || "個別設定"}</div>
        ${specificCardNote}
        ${specificFields.map(f => buildUiFieldHtml(f, spec.type, spec.countVal)).join("")}
        ${actionFields.map(f => buildUiFieldHtml(f, spec.type, spec.countVal)).join("")}
      </div>` : "";
  const noteHtml = (!countField && spec.hideRemain) ? `<div class="rule-subnote standalone">※染料に目標回数はありません。</div>` : "";
  if (spec.type === "originalSin") {
    const fixedToggle = fields.find(f => String(f.path || "") === "notify.originalSin.fixedEnabled") || null;
    const fixedList = fields.find(f => f.type === "timeList") || null;
    const resetToggle = fields.find(f => String(f.path || "") === "notify.originalSin.sinceResetEnabled") || null;
    const resetList = fields.find(f => f.type === "offsetList") || null;
    const idleToggle = fields.find(f => String(f.path || "") === "notify.originalSin.idleWindowEnabled") || null;
    const idleDuration = fields.find(f => String(f.path || "") === "notify.originalSin.taskDurationMin") || null;
    const idleRepeat = fields.find(f => String(f.path || "") === "notify.originalSin.repeatEveryMin") || null;
    const idleStartHour = fields.find(f => String(f.path || "") === "notify.originalSin.searchStartHour") || null;
    const idleStartMinute = fields.find(f => String(f.path || "") === "notify.originalSin.searchStartMinute") || null;
    const weekButton = actionFields[0] || null;
    const stateHtml = weekButton ? `
      <div class="card rule-specific-card originalsin-card originalsin-state-card">
        <div class="card-header">今週の状態</div>
        <div class="rule-subnote">毎週日曜の更新時刻で自動的に未完了へ戻ります。</div>
        ${buildUiFieldHtml(weekButton, spec.type, spec.countVal)}
      </div>` : "";
    const fixedHtml = (fixedToggle || fixedList) ? `
      <div class="card rule-common-card originalsin-card">
        <div class="card-header">定時実行</div>
        <div class="rule-subnote">日本時間ベースの固定時刻で通知します。時刻欄をタップすると iOS の時間入力UIを開けます。</div>
        ${fixedToggle ? buildUiFieldHtml(fixedToggle, spec.type, spec.countVal) : ""}
        ${fixedList ? buildUiFieldHtml(fixedList, spec.type, spec.countVal) : ""}
      </div>` : "";
    const resetHtml = (resetToggle || resetList) ? `
      <div class="card rule-common-card originalsin-card">
        <div class="card-header">更新時刻からの相対通知</div>
        <div class="rule-subnote">更新時刻から何分後に知らせるかを登録します。</div>
        ${resetToggle ? buildUiFieldHtml(resetToggle, spec.type, spec.countVal) : ""}
        ${resetList ? buildUiFieldHtml(resetList, spec.type, spec.countVal) : ""}
      </div>` : "";
    const idleHtml = (idleToggle || idleDuration || idleRepeat || idleStartHour || idleStartMinute) ? `
      <div class="card rule-common-card originalsin-card">
        <div class="card-header">空き時間探索</div>
        <div class="rule-subnote">他イベントの拘束区間を避けて、空いている時間帯だけ通知します。</div>
        ${idleToggle ? buildUiFieldHtml(idleToggle, spec.type, spec.countVal) : ""}
        ${idleDuration ? buildUiFieldHtml(idleDuration, spec.type, spec.countVal) : ""}
        ${idleRepeat ? buildUiFieldHtml(idleRepeat, spec.type, spec.countVal) : ""}
        ${idleStartHour ? buildUiFieldHtml(idleStartHour, spec.type, spec.countVal) : ""}
        ${idleStartMinute ? buildUiFieldHtml(idleStartMinute, spec.type, spec.countVal) : ""}
      </div>` : "";
    return `
      <div class="event-section-wrap rule-content" id="notify-sec-${spec.type}" data-enabled="${on}" data-hide-remain="${spec.hideRemain ? 1 : 0}" style="display:${index === 0 ? 'block' : 'none'};">
        <div class="card notify-summary-card ${toneClass} originalsin-summary-card">
          <div class="form-row notify-event-head">
            <h3 style="margin: 0;">${spec.title}</h3>
            ${spec.hideMainToggle ? "" : `${renderToggleHtml(on, `handleSettingChange('${spec.enabledPath}', true, this)`, `handleSettingChange('${spec.enabledPath}', false, this)`, "オン", "お休み")}`}
          </div>
          ${spec.desc ? `<div class="rule-subnote">${spec.desc}</div>` : ""}
        </div>
        <div class="originalsin-layout">
          ${stateHtml}
          <div class="originalsin-grid">
            ${fixedHtml}
            ${resetHtml}
            ${idleHtml}
          </div>
        </div>
      </div>`;
  }
  const lowerSectionHtml = spec.type === "shards"
    ? `${specificHtml}${commonHtml}`
    : `${commonHtml}${specificHtml}`;
  return `
    <div class="event-section-wrap rule-content" id="notify-sec-${spec.type}" data-enabled="${on}" data-hide-remain="${spec.hideRemain ? 1 : 0}" style="display:${index === 0 ? 'block' : 'none'};">
      <div class="card notify-summary-card ${toneClass}">
        <div class="form-row notify-event-head" style="margin-bottom: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
          <h3 style="margin: 0;">${spec.title}</h3>
          ${spec.hideMainToggle ? "" : `${renderToggleHtml(on, `handleSettingChange('${spec.enabledPath}', true, this)`, `handleSettingChange('${spec.enabledPath}', false, this)`, "オン", "お休み")}`}
        </div>
        ${spec.desc ? `<div class="rule-subnote">${spec.desc}</div>` : ""}
        ${noteHtml}
        ${progressHtml}
      </div>
      ${countControlHtml}
      ${lowerSectionHtml}
    </div>`;
}
const sectionSpecs = buildSectionSpecs(settings);
const notifyOrder = ['updateTime', 'uni', 'pan', 'turtle', 'race', 'originalSin', 'shards', 'dye'];
const orderedSectionSpecs = [...sectionSpecs].sort((a, b) => {
  const ai = notifyOrder.indexOf(String(a && a.type || ''));
  const bi = notifyOrder.indexOf(String(b && b.type || ''));
  const av = ai >= 0 ? ai : 999;
  const bv = bi >= 0 ? bi : 999;
  return av - bv;
});
const getDisp = (id) => initialScreen === id ? "block" : "none";
const initialTestTimeStr = F.localInputFormat(Date.now() + (Number(settings.testOffsetMs) || 0), settings);
const UI_TAB_LABEL_HTML = Object.freeze({ shards: "ウィジェット", notify: "お知らせ<br>ルール", manage: "予定表", data: "システム", intro: "はじめに" });
const initialHeaderLabelText = settings.testMode ? "仮想時刻" : "現在時刻";
const initialHeaderModeClass = settings.testMode ? "mode-virtual" : "mode-real";
const initialHeaderClockText = F.localFullFormat(new Date(Date.now() + (settings.testMode ? (Number(settings.testOffsetMs) || 0) : 0)), settings);
const initialNavButtonsHtml = NAV_SCREEN_DEFS.map(def => {
  const labelHtml = UI_TAB_LABEL_HTML[def.id] || String(def.label || def.id);
  const activeClass = def.id === initialScreen ? " active" : "";
  return `<div class="navbtn tab-btn${activeClass}" id="btn-${def.id}" onclick="setScreen('${def.id}')"><span>${labelHtml}</span></div>`;
}).join("");
const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      :root {
        --footer-h: 56px; --bg: ${ui.bg}; --card-bg: ${ui.cardBg}; --text: ${ui.text}; --border: ${ui.border};
        --active: ${ui.active}; --fab-bg: ${ui.fabBg}; --fab-fg: ${ui.fabFg}; --fab-ring: ${ui.fabRing};
        --nav-glass-bg: ${ui.navGlassBg}; --footer-glass-bg: ${ui.footerGlassBg};
      }
      body {
        background-color: var(--bg); color: var(--text); font-family: -apple-system, sans-serif;
        margin: 0; padding: 0;
        padding-bottom: calc(var(--footer-h) + 40px + env(safe-area-inset-bottom));
        -webkit-user-select: none;
      }
      .grid { display: grid; gap: 15px; max-width: 600px; margin: 0 auto; transition: all 0.3s ease; }
      .card { border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); background-color: var(--card-bg); transition: aspect-ratio 0.3s ease; }
      img { width: 100%; height: 100%; object-fit: contain; }
      .settings-scroll .row:first-child{ margin-top: 2px; }
      .settings-title { font-weight: 800; font-size: 13px; opacity: 0.9; }
      .row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; flex-wrap: wrap; gap: 8px; }
      .label { font-weight: 700; font-size: 13px; opacity: 0.85; flex-shrink: 0; margin-right: 10px; }
      .preview-form-row { display:block; margin-bottom: 14px; }
      .preview-form-row:last-child { margin-bottom: 0; }
      .preview-form-label { display:block; margin: 0 0 8px 0; font-size: 14px; font-weight: 700; opacity: 0.92; }
      .preview-form-control { width: 100%; }
      .preview-form-row .segmented { width: 100%; justify-content: flex-start; }
      .preview-form-row .segmented.narrow { width: auto; }
      .segmented { display: flex; background: rgba(142,142,147,0.15); padding: 2px; border-radius: 9px; width: 320px; max-width: 100%; flex-wrap: wrap; justify-content: flex-end; box-sizing: border-box; }
      .segmented.narrow { width: 180px; max-width: 100%; flex-wrap: nowrap; }
      .opt { flex: 1; padding: 4px 0; text-align: center; border-radius: 7px; font-size: 12px; font-weight: 600; cursor: pointer; min-width: 44px; line-height: 1.1; box-sizing: border-box; }
      #seg-view { width: 100%; max-width: 360px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px; }
      #seg-view .opt { width: 100%; display: flex; align-items: center; justify-content: center; white-space: nowrap; padding: 7px 6px; font-size: 11px; box-sizing: border-box; }
      .notify-tab-grid { display:grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap:4px; width:100%; }
      .notify-tab-grid .opt { display:flex; align-items:center; justify-content:center; min-height:34px; padding:7px 6px; }
      .opt.selected { background: var(--card-bg); box-shadow: 0 2px 4px rgba(0,0,0,0.2); font-weight: 600; color: var(--text); }
      input[type="datetime-local"] { width: 100%; padding: 6px 12px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg); color: var(--text); font-family: inherit; font-size: 14px; box-sizing: border-box; }
      input[type="datetime-local"]::-webkit-calendar-picker-indicator { filter: ${isDark ? 'invert(1)' : 'none'}; }
      .keychain-pre { width: 100%; max-height: 150px; padding: 12px; margin: 10px 0 0 0; border-radius: 12px; border: 1px solid var(--border); background: #1c1c1e; color: #30d158; font-family: ui-monospace, Menlo, monospace; font-size: 11px; box-sizing: border-box; overflow-y: auto; overflow-x: hidden; white-space: pre-wrap; word-break: break-all; line-height: 1.45; }
      .screen{max-width:600px;margin:0 auto; padding: calc(var(--header-h, 80px) + 4px) 20px 40px 20px; box-sizing: border-box;}
      .section{margin-top:10px;padding:14px 12px;border-radius:18px;border:1px solid var(--border);background:var(--card-bg);}
      .section h3{margin:0 0 8px 0;font-size:16px;}
      .sectionhead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 8px 0;}
      .sectionhead h3{margin:0;font-size:16px;}
      .remain{display:inline-flex;align-items:center;justify-content:center;padding:5px 10px;border-radius:999px;border:1px solid var(--border);font-size:12px;font-weight:900;white-space:nowrap;}
      .remain.ok{background: rgba(48,209,88,0.20);}
      .remain.todo{background: rgba(255,159,10,0.20);}
      .minirow{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:8px 0;flex-wrap:nowrap;}
      .minirow .label{font-size:13px;opacity:0.85;flex:1;min-width:0;white-space:nowrap;overflow:visible;padding-right:5px;}
      .minirow > :not(.label){flex-shrink:0;}
      .num{width:36px;height:36px;padding:0;border-radius:12px;border:1px solid var(--border);background:transparent;color:var(--text);text-align:center;box-sizing:border-box;-moz-appearance:textfield;}
      .num-group{display:flex;align-items:center;gap:5px;flex-shrink:0;}
      .btn{padding:12px 12px;border-radius:14px;border:1px solid var(--border);background:var(--btn-bg, rgba(10,132,255,0.12));text-align:center;font-weight:800;margin-top:10px;}
      .btn.pm{width:36px;height:36px;padding:0;font-size:20px;font-weight:400;display:flex;align-items:center;justify-content:center;border-radius:12px;box-sizing:border-box;margin:0;}
      .btn.danger{background:var(--btn-danger-bg, rgba(255,59,48,0.14));}
      .helpbar { margin-top: 12px; margin-bottom: 16px; }
      .footerbar{ position: fixed; left: 0; right: 0; bottom: 0; height: var(--footer-h); height: calc(var(--footer-h) + env(safe-area-inset-bottom)); padding: 10px 14px; padding-bottom: calc(10px + env(safe-area-inset-bottom)); border-top: 1px solid var(--border); background: var(--footer-glass-bg); z-index: 30; display:flex; justify-content:center; align-items:center; }
      .footerbtn{ width: 100%; max-width: 600px; text-align:center; padding: 12px 14px; border-radius: 14px; font-weight: 900; border: 1px solid var(--border); background: rgba(48,209,88,0.22); box-sizing: border-box; }
      .flash-ok{ background: rgba(48,209,88,0.30) !important; border-color: rgba(48,209,88,0.65) !important; }
      .flash-err{ background: rgba(255,59,48,0.22) !important; border-color: rgba(255,59,48,0.65) !important; }
      #toast { visibility: hidden; max-width: 80%; min-width: 200px; background-color: var(--text); color: var(--bg); text-align: center; border-radius: 20px; padding: 12px 20px; position: fixed; z-index: 1000; left: 50%; top: calc(env(safe-area-inset-top) + 20px); transform: translateX(-50%) translateY(-20px) scale(0.95); font-size: 14px; font-weight: 700; opacity: 0; box-shadow: 0 8px 24px rgba(0,0,0,0.2); transition: opacity 0.3s, transform 0.3s, visibility 0.3s; }
      #toast.show { visibility: visible; opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
      .btn, .navbtn, .opt, .footerbtn { transition: all 0.2s; }
      .btn:active, .navbtn:active, .footerbtn:active { transform: scale(0.96); filter: brightness(0.9); }
      .btnrow { display:flex; gap:10px; }
      .btnrow .btn { flex: 1; }
      .settings-container { background-color: var(--card-bg); border: 1px solid var(--border); border-radius: 18px; margin-top: 24px; display: flex; flex-direction: column; overflow: hidden; }
      .settings-scroll { padding: 12px; overflow: visible; -webkit-overflow-scrolling: touch; }
      .settings-container .settings-header { border-bottom: 1px solid var(--border); padding: 6px 12px; background: var(--card-bg); }
      .glass-panel{ backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); }
      .topnav{ position: fixed; top: 0; left: 0; right: 0; z-index: 50; padding: 10px 20px; padding-top: calc(10px + env(safe-area-inset-top)); background: var(--nav-glass-bg); border-bottom: 1px solid var(--border); box-sizing: border-box; }
      .topnav .navwrap{ max-width: 600px; margin: 10px auto 0; display: flex; gap: 8px; flex-wrap: wrap; }
      .navbtn{ flex: 1; padding: 10px 4px; border-radius: 12px; border: 1px solid var(--border); background: var(--card-bg); text-align: center; font-weight: 800; font-size: 14px; box-sizing: border-box; }
      .navbtn.active{ outline: 3px solid var(--fab-ring); background: rgba(10,132,255,0.12); }
      .manage-head{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
      .manage-controls{ display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; }
      .btn.small{ padding: 9px 10px; font-size: 12px; border-radius: 12px; }
      .btn.secondary{ background: transparent; border: 1px solid var(--border); color: var(--text); }
      .manage-list{ display:flex; flex-direction:column; gap:10px; margin-top: 12px; }
      .manage-item{ background: var(--card-bg); border: 1px solid var(--border); border-radius: 14px; padding: 12px; display:flex; gap: 12px; align-items:flex-start; }
      .manage-item input[type="checkbox"]{ width: 22px; height: 22px; margin-top: 2px; accent-color: var(--fab-bg); }
      .manage-group-wrap { background: var(--card-bg); border: 1px solid var(--border); border-radius: 14px; padding: 10px; margin-bottom: 12px; }
      .manage-group-head { font-weight: 800; font-size: 15px; margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom: 8px; }
      .manage-sub-wrap { margin-bottom: 12px; }
      .manage-sub-head { font-weight: 700; font-size: 14px; margin-bottom: 6px; opacity: 0.9; }
      .manage-list-item { display: flex; align-items: center; gap: 10px; padding: 4px 0; border: none; border-radius: 0; background: transparent; }
      .manage-cb-input { margin: 0; }
      .manage-item-content { flex: 1; min-width: 0; }
      .manage-item-time { font-size: 14px; font-weight: 600; }
      .manage-item-toggle { width: 86px; margin: 0; padding: 2px; box-sizing: border-box; }
      .dialog-overlay { position:fixed; top:0; left:0; width:100%; height:100%; z-index:2000; align-items:center; justify-content:center; background: rgba(0,0,0,0.4); }
      .dialog-box { background:var(--card-bg); border:1px solid var(--border); border-radius:18px; padding:20px; width:80%; max-width:320px; text-align:center; box-shadow: 0 8px 24px rgba(0,0,0,0.2); }
      .dialog-msg { font-weight:bold; margin-bottom:20px; font-size:15px; line-height:1.4; }
      .test-clock-wrap { width:100%; display:flex; justify-content:center; align-items:center; margin:0 auto 8px; min-height:40px; }
      .test-clock-bar { display:inline-flex; align-items:center; justify-content:center; width:auto; min-width:0; max-width:100%; white-space:nowrap; color:#fff; text-align:center; padding:7px 12px; font-size:13px; font-weight:bold; border-radius:10px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); box-sizing:border-box; transition: background-color 0.2s ease; }
      .test-clock-bar.current { background:rgba(52,199,89,0.96); }
      .test-clock-bar.virtual { background:rgba(255,159,10,0.96); }
      .pill{ display:inline-flex; align-items:center; gap:6px; padding:6px 10px; border-radius: 999px; border:1px solid var(--border); background: rgba(10,132,255,0.10); font-size: 12px; font-weight: 800; }
      .btn.del-btn { width: auto; flex: 1; font-size: 13px; padding: 9px 6px; }
      .notify-tab-grid { display:grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-auto-rows:minmax(42px, auto); gap:4px; width:100%; align-items:stretch; }
      .notify-tab-grid .opt { display:flex; align-items:center; justify-content:center; min-height:40px; padding:8px 6px; white-space:normal; word-break:keep-all; text-align:center; }
      .originalsin-summary-card { border-left:4px solid var(--color-primary); }
      .originalsin-summary-card .notify-event-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; padding-bottom:8px; border-bottom:1px solid var(--border-color); gap:12px; flex-wrap:nowrap; }
      .originalsin-summary-card .notify-event-head h3 { margin:0; font-size:20px; }
      .originalsin-layout { display:flex; flex-direction:column; gap:16px; }
      .originalsin-grid { display:grid; grid-template-columns: repeat(1, minmax(0, 1fr)); gap:16px; }
      .originalsin-card { border-radius:20px; border:1px solid var(--border-color); box-shadow:0 4px 16px rgba(0,0,0,0.08); padding:16px; }
      .originalsin-card.rule-specific-card { background: color-mix(in srgb, var(--card-bg-soft) 94%, rgba(10,132,255,0.06)); }
      .originalsin-card .card-header { font-size:16px; font-weight:800; margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; gap:8px; }
      .originalsin-card .rule-subnote { color:var(--text-sub); font-size:12px; line-height:1.45; margin-top:4px; margin-bottom:8px; }
      .originalsin-card .rule-subnote + .field-row,
      .originalsin-card .rule-subnote + .form-row,
      .originalsin-card .rule-subnote + .ui-field-list { margin-top:8px; }
      .originalsin-card .field-row,
      .originalsin-card .form-row { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:12px; flex-wrap:nowrap; }
      .originalsin-card .field-row:last-child,
      .originalsin-card .form-row:last-child { margin-bottom:0; }
      .originalsin-card .form-label { font-size:14px; font-weight:600; opacity:0.92; line-height:1.35; min-width:0; flex:1; white-space:nowrap; }
      .originalsin-card .ui-field-list { display:flex; flex-direction:column; align-items:stretch; gap:12px; margin-top:16px; }
      .originalsin-card .ui-field-list > .form-label { display:block; margin-bottom:0; }
      .osi-list-wrap { display:flex; flex-direction:column; gap:8px; background:color-mix(in srgb, var(--bg-color) 60%, transparent); border:1px solid var(--border-color); border-radius:8px; padding:12px; margin-top:0; }
      .osi-list-row.card-like { display:flex; align-items:center; justify-content:space-between; gap:12px; padding-bottom:12px; border:none; border-bottom:1px solid var(--border-color); background:transparent; border-radius:0; box-shadow:none; margin:0; }
      .osi-list-row.card-like:last-of-type { padding-bottom:0; border-bottom:none; }
      .osi-list-row.card-like .manage-item-content { display:flex; align-items:center; gap:12px; flex:1; min-width:0; }
      .osi-list-row.card-like .manage-item-title { font-size:13px; font-weight:700; color:var(--text-sub); width:60px; flex:0 0 60px; margin-bottom:0; }
      .osi-list-row.card-like .manage-item-time { display:flex; align-items:center; gap:8px; flex-wrap:wrap; font-size:13px; font-weight:600; color:var(--text-sub); }
      .osi-time-input,
      .osi-minute-input { padding:8px 12px; border:1px solid var(--border-color); border-radius:8px; background:var(--card-bg-soft); color:var(--text-main); font-size:14px; font-weight:700; box-sizing:border-box; }
      .osi-time-input { width:120px; max-width:100%; }
      .osi-minute-input { width:80px !important; min-width:80px !important; flex:0 0 80px !important; text-align:right; }
      .osi-list-unit { font-size:13px; font-weight:700; opacity:0.8; margin-left:4px; }
      .osi-list-actions { display:flex; justify-content:flex-end; margin-top:8px; }
      .osi-list-actions .btn.small { margin-top:0; }
      .stepper.compact { display:flex; align-items:center; gap:4px; }
      .stepper.compact .num { width:44px; }
      .originalsin-card .btn.small { width:auto; padding:6px 12px; font-size:12px; border-radius:8px; margin:0; display:inline-block; }
      .originalsin-card .del-btn { background:transparent; border:1px solid var(--border-color); color:var(--text-main); }
      .originalsin-state-card .btn { margin-top:10px; }
      :root {
        --bg-color: var(--bg);
        --card-bg-soft: var(--card-bg);
        --text-main: var(--text);
        --text-sub: rgba(142,142,147,0.95);
        --border-color: var(--border);
        --color-primary: #0a84ff;
        --color-primary-bg: rgba(10,132,255,0.10);
        --color-active: rgba(52,199,89,0.96);
        --color-warning: rgba(255,159,10,0.96);
        --color-danger: rgba(255,59,48,0.96);
        --color-danger-bg: rgba(255,59,48,0.10);
        --radius-sm: 8px;
        --radius-md: 14px;
        --radius-lg: 20px;
        --shadow: 0 4px 16px rgba(0,0,0,0.08);
        --global-header-offset: 0px;
        --global-footer-offset: 0px;
      }
      body {
        background-color: var(--bg-color);
        color: var(--text-main);
        margin: 0;
        padding: 0;
        -webkit-user-select: none;
      }
      .topnav.global-header {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 100;
        padding: 0;
        background: color-mix(in srgb, var(--bg-color) 88%, transparent);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border-bottom: 1px solid var(--border-color);
        box-sizing: border-box;
      }
      .status-banner {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: calc(env(safe-area-inset-top) + 6px) 16px 6px;
        font-size: 13px;
        font-weight: 700;
        transition: background 0.2s ease, color 0.2s ease;
      }
      .status-banner.mode-real { background: var(--color-active); color: #fff; }
      .status-banner.mode-virtual { background: var(--color-warning); color: #fff; }
      .test-clock-bar {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        padding: 0;
        min-height: 0;
        color: inherit;
        background: transparent !important;
        box-shadow: none;
        border-radius: 0;
        white-space: normal;
        font-size: 13px;
        font-weight: 700;
      }
      #test-clock-label, #test-clock-time { color: inherit; }
      .topnav .navwrap,
      .tab-bar {
        max-width: 600px;
        margin: 0 auto;
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 6px;
        padding: 8px 12px 10px;
        box-sizing: border-box;
      }
      .navbtn,
      .tab-btn {
        min-width: 0;
        min-height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 8px 4px;
        border-radius: var(--radius-sm);
        border: 1px solid var(--border-color);
        background: var(--card-bg-soft);
        color: var(--text-sub);
        font-size: 12px;
        line-height: 1.15;
        font-weight: 800;
        box-sizing: border-box;
        transition: 0.2s;
      }
      .navbtn span,
      .tab-btn span { display: block; }
      .navbtn.active,
      .tab-btn.active {
        color: var(--color-primary);
        border-color: var(--color-primary);
        background: var(--color-primary-bg);
        outline: none;
      }
      .screen {
        max-width: 600px;
        margin: 0 auto;
        padding: calc(var(--global-header-offset) + 16px) 16px calc(var(--global-footer-offset) + 16px);
        box-sizing: border-box;
      }
      .screen-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 10px;
        margin-bottom: 16px;
        padding-bottom: 8px;
        border-bottom: 2px solid var(--border-color);
      }
      .screen-title-wrap { min-width: 0; flex: 1; }
      .screen-header h2 {
        margin: 0;
        font-size: 22px;
        font-weight: 800;
        line-height: 1.2;
      }
      .screen-subnote {
        margin: -4px 0 16px;
        color: var(--text-sub);
        font-size: 12px;
        line-height: 1.45;
      }
      .help-entry-btn {
        background: var(--color-primary-bg);
        color: var(--color-primary);
        border: 1px solid var(--color-primary);
        border-radius: var(--radius-sm);
        padding: 6px 12px;
        font-size: 12px;
        font-weight: 700;
        white-space: nowrap;
      }
      .section,
      .settings-container,
      .manage-group-wrap,
      .keychain-pre,
      .dialog-box,
      .overlay-card {
        background: var(--card-bg-soft);
        border-radius: var(--radius-lg);
        border: 1px solid var(--border-color);
        box-shadow: var(--shadow);
      }
      .section,
      .manage-group-wrap {
        padding: 16px;
        margin-top: 0;
        margin-bottom: 16px;
      }
      .section h3,
      .manage-group-head,
      .settings-title {
        margin: 0 0 12px 0;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--border-color);
        font-size: 16px;
        font-weight: 800;
        opacity: 1;
      }
      .preview-stage {
        padding: 16px;
        margin-bottom: 16px;
        background: color-mix(in srgb, var(--card-bg-soft) 94%, rgba(10,132,255,0.04));
      }
      .preview-stage #dynamic-grid {
        margin: 0 auto;
      }
      .preview-stage .grid {
        gap: 12px;
      }
      .settings-container { margin-top: 16px; overflow: hidden; }
      .settings-container .settings-header {
        padding: 16px 16px 0;
        border-bottom: none;
        background: transparent;
      }
      .settings-scroll { padding: 0 16px 16px; }
      #screen-shards .settings-container {
        margin-top: 0;
      }
      #screen-shards .screen-subnote {
        margin-bottom: 14px;
      }
      #seg-layout {
        width: 100%;
        max-width: 320px;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 3px;
      }
      #seg-layout .opt,
      #seg-theme .opt {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 34px;
        padding: 7px 6px;
      }
      #seg-theme {
        width: 100%;
        max-width: 220px;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 3px;
      }
      .minirow,
      .row,
      .form-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
        flex-wrap: nowrap;
      }
      .label,
      .minirow .label {
        font-size: 14px;
        font-weight: 600;
        opacity: 0.92;
        line-height: 1.35;
        min-width: 0;
      }
      .segmented {
        display: inline-flex;
        background: var(--bg-color);
        border-radius: var(--radius-sm);
        padding: 2px;
        border: 1px solid var(--border-color);
        flex-shrink: 0;
        max-width: 100%;
        flex-wrap: wrap;
      }
      .segmented.narrow { width: auto; }
      .opt {
        padding: 6px 12px;
        font-size: 12px;
        font-weight: 700;
        border-radius: 6px;
        color: var(--text-sub);
        text-align: center;
        box-sizing: border-box;
        white-space: nowrap;
        word-break: keep-all;
      }
      .opt.selected {
        background: var(--card-bg-soft);
        color: var(--text-main);
        box-shadow: 0 1px 3px rgba(0,0,0,0.10);
      }
      .btn,
      .footerbtn,
      .btn-save {
        padding: 12px;
        border-radius: var(--radius-md);
        font-weight: 800;
        text-align: center;
        border: 1px solid var(--border-color);
        background: var(--bg-color);
        color: var(--text-main);
        width: 100%;
        box-sizing: border-box;
        margin-top: 10px;
      }
      .btn.secondary.small,
      .btn.small {
        width: auto;
        padding: 6px 12px;
        font-size: 12px;
        border-radius: var(--radius-sm);
        margin: 0;
        display: inline-block;
      }
      .btn.danger {
        background: var(--color-danger-bg);
        color: var(--color-danger);
        border-color: var(--color-danger);
      }
      .footerbar,
      .footer-bar {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 95;
        display: none;
        height: auto;
        padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
        background: color-mix(in srgb, var(--bg-color) 90%, transparent);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border-top: 1px solid var(--border-color);
        box-sizing: border-box;
      }
      .footerbtn,
      .btn-save {
        max-width: 600px;
        margin: 0 auto;
        padding: 14px 16px;
        border: none;
        background: rgba(48,209,88,0.92);
        color: #fff;
        font-size: 16px;
        box-shadow: var(--shadow);
      }
      .footerbar.active { display: block; }
      .overlay {
        position: fixed;
        inset: 0;
        z-index: 90;
        display: none;
        padding: calc(var(--global-header-offset) + 16px) 16px calc(16px + env(safe-area-inset-bottom));
        box-sizing: border-box;
        overflow-y: auto;
        background: color-mix(in srgb, var(--bg-color) 92%, transparent);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
      }
      .overlay.active { display: block; }
      .overlay .screen-header { max-width: 600px; margin: 0 auto 16px; }
      .overlay-card { max-width: 600px; margin: 0 auto; padding: 16px; }
      .dialog-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1000;
        display: none;
        align-items: center;
        justify-content: center;
        background: rgba(0,0,0,0.5);
      }
      .dialog-box {
        width: 80%;
        max-width: 320px;
        padding: 20px;
        text-align: center;
      }
      #toast {
        visibility: hidden;
        max-width: 80%;
        min-width: 200px;
        background-color: var(--text-main);
        color: var(--bg-color);
        text-align: center;
        border-radius: 24px;
        padding: 12px 24px;
        position: fixed;
        z-index: 2000;
        left: 50%;
        top: calc(env(safe-area-inset-top) + 96px);
        transform: translateX(-50%);
        font-size: 14px;
        font-weight: 700;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.3s;
      }
      #toast.show { visibility: visible; opacity: 1; transform: translateX(-50%); }
      @media (max-width: 420px) {
        .screen-header { align-items: stretch; flex-direction: column; }
        .help-entry-btn { align-self: flex-start; }
      }
      @media (max-width: 460px) {
        .rule-common-card .minirow,
        .rule-specific-card .minirow,
        .rule-progress-card .minirow,
        .system-card .minirow,
        .schedule-filter-card .minirow {
          align-items: stretch;
          flex-direction: column;
        }
        .rule-common-card .minirow .label,
        .rule-specific-card .minirow .label,
        .rule-progress-card .minirow .label,
        .system-card .minirow .label {
          width: 100%;
          margin-right: 0;
          padding-right: 0;
          white-space: normal;
        }
        .rule-common-card .num-group,
        .rule-specific-card .num-group,
        .rule-progress-card .num-group,
        .rule-common-card .segmented,
        .rule-specific-card .segmented,
        .rule-progress-card .segmented,
        .system-card .segmented {
          width: 100%;
          max-width: 100%;
        }
        .rule-common-card .segmented.narrow,
        .rule-specific-card .segmented.narrow,
        .rule-progress-card .segmented.narrow,
        .system-card .segmented.narrow {
          flex-wrap: wrap;
        }
        .manage-list-item {
          align-items: flex-start;
        }
        .manage-item-toggle {
          width: 100%;
          margin-left: 34px;
        }
        .schedule-batch-row {
          grid-template-columns: 1fr;
        }
      }
      .event-section-wrap { display:block; }
      .event-hero { padding: 16px; }
      .event-hero.tone-green { border-left: 4px solid rgba(48,209,88,0.96); }
      .event-hero.tone-orange { border-left: 4px solid rgba(255,159,10,0.96); }
      .event-hero.tone-red { border-left: 4px solid rgba(255,59,48,0.96); }
      .event-hero.tone-blue { border-left: 4px solid rgba(10,132,255,0.96); }
      .event-hero-head { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
      .event-hero-title-wrap { min-width:0; flex:1; }
      .event-hero-title-wrap h3 { margin:0 0 10px 0; font-size:20px; }
      .event-hero-toggle { flex-shrink:0; }
      .rule-subnote { color: var(--text-sub); font-size: 12px; line-height: 1.45; margin-top: 4px; }
      .rule-subnote.standalone { margin-top: 10px; }
      .progress-strip { display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap:8px; margin-top:14px; }
      .progress-chip { background: var(--bg-color); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 10px 8px; text-align:center; font-size:12px; font-weight:700; line-height:1.35; }
      .progress-chip.highlight { background: var(--color-primary-bg); border-color: var(--color-primary); color: var(--color-primary); }
      .progress-num { display:inline-block; margin-top: 4px; font-size:18px; font-weight:800; color: var(--text-main); }
      .rule-progress-card h3,
      .rule-common-card h3,
      .rule-specific-card h3 { margin-bottom: 8px; }
      .rule-progress-card .minirow:first-of-type,
      .rule-common-card .minirow:first-of-type,
      .rule-specific-card .minirow:first-of-type { margin-top: 12px; }
      .rule-progress-card .btnrow,
      .rule-specific-card .btnrow { margin-top: 12px; }
      .rule-progress-card .btn.secondary,
      .rule-specific-card .btn.secondary { background: rgba(255,159,10,0.12); border-color: rgba(255,159,10,0.32); color: var(--text-main); }
      .rule-progress-card { background: color-mix(in srgb, var(--card-bg-soft) 92%, rgba(255,159,10,0.10)); }
      .rule-specific-card { background: color-mix(in srgb, var(--card-bg-soft) 94%, rgba(10,132,255,0.06)); }
      .rule-progress-card .minirow,
      .rule-common-card .minirow,
      .rule-specific-card .minirow {
        align-items: center;
        min-height: 44px;
      }
      .rule-progress-card .num,
      .rule-common-card .num,
      .rule-specific-card .num,
      .rule-progress-card .btn.pm,
      .rule-common-card .btn.pm,
      .rule-specific-card .btn.pm {
        width: 42px;
        height: 42px;
      }
      .rule-progress-card .segmented,
      .rule-common-card .segmented,
      .rule-specific-card .segmented {
        min-height: 40px;
      }
      .rule-progress-card .segmented .opt,
      .rule-common-card .segmented .opt,
      .rule-specific-card .segmented .opt {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 36px;
      }
      .rule-progress-card .segmented.narrow,
      .rule-common-card .segmented.narrow,
      .rule-specific-card .segmented.narrow {
        min-width: 168px;
      }
      .rule-specific-card .btn.secondary {
        margin-top: 4px;
      }
      .schedule-filter-card .minirow,
      .system-card .minirow { margin-bottom: 0; }
      .schedule-section { padding: 16px; }
      .schedule-section + .schedule-section { margin-top: 16px; }
      .schedule-state-head { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom: 12px; }
      .schedule-state-head h3 { margin:0; font-size: 18px; }
      .schedule-subtools { display:flex; flex-wrap:wrap; gap:8px; margin: 10px 0 0; }
      .schedule-select-row {
        margin-top: 10px;
      }
      .schedule-batch-row {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
        margin-top: 12px;
      }
      .schedule-batch-row .btn {
        margin-top: 0;
      }
      .schedule-batch-row-single {
        grid-template-columns: 1fr;
      }
      .schedule-list { display:flex; flex-direction:column; gap:12px; margin-top: 12px; }
      .manage-group-wrap { padding: 0; overflow: hidden; border-radius: var(--radius-md); }
      .manage-group-head { margin:0; padding: 10px 12px; background: var(--bg-color); font-size:13px; font-weight:800; border-bottom: 1px solid var(--border-color); }
      .manage-sub-wrap { margin: 0; padding: 8px 12px; border-bottom: 1px solid var(--border-color); }
      .manage-sub-wrap:last-child { border-bottom:none; }
      .manage-sub-head { display:inline-flex; align-items:center; padding: 6px 10px; border-radius: 999px; border:1px solid var(--border-color); background: rgba(10,132,255,0.08); font-size: 12px; margin-bottom: 8px; }
      .manage-list-item { display:flex; align-items:center; gap:12px; padding: 10px 0; }
      .manage-list-item + .manage-list-item { border-top: 1px solid var(--border-color); }
      .manage-item-title { font-size: 14px; font-weight: 800; margin-bottom: 4px; }
      .manage-item-time { font-size: 13px; font-weight: 600; color: var(--text-sub); }
      .manage-item-toggle { width: 104px; }
      .manage-empty,
      .loading-state,
      .empty-state { padding: 14px 12px; border-radius: var(--radius-sm); background: var(--bg-color); border:1px dashed var(--border-color); color: var(--text-sub); font-size: 13px; line-height: 1.5; }
      .loading-state { color: var(--color-primary); border-style: solid; background: color-mix(in srgb, var(--color-primary-bg) 60%, var(--bg-color)); font-weight: 700; }
      .empty-state { color: var(--text-sub); }
      .manage-empty { margin-top: 12px; }
      .schedule-thread-wrap { margin-top: 12px; padding: 12px; border-radius: var(--radius-sm); background: var(--bg-color); border: 1px dashed var(--border-color); }
      .thread-help { font-size: 12px; font-weight: 700; color: var(--text-sub); margin-bottom: 8px; }
      .schedule-thread-chips { margin-top: 0; }
      .schedule-thread-chips .btn { margin-top: 0; border-radius: 999px; padding: 8px 12px; background: rgba(10,132,255,0.08); }
      .zone-virtual { border-left: 4px solid rgba(255,159,10,0.96); }
      .zone-destructive { border: 2px solid rgba(255,59,48,0.72); background: rgba(255,59,48,0.10); box-shadow: inset 0 0 0 1px rgba(255,59,48,0.08); }
      .zone-destructive h3,
      .zone-destructive .danger-note { color: rgba(255,59,48,0.96); }
      .zone-destructive .btn.danger { background: rgba(255,59,48,0.16); }
      .danger-note { font-size: 13px; font-weight: 700; line-height: 1.45; margin-bottom: 12px; }
      .destructive-grid { display:grid; gap:10px; }
      .destructive-grid .btn { margin-top: 0; }
      .system-stack-actions,
      .system-danger-stack {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 12px;
      }
      .system-stack-actions .btn,
      .system-danger-stack .btn {
        margin-top: 0;
      }
      .system-action-grid { display:grid; grid-template-columns: 1fr 1fr; gap:8px; }
      .system-action-grid .btn { margin-top:0; font-size:13px; padding: 10px 8px; }
      .system-card .btnrow { margin-top: 12px; }
      .screen-subnote strong { color: var(--text-main); }
      .preview-stage {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .preview-stage-meta {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .preview-stage-title {
        font-size: 15px;
        font-weight: 800;
        color: var(--text-main);
      }
      .preview-stage-note {
        font-size: 12px;
        line-height: 1.5;
        color: var(--text-sub);
      }
      .preview-stage-canvas {
        padding: 14px;
        border-radius: var(--radius-md);
        border: 1px dashed var(--border-color);
        background: color-mix(in srgb, var(--bg-color) 92%, transparent);
      }
      .preview-stage #dynamic-grid {
        width: min(100%, 460px);
      }
      .preview-control-grid {
        display: grid;
        gap: 12px;
      }
      .preview-form-row {
        margin-bottom: 0;
        padding: 12px;
        border-radius: var(--radius-md);
        border: 1px solid var(--border-color);
        background: color-mix(in srgb, var(--bg-color) 90%, transparent);
      }
      .preview-form-row .preview-form-label {
        margin-bottom: 10px;
      }
      .preview-form-row .segmented,
      .preview-form-row #seg-view,
      .preview-form-row #seg-layout,
      .preview-form-row #seg-theme {
        max-width: 100%;
      }
      .rule-progress-card .field-row,
      .rule-common-card .field-row,
      .rule-specific-card .field-row {
        align-items: flex-start;
        gap: 10px;
      }
      .rule-progress-card .field-row .label,
      .rule-common-card .field-row .label,
      .rule-specific-card .field-row .label {
        flex: 1;
        margin-right: 0;
        padding-top: 2px;
        white-space: normal;
      }
      .rule-progress-card .field-row .num-group,
      .rule-common-card .field-row .num-group,
      .rule-specific-card .field-row .num-group,
      .rule-progress-card .field-row .segmented,
      .rule-common-card .field-row .segmented,
      .rule-specific-card .field-row .segmented {
        margin-left: auto;
      }
      .field-row-shards {
        padding: 10px 12px;
        border-radius: var(--radius-sm);
        border: 1px solid rgba(255,59,48,0.20);
        background: rgba(255,59,48,0.06);
      }
      .field-row-shards .segmented {
        min-width: 148px;
      }
      .shard-specific-note {
        margin: 0 0 12px 0;
      }
      .schedule-list {
        margin-top: 10px;
      }
      .schedule-thread-wrap {
        display: grid;
        gap: 8px;
      }
      .schedule-thread-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .schedule-thread-chips .btn {
        width: auto;
        max-width: 100%;
        white-space: normal;
        line-height: 1.35;
      }
      .system-expand-stack .minirow,
      .system-datetime-row {
        align-items: stretch;
        flex-direction: column;
      }
      .system-datetime-input {
        width: 100% !important;
        max-width: none !important;
        min-height: 42px;
      }
      .system-copy-row .btn {
        min-width: 180px;
      }
      .keychain-pre {
        max-height: 220px;
        padding: 14px;
        margin-top: 12px;
        line-height: 1.5;
      }
      .overlay-card.wide {
        max-width: min(960px, calc(100vw - 24px));
      }
      .keychain-overlay-pre {
        width: 100%;
        max-height: calc(100vh - 190px);
        padding: 14px;
        margin: 0;
        border-radius: var(--radius-sm);
        border: 1px solid var(--border-color);
        background: color-mix(in srgb, var(--bg-color) 92%, transparent);
        color: var(--text-main);
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 11px;
        overflow: auto;
        white-space: pre-wrap;
        word-break: break-all;
        line-height: 1.5;
        box-sizing: border-box;
      }
      .zone-destructive {
        margin-top: 22px;
      }
      .intro-copy {
        font-size: 14px;
        line-height: 1.75;
        color: var(--text-main);
      }
      .intro-step-list {
        display: grid;
        gap: 10px;
        margin-top: 12px;
      }
      .intro-step-card {
        display: flex;
        gap: 12px;
        align-items: flex-start;
        padding: 12px;
        border-radius: var(--radius-md);
        border: 1px solid var(--border-color);
        background: color-mix(in srgb, var(--bg-color) 92%, transparent);
      }
      .intro-step-num {
        width: 28px;
        height: 28px;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        font-weight: 800;
        color: var(--color-primary);
        background: var(--color-primary-bg);
        border: 1px solid rgba(10,132,255,0.20);
        flex-shrink: 0;
      }
      .intro-step-title {
        font-size: 14px;
        font-weight: 800;
        color: var(--text-main);
        margin-bottom: 4px;
      }
      .intro-step-copy {
        font-size: 13px;
        line-height: 1.55;
        color: var(--text-sub);
      }
      .intro-role-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 12px;
      }
      .intro-role-chip {
        display: inline-flex;
        align-items: center;
        min-height: 34px;
        padding: 8px 12px;
        border-radius: 999px;
        border: 1px solid var(--border-color);
        background: color-mix(in srgb, var(--bg-color) 92%, transparent);
        font-size: 13px;
        font-weight: 700;
      }
      @media (min-width: 520px) {
        .preview-control-grid {
          grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
          align-items: start;
        }
        .preview-control-grid .preview-form-row:first-child {
          grid-column: 1 / -1;
        }
        .preview-control-grid #row-layout,
        .preview-control-grid .preview-form-row:not(:first-child) {
          min-height: 100%;
        }
      }
      @media (max-width: 520px) {
        .system-action-grid {
          grid-template-columns: 1fr;
        }
      }
      @media (max-width: 460px) {
        .field-row-shards .segmented {
          width: 100%;
        }
      }
      .card {
        background: var(--card-bg-soft);
        border-radius: var(--radius-lg);
        border: 1px solid var(--border-color);
        padding: 16px;
        margin-bottom: 16px;
        box-shadow: var(--shadow);
      }
      .card-header {
        font-size: 16px;
        font-weight: 800;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--border-color);
      }
      .preview-stage #dynamic-grid .card {
        padding: 0;
        margin-bottom: 0;
        background: var(--card-bg);
        border: none;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        overflow: hidden;
        border-radius: 16px;
      }
      .preview-stage #dynamic-grid img {
        display: block;
      }
      .form-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
      }
      .form-row:last-child { margin-bottom: 0; }
      .form-label {
        font-size: 14px;
        font-weight: 600;
        opacity: 0.92;
        line-height: 1.35;
        min-width: 0;
        flex: 1;
      }
      .stepper {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-shrink: 0;
      }
      .stepper .btn.pm,
      .stepper button {
        width: 32px;
        height: 32px;
        min-height: 32px;
        padding: 0;
        border-radius: 8px;
        margin: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--bg-color);
        border: 1px solid var(--border-color);
        font-size: 16px;
        font-weight: 700;
      }
      .stepper .num,
      .stepper input {
        width: 40px;
        height: 32px;
        padding: 0;
        text-align: center;
        font-weight: 700;
        background: var(--card-bg-soft);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        color: var(--text-main);
        box-sizing: border-box;
      }
      .btn-action-temp {
        background: transparent;
        border: 2px dashed var(--border-color);
        color: var(--text-main);
        opacity: 0.85;
      }
      .btn-danger,
      .btn.danger {
        background: var(--color-danger-bg);
        color: var(--color-danger);
        border-color: var(--color-danger);
      }
      .notify-summary-card,
      .rule-progress-card,
      .rule-common-card,
      .rule-specific-card,
      .schedule-section,
      .system-card,
      .intro-hero-card,
      .manage-group-wrap,
      .schedule-filter-card {
        background: var(--card-bg-soft);
      }
      .notify-summary-card.tone-green { border-left: 4px solid var(--color-active); }
      .notify-summary-card.tone-orange { border-left: 4px solid var(--color-warning); }
      .notify-summary-card.tone-red { border-left: 4px solid var(--color-danger); }
      .notify-summary-card.tone-blue { border-left: 4px solid var(--color-primary); }
      .rule-progress-card,
      .rule-common-card,
      .rule-specific-card,
      .schedule-section,
      .system-card,
      .intro-hero-card,
      .manage-group-wrap,
      .schedule-filter-card {
        border-radius: var(--radius-lg);
        border: 1px solid var(--border-color);
        box-shadow: var(--shadow);
      }
      .rule-progress-card,
      .rule-common-card,
      .rule-specific-card,
      .schedule-section,
      .system-card,
      .intro-hero-card,
      .manage-group-wrap,
      .schedule-filter-card {
        padding: 16px;
      }
      .rule-progress-card h3,
      .rule-common-card h3,
      .rule-specific-card h3,
      .system-card h3,
      .intro-hero-card h3 {
        display: none;
      }
      .event-switcher {
        margin-bottom: 16px;
      }
      .event-switcher .opt {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 34px;
        padding: 7px 6px;
      }
      .notify-event-head h3 {
        font-size: 20px;
      }
      .progress-strip {
        display: flex;
        gap: 8px;
        margin-top: 14px;
        margin-bottom: 0;
      }
      .progress-chip {
        flex: 1;
        min-width: 0;
        padding: 8px;
        text-align: center;
        font-size: 12px;
        line-height: 1.35;
        font-weight: 700;
        background: var(--bg-color);
        border-radius: var(--radius-sm);
        border: 1px solid var(--border-color);
      }
      .progress-chip.highlight {
        background: color-mix(in srgb, var(--color-active) 15%, var(--bg-color));
        color: #24a142;
        border-color: #24a142;
      }
      .progress-num {
        display: inline-block;
        margin-top: 4px;
        font-size: 18px;
        font-weight: 800;
        color: var(--text-main);
      }
      .field-row-shards {
        padding: 10px 12px;
        border-radius: var(--radius-sm);
        border: 1px solid rgba(255,59,48,0.20);
        background: rgba(255,59,48,0.06);
      }
      .schedule-filter-card .minirow,
      .schedule-filter-card .form-row {
        margin-bottom: 0;
      }
      .schedule-filter-card {
        padding: 12px 16px;
      }
      .schedule-state-head h3 {
        margin: 0;
        font-size: 18px;
      }
      .pill,
      .state-badge {
        display: inline-block;
        padding: 4px 8px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 700;
        background: var(--color-primary-bg);
        color: var(--color-primary);
        border: none;
      }
      .manage-group-wrap {
        padding: 0;
        overflow: hidden;
      }
      .manage-group-head {
        margin: 0;
        padding: 8px 12px;
        font-size: 13px;
        font-weight: 700;
        background: var(--bg-color);
        border-bottom: 1px solid var(--border-color);
      }
      .manage-sub-wrap {
        margin: 0;
        padding: 8px 12px;
        border-bottom: 1px solid var(--border-color);
      }
      .manage-sub-wrap:last-child {
        border-bottom: none;
      }
      .manage-sub-head {
        margin-bottom: 8px;
        font-size: 12px;
        font-weight: 700;
        color: var(--text-sub);
      }
      .manage-list-item.schedule-card {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        border-radius: var(--radius-sm);
        border: 1px solid var(--border-color);
        background: var(--bg-color);
        margin-bottom: 8px;
      }
      .manage-list-item.schedule-card + .manage-list-item.schedule-card {
        margin-top: 8px;
      }
      .manage-item-title {
        font-weight: 700;
        font-size: 14px;
        margin-bottom: 4px;
      }
      .manage-item-time {
        font-size: 13px;
        opacity: 0.8;
      }
      .loading-state {
        padding: 16px;
        text-align: center;
        color: var(--color-primary);
        font-size: 14px;
        font-weight: 700;
      }
      .empty-state {
        padding: 24px;
        text-align: center;
        color: var(--text-sub);
        font-size: 14px;
        font-weight: 700;
        border: 2px dashed var(--border-color);
        border-radius: var(--radius-sm);
        background: transparent;
      }
      .zone-virtual {
        border: 2px solid var(--color-warning);
        background: var(--color-warning-bg);
      }
      .zone-destructive {
        border: 2px solid var(--color-danger);
        background: var(--color-danger-bg);
        margin-top: 32px;
        box-shadow: none;
      }
      .zone-destructive h3,
      .zone-destructive .danger-note {
        color: var(--color-danger);
      }
      .rule-subnote {
        color: var(--text-sub);
        font-size: 12px;
        line-height: 1.45;
      }
      @media (max-width: 460px) {
        .form-row.ui-field,
        .schedule-filter-card .minirow,
        .schedule-filter-card .form-row,
        .system-card .minirow,
        .system-card .form-row {
          align-items: stretch;
          flex-direction: column;
        }
        .form-row.ui-field .segmented,
        .form-row.ui-field .stepper,
        .schedule-filter-card .segmented,
        .system-card .segmented,
        .system-card .stepper {
          width: 100%;
          max-width: 100%;
        }
        .form-row.ui-field .stepper {
          justify-content: flex-end;
        }
      }
      /* v2.6 prototype parity overrides */
      .navbtn,
      .tab-btn {
        background: var(--card-bg);
        white-space: normal;
        word-break: keep-all;
        overflow-wrap: normal;
      }
      .navbtn span,
      .tab-btn span,
      .opt,
      .manage-item-toggle .opt,
      .schedule-filter-card .opt,
      .system-card .opt,
      .preview-form-row .opt {
        white-space: nowrap;
        word-break: keep-all;
        overflow-wrap: normal;
      }
      .segmented {
        background: var(--bg-color);
        border-radius: var(--radius-sm);
        padding: 2px;
        border: 1px solid var(--border-color);
      }
      .opt {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 32px;
        padding: 6px 12px;
        font-size: 12px;
        font-weight: 700;
        border-radius: 6px;
        color: var(--text-sub);
        line-height: 1.15;
        white-space: nowrap;
        word-break: keep-all;
      }
      .opt.selected {
        background: var(--card-bg);
        color: var(--text-main);
        box-shadow: 0 1px 3px rgba(0,0,0,0.10);
      }
      .segmented.narrow,
      .manage-item-toggle {
        width: auto;
        min-width: 112px;
        max-width: 100%;
        flex-wrap: nowrap;
      }
      .segmented.narrow.two-col {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0;
      }
      .segmented.narrow .opt,
      .manage-item-toggle .opt {
        min-width: 48px;
        flex: 1 1 0;
      }
      .preview-form-row .segmented,
      .preview-form-row #seg-view,
      .preview-form-row #seg-layout,
      .preview-form-row #seg-theme {
        background: var(--bg-color);
      }
      .preview-stage-canvas {
        display: flex;
        justify-content: center;
        align-items: center;
      }
      .preview-stage #dynamic-grid {
        margin: 0 auto;
      }
      .section,
      .settings-container,
      .notify-summary-card,
      .rule-progress-card,
      .rule-common-card,
      .rule-specific-card,
      .manage-group-wrap,
      .intro-hero-card,
      .system-card,
      .card,
      .schedule-filter-card {
        background: var(--card-bg);
      }
      .schedule-filter-card,
      .schedule-section {
        background: transparent;
        border: none;
        box-shadow: none;
        padding: 0;
      }
      .schedule-filter-card .minirow {
        margin-bottom: 16px;
      }
      .schedule-subtools {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
        flex-wrap: wrap;
      }
      .schedule-state-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }
      .state-badge,
      .pill {
        background: var(--color-primary-bg);
        color: var(--color-primary);
      }
      .manage-group-wrap {
        padding: 0;
        overflow: hidden;
        margin-bottom: 12px;
        border: 1px solid var(--border-color);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow);
      }
      .manage-group-head {
        padding: 8px 12px;
        background: var(--bg-color);
        border-bottom: 1px solid var(--border-color);
      }
      .manage-sub-wrap {
        padding: 10px 12px 12px;
        border-bottom: 1px solid var(--border-color);
      }
      .manage-sub-wrap:last-child {
        border-bottom: none;
      }
      .manage-sub-head {
        padding: 0;
        margin: 0 0 8px;
        color: var(--text-sub);
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.01em;
      }
      .manage-item-time.only-line {
        font-size: 14px;
        font-weight: 700;
        color: var(--text-main);
      }
      .manage-group-wrap .manage-list-item.schedule-card {
        background: transparent;
        border: none;
        border-radius: 0;
        padding: 12px;
        margin: 0;
      }
      .manage-group-wrap .manage-list-item.schedule-card + .manage-list-item.schedule-card {
        border-top: 1px solid var(--border-color);
        margin-top: 0;
      }
      .zone-virtual {
        border-left: 4px solid var(--color-warning);
        border-top: 1px solid var(--border-color);
        border-right: 1px solid var(--border-color);
        border-bottom: 1px solid var(--border-color);
        background: var(--card-bg);
      }
      .zone-destructive {
        border: 2px solid var(--color-danger);
        background: var(--color-danger-bg);
        margin-top: 32px;
        box-shadow: none;
      }
      .system-card > h3,
      .intro-hero-card > h3 {
        display: block;
        margin: 0 0 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--border-color);
        font-size: 16px;
        font-weight: 800;
      }
      .sectionhead {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin: 0 0 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--border-color);
        flex-wrap: nowrap;
      }
      .sectionhead h3 {
        display: block;
        margin: 0;
        font-size: 16px;
        font-weight: 800;
        flex: 1;
        min-width: 0;
        line-height: 1.3;
        word-break: keep-all;
      }
      .sectionhead > .segmented {
        flex: 0 0 auto;
        width: auto;
      }
      .sectionhead > .segmented .opt {
        min-width: 48px;
        padding-left: 10px;
        padding-right: 10px;
      }
      .rule-progress-card h3,
      .rule-common-card h3,
      .rule-specific-card h3 {
        display: none;
      }
      @media (max-width: 460px) {
        .schedule-filter-card .segmented.narrow,
        .system-card .segmented.narrow,
        .manage-item-toggle,
        .field-row .segmented.narrow {
          width: auto;
          max-width: 100%;
          flex-wrap: nowrap;
        }
      }
      .screen-header {
        flex-direction: row !important;
        align-items: flex-start !important;
        flex-wrap: nowrap;
      }
      .help-entry-btn {
        align-self: auto !important;
        flex-shrink: 0;
        white-space: nowrap;
      }
      .preview-stage-canvas {
        display: flex;
        justify-content: center;
      }
      .preview-stage #dynamic-grid {
        display: block;
        width: min(100%, 460px);
        margin: 0 auto;
      }
      .preview-stage #dynamic-grid .grid {
        display: grid;
        gap: 12px;
        max-width: 600px;
        margin: 0 auto;
        transition: all 0.3s ease;
      }
      .preview-stage #dynamic-grid .card {
        padding: 0 !important;
        margin: 0 !important;
        background-color: var(--card-bg) !important;
        border: none !important;
        border-radius: 16px !important;
        overflow: hidden !important;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important;
        transition: aspect-ratio 0.3s ease !important;
      }
      .preview-stage #dynamic-grid img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      .rule-progress-card .field-row,
      .rule-common-card .field-row,
      .rule-specific-card .field-row {
        align-items: center;
        gap: 12px;
      }
      .rule-progress-card .field-row .form-label,
      .rule-common-card .field-row .form-label,
      .rule-specific-card .field-row .form-label {
        padding-top: 0;
      }
      .manage-group-wrap {
        padding: 12px;
        background: var(--card-bg-soft);
      }
      .manage-group-head {
        margin: 0;
        padding: 0 0 10px;
        font-size: 13px;
        font-weight: 700;
        background: transparent;
        border-bottom: 1px solid var(--border-color);
      }
      .manage-sub-wrap {
        margin: 12px 0 0;
        padding: 12px;
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        background: color-mix(in srgb, var(--bg-color) 92%, transparent);
      }
      .manage-sub-wrap:first-of-type {
        margin-top: 12px;
      }
      .manage-sub-head {
        display: block;
        margin: 0 0 10px;
        padding: 8px 12px;
        border-radius: var(--radius-sm);
        border: 1px solid var(--border-color);
        background: var(--card-bg-soft);
        color: var(--text-main);
        font-size: 13px;
        font-weight: 800;
      }
      .manage-list-item.schedule-card {
        margin-bottom: 0;
      }
      .manage-list-item.schedule-card + .manage-list-item.schedule-card {
        margin-top: 8px;
      }
      .system-card-header-split {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .system-card-header-split > span {
        min-width: 0;
        font-size: 16px;
        font-weight: 800;
        line-height: 1.35;
      }
      .system-virtual-row {
        align-items: center;
        margin-bottom: 0;
      }
      .system-virtual-row .form-label {
        white-space: nowrap;
      }
      .system-virtual-row .system-datetime-input {
        width: 180px !important;
        max-width: 180px !important;
        min-height: 42px;
        flex-shrink: 0;
      }
      @media (max-width: 460px) {
        .form-row.ui-field,
        .schedule-filter-card .minirow,
        .schedule-filter-card .form-row,
        .system-card .minirow,
        .system-card .form-row {
          align-items: center !important;
          flex-direction: row !important;
        }
        .form-row.ui-field .segmented,
        .form-row.ui-field .stepper,
        .schedule-filter-card .segmented,
        .system-card .segmented,
        .system-card .stepper {
          width: auto !important;
          max-width: 100% !important;
        }
        .system-virtual-row {
          align-items: flex-start !important;
        }
        .system-virtual-row .system-datetime-input {
          width: 180px !important;
        }
      }
      /* v2.9 prototype parity overrides */
      .preview-form-control,
      .preview-form-row .segmented,
      .preview-form-row #seg-view,
      .preview-form-row #seg-layout,
      .preview-form-row #seg-theme,
      .schedule-filter-card .segmented.narrow,
      .system-card .segmented.narrow,
      .field-row .segmented.narrow,
      .manage-item-toggle,
      .system-card-header-split .segmented,
      .sectionhead > .segmented {
        display: inline-flex !important;
        width: auto !important;
        min-width: 0 !important;
        max-width: 100% !important;
        flex: 0 0 auto !important;
        flex-wrap: wrap;
        justify-content: flex-start !important;
      }
      .preview-form-row #seg-view,
      .preview-form-row #seg-layout,
      .preview-form-row #seg-theme {
        display: inline-flex !important;
        grid-template-columns: none !important;
        gap: 0 !important;
      }
      .preview-form-control {
        width: auto !important;
        max-width: 100%;
      }
      .preview-form-row .opt,
      .schedule-filter-card .opt,
      .system-card .opt,
      .field-row .opt,
      .manage-item-toggle .opt,
      .preview-form-row #seg-view .opt,
      .preview-form-row #seg-layout .opt,
      .preview-form-row #seg-theme .opt,
      .system-card-header-split .opt,
      .sectionhead > .segmented .opt {
        flex: 0 0 auto !important;
        width: auto !important;
        min-width: 0 !important;
        white-space: nowrap;
        padding-left: 12px;
        padding-right: 12px;
      }
      .segmented.narrow.two-col {
        display: inline-flex !important;
        grid-template-columns: none !important;
        gap: 0 !important;
      }
      .manage-item-toggle {
        margin-left: auto !important;
        padding: 2px !important;
        min-width: 0 !important;
      }
      .manage-item-toggle .opt,
      .segmented.narrow .opt {
        min-width: 0 !important;
        flex: 0 0 auto !important;
      }
      .zone-virtual.system-card {
        border: 2px solid var(--color-warning) !important;
        background: var(--color-warning-bg) !important;
        box-shadow: var(--shadow) !important;
      }
      .zone-virtual.system-card .card-header {
        border-bottom: 1px solid color-mix(in srgb, var(--color-warning) 32%, var(--border-color)) !important;
      }
      .system-card-header-split {
        align-items: flex-start !important;
      }
      .system-card-header-split > span {
        flex: 1 1 auto;
      }
      .manage-group-wrap {
        padding: 16px !important;
      }
      .manage-group-head {
        margin: 0 0 12px 0 !important;
        padding: 0 0 8px 0 !important;
        border-bottom: 1px solid var(--border-color) !important;
      }
      .manage-sub-wrap {
        margin: 12px 0 0 0 !important;
        padding: 0 0 0 12px !important;
        border: none !important;
        border-left: 1px dashed var(--border-color) !important;
        border-radius: 0 !important;
        background: transparent !important;
        box-shadow: none !important;
      }
      .manage-sub-wrap + .manage-sub-wrap {
        margin-top: 14px !important;
      }
      .manage-sub-head {
        margin: 0 0 8px 0 !important;
        padding: 0 !important;
        border: none !important;
        border-radius: 0 !important;
        background: transparent !important;
        color: var(--text-sub) !important;
        font-size: 13px !important;
        font-weight: 700 !important;
        line-height: 1.4;
      }
      .manage-list-item.schedule-card {
        gap: 12px;
        margin: 0 !important;
        padding: 8px 0 8px 2px !important;
        border: none !important;
        border-bottom: 1px solid color-mix(in srgb, var(--border-color) 72%, transparent) !important;
        border-radius: 0 !important;
        background: transparent !important;
        box-shadow: none !important;
      }
      .manage-list-item.schedule-card + .manage-list-item.schedule-card {
        margin-top: 0 !important;
      }
      .manage-sub-wrap .manage-list-item.schedule-card:last-child {
        border-bottom: none !important;
        padding-bottom: 2px !important;
      }
      .manage-item-title {
        margin-bottom: 2px !important;
        color: var(--text-sub) !important;
        font-size: 13px !important;
      }
      .manage-item-time {
        font-size: 14px !important;
        font-weight: 600 !important;
        line-height: 1.45;
        opacity: 1 !important;
      }
      @media (max-width: 460px) {
        .rule-common-card .minirow,
        .rule-specific-card .minirow,
        .rule-progress-card .minirow {
          align-items: center !important;
          flex-direction: row !important;
        }
        .rule-common-card .minirow .label,
        .rule-specific-card .minirow .label,
        .rule-progress-card .minirow .label {
          width: auto !important;
          flex: 1 1 auto !important;
          min-width: 0 !important;
          margin-right: 0 !important;
          padding-right: 5px !important;
          white-space: nowrap !important;
        }
        .rule-common-card .num-group,
        .rule-specific-card .num-group,
        .rule-progress-card .num-group,
        .rule-common-card .segmented,
        .rule-specific-card .segmented,
        .rule-progress-card .segmented {
          width: auto !important;
          max-width: 100% !important;
          flex: 0 0 auto !important;
        }
        .rule-common-card .segmented.narrow,
        .rule-specific-card .segmented.narrow,
        .rule-progress-card .segmented.narrow {
          flex-wrap: nowrap !important;
        }
      }
      /* v2.10 nowrap and preview-row corrections */
      .form-row.ui-field,
      .rule-progress-card .field-row,
      .rule-common-card .field-row,
      .rule-specific-card .field-row,
      .schedule-filter-card .form-row,
      .system-card .form-row,
      .schedule-filter-card .minirow,
      .system-card .minirow,
      .rule-progress-card .minirow,
      .rule-common-card .minirow,
      .rule-specific-card .minirow,
      .system-virtual-row {
        display: flex !important;
        flex-direction: row !important;
        flex-wrap: nowrap !important;
        align-items: center !important;
        row-gap: 0 !important;
        overflow-x: auto;
        overflow-y: hidden;
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
      .form-row.ui-field::-webkit-scrollbar,
      .rule-progress-card .field-row::-webkit-scrollbar,
      .rule-common-card .field-row::-webkit-scrollbar,
      .rule-specific-card .field-row::-webkit-scrollbar,
      .schedule-filter-card .form-row::-webkit-scrollbar,
      .system-card .form-row::-webkit-scrollbar,
      .schedule-filter-card .minirow::-webkit-scrollbar,
      .system-card .minirow::-webkit-scrollbar,
      .rule-progress-card .minirow::-webkit-scrollbar,
      .rule-common-card .minirow::-webkit-scrollbar,
      .rule-specific-card .minirow::-webkit-scrollbar,
      .system-virtual-row::-webkit-scrollbar {
        display: none;
      }
      .form-row.ui-field .form-label,
      .schedule-filter-card .form-label,
      .system-card .form-label,
      .rule-progress-card .form-label,
      .rule-common-card .form-label,
      .rule-specific-card .form-label,
      .schedule-filter-card .label,
      .system-card .label,
      .rule-progress-card .label,
      .rule-common-card .label,
      .rule-specific-card .label,
      .system-card-header-split > span,
      .sectionhead > h3 {
        white-space: nowrap !important;
        word-break: keep-all !important;
        overflow: visible !important;
        text-overflow: clip !important;
        flex: 1 1 auto !important;
        min-width: 0 !important;
      }
      .form-row.ui-field > .segmented,
      .form-row.ui-field > .stepper,
      .form-row.ui-field > .num-group,
      .form-row.ui-field > input[type="datetime-local"],
      .schedule-filter-card .form-row > .segmented,
      .schedule-filter-card .form-row > .stepper,
      .schedule-filter-card .minirow > .segmented,
      .schedule-filter-card .minirow > .num-group,
      .system-card .form-row > .segmented,
      .system-card .form-row > .stepper,
      .system-card .form-row > input[type="datetime-local"],
      .system-card .minirow > .segmented,
      .system-card .minirow > .num-group,
      .rule-progress-card .field-row > .segmented,
      .rule-progress-card .field-row > .stepper,
      .rule-progress-card .minirow > .segmented,
      .rule-progress-card .minirow > .num-group,
      .rule-common-card .field-row > .segmented,
      .rule-common-card .field-row > .stepper,
      .rule-common-card .minirow > .segmented,
      .rule-common-card .minirow > .num-group,
      .rule-specific-card .field-row > .segmented,
      .rule-specific-card .field-row > .stepper,
      .rule-specific-card .minirow > .segmented,
      .rule-specific-card .minirow > .num-group,
      .system-card-header-split > .segmented,
      .sectionhead > .segmented {
        flex: 0 0 auto !important;
        width: auto !important;
        min-width: 0 !important;
        max-width: none !important;
        margin-left: auto !important;
        align-self: center !important;
      }
      .preview-form-row {
        display: block !important;
        overflow: visible !important;
      }
      .preview-form-row .preview-form-label {
        display: block !important;
        margin: 0 0 10px 0 !important;
        white-space: nowrap !important;
      }
      .preview-form-control {
        display: block !important;
        width: 100% !important;
        max-width: 100% !important;
      }
      .preview-form-row .segmented,
      .preview-form-row #seg-view,
      .preview-form-row #seg-layout,
      .preview-form-row #seg-theme {
        display: inline-flex !important;
        width: auto !important;
        min-width: 0 !important;
        max-width: 100% !important;
        margin-left: 0 !important;
        justify-content: flex-start !important;
      }
      .preview-form-row .opt,
      .preview-form-row #seg-view .opt,
      .preview-form-row #seg-layout .opt,
      .preview-form-row #seg-theme .opt {
        white-space: nowrap !important;
      }
      @media (max-width: 460px) {
        .form-row.ui-field,
        .rule-progress-card .field-row,
        .rule-common-card .field-row,
        .rule-specific-card .field-row,
        .schedule-filter-card .form-row,
        .system-card .form-row,
        .schedule-filter-card .minirow,
        .system-card .minirow,
        .rule-progress-card .minirow,
        .rule-common-card .minirow,
        .rule-specific-card .minirow,
        .system-virtual-row {
          flex-direction: row !important;
          flex-wrap: nowrap !important;
          align-items: center !important;
        }
        .form-row.ui-field .form-label,
        .schedule-filter-card .form-label,
        .system-card .form-label,
        .rule-progress-card .form-label,
        .rule-common-card .form-label,
        .rule-specific-card .form-label,
        .schedule-filter-card .label,
        .system-card .label,
        .rule-progress-card .label,
        .rule-common-card .label,
        .rule-specific-card .label {
          width: auto !important;
          margin-right: 0 !important;
          padding-right: 8px !important;
          white-space: nowrap !important;
        }
        .preview-form-row {
          display: block !important;
        }
      }
      /* v2.11 final polish */
      .notify-event-head {
        align-items: center !important;
      }
      .notify-event-head > .segmented.narrow.two-col {
        display: inline-flex !important;
        flex-wrap: nowrap !important;
        justify-content: flex-start !important;
        align-self: center !important;
        width: auto !important;
        max-width: max-content !important;
        min-width: 0 !important;
        margin-left: auto !important;
        padding: 2px !important;
        border: 1px solid var(--border-color) !important;
        background: var(--bg-color) !important;
        box-sizing: border-box !important;
      }
      .notify-event-head > .segmented.narrow.two-col .opt {
        flex: 0 0 auto !important;
        width: auto !important;
        min-width: 0 !important;
        white-space: nowrap !important;
        padding: 6px 12px !important;
      }
      .status-banner {
        display: flex !important;
        justify-content: center !important;
        align-items: center !important;
      }
      #test-clock-wrap {
        display: flex;
        justify-content: center;
        align-items: center;
      }
      .ui-field.ui-field-list,
      .originalsin-card .ui-field-list {
        flex-direction: column !important;
        align-items: stretch !important;
        flex-wrap: wrap !important;
        overflow: visible !important;
      }
      .ui-field.ui-field-list > .form-label {
        white-space: normal !important;
        flex: none !important;
      }
      .osi-list-row .btn.del-btn,
      .osi-list-row.card-like .btn.del-btn {
        flex: 0 0 auto !important;
        width: auto !important;
        padding: 6px 12px !important;
        font-size: 12px !important;
      }
      .originalsin-card .field-row,
      .originalsin-card .form-row,
      .originalsin-card .ui-field {
        overflow-x: visible !important;
        overflow-y: visible !important;
      }
</style>
  </head>
  <body>
    <div id="toast"></div>
    <div id="confirm-dialog" class="glass-panel dialog-overlay" style="display:none;">
      <div class="dialog-box">
        <div id="confirm-msg" class="dialog-msg"></div>
        <div class="btnrow"><div class="btn secondary" onclick="closeConfirm()">キャンセル</div><div class="btn danger" id="confirm-ok-btn">削除</div></div>
      </div>
    </div>
    <div class="global-header topnav glass-panel">
      <div id="test-clock-wrap" class="status-banner ${initialHeaderModeClass}">
        <div id="test-clock-bar" class="test-clock-bar ${settings.testMode ? 'virtual' : 'current'}">
          <span id="test-clock-label">${initialHeaderLabelText}</span>: <span id="test-clock-time">${initialHeaderClockText}</span>
        </div>
      </div>
      <div class="tab-bar navwrap" id="navwrap">${initialNavButtonsHtml}</div>
    </div>
    <div id="screen-shards" class="screen" style="display:${getDisp('shards')};">
      <div class="screen-header">
        <div class="screen-title-wrap"><h2>ウィジェット設定</h2></div>
        <button class="help-entry-btn" onclick="openHelp('shards')">この画面の使い方 (?)</button>
      </div>
      <div class="screen-subnote">この試作では、見た目の変更がその場で反映される前提で確認します。</div>
      <div class="section preview-stage">
        <div class="preview-stage-meta">
          <div class="preview-stage-title">ウィジェットの見え方</div>
          <div class="preview-stage-note">実際のカード余白に近い形で確認します。</div>
        </div>
        <div class="preview-stage-canvas">
          <div id="dynamic-grid">
          ${generateCardsHtml(initialImages, settings)}
        </div>
        </div>
      </div>
      <div class="settings-container" id="panel">
      <div class="settings-header">
        <div>
          <div class="settings-title">見た目の調整</div>
          <div class="rule-subnote" style="margin-top:6px;">表示形式・レイアウト・テーマをまとめて整えます。</div>
        </div>
      </div>
      <div class="settings-scroll preview-control-grid" id="panel-scroll">
      ${buildCommonSettingsHtml(settings)}
      </div>
      </div>
    </div>
    </div><!-- end screen-shards -->
    <div id="screen-notify" class="screen" style="display:${getDisp('notify')};">
      <div class="screen-header">
        <div class="screen-title-wrap"><h2>お知らせルール</h2></div>
        <button class="help-entry-btn" onclick="openHelp('notify')">この画面の使い方 (?)</button>
      </div>
      <div class="screen-subnote">恒久的な設定と、その日の進行状況が混ざらないように分けて表示します。</div>
      <div class="segmented notify-tab-grid event-switcher" style="width: 100%; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px; margin-bottom: 16px;">
        ${orderedSectionSpecs.map((spec, i) => `<div class="opt ${i===0?'selected':''}" onclick="switchNotifyTab('${spec.type}', this)">${spec.title}</div>`).join('')}
      </div>
      ${orderedSectionSpecs.map((spec, i) => renderEventSection(spec, i)).join('')}
    </div>
    <div id="screen-data" class="screen" style="display:${getDisp('data')};">
      <div class="screen-header">
        <div class="screen-title-wrap"><h2>システムとデータ</h2></div>
        <button class="help-entry-btn" onclick="openHelp('data')">この画面の使い方 (?)</button>
      </div>
      <div class="screen-subnote">本番 / テストの状態、保存データ、危険操作を混ぜずに確認できるよう整理しています。</div>
      <div class="section zone-virtual system-card">
        <div class="card-header system-card-header-split">
          <span>タイムトラベル（テストモード）</span>
          ${renderToggleHtml(settings.testMode, `setTestMode(true, this)`, `setTestMode(false, this)`, "オン", "オフ")}
        </div>
        <div id="test-mode-row" class="system-expand-stack" style="display:${settings.testMode ? 'block' : 'none'}; margin-top:12px;">
          <div class="form-row system-virtual-row">
            <span class="form-label">トラベル先の時間</span>
            <input class="input-datetime system-datetime-input" style="width:180px;" type="datetime-local" id="test-time-input" value="${initialTestTimeStr}" ${settings.testMode ? '' : 'disabled'} onchange="applyTestTimeAuto(this)">
          </div>
        </div>
        <div class="rule-subnote" style="margin-top:12px;">
          ※時間を進めると、アプリの中の時間もすぐに進みます。<br>
          ※「オフ」に戻すと、現実の空（いまの時間）に戻ります。
        </div>
      </div>
      <div class="section system-card">
        <h3>海外との時差設定</h3>
        <div class="minirow">
          <div class="label">時差の合わせ方</div>
          <div class="segmented narrow">
            <div class="opt ${settings.localOffsetAuto !== false ? 'selected' : ''}" onclick="setLocalOffsetAuto(true, this)">自動(端末)</div>
            <div class="opt ${settings.localOffsetAuto === false ? 'selected' : ''}" onclick="setLocalOffsetAuto(false, this)">手動</div>
          </div>
        </div>
        <div id="manual-offset-row" style="display:${settings.localOffsetAuto !== false ? 'none' : 'flex'}; flex-direction:column; margin-top:12px;">
          ${buildUiFieldHtml({ label: "世界標準時(UTC)からのズレ", path: "localOffset", def: 9, value: num(settings.localOffset, 9) })}
        </div>
      </div>
      <div class="section system-card">
        <h3>地方の上書き設定</h3>
        <div class="rule-subnote" style="margin-bottom:12px;">通常は自動で判定されます。必要なときだけ、今日の地方表示を手動で上書きできます。</div>
        <div class="rule-subnote" style="margin-bottom:12px;">ここは自動保存されません。保存ボタンを押すまでは反映されず、大キャンとデイリーを同じ地方にはできません。</div>
        <div id="realm-override-fields">${buildRealmDisplayHtml(settings)}</div>
        <div class="btnrow system-copy-row" style="flex-wrap:wrap; gap:8px; margin-top:12px;">
          <div class="btn secondary" id="btn-save-realm-overrides" onclick="saveRealmOverrides(this)">地方の上書きを保存</div>
        </div>
      </div>
      <div class="section system-card">
        <h3>通知プリセット</h3>
        <div class="rule-subnote">よく使う通知構成を一括で適用します。細かい設定はあとから個別に調整できます。</div>
        <div class="system-action-grid" style="margin-top:12px; grid-template-columns:repeat(2,minmax(0,1fr));">
          <div class="btn secondary" onclick="sendCommand('scriptable-applypreset://standard', this)">標準</div>
          <div class="btn secondary" onclick="sendCommand('scriptable-applypreset://minimum', this)">最低限</div>
          <div class="btn secondary" onclick="sendCommand('scriptable-applypreset://farm', this)">周回重視</div>
          <div class="btn secondary" onclick="sendCommand('scriptable-applypreset://originalsin', this)">原罪重視</div>
        </div>
      </div>
      <div class="section system-card">
        <h3>画像の管理</h3>
        <div class="system-stack-actions">
          <div class="btn secondary del-btn" id="clearAndReloadImages">画像を新しく読み込みなおす</div>
          <div class="btn danger del-btn" onclick="confirmDelete('IMAGES', '画像キャッシュ', this)">画像の保存データを整理</div>
        </div>
        <div class="rule-subnote" style="margin-top:12px;">${settings.imageAutoFetchEnabled === false ? '前回の画像取得に失敗したため、自動画像取得は停止中です。必要なときだけ上の読み込みボタンで再実行します。' : '画像が不足しているときは、起動時に自動で取得します。失敗した場合は自動取得を停止し、手動読み込みだけに切り替えます。'} </div>
      </div>
      <div class="section system-card">
        <h3>GitHubアップデート</h3>
        <div class="rule-subnote">起動時にGitHub上の分割ファイルを確認し、更新があればScriptable内のフォルダに保存してから実行します。</div>
        <div class="minirow" style="margin-top:12px;">
          <div class="label">更新タイミング</div>
          <div class="segmented narrow">
            <div class="opt ${(settings.githubUpdate?.policy || 'daily') === 'none' ? 'selected' : ''}" onclick="handleSettingChange('githubUpdate.policy', 'none', this)">更新しない</div>
            <div class="opt ${(settings.githubUpdate?.policy || 'daily') === 'daily' ? 'selected' : ''}" onclick="handleSettingChange('githubUpdate.policy', 'daily', this)">24時間</div>
            <div class="opt ${(settings.githubUpdate?.policy || 'daily') === 'always' ? 'selected' : ''}" onclick="handleSettingChange('githubUpdate.policy', 'always', this)">毎回</div>
          </div>
        </div>
        <div class="system-stack-actions" style="margin-top:12px;">
          <div class="btn secondary" onclick="sendCommand('scriptable-githubupdatenow://1', this)">今すぐ更新</div>
        </div>
        <div class="form-row" style="margin-top:12px; align-items:stretch; flex-direction:column;">
          <span class="form-label">GitHub manifest URL</span>
          <input class="input-text" style="width:100%; box-sizing:border-box;" type="url" value="${escapeHtml(settings.githubUpdate?.remoteManifestUrl || 'https://raw.githubusercontent.com/Hajime-Sky/Sky-source/main/SkyReminderModules/manifest.json')}" onchange="handleSettingChange('githubUpdate.remoteManifestUrl', this.value, this)">
        </div>
        <div class="rule-subnote" style="margin-top:12px;">最終確認: ${settings.githubUpdate?.lastCheckedAtMs ? F.localFullFormat(new Date(Number(settings.githubUpdate.lastCheckedAtMs)), settings) : '未実行'} / 状態: ${escapeHtml(settings.githubUpdate?.lastUpdateStatus || '未実行')}</div>
      </div>
      <div class="section system-card">
        <h3>設定のインポート / エクスポート</h3>
        <div class="rule-subnote">画像以外のキーチェーンを丸ごとバックアップします。読み込みは選択中の保存先にある最新バックアップを使い、データを書き換えたあと通常実行と同じように再スケジューリングします。</div>
        <div class="minirow" style="margin-top:12px;">
          <div class="label">バックアップ保存先</div>
          <div class="segmented narrow">
            <div class="opt ${settings.backupStorageMode !== 'local' ? 'selected' : ''}" onclick="handleSettingChange('backupStorageMode', 'iCloud', this)">iCloud</div>
            <div class="opt ${settings.backupStorageMode === 'local' ? 'selected' : ''}" onclick="handleSettingChange('backupStorageMode', 'local', this)">local</div>
          </div>
        </div>
        <div class="rule-subnote" id="settings-backup-path-note" style="margin-top:12px;">現在の保存先: ${settings.backupStorageMode === 'local' ? 'local' : 'iCloud'} / ${SETTINGS_BACKUP_DIRNAME}</div>
        <div class="btnrow system-copy-row" style="flex-wrap:wrap; gap:8px; margin-top:12px;">
          <div class="btn small del-btn" style="flex:1;" onclick="sendCommand('scriptable-settingsexport://', this)">バックアップを書き出す</div>
          <div class="btn small secondary" style="flex:1; margin-top:0;" onclick="sendCommand('scriptable-settingsimport://', this)">最新バックアップを読み込む</div>
        </div>
      </div>
      <div class="section system-card">
        <h3>データの管理</h3>
        <div class="minirow">
          <div class="label">アプリの動きを軽くする(一時保存)</div>
          ${renderToggleHtml(settings.useCache !== false, "handleSettingChange('useCache', true, this)", "handleSettingChange('useCache', false, this)", "オン", "オフ")}
        </div>
        <div class="rule-subnote" style="margin-top:12px;">特定のデータだけ消したいときは、下のボタンから個別に整理できます。</div>
        <div class="system-action-grid" style="margin-top:12px;">
          <div class="btn danger del-btn" onclick="confirmDelete('${KEYCHAIN_KEY}', '設定データ', this)">設定データ</div>
          <div class="btn danger del-btn" onclick="confirmDelete('RUNSTATE', '完了状態', this)">完了状態</div>
          <div class="btn danger del-btn" onclick="confirmDelete('${getDisabledNotiKey(settings)}', 'オフリスト', this)">オフリスト</div>
          <div class="btn danger del-btn" onclick="confirmDelete('${CACHE_KEY}', 'キャッシュ', this)">キャッシュ</div>
        </div>
        <div class="btnrow system-copy-row" style="flex-wrap:wrap; gap:8px; margin-top:12px;">
          <div class="btn small del-btn" id="btn-copykeychain" style="flex: 1;" onclick="sendCommand('scriptable-keychaincopy://', this)">すべてのデータをコピー</div>
          <div class="btn small secondary" id="btn-openkeychain" style="flex: 1; margin-top:0;" onclick="openKeychainOverlay()">全体表示</div>
          <div class="btn small secondary" id="btn-copyhtml" style="flex: 1 1 100%; margin-top:0;" onclick="sendCommand('scriptable-htmlcopy://', this)">現在のHTMLを書き出す</div>
        </div>
        <pre class="keychain-pre" id="keychain-pre"></pre>
      </div>
      <div class="section zone-destructive system-card">
        <h3>[危険] データの初期化</h3>
        <div class="danger-note">これらの操作は元に戻せません。進行状況のリセットと全削除を分けて置いています。</div>
        <div class="system-danger-stack">
          <div class="btn danger" onclick="resetToday('all', this)">今日の記録をすべてリセット</div>
          <div class="btn danger" onclick="confirmDelete('ALL', 'すべてのデータ', this)">すべてのデータを完全に削除</div>
        </div>
      </div>
    </div>
    <div id="screen-intro" class="screen" style="display:${getDisp('intro')};">
      <div class="screen-header">
        <div class="screen-title-wrap"><h2>はじめに</h2></div>
      </div>
      <div class="screen-subnote">最初に見る順番と、各画面で何をするかだけを短く追えるようにしています。</div>
      <div class="section intro-hero-card">
        <h3>使い始める前に</h3>
        <div class="rule-subnote intro-copy">
          この画面は導入専用です。まず見た目、次にルール、そのあと実際の予定を確認し、最後にシステム設定へ進みます。
        </div>
        ${buildYouTubeEmbedHtml(HELP_VIDEO_IDS.intro, "はじめにの動画", true)}
      </div>
      <div class="section">
        <h3>触る順番の目安</h3>
        <div class="intro-step-list">
          <div class="intro-step-card">
            <div class="intro-step-num">1</div>
            <div class="intro-step-body"><div class="intro-step-title">ウィジェット設定</div><div class="intro-step-copy">見た目と表示形式を決めます。</div></div>
          </div>
          <div class="intro-step-card">
            <div class="intro-step-num">2</div>
            <div class="intro-step-body"><div class="intro-step-title">お知らせルール</div><div class="intro-step-copy">イベントごとの条件と、その日の進行を整えます。</div></div>
          </div>
          <div class="intro-step-card">
            <div class="intro-step-num">3</div>
            <div class="intro-step-body"><div class="intro-step-title">予定表</div><div class="intro-step-copy">これから届くものと、お休み中を確認します。</div></div>
          </div>
          <div class="intro-step-card">
            <div class="intro-step-num">4</div>
            <div class="intro-step-body"><div class="intro-step-title">システム</div><div class="intro-step-copy">テストモードや保存データの整理だけを扱います。</div></div>
          </div>
        </div>
      </div>
      <div class="section">
        <h3>画面の役割</h3>
        <div class="intro-role-list">
          <div class="intro-role-chip">見た目はウィジェット設定</div>
          <div class="intro-role-chip">条件はお知らせルール</div>
          <div class="intro-role-chip">一覧は予定表</div>
          <div class="intro-role-chip">管理はシステム</div>
        </div>
      </div>
    </div>
    <div id="screen-help" class="screen" style="display:none;">
      <div id="help-content-container" style="display:none;"></div>
    </div>
    <div id="screen-manage" class="screen" style="display:${getDisp('manage')};">
      <div class="screen-header">
        <div class="screen-title-wrap"><h2>これからのお知らせ</h2></div>
        <button class="help-entry-btn" onclick="openHelp('manage')">この画面の使い方 (?)</button>
      </div>
      <div class="screen-subnote">これから届くものと、お休み中のものを分けて確認できます。</div>
      <div class="section schedule-filter-card">
        <div class="minirow">
          <div class="label">表示フィルタ</div>
          <div class="segmented narrow">
            <div class="opt selected" onclick="filterManage('all', this)">すべて</div>
            <div class="opt" onclick="filterManage('on', this)">オンのみ</div>
            <div class="opt" onclick="filterManage('off', this)">お休みのみ</div>
          </div>
        </div>
        <div class="schedule-subtools">
          <div class="btn secondary small" onclick="manageRefresh(this)">最新にする</div>
          <div class="segmented narrow">
            <div class="opt selected" onclick="setManageIncludeTest(false, this)">テスト非表示</div>
            <div class="opt" onclick="setManageIncludeTest(true, this)">テスト表示</div>
          </div>
        </div>
      </div>
      <div class="section schedule-section" id="manage-section-on">
        <div class="schedule-state-head">
          <h3>これからのお知らせ</h3>
          <div class="pill" id="manage-count">0件</div>
        </div>
        <div class="schedule-subtools schedule-select-row">
          <div class="btn secondary small" onclick="manageSelectAll(true, this)">全選択</div>
          <div class="btn secondary small" onclick="manageSelectAll(false, this)">全解除</div>
        </div>
        <div class="schedule-batch-row">
          <div class="btn danger" onclick="manageToggleSelected(this, '#manage-list .manage-cb:checked', 'scriptable-notif-disable://')">選んだものをお休み</div>
          <div class="btn danger" onclick="manageDisableAll(this)">すべてお休み</div>
        </div>
        <div class="schedule-thread-wrap" id="manage-threads-wrap" style="display:none;">
          <div class="thread-help">スレッド単位でまとめて選ぶ</div>
          <div class="manage-controls schedule-thread-chips" id="manage-threads"></div>
        </div>
        <div class="manage-list schedule-list" id="manage-list">
          <div class="loading-state">星の記録を読み込んでいます…🕊️</div>
        </div>
      </div>
      <div class="section schedule-section" id="manage-section-off">
        <div class="schedule-state-head">
          <h3>お休み中のお知らせ</h3>
          <div class="pill" id="manage-disabled-count">0件</div>
        </div>
        <div class="schedule-subtools schedule-select-row">
          <div class="btn secondary small" onclick="manageSelectAll(true, this)">全選択</div>
          <div class="btn secondary small" onclick="manageSelectAll(false, this)">全解除</div>
        </div>
        <div class="schedule-batch-row schedule-batch-row-single">
          <div class="btn secondary" onclick="manageToggleSelected(this, '#manage-disabled-list .manage-cb:checked', 'scriptable-notif-enable://')">選んだものをオン</div>
        </div>
        <div class="manage-list schedule-list" id="manage-disabled-list">
          <div class="empty-state">お休み中の予定はありません</div>
        </div>
      </div>
    </div>
    <div id="help-overlay" class="overlay">
      <div class="screen-header">
        <div class="screen-title-wrap"><h2>この画面の使い方</h2></div>
        <button class="help-entry-btn" onclick="closeHelp()">閉じる</button>
      </div>
      <div class="overlay-card">
        <div id="help-text-content" style="line-height:1.6;"></div>
      </div>
    </div>
    <div id="keychain-overlay" class="overlay">
      <div class="screen-header">
        <div class="screen-title-wrap"><h2>キーチェーン全体表示</h2></div>
        <button class="help-entry-btn" onclick="closeKeychainOverlay()">閉じる</button>
      </div>
      <div class="overlay-card wide">
        <pre class="keychain-overlay-pre" id="keychain-overlay-pre"></pre>
      </div>
    </div>
<script>
      function confirmDelete(key, label, el) {
        var msg = label + " を削除しますか？\\nこの操作は元に戻せません。";
        var msgEl = document.getElementById('confirm-msg');
        if (msgEl) msgEl.innerText = msg;
        var dialog = document.getElementById('confirm-dialog');
        if (dialog) dialog.style.display = 'flex';
        var okBtn = document.getElementById('confirm-ok-btn');
        if (okBtn) {
          okBtn.onclick = function() {
            closeConfirm();
            if (key === 'ALL') {
              sendCommand('scriptable-deleteallkeychain://', el);
            } else if (key === 'IMAGES') {
              sendCommand('scriptable-deleteimages://', el);
            } else {
              sendCommand('scriptable-deletekeychain://' + key, el);
            }
          };
        }
      }
      function closeConfirm() {
        var dialog = document.getElementById('confirm-dialog');
        if (dialog) dialog.style.display = 'none';
      }
      var __toastTimer = null;
      function toast(msg, ms){
        try {
          ms = (typeof ms === 'number' && ms > 0) ? ms : 1400;
          var t = document.getElementById('toast');
          if (!t) return;
          t.textContent = String(msg || '');
          t.classList.add('show');
          if (__toastTimer) clearTimeout(__toastTimer);
          __toastTimer = setTimeout(function(){
            t.classList.remove('show');
          }, ms);
        } catch (e) {}
      }
function pulse(el, kind){
  try{
    if(!el) return;
    var cls = (kind==='err') ? 'flash-err' : 'flash-ok';
    el.classList.remove('flash-ok'); el.classList.remove('flash-err');
    void el.offsetWidth;
    el.classList.add(cls);
    setTimeout(function(){ try{ el.classList.remove(cls); }catch(_){} }, 650);
  }catch(e){}
}
function selectTab(el) {
  try {
    if (el && el.parentElement && el.parentElement.children) {
      Array.from(el.parentElement.children).forEach(function(c){
        c.classList.remove('selected');
        c.classList.remove('active');
      });
      el.classList.add((el.classList && el.classList.contains('navbtn')) ? 'active' : 'selected');
    }
  } catch(_) {}
}
function _getLimitBounds(el) {
  var minVal = Number(numberLimits && numberLimits.MIN);
  var maxVal = Number(numberLimits && numberLimits.MAX);
  if (!Number.isFinite(minVal)) minVal = -99;
  if (!Number.isFinite(maxVal)) maxVal = 99;
  if (el && el.dataset) {
    if (el.dataset.min != null) minVal = Number(el.dataset.min);
    if (el.dataset.max != null) maxVal = Number(el.dataset.max);
  }
  return { min: minVal, max: maxVal };
}
var __cmdQueue = [];
var __cmdBusy = false;
var _cmdSeq = 0;
var _lastCompletedSeq = 0;
function __buildCommandUrl(baseUrl, payload){
  var u = String(baseUrl || '');
  if (payload !== undefined) {
    var p = payload;
    try { if (typeof p !== 'string') p = JSON.stringify(p); } catch(e) { p = String(p); }
    u += encodeURIComponent(p);
  }
  return u;
}
function __appendCommandSeq(url, seq){
  var u = String(url || '');
  return u + (u.indexOf('?') >= 0 ? '&' : '?') + '_seq=' + encodeURIComponent(String(seq || 0));
}
function __drainCmdQueue(){
  if (__cmdBusy) return;
  if (!__cmdQueue.length) return;
  __cmdBusy = true;
  var item = __cmdQueue.shift();
  try { window.location.href = item.url; } catch(e) {}
  setTimeout(function(){
    __cmdBusy = false;
    __drainCmdQueue();
  }, item.gap);
}
function sendCommand(baseUrl, element, payload, delay){
  var gap = (typeof delay === 'number' && delay >= 0) ? delay : 50;
  gap = Math.max(50, gap);
  try{
    _cmdSeq++;
    var currentSeq = _cmdSeq;
    var url = __appendCommandSeq(__buildCommandUrl(baseUrl, payload), currentSeq);
    __cmdQueue.push({ url: url, gap: gap, seq: currentSeq });
    setTimeout(__drainCmdQueue, 0);
  }catch(e){
    try{
      _cmdSeq++;
      __cmdQueue.push({ url: __appendCommandSeq(String(baseUrl || ''), _cmdSeq), gap: gap, seq: _cmdSeq });
      setTimeout(__drainCmdQueue, 0);
    }catch(_){}
  }
}
window.__APP_CONTEXT = ${JSON.stringify(__appContext)};
      var currentSettings = window.__APP_CONTEXT.settings || {};
      var pendingSettings = (function(s){ try { return JSON.parse(JSON.stringify(s||{})); } catch(e){ return Object.assign({}, s||{}); } })(currentSettings);
      var numberLimits = window.__APP_CONTEXT.numberLimits || {};
      var testModeOffset = ${Number(settings.testOffsetMs) || 0};
      var isTestMode = ${!!settings.testMode};
      var TimeCoreFront = {
        getOffsetMs: function() {
          return Number(currentSettings.localOffset != null ? currentSettings.localOffset : 9) * 3600000;
        },
        toLocalUIMs: function(virtualMs) {
          var off = TimeCoreFront.getOffsetMs();
          return virtualMs + off;
        },
        fromLocalUIMs: function(localMs) {
          var off = TimeCoreFront.getOffsetMs();
          return localMs - off;
        },
        _getParts: function(virtualMs) {
          var ld = new Date(TimeCoreFront.toLocalUIMs(virtualMs));
          return {
            y: ld.getUTCFullYear(),
            m: String(ld.getUTCMonth()+1).padStart(2,'0'),
            d: String(ld.getUTCDate()).padStart(2,'0'),
            h: String(ld.getUTCHours()).padStart(2,'0'),
            mi: String(ld.getUTCMinutes()).padStart(2,'0'),
            s: String(ld.getUTCSeconds()).padStart(2,'0')
          };
        },
        formatForInput: function(virtualMs) {
          var p = this._getParts(virtualMs);
          return p.y + '-' + p.m + '-' + p.d + 'T' + p.h + ':' + p.mi;
        },
        formatForClock: function(virtualMs) {
          var p = this._getParts(virtualMs);
          return p.y + '/' + p.m + '/' + p.d + ' ' + p.h + ':' + p.mi + ':' + p.s;
        },
        parseInputToOffset: function(str) {
          var s = String(str || '');
          if (s.length < 16) return NaN;
          var y = parseInt(s.slice(0,4), 10);
          var m = parseInt(s.slice(5,7), 10) - 1;
          var d = parseInt(s.slice(8,10), 10);
          var h = parseInt(s.slice(11,13), 10);
          var mi = parseInt(s.slice(14,16), 10);
          if (![y,m,d,h,mi].every(function(v){ return Number.isFinite(v); })) return NaN;
          var localMs = Date.UTC(y, m, d, h, mi, 0);
          var virtualMs = TimeCoreFront.fromLocalUIMs(localMs);
          return virtualMs - Date.now();
        }
      };
      function updateTestClock() {
        var nowMs = Date.now();
        var displayMs = isTestMode ? (nowMs + testModeOffset) : nowMs;
        var str = TimeCoreFront.formatForClock(displayMs);
        var timeEl = document.getElementById('test-clock-time');
        var labelEl = document.getElementById('test-clock-label');
        var barEl = document.getElementById('test-clock-bar');
        var wrapEl = document.getElementById('test-clock-wrap');
        if (timeEl) timeEl.textContent = str;
        if (labelEl) labelEl.textContent = isTestMode ? '仮想時刻' : '現在時刻';
        if (barEl) {
          barEl.classList.remove('current', 'virtual');
          barEl.classList.add(isTestMode ? 'virtual' : 'current');
        }
        if (wrapEl) {
          wrapEl.classList.remove('mode-real', 'mode-virtual');
          wrapEl.classList.add(isTestMode ? 'mode-virtual' : 'mode-real');
        }
      }
      function adjustHeaderPadding() {
        requestAnimationFrame(function() {
          var header = document.querySelector('.global-header');
          var footer = document.getElementById('footerbar');
          var headerH = header ? Math.ceil(header.getBoundingClientRect().height) : 0;
          var footerH = (footer && footer.style.display !== 'none' && !isOverlayActive()) ? Math.ceil(footer.getBoundingClientRect().height) : 0;
          document.documentElement.style.setProperty('--global-header-offset', headerH + 'px');
          document.documentElement.style.setProperty('--global-footer-offset', footerH + 'px');
        });
      }
      setInterval(updateTestClock, 1000); updateTestClock();
function updateRemainBadges(){
  try{
    var appCtx = window.__APP_CONTEXT || {};
    var info = appCtx.remainInfo || {};
    Object.keys(info).forEach(function(tp){
      var sec = document.getElementById('notify-sec-' + String(tp));
      var countNum = document.getElementById('count-num-' + String(tp));
      var remainNum = document.getElementById('remain-num-' + String(tp));
      var remainChip = document.getElementById('remain-chip-' + String(tp));
      if (sec && sec.dataset && sec.dataset.hideRemain === '1') {
        if (remainChip) remainChip.style.display = 'none';
      } else if (remainChip) {
        remainChip.style.display = '';
      }
      var it = info[tp] || {};
      var remain = Number(it.remain || 0);
      var limit = Number(it.limit || 0);
      var count = Number(it.count || 0);
      if (countNum) countNum.textContent = String(count);
      if (remainNum) remainNum.textContent = (limit > 0) ? String(remain) : '—';
      if (remainChip) {
        remainChip.classList.toggle('highlight', limit > 0);
        remainChip.title = (limit > 0)
          ? ('完了 ' + String(count) + '/' + String(limit) + ' (' + (appCtx.remainLaKey||'') + ')')
          : ('オフ または 開催なし (' + (appCtx.remainLaKey||'') + ')');
      }
    });
  }catch(e){}
}
var currentScreen = "${initialScreen}";
var screenHistory = [];
var SCREEN_HOOKS = {
  'data': function() { try { sendCommand('scriptable-keychain://1'); } catch(_) {} },
  'manage': function() { try { manageRefresh(); } catch(_) {} },
  'intro': function() { try { activateVideoSlots(document.getElementById('screen-intro')); } catch(_) {} }
};
function buildTopNav(){
  try{
    var wrap = document.getElementById('navwrap');
    if (!wrap) return;
    if (wrap.children && wrap.children.length) {
      updateTestClock();
      return;
    }
    var appCtx = window.__APP_CONTEXT || {};
    var defs = Array.isArray(appCtx.navScreens) ? appCtx.navScreens : [];
    var labelHtmlMap = { shards: 'ウィジェット', notify: 'お知らせ<br>ルール', manage: '予定表', data: 'システム', intro: 'はじめに' };
    wrap.innerHTML = '';
    defs.forEach(function(def){
      var id = String(def && def.id || '');
      if (!id) return;
      var btn = document.createElement('div');
      btn.className = 'navbtn tab-btn';
      btn.id = 'btn-' + id;
      btn.innerHTML = '<span>' + String(labelHtmlMap[id] || def.label || id) + '</span>';
      btn.onclick = function(){ setScreen(id); };
      wrap.appendChild(btn);
    });
    updateTestClock();
  }catch(_){}
}
function buildHelpContents(){
  try{
    var container = document.getElementById('help-content-container');
    if (!container) return;
    var appCtx = window.__APP_CONTEXT || {};
    var defs = Array.isArray(appCtx.navScreens) ? appCtx.navScreens : [];
    container.innerHTML = '';
    defs.forEach(function(def){
      var id = String(def && def.id || '');
      if (!id) return;
      var el = document.createElement('div');
      el.id = 'help-text-' + id;
      el.style.display = 'none';
      el.innerHTML = String(def && def.helpText || '');
      container.appendChild(el);
    });
  }catch(_){}
}
function buildScreenHelpButtons(){
  return;
}
function buildYouTubeEmbedSrc(videoId){
  var safeId = String(videoId || '').replace(/[^A-Za-z0-9_-]/g, '');
  if (!safeId) return '';
  return 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(safeId) + '?playsinline=1&rel=0&modestbranding=1';
}
function activateVideoSlots(root){
  try{
    var scope = root || document;
    if (!scope || !scope.querySelectorAll) return;
    var slots = scope.querySelectorAll('.js-video-slot[data-video-id]');
    slots.forEach(function(slot){
      try{
        if (!slot || !slot.dataset) return;
        if (String(slot.dataset.videoLoaded || '0') === '1') return;
        var videoId = String(slot.dataset.videoId || '');
        if (!videoId) return;
        var src = buildYouTubeEmbedSrc(videoId);
        if (!src) return;
        slot.dataset.videoLoaded = '1';
        slot.innerHTML = '';
        var iframe = document.createElement('iframe');
        iframe.src = src;
        iframe.title = String(slot.dataset.videoTitle || '操作説明動画');
        iframe.referrerPolicy = 'strict-origin-when-cross-origin';
        iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
        iframe.setAttribute('allowfullscreen', '');
        iframe.style.position = 'absolute';
        iframe.style.inset = '0';
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        slot.appendChild(iframe);
      }catch(e){
      }
    });
  }catch(e){
  }
}
function isOverlayActive(){
  try{
    var help = document.getElementById('help-overlay');
    var keychain = document.getElementById('keychain-overlay');
    return !!((help && help.classList.contains('active')) || (keychain && keychain.classList.contains('active')));
  }catch(_){ return false; }
}
function applyScreen() {
  var activeTab = currentScreen;
  if (currentScreen === 'help' && screenHistory && screenHistory.length > 0) {
    activeTab = screenHistory[screenHistory.length - 1];
  }
  document.querySelectorAll('.screen').forEach(function(el) {
    var idName = 'screen-' + currentScreen;
    el.style.display = (el.id === idName) ? 'block' : 'none';
  });
  document.querySelectorAll('.navbtn').forEach(function(el) {
    var idName = 'btn-' + activeTab;
    el.classList.toggle('active', el.id === idName);
  });
  var footer = document.getElementById('footerbar');
  var hasFooter = false;
  var appCtx = window.__APP_CONTEXT || {};
  var defs = Array.isArray(appCtx.navScreens) ? appCtx.navScreens : [];
  for (var i = 0; i < defs.length; i++) {
    if (defs[i].id === currentScreen && defs[i].hasFooter) { hasFooter = true; break; }
  }
  if (footer) footer.style.display = (hasFooter && !isOverlayActive()) ? 'block' : 'none';
  try { adjustHeaderPadding(); } catch(_) {}
  try { window.scrollTo(0, 0); } catch(_) {}
}
function setScreen(s) {
  try {
    if (String(s || '') !== 'notify') sortOriginalSinListsOnLeave();
  } catch (_) {}
  closeHelp();
  closeKeychainOverlay();
  currentScreen = s;
  applyScreen();
  if (SCREEN_HOOKS[s]) SCREEN_HOOKS[s]();
}
function openHelp(targetScreen){
  try{
    sortOriginalSinListsOnLeave();
    closeKeychainOverlay();
    var id = String(targetScreen || currentScreen || 'shards');
    var appCtx = window.__APP_CONTEXT || {};
    var defs = Array.isArray(appCtx.navScreens) ? appCtx.navScreens : [];
    var msg = '';
    for (var i = 0; i < defs.length; i++) {
      if (String(defs[i] && defs[i].id || '') === id) {
        msg = String(defs[i] && defs[i].helpText || '');
        break;
      }
    }
    var content = document.getElementById('help-text-content');
    if (content) {
      content.innerHTML = msg;
      try { activateVideoSlots(content); } catch(_) {}
    }
    var overlay = document.getElementById('help-overlay');
    if (overlay) overlay.classList.add('active');
    try { applyScreen(); } catch(_) {}
  }catch(_){ }
}
function closeHelp(){
  var overlay = document.getElementById('help-overlay');
  if (overlay) overlay.classList.remove('active');
  try { applyScreen(); } catch(_) {}
}
function openKeychainOverlay(){
  var overlay = document.getElementById('keychain-overlay');
  if (!overlay) return;
  var src = document.getElementById('keychain-pre');
  var dst = document.getElementById('keychain-overlay-pre');
  if (dst && src) dst.textContent = src.textContent || '';
  overlay.classList.add('active');
  try { applyScreen(); } catch(_) {}
}
function closeKeychainOverlay(){
  var overlay = document.getElementById('keychain-overlay');
  if (overlay) overlay.classList.remove('active');
  try { applyScreen(); } catch(_) {}
}
function goBack(){
  closeHelp();
  closeKeychainOverlay();
}
      function updateSetting(path, value) {
        try {
          if (!pendingSettings || typeof pendingSettings !== 'object') pendingSettings = {};
          var parts = String(path || '').split('.').filter(Boolean);
          if (!parts.length) return;
          var obj = pendingSettings;
          for (var i = 0; i < parts.length - 1; i++) {
            var k = parts[i];
            if (!obj[k] || typeof obj[k] !== 'object') obj[k] = {};
            obj = obj[k];
          }
          obj[parts[parts.length - 1]] = value;
        } catch (e) {}
      }
      function _setObjectPath(root, path, value) {
        try {
          if (!root || typeof root !== 'object') return;
          var parts = String(path || '').split('.').filter(Boolean);
          if (!parts.length) return;
          var obj = root;
          for (var i = 0; i < parts.length - 1; i++) {
            var k = parts[i];
            if (!obj[k] || typeof obj[k] !== 'object') obj[k] = {};
            obj = obj[k];
          }
          obj[parts[parts.length - 1]] = value;
        } catch (_) {}
      }
      function _syncCurrentSetting(path, value) {
        try {
          if (!currentSettings || typeof currentSettings !== 'object') currentSettings = {};
          _setObjectPath(currentSettings, path, value);
        } catch (_) {}
      }
      function _getObjectPath(root, path) {
        try {
          var parts = String(path || '').split('.').filter(Boolean);
          var cur = root;
          for (var i = 0; i < parts.length; i++) {
            if (!cur) return null;
            cur = cur[parts[i]];
          }
          return cur;
        } catch (_) { return null; }
      }
      function _updateRealmDisplayFieldUI(fieldEl, settingsObj) {
        try {
          if (!fieldEl) return;
          var overridePath = String(fieldEl.getAttribute('data-override-path') || '');
          if (!overridePath) return;
          var labelEl = fieldEl.querySelector('.form-label');
          var options = Array.prototype.slice.call(fieldEl.querySelectorAll('.opt'));
          var map = { prairie: '草原', forest: '雨林', valley: '峡谷', waste: '捨て地', vault: '書庫' };
          var currentRealmKey = String(fieldEl.getAttribute('data-current-realm-key') || '');
          var overrideVal = _getObjectPath(settingsObj || pendingSettings, overridePath);
          if (overrideVal == null || overrideVal === '') overrideVal = null;
          var shownRealmKey = overrideVal || currentRealmKey;
          var realmJa = map[shownRealmKey] || '不明';
          var isForest = shownRealmKey === 'forest';
          if (labelEl) {
            labelEl.innerHTML = String(fieldEl.getAttribute('data-label-prefix') || '') + ': <b style="color:' + (isForest ? 'var(--color-active)' : 'var(--text-main)') + '">' + realmJa + '</b>' + (overrideVal ? ' <span style="font-size:11px; opacity:0.7;">(上書き中)</span>' : '');
          }
          options.forEach(function(opt){
            var value = String(opt.getAttribute('data-realm-value') || '');
            var selected = (overrideVal ? overrideVal === value : currentRealmKey === value);
            opt.classList.toggle('selected', selected);
          });
        } catch (_) {}
      }
      function refreshRealmDisplayUI(settingsObj) {
        try {
          document.querySelectorAll('.realm-display-field').forEach(function(fieldEl){
            _updateRealmDisplayFieldUI(fieldEl, settingsObj || pendingSettings);
          });
        } catch (_) {}
      }
      function _normalizeOriginalSinList(path, value) {
        var key = String(path || '');
        var arr = Array.isArray(value) ? value : [];
        if (key.indexOf('fixedTimes') !== -1) {
          return arr.slice(0, 10).map(function(item){
            var rawHour = item && (item.hour != null ? item.hour : item.h);
            var rawMinute = item && (item.minute != null ? item.minute : item.m);
            var hasHour = rawHour != null && String(rawHour) !== '';
            var hasMinute = rawMinute != null && String(rawMinute) !== '';
            if (!hasHour || !hasMinute) return { hour: null, minute: null };
            return {
              hour: Math.max(0, Math.min(23, Math.round(Number(rawHour) || 0))),
              minute: Math.max(0, Math.min(59, Math.round(Number(rawMinute) || 0)))
            };
          });
        }
        return arr.slice(0, 10).map(function(item){
          var rawTotal = item && (item.minutesAfterReset != null ? item.minutesAfterReset : item.afterResetMinutes);
          var hasTotal = rawTotal != null && String(rawTotal) !== '';
          if (!hasTotal) return { minutesAfterReset: null };
          return {
            minutesAfterReset: Math.max(0, Math.min(4320, Math.round(Number(rawTotal) || 0)))
          };
        });
      }
      function _getOriginalSinSortBaseMinutes() {
        try {
          var appCtx = window.__APP_CONTEXT || {};
          var baseUtcMs = Number(appCtx.originalSinResetBaseUtcMs || 0);
          var offMs = TimeCoreFront.getOffsetMs();
          if (!Number.isFinite(baseUtcMs) || !Number.isFinite(offMs) || baseUtcMs <= 0) return 16 * 60;
          var ld = new Date(baseUtcMs + offMs);
          return (ld.getUTCHours() * 60) + ld.getUTCMinutes();
        } catch (_) {
          return 16 * 60;
        }
      }
      function _sortOriginalSinFixedTimes(list) {
        try {
          var baseMin = _getOriginalSinSortBaseMinutes();
          return (Array.isArray(list) ? list.slice() : []).sort(function(a, b){
            var aBlank = !(a && a.hour != null && a.minute != null && String(a.hour) !== '' && String(a.minute) !== '');
            var bBlank = !(b && b.hour != null && b.minute != null && String(b.hour) !== '' && String(b.minute) !== '');
            if (aBlank && bBlank) return 0;
            if (aBlank) return 1;
            if (bBlank) return -1;
            var am = ((Number(a && a.hour || 0) * 60) + Number(a && a.minute || 0)) % 1440;
            var bm = ((Number(b && b.hour || 0) * 60) + Number(b && b.minute || 0)) % 1440;
            var ad = (am - baseMin + 1440) % 1440;
            var bd = (bm - baseMin + 1440) % 1440;
            return ad - bd || am - bm;
          });
        } catch (_) {
          return Array.isArray(list) ? list.slice() : [];
        }
      }
      function _sortOriginalSinSinceResetTimes(list) {
        try {
          return (Array.isArray(list) ? list.slice() : []).sort(function(a, b){
            var aBlank = !(a && a.minutesAfterReset != null && String(a.minutesAfterReset) !== '');
            var bBlank = !(b && b.minutesAfterReset != null && String(b.minutesAfterReset) !== '');
            if (aBlank && bBlank) return 0;
            if (aBlank) return 1;
            if (bBlank) return -1;
            return Number(a && a.minutesAfterReset || 0) - Number(b && b.minutesAfterReset || 0);
          });
        } catch (_) {
          return Array.isArray(list) ? list.slice() : [];
        }
      }
      function _isOriginalSinTabActive() {
        try {
          if (String(currentScreen || '') !== 'notify') return false;
          var sec = document.getElementById('notify-sec-originalSin');
          if (!sec) return false;
          return sec.style.display !== 'none';
        } catch (_) {
          return false;
        }
      }
      function sortOriginalSinListsOnLeave() {
        try {
          if (!_isOriginalSinTabActive()) return false;
          var fixedPath = 'notify.originalSin.fixedTimes';
          var offsetPath = 'notify.originalSin.sinceResetTimes';
          var fixedCur = _normalizeOriginalSinList(fixedPath, _getObjectPath(pendingSettings, fixedPath) || []);
          var offsetCur = _normalizeOriginalSinList(offsetPath, _getObjectPath(pendingSettings, offsetPath) || []);
          var fixedSorted = _sortOriginalSinFixedTimes(fixedCur);
          var offsetSorted = _sortOriginalSinSinceResetTimes(offsetCur);
          var changed = JSON.stringify(fixedCur) !== JSON.stringify(fixedSorted) || JSON.stringify(offsetCur) !== JSON.stringify(offsetSorted);
          if (!changed) return false;
          updateSetting(fixedPath, fixedSorted);
          updateSetting(offsetPath, offsetSorted);
          _syncCurrentSetting(fixedPath, fixedSorted);
          _syncCurrentSetting(offsetPath, offsetSorted);
          if (_saveDebounceTimer) { clearTimeout(_saveDebounceTimer); _saveDebounceTimer = null; }
          save(null);
          return true;
        } catch (_) {
          return false;
        }
      }
      function renderOriginalSinListFields(settingsObj) {
        try {
          document.querySelectorAll('.osi-list-field').forEach(function(fieldEl){
            var path = String(fieldEl.getAttribute('data-list-path') || '');
            var kind = String(fieldEl.getAttribute('data-list-kind') || '');
            var pathAttr = path.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
            var list = _normalizeOriginalSinList(path, _getObjectPath(settingsObj || pendingSettings, path) || []);
            var html = '';
            if (kind === 'time') {
              html = list.map(function(item, idx){
                var hh = (item && item.hour != null && String(item.hour) !== '') ? String(item.hour).padStart(2, '0') : '';
                var mm = (item && item.minute != null && String(item.minute) !== '') ? String(item.minute).padStart(2, '0') : '';
                var timeVal = (hh && mm) ? (hh + ':' + mm) : '';
                return '<div class="osi-list-row card-like"><div class="manage-item-content"><div class="manage-item-title">時刻 ' + (idx + 1) + '</div><div class="manage-item-time"><input class="osi-time-input" type="time" step="60" value="' + timeVal + '" onchange="handleOriginalSinTimeInput(&quot;' + pathAttr + '&quot;,' + idx + ',this.value,this)" onblur="commitOriginalSinTimeInput(&quot;' + pathAttr + '&quot;,' + idx + ',this.value,this)"></div></div><div class="btn small del-btn" onclick="removeOriginalSinListItem(&quot;' + pathAttr + '&quot;,' + idx + ',this)">削除</div></div>';
              }).join('');
              if (!html) html = '<div class="rule-subnote">時刻がありません。＋追加で登録できます。</div>';
              if (list.length < 10) html += '<div class="osi-list-actions"><div class="btn small" onclick="addOriginalSinListItem(&quot;' + pathAttr + '&quot;,&quot;time&quot;,this)">＋追加</div></div>';
            } else {
              html = list.map(function(item, idx){
                var offsetVal = (item && item.minutesAfterReset != null && String(item.minutesAfterReset) !== '') ? String(item.minutesAfterReset) : '';
                return '<div class="osi-list-row card-like offset"><div class="manage-item-content"><div class="manage-item-title">相対通知 ' + (idx + 1) + '</div><div class="manage-item-time"><input class="num osi-minute-input" type="number" inputmode="numeric" min="0" max="4320" step="1" value="' + offsetVal + '" onchange="handleOriginalSinListInput(&quot;' + pathAttr + '&quot;,' + idx + ',&quot;minutesAfterReset&quot;,this.value,this)"><span class="osi-list-unit">分後</span></div></div><div class="btn small del-btn" onclick="removeOriginalSinListItem(&quot;' + pathAttr + '&quot;,' + idx + ',this)">削除</div></div>';
              }).join('');
              if (!html) html = '<div class="rule-subnote">相対時刻がありません。＋追加で登録できます。</div>';
              if (list.length < 10) html += '<div class="osi-list-actions"><div class="btn small" onclick="addOriginalSinListItem(&quot;' + pathAttr + '&quot;,&quot;offset&quot;,this)">＋追加</div></div>';
            }
            fieldEl.innerHTML = '<div class="osi-list-wrap">' + html + '</div>';
          });
        } catch (e) {
          try { console.error('[[SKYOSDBG]] renderOriginalSinListFields ' + String(e && e.message || e)); } catch (_) {}
        }
      }
      function _applyOriginalSinTimeInput(path, idx, raw, el) {
        var parts = String(raw || '').split(':');
        var list = _normalizeOriginalSinList(path, _getObjectPath(pendingSettings, path) || []);
        var i = Number(idx) || 0;
        if (!list[i]) return false;
        if (String(raw || '') === '') {
          list[i] = { hour: null, minute: null };
          if (el) el.value = '';
        } else {
          var hour = Math.max(0, Math.min(23, Math.round(Number(parts[0]) || 0)));
          var minute = Math.max(0, Math.min(59, Math.round(Number(parts[1]) || 0)));
          list[i] = { hour: hour, minute: minute };
          if (el) el.value = String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
        }
        updateSetting(path, list);
        _syncCurrentSetting(path, list);
        return true;
      }
      function handleOriginalSinTimeInput(path, idx, raw, el) {
        try {
          _applyOriginalSinTimeInput(path, idx, raw, el);
        } catch (_) {}
      }
      function commitOriginalSinTimeInput(path, idx, raw, el) {
        try {
          if (_applyOriginalSinTimeInput(path, idx, raw, el)) queueSettingsSave(el);
        } catch (_) {}
      }
      function queueSettingsSave(el) {
        if (_saveDebounceTimer) clearTimeout(_saveDebounceTimer);
        _saveDebounceTimer = setTimeout(function() {
          save(el || null);
          _saveDebounceTimer = null;
        }, 600);
      }
      function addOriginalSinListItem(path, kind, el) {
        try {
          var list = _normalizeOriginalSinList(path, _getObjectPath(pendingSettings, path) || []);
          if (list.length >= 10) return;
          list.push(kind === 'time' ? { hour: null, minute: null } : { minutesAfterReset: null });
          updateSetting(path, list);
          _syncCurrentSetting(path, list);
          renderOriginalSinListFields(pendingSettings);
          queueSettingsSave(el);
        } catch (_) {}
      }
      function removeOriginalSinListItem(path, idx, el) {
        try {
          var list = _normalizeOriginalSinList(path, _getObjectPath(pendingSettings, path) || []);
          list.splice(Number(idx) || 0, 1);
          updateSetting(path, list);
          _syncCurrentSetting(path, list);
          renderOriginalSinListFields(pendingSettings);
          queueSettingsSave(el);
        } catch (_) {}
      }
      function handleOriginalSinListInput(path, idx, key, raw, el) {
        try {
          var list = _normalizeOriginalSinList(path, _getObjectPath(pendingSettings, path) || []);
          var i = Number(idx) || 0;
          if (!list[i]) return;
          if (String(raw || '') === '') {
            list[i][key] = null;
            if (el) el.value = '';
          } else {
            var v = Math.round(Number(raw) || 0);
            if (key === 'hour') v = Math.max(0, Math.min(23, v));
            else if (key === 'minute') v = Math.max(0, Math.min(59, v));
            else if (key === 'minutesAfterReset') v = Math.max(0, Math.min(4320, v));
            list[i][key] = v;
            if (el) el.value = v;
          }
          updateSetting(path, list);
          _syncCurrentSetting(path, list);
          queueSettingsSave(el);
        } catch (_) {}
      }
      function adjustOriginalSinListNumber(path, idx, key, delta, el) {
        try {
          var list = _normalizeOriginalSinList(path, _getObjectPath(pendingSettings, path) || []);
          var i = Number(idx) || 0;
          if (!list[i]) return;
          var cur = Math.round(Number(list[i][key]) || 0) + Number(delta || 0);
          if (key === 'hour') cur = Math.max(0, Math.min(23, cur));
          else if (key === 'minute') cur = Math.max(0, Math.min(59, cur));
          else if (key === 'minutesAfterReset') cur = Math.max(0, Math.min(4320, cur));
          list[i][key] = cur;
          updateSetting(path, list);
          _syncCurrentSetting(path, list);
          renderOriginalSinListFields(pendingSettings);
          queueSettingsSave(el);
        } catch (_) {}
      }
      function updateBackupStoragePathNote(st) {
        try {
          var note = document.getElementById('settings-backup-path-note');
          if (!note) return;
          var mode = (st && st.backupStorageMode === 'local') ? 'local' : 'iCloud';
          note.textContent = '現在の保存先: ' + mode + ' / ${SETTINGS_BACKUP_DIRNAME}';
        } catch (_) {}
      }
      function applySettingsToUI(st) {
        try {
          currentSettings = (function(s){ try { return JSON.parse(JSON.stringify(s || {})); } catch(e){ return Object.assign({}, s || {}); } })(st || {});
          pendingSettings = (function(s){ try { return JSON.parse(JSON.stringify(s || {})); } catch(e){ return Object.assign({}, s || {}); } })(currentSettings);
          var row = document.getElementById('manual-offset-row');
          var isAuto = !!(currentSettings && currentSettings.localOffsetAuto !== false);
          if (row) row.style.display = isAuto ? 'none' : 'flex';
          var testRow = document.getElementById('test-mode-row');
          var testOn = !!(currentSettings && currentSettings.testMode);
          if (testRow) testRow.style.display = testOn ? 'block' : 'none';
          var inp = document.getElementById('test-time-input');
          if (inp) {
            inp.disabled = !testOn;
            var curOff = Number(currentSettings && currentSettings.testOffsetMs);
            if (!Number.isFinite(curOff)) curOff = 0;
            inp.value = TimeCoreFront.formatForInput(Date.now() + curOff);
          }
          isTestMode = testOn;
          var tmpOff = Number(currentSettings && currentSettings.testOffsetMs);
          testModeOffset = Number.isFinite(tmpOff) ? tmpOff : 0;
          refreshRealmDisplayUI(currentSettings);
          renderOriginalSinListFields(currentSettings);
          updateBackupStoragePathNote(currentSettings);
          updateTestClock();
        } catch (_) {}
      }
      function isTruthyValue(v){ return v === true || v === 1 || v === '1' || String(v).toLowerCase() === 'true'; }
      function _parseSettingValue(path, raw, el) {
        try {
          if (raw === null || raw === undefined) return raw;
          if (typeof raw === 'boolean') return raw;
          var p = String(path || '');
          if (p.toLowerCase().endsWith('enabled')) return isTruthyValue(raw);
          if (typeof raw === 'string' && isNaN(Number(raw))) return raw;
          var v = Number(raw);
          var bounds = _getLimitBounds(el);
          if (!Number.isFinite(v)) return 0;
          return Math.max(bounds.min, Math.min(bounds.max, Math.round(v)));
        } catch (e) { return raw; }
      }
      function _getSetting(p) {
        var parts = String(p || '').split('.');
        var cur = pendingSettings;
        for (var i = 0; i < parts.length; i++) { if (!cur) return 0; cur = cur[parts[i]]; }
        return cur;
      }
      function _getInputIdFromPath(path) { return 'input-' + String(path || '').split('.').join('-'); }
      function _getFieldInput(path, el) {
        try {
          if (el && String(el.tagName || '').toUpperCase() === 'INPUT') return el;
          return document.getElementById(_getInputIdFromPath(path));
        } catch (_) { return null; }
      }
      function _setFieldValue(path, val) {
        try {
          var inp = _getFieldInput(path);
          if (inp) inp.value = val;
        } catch (_) {}
      }
      function _getFieldConstraint(path, el) {
        try {
          var inp = _getFieldInput(path, el);
          var ds = inp && inp.dataset ? inp.dataset : {};
          return {
            pairPath: String(ds.pairPath || ''),
            pairRole: String(ds.pairRole || ''),
            minGap: Number(ds.minGap || 0),
          };
        } catch (_) {
          return { pairPath: '', pairRole: '', minGap: 0 };
        }
      }
      function _applyLinkedFieldConstraint(path, value, el) {
        var rule = _getFieldConstraint(path, el);
        var v = Number(value);
        if (!rule.pairPath || !rule.pairRole || !Number.isFinite(v)) return value;
        var pairVal = Number(_getSetting(rule.pairPath));
        if (!Number.isFinite(pairVal)) return value;
        var minGap = Math.max(0, Number(rule.minGap || 0));
        var bounds = _getLimitBounds(el);
        var minVal = bounds.min;
        var maxVal = bounds.max;
        let changed = false;
        if (rule.pairRole === 'lower' && v >= pairVal) {
          pairVal = Math.min(maxVal, v + minGap);
          if (pairVal <= v) {
            v = Math.max(minVal, maxVal - minGap);
            pairVal = maxVal;
          }
          changed = true;
        } else if (rule.pairRole === 'upper' && v <= pairVal) {
          pairVal = Math.max(minVal, v - minGap);
          if (pairVal >= v) {
            pairVal = minVal;
            v = Math.min(maxVal, minVal + minGap);
          }
          changed = true;
        }
        if (changed) {
          updateSetting(rule.pairPath, pairVal);
          _setFieldValue(rule.pairPath, pairVal);
          return v;
        }
        return value;
      }
      function filterManage(mode, el) {
        selectTab(el);
        var secOn = document.getElementById('manage-section-on');
        var secOff = document.getElementById('manage-section-off');
        if (secOn) secOn.style.display = (mode === 'all' || mode === 'on') ? 'block' : 'none';
        if (secOff) secOff.style.display = (mode === 'all' || mode === 'off') ? 'block' : 'none';
      }
      var _saveDebounceTimer = null;
      var __immediateSavePaths = ${JSON.stringify(INPUT_SAVE_POLICY.immediatePaths)};
      var __debounceSavePaths = ${JSON.stringify(INPUT_SAVE_POLICY.debouncePaths)};
      var __explicitSavePaths = ${JSON.stringify(INPUT_SAVE_POLICY.explicitPaths)};
      function getInputSavePolicy(path, el) {
        var key = String(path || '').trim();
        if (__immediateSavePaths.indexOf(key) !== -1) return 'immediate';
        if (__explicitSavePaths.indexOf(key) !== -1) return 'explicit';
        if (__debounceSavePaths.indexOf(key) !== -1) return 'debounce';
        if (el && (el.type === 'checkbox' || el.type === 'radio' || el.tagName === 'SELECT' || (el.classList && el.classList.contains('opt')))) return 'immediate';
        return 'debounce';
      }
      function handleSettingChange(path, raw, el) {
        var v = _parseSettingValue(path, raw, el);
        if (typeof v === 'number') v = _applyLinkedFieldConstraint(path, v, el);
        updateSetting(path, v);
        _syncCurrentSetting(path, v);
        if (String(path || '').indexOf('notify.pan.') === 0) refreshRealmDisplayUI(pendingSettings);
        if (el && el.classList && el.classList.contains('opt')) selectTab(el);
        updateTestClock();
        var policy = getInputSavePolicy(path, el);
        if (policy === 'explicit') return;
        if (policy === 'immediate') {
          if (_saveDebounceTimer) { clearTimeout(_saveDebounceTimer); _saveDebounceTimer = null; }
          save(el);
          return;
        }
        if (_saveDebounceTimer) clearTimeout(_saveDebounceTimer);
        _saveDebounceTimer = setTimeout(function() {
          save(el);
          _saveDebounceTimer = null;
        }, 600);
      }
      function setLocalOffsetAuto(isAuto, el) {
        selectTab(el);
        var row = document.getElementById('manual-offset-row');
        if (row) row.style.display = isAuto ? 'none' : 'flex';
        updateSetting('localOffsetAuto', isAuto);
        _syncCurrentSetting('localOffsetAuto', isAuto);
        if (isAuto) {
          var d = new Date();
          var offset = -(d.getTimezoneOffset()) / 60;
          updateSetting('localOffset', offset);
          _syncCurrentSetting('localOffset', offset);
          var inp = _getFieldInput('localOffset');
          if (inp) {
            inp.value = offset;
            inp.dataset.lastValid = offset;
          }
        }
        save(el);
      }
      function adjustSettingNumber(path, delta, el) {
        try {
          var inp = _getFieldInput(path);
          if (!inp) { toast('エラー: 入力欄が見つかりません'); return; }
          var val = Number(inp.value) || 0;
          val += Number(delta);
          var bounds = _getLimitBounds(inp);
          val = Math.max(bounds.min, Math.min(bounds.max, val));
          inp.value = val;
          inp.dataset.lastValid = val;
          handleSettingChange(path, val, inp);
        } catch(e) {}
      }
      function setTestMode(isOn, el) {
        selectTab(el);
        var row = document.getElementById('test-mode-row');
        if (row) row.style.display = isOn ? 'block' : 'none';
        var clockWrap = document.getElementById('test-clock-wrap');
        if (clockWrap) clockWrap.style.display = 'flex';
        try { adjustHeaderPadding(); } catch(_) {}
        updateSetting('testMode', isOn);
        _syncCurrentSetting('testMode', isOn);
        currentSettings.testMode = isOn;
        isTestMode = isOn;
        var storedOffset = Number(_getSetting('testOffsetMs'));
        if (!Number.isFinite(storedOffset)) storedOffset = Number(currentSettings.testOffsetMs);
        if (!Number.isFinite(storedOffset)) storedOffset = 0;
        testModeOffset = storedOffset;
        currentSettings.testOffsetMs = storedOffset;
        var inp = document.getElementById('test-time-input');
        if (inp) {
          inp.disabled = !isOn;
          inp.value = TimeCoreFront.formatForInput(Date.now() + testModeOffset);
        }
        updateTestClock();
        save(el);
      }
      function applyTestTimeAuto(el) {
        if (!el || !el.value) return;
        var offset = Number(TimeCoreFront.parseInputToOffset(el.value));
        if (!Number.isFinite(offset)) return;
        updateSetting('testOffsetMs', offset);
        _syncCurrentSetting('testOffsetMs', offset);
        currentSettings.testOffsetMs = offset;
        testModeOffset = offset;
        if (el) el.value = TimeCoreFront.formatForInput(Date.now() + testModeOffset);
        updateTestClock();
        save(el);
      }
      function adjustCount(type, delta, el) {
        var inp = document.getElementById('count-' + String(type || ''));
        if (!inp) return;
        var v = parseInt(inp.value, 10);
        if (isNaN(v) || v < 0) v = 0;
        v = Math.max(0, v + Number(delta || 0));
        inp.value = v;
        setCountAbsolute(type, v, inp);
      }
      function getCurrentOperateLaKey() {
        try {
          var k = String(((window.__APP_CONTEXT || {}).remainLaKey) || '').trim();
          return /^\d{4}-\d{2}-\d{2}$/.test(k) ? k : '';
        } catch (_) { return ''; }
      }
      function setCountAbsolute(type, val, el) {
        var v = parseInt(val, 10);
        if (isNaN(v) || v < 0) v = 0;
        if (el) el.value = v;
        var la = getCurrentOperateLaKey();
        var q = '?v=' + v + (la ? ('&la=' + encodeURIComponent(la)) : '');
        sendCommand('scriptable-setcount://' + encodeURIComponent(type) + q, el);
      }
      function resetToday(type, el) {
        var la = getCurrentOperateLaKey();
        var q = la ? ('?la=' + encodeURIComponent(la)) : '';
        sendCommand("scriptable-resetday://" + encodeURIComponent(type) + q, el);
      }
      function triggerEventAction(type, action, el) {
        var eventType = String(type || '').trim();
        var act = String(action || '').trim().toLowerCase();
        if (!eventType || !act) return;
        if (act === 'dyecomplete') {
          var la = getCurrentOperateLaKey();
          sendCommand('scriptable-dyecomplete://1', el, Object.assign({ type: eventType }, la ? { la: la } : {}), 0);
          return;
        }
        if (act === 'pantreasurecomplete') {
          var la = getCurrentOperateLaKey();
          sendCommand('scriptable-pantreasurecomplete://1', el, Object.assign({ type: eventType }, la ? { la: la } : {}), 0);
          return;
        }
        if (act === 'pandailycomplete') {
          var la = getCurrentOperateLaKey();
          sendCommand('scriptable-pandailycomplete://1', el, Object.assign({ type: eventType }, la ? { la: la } : {}), 0);
          return;
        }
        if (act === 'originalsincomplete') {
          var la = getCurrentOperateLaKey();
          sendCommand('scriptable-originalsincomplete://1', el, Object.assign({ type: eventType }, la ? { la: la } : {}), 0);
          return;
        }
      }
function clearAndReloadImages(el) {
        if (el) { el.dataset.origText = el.innerText; el.innerText = "処理中..."; }
        sendCommand("scriptable-clearcache://", el);
        setTimeout(function() {
          if (el) el.innerText = el.dataset.origText || "画像キャッシュを削除して更新";
        }, 3000);
      }
function bindCommonSettingEvents() {
        if (window.__commonSettingEventsBound) return;
        window.__commonSettingEventsBound = true;
        document.addEventListener('click', function(ev) {
          var target = ev.target && ev.target.closest ? ev.target.closest('.opt[data-setting-key]') : null;
          if (!target) return;
          var key = String(target.getAttribute('data-setting-key') || '');
          var value = target.getAttribute('data-setting-value');
          if (!key) return;
          set(key, value, target);
        });
      }
function set(key, val, el) {
        if (el && el.classList && el.classList.contains('opt')) selectTab(el);
        if (key === 'theme') {
            var isDark = (val === 'dark');
            var r = document.documentElement;
            var appCtx = window.__APP_CONTEXT || {};
            var palettes = appCtx.palettes || {};
            var p = palettes[val] || palettes['light'] || {};
            Object.keys(p).forEach(function(k){
              if (p[k] != null) {
                var cssKey = '--' + k.replace(/([A-Z])/g, '-$1').toLowerCase();
                r.style.setProperty(cssKey, p[k]);
              }
            });
            r.style.colorScheme = isDark ? 'dark' : 'light';
            try{
              document.querySelectorAll('input[type="datetime-local"]').forEach(function(inp){
                if (inp) inp.style.filter = isDark ? 'invert(1)' : 'none';
              });
            }catch(_){ }
        }
        pendingSettings[key] = val;
        if (['viewMode', 'layoutMode', 'theme'].indexOf(key) !== -1) {
          sendCommand("scriptable-preview://", null, pendingSettings, 50);
        }
      }
function save(el) {
        sendCommand("scriptable-save://", el, pendingSettings, 0);
      }
      function saveRealmOverrides(el) {
        sendCommand("scriptable-saverealmoverrides://", el, pendingSettings, 0);
      }
            var managePayload = { pending: [], disabled: [] };
      var manageChecked = {};
      var manageDisabledChecked = {};
      var manageIncludeTest = ${!!settings.testMode};
      var manageLoadedOnce = false;
      function showManageLoading(){
        var listEl = document.getElementById('manage-list');
        if (listEl) listEl.innerHTML = '<div class="loading-state">星の記録を読み込んでいます…🕊️</div>';
        var disabledEl = document.getElementById('manage-disabled-list');
        if (disabledEl) disabledEl.innerHTML = '<div class="loading-state">お休み中のお知らせを確認しています…</div>';
        var countEl = document.getElementById('manage-count');
        if (countEl) countEl.textContent = '...';
        var disabledCountEl = document.getElementById('manage-disabled-count');
        if (disabledCountEl) disabledCountEl.textContent = '...';
        var wrap = document.getElementById('manage-threads-wrap');
        if (wrap) wrap.style.display = 'none';
      }
      function setManageIncludeTest(v, el){
        manageIncludeTest = !!v;
        selectTab(el);
        try{ renderManageNotifications(managePayload); }catch(_){ }
      }
      function manageRefresh(el){
  manageLoadedOnce = false;
  showManageLoading();
  sendCommand('scriptable-notif-list://1', el);
}
      function _getManageScope(el){
        try{
          var sec = el && el.closest ? el.closest('#manage-section-on, #manage-section-off') : null;
          if (sec && sec.id === 'manage-section-off') return { containerId: 'manage-disabled-list', checkedMap: manageDisabledChecked };
        } catch(_){ }
        return { containerId: 'manage-list', checkedMap: manageChecked };
      }
      function manageSelectAll(state, el){
        var scope = _getManageScope(el);
        document.querySelectorAll('#' + scope.containerId + ' .manage-cb').forEach(function(cb){
          cb.checked = !!state;
          scope.checkedMap[String(cb.value||'')] = !!state;
        });
      }
      function manageSelectByThread(thread){
        document.querySelectorAll('.manage-cb').forEach(function(cb){
          if (String(cb.dataset.thread||'') === String(thread||'')) {
            var item = cb.closest('.manage-item');
            if (item && item.offsetParent !== null) {
              cb.checked = true;
              var checkedMap = cb.closest('#manage-disabled-list') ? manageDisabledChecked : manageChecked;
              checkedMap[String(cb.value||'')] = true;
            }
          }
        });
      }
      function manageToggleSelected(el, selector, commandUrl){
        var selected = Array.from(document.querySelectorAll(selector)).map(function(cb){ return cb.value; });
        if (!selected.length) { toast('選択がありません'); return; }
        sendCommand(commandUrl, el, selected, 0);
      }
      function prettyThread(t){
        try{
          var s = String(t||'');
          var p = s.split(':');
          if (p.length < 3) return s;
          var tp = String(p[1] || '');
          var appCtx = window.__APP_CONTEXT || {};
          var cfg = appCtx.notiIdConfig || {};
          var testTag = String(cfg.testTag || '');
          var isTest = (testTag && String(p[2] || '') === testTag);
          var off = isTest ? 3 : 2;
          var la = String(p[off] || '');
          var titleMap = (appCtx.eventTitles && typeof appCtx.eventTitles === 'object') ? appCtx.eventTitles : {};
          var label = String(titleMap[tp] || tp || '');
          return (isTest ? ('🧪 ' + label + ' ' + la) : (label + ' ' + la));
        }catch(e){ return String(t||''); }
      }
      function renderManageListInto(containerId, countId, items, source){
        var list = Array.isArray(items) ? items.slice() : [];
        if (!manageIncludeTest) {
          list = list.filter(function(n){ return !(n && n.isTest); });
        }
        list.sort(function(a,b){ return Number(a && a.ts || 0) - Number(b && b.ts || 0); });
        var countEl = document.getElementById(countId);
        if (countEl) countEl.textContent = String(list.length) + '件';
        var listEl = document.getElementById(containerId);
        if (listEl) listEl.innerHTML = '';
        if (!list.length) {
          if (listEl) {
            var stateClass = manageLoadedOnce ? 'empty-state' : 'loading-state';
            var msg = manageLoadedOnce
              ? (source === 'disabled' ? 'お休み中の予定はありません' : 'これからの予定はありません')
              : (source === 'disabled' ? 'お休み中のお知らせを確認しています…' : '星の記録を読み込んでいます…🕊️');
            listEl.innerHTML = '<div class="' + stateClass + '">' + msg + '</div>';
          }
          return list;
        }
        var groupsMap = {};
        var groupsOrder = [];
        var appCtxOS = window.__APP_CONTEXT || {};
        var originalSinMap = (appCtxOS && appCtxOS.originalSinWindowMap && typeof appCtxOS.originalSinWindowMap === 'object') ? appCtxOS.originalSinWindowMap : {};
        var originalSinWindows = Object.keys(originalSinMap).map(function(key){
          var meta = originalSinMap[key] || {};
          return {
            laKey: String(key || ''),
            label: String(meta.label || ''),
            startMs: Number(meta.startMs || 0) || 0,
            endMs: Number(meta.endMs || 0) || 0
          };
        }).filter(function(x){ return x.startMs > 0 && x.endMs > x.startMs; }).sort(function(a,b){ return a.startMs - b.startMs; });
        function manageLocalParts(ms){
          var off = Number(currentSettings && currentSettings.localOffset != null ? currentSettings.localOffset : 9) * 3600000;
          var d = new Date(Number(ms || 0) + off);
          return {
            y: d.getUTCFullYear(),
            m: String(d.getUTCMonth()+1).padStart(2,'0'),
            d: String(d.getUTCDate()).padStart(2,'0'),
            h: String(d.getUTCHours()).padStart(2,'0'),
            mi: String(d.getUTCMinutes()).padStart(2,'0'),
            wk: ['日','月','火','水','木','金','土'][d.getUTCDay()]
          };
        }
        function manageLocalDateLabel(ms){
          var p = manageLocalParts(ms);
          return p.y + '/' + p.m + '/' + p.d + ' (' + p.wk + ')';
        }
        function manageLocalTimeLabel(ms){
          var p = manageLocalParts(ms);
          return p.h + ':' + p.mi;
        }
        function resolveOriginalSinMeta(ts, fallbackLaKey){
          var numTs = Number(ts || 0) || 0;
          if (numTs > 0) {
            for (var i = 0; i < originalSinWindows.length; i++) {
              var w = originalSinWindows[i];
              if (numTs >= w.startMs && numTs < w.endMs) return w;
            }
          }
          if (fallbackLaKey && originalSinMap[fallbackLaKey]) {
            var meta = originalSinMap[fallbackLaKey] || {};
            var s = Number(meta.startMs || 0) || 0;
            var e = Number(meta.endMs || 0) || 0;
            if (s > 0 && e > s) return { laKey: String(fallbackLaKey), label: String(meta.label || ''), startMs: s, endMs: e };
          }
          return null;
        }
        function detectManageItemType(n){
          var raw = String(n && n.type || '').trim();
          if (raw) return raw;
          var id = String(n && n.id || '');
          if (id.indexOf(':originalSin:') >= 0) return 'originalSin';
          if (id.indexOf(':shards:') >= 0) return 'shards';
          var title = String(n && n.title || '');
          if (title.indexOf('原罪') >= 0) return 'originalSin';
          if (title.indexOf('闇の破片') >= 0) return 'shards';
          return raw;
        }
        list.forEach(function(n) {
          var lk = String(n && n.laKey || 'unknown');
          var tp = detectManageItemType(n);
          var skyMeta = (tp === 'originalSin') ? resolveOriginalSinMeta(Number(n && n.ts || 0) || 0, lk) : null;
          var groupKey = (tp === 'originalSin') ? ('originalSin::' + String(skyMeta && skyMeta.startMs || lk)) : ('default::' + lk);
          if (!groupsMap[groupKey]) {
            var initialSortTs = Number(n && n.ts || 0) || 0;
            if (tp === 'originalSin' && skyMeta && skyMeta.startMs > 0) initialSortTs = skyMeta.startMs;
            groupsMap[groupKey] = { laKey: lk, type: tp, skyMeta: skyMeta, titleMap: {}, titleOrder: [], itemsCount: 0, sortTs: initialSortTs };
            groupsOrder.push(groupKey);
          }
          var g = groupsMap[groupKey];
          if (tp !== 'originalSin' && (!g.sortTs || ((Number(n && n.ts || 0) || 0) < g.sortTs))) g.sortTs = Number(n && n.ts || 0) || g.sortTs;
          var tTitle = n.title || '(無題)';
          if (!g.titleMap[tTitle]) {
            g.titleMap[tTitle] = [];
            g.titleOrder.push(tTitle);
          }
          g.titleMap[tTitle].push(n);
          g.itemsCount++;
        });
        groupsOrder.sort(function(a, b){
          var ga = groupsMap[a] || {};
          var gb = groupsMap[b] || {};
          return (Number(ga.sortTs || 0) - Number(gb.sortTs || 0)) || String(a).localeCompare(String(b));
        });
        groupsOrder.forEach(function(groupKey) {
          var g = groupsMap[groupKey];
          var lk = String(g && g.laKey || 'unknown');
          var gWrap = document.createElement('div');
          gWrap.className = 'manage-group-wrap';
          var gHead = document.createElement('div');
          gHead.className = 'manage-group-head';
          var dateHeader = lk;
          var p = lk.split('-');
          if (String(g && g.type || '') === 'originalSin' && g && g.skyMeta && Number(g.skyMeta.startMs || 0) > 0) {
            var skyStartLabel = manageLocalDateLabel(Number(g.skyMeta.startMs || 0));
            var skyWindowLabel = String(g.skyMeta.label || '').trim();
            dateHeader = skyStartLabel + ' Sky日';
            if (skyWindowLabel) dateHeader += '（' + skyWindowLabel + '）';
          } else if (p.length === 3) {
            var dObj = new Date(p[0], p[1]-1, p[2]);
            var wk = ["日","月","火","水","木","金","土"][dObj.getDay()];
            dateHeader = p[0] + '/' + p[1] + '/' + p[2] + ' (' + wk + ')';
          }
          gHead.textContent = dateHeader + ' の予定 (' + g.itemsCount + '件)';
          gWrap.appendChild(gHead);
          g.titleOrder.forEach(function(tTitle) {
            var subItems = Array.isArray(g.titleMap[tTitle]) ? g.titleMap[tTitle].slice() : [];
            if (String(g && g.type || '') === 'originalSin') {
              var startMs1 = g && g.skyMeta && Number.isFinite(Number(g.skyMeta.startMs || 0)) ? Number(g.skyMeta.startMs || 0) : NaN;
              subItems.sort(function(a, b){
                var at = Number(a && a.ts || 0) || 0;
                var bt = Number(b && b.ts || 0) || 0;
                if (Number.isFinite(startMs1)) {
                  var ar = (at - startMs1 + 86400000) % 86400000;
                  var br = (bt - startMs1 + 86400000) % 86400000;
                  return ar - br || at - bt;
                }
                return at - bt;
              });
            }
            var subWrap = document.createElement('div');
            subWrap.className = 'manage-sub-wrap';
            var subHead = document.createElement('div');
            subHead.className = 'manage-sub-head';
            if (String(g && g.type || '') === 'originalSin' && g && g.skyMeta && Number(g.skyMeta.startMs || 0) > 0) {
              var subWindowLabel = String(g.skyMeta.label || '').trim();
              subHead.textContent = tTitle + (subWindowLabel ? (' ｜ ' + subWindowLabel) : '');
            } else {
              subHead.textContent = tTitle;
            }
            subWrap.appendChild(subHead);
            subItems.forEach(function(n) {
              var id = String(n.id||'');
              var checkedMap = (source === 'disabled') ? manageDisabledChecked : manageChecked;
              var item = document.createElement('div');
              item.className = 'manage-item manage-list-item schedule-card';
              var cb = document.createElement('input');
              cb.type = 'checkbox';
              cb.className = 'manage-cb manage-cb-input';
              cb.value = id;
              cb.dataset.thread = String(n.thread||'');
              cb.checked = !!checkedMap[id];
              cb.onchange = function(){ checkedMap[id] = !!cb.checked; };
              var content = document.createElement('div');
              content.className = 'manage-item-content';
              var bodyText = n.body ? n.body.replace('受付期間: ', '') : '';
              if (String(n.title || '').indexOf('染料') >= 0 && bodyText.indexOf(' / ') >= 0) {
                bodyText = bodyText.split(' / ').pop().trim();
              }
              var displayTitle = String(n.title || '').trim();
              if (displayTitle && displayTitle !== String(tTitle || '').trim()) {
                var titleRow = document.createElement('div');
                titleRow.className = 'manage-item-title';
                titleRow.textContent = displayTitle;
                content.appendChild(titleRow);
              }
              var timeRow = document.createElement('div');
              timeRow.className = 'manage-item-time';
              var displayTimeText = bodyText || String(n.date || '').trim() || '(本文なし)';
              if (String(g && g.type || '') === 'originalSin') {
                var hhmm = manageLocalTimeLabel(Number(n && n.ts || 0) || 0);
                var m = String(n && n.body || '').match(/空き候補（([^）]+)）/);
                var gapText = m ? String(m[1]) : '';
                displayTimeText = hhmm + (gapText ? (' 空き候補（' + gapText + '）') : ' 空き候補');
              }
              timeRow.textContent = displayTimeText;
              if (!displayTitle || displayTitle === String(tTitle || '').trim()) {
                timeRow.classList.add('only-line');
              }
              content.appendChild(timeRow);
              var toggle = document.createElement('div');
              toggle.className = 'segmented narrow manage-item-toggle';
              var optOn = document.createElement('div');
              optOn.className = 'opt' + (source === 'pending' ? ' selected' : '');
              optOn.textContent = 'オン';
              optOn.onclick = function(){ if (source === 'disabled') sendCommand('scriptable-notif-enable://', null, [id], 0); };
              var optOff = document.createElement('div');
              optOff.className = 'opt' + (source === 'disabled' ? ' selected' : '');
              optOff.textContent = 'お休み';
              optOff.onclick = function(){ if (source === 'pending') sendCommand('scriptable-notif-disable://', null, [id], 0); };
              toggle.appendChild(optOn);
              toggle.appendChild(optOff);
              item.appendChild(cb);
              item.appendChild(content);
              item.appendChild(toggle);
              subWrap.appendChild(item);
            });
            gWrap.appendChild(subWrap);
          });
          if (listEl) listEl.appendChild(gWrap);
        });
        return list;
      }
      function renderManageNotifications(payload){
        manageLoadedOnce = true;
        managePayload = (payload && typeof payload === 'object') ? payload : { pending: [], disabled: [] };
        var pending = Array.isArray(managePayload.pending) ? managePayload.pending : [];
        var disabled = Array.isArray(managePayload.disabled) ? managePayload.disabled : [];
        var shownPending = renderManageListInto('manage-list', 'manage-count', pending, 'pending');
        renderManageListInto('manage-disabled-list', 'manage-disabled-count', disabled, 'disabled');
        var threadsEl = document.getElementById('manage-threads');
        var threadsWrap = document.getElementById('manage-threads-wrap');
        if (threadsEl) {
          threadsEl.innerHTML = '';
          var seen = {};
          shownPending.forEach(function(n){
            var th = String(n && n.thread || '');
            if (!th || seen[th]) return;
            seen[th] = true;
            var btn = document.createElement('div');
            btn.className = 'btn secondary small';
            btn.textContent = prettyThread(th);
            btn.onclick = function(){ manageSelectByThread(th); };
            threadsEl.appendChild(btn);
          });
          var hasThreads = Object.keys(seen).length > 0;
          threadsEl.style.display = hasThreads ? 'flex' : 'none';
          if (threadsWrap) threadsWrap.style.display = hasThreads ? 'block' : 'none';
        } else if (threadsWrap) {
          threadsWrap.style.display = 'none';
        }
      }
      function switchNotifyTab(type, el) {
        try {
          if (String(type || '') !== 'originalSin') sortOriginalSinListsOnLeave();
        } catch (_) {}
        selectTab(el);
        document.querySelectorAll('.event-section-wrap').forEach(function(sec){
          sec.style.display = 'none';
        });
        var target = document.getElementById('notify-sec-' + String(type || ''));
        if (target) target.style.display = 'block';
      }
      window.addEventListener('load', function(){
        try{ buildTopNav(); }catch(_){ }
        try{ buildHelpContents(); }catch(_){ }
        try{ buildScreenHelpButtons(); }catch(_){ }
        try{ bindCommonSettingEvents(); }catch(_){ }
        try{
          var clearBtn = document.getElementById('clearAndReloadImages');
          if (clearBtn) clearBtn.addEventListener('click', function(){ clearAndReloadImages(clearBtn); });
        }catch(_){ }
        applyScreen();
        if (currentScreen === 'intro') { try { activateVideoSlots(document.getElementById('screen-intro')); } catch(_){} }
        try{ updateRemainBadges(); }catch(_){ }
        try{ adjustHeaderPadding(); }catch(_){ }
        try{ sendCommand('scriptable-keychain://1'); }catch(_){ }
        if (currentScreen === 'manage') { try{ showManageLoading(); manageRefresh(); }catch(_){} }
        function refreshIfKeychainVisible(){
          try{
            var kc = document.getElementById('screen-data');
            if (kc && kc.style.display !== 'none') sendCommand('scriptable-keychain://1');
          }catch(_){}
        }
        window.addEventListener('focus', refreshIfKeychainVisible);
        window.addEventListener('resize', function(){ try{ adjustHeaderPadding(); }catch(_){} });
        document.addEventListener('visibilitychange', function(){
          if (document.visibilityState === 'visible') {
            refreshIfKeychainVisible();
            try{ adjustHeaderPadding(); }catch(_){ }
          }
        });
      });
    </script>
<div class="footerbar glass-panel" id="footerbar">
  <div class="footerbtn btn-save" id="footer-save" onclick="save(this)">この見た目で保存</div>
</div>
</body>
</html>
  `;
  const wv = new WebView();
  const extractNotiMeta = (n, defaultTs = 0) => {
    const id = String(n?.identifier || "");
    let dt = extractNotiTriggerDate(n);
    if (n?.userInfo?.labelDateMs) {
      const parsedMs = Number(n.userInfo.labelDateMs);
      if (Number.isFinite(parsedMs)) dt = new Date(parsedMs);
    }
    const p = NOTI_ID.parse(id);
    return {
      id,
      title: n?.title || "(無題)",
      body: n?.body || "",
      date: dt ? F.localFullFormat(dt, loadSettings()) : "日時不明",
      thread: String(n?.threadIdentifier || ""),
      ts: dt ? dt.getTime() : defaultTs,
      isTest: NOTI_ID.isTestId(id),
      laKey: p ? p.laKey : "unknown"
    };
  };
  let __managePendingFallback = [];
  const extractPlannedNotiMeta = (n, defaultTs = 0) => {
    const id = String(n?.id || n?.identifier || "");
    const p = NOTI_ID.parse(id);
    let dt = null;
    try {
      if (n?.userInfo?.labelDateMs != null) {
        const parsedMs = Number(n.userInfo.labelDateMs);
        if (Number.isFinite(parsedMs)) dt = new Date(parsedMs);
      }
    } catch (_) {}
    if (!dt) {
      const trigger = n?.triggerDate;
      if (trigger instanceof Date) dt = trigger;
      else if (trigger) {
        const tmp = new Date(trigger);
        if (!isNaN(tmp.getTime())) dt = tmp;
      }
    }
    return {
      id,
      title: n?.title || "(無題)",
      body: n?.body || "",
      date: dt ? F.localFullFormat(dt, loadSettings()) : "日時不明",
      thread: String(n?.threadId || n?.threadIdentifier || ""),
      ts: dt ? dt.getTime() : defaultTs,
      isTest: NOTI_ID.isTestId(id),
      laKey: p ? p.laKey : "unknown"
    };
  };
  const hydrateDisabledMeta = (entry, baseTime = null, settingsOverride = null) => {
    const raw = (entry && typeof entry === 'object') ? entry : { id: String(entry || '') };
    const id = String(raw?.id || raw?.identifier || '');
    const st = settingsOverride || loadSettings();
    const out = {
      id,
      title: String(raw?.title || ''),
      body: String(raw?.body || ''),
      date: String(raw?.date || ''),
      thread: String(raw?.thread || raw?.threadIdentifier || ''),
      ts: Number(raw?.ts || 0) || 0,
      isTest: raw?.isTest != null ? !!raw.isTest : NOTI_ID.isTestId(id),
      laKey: String(raw?.laKey || '')
    };
    const parsed = id ? NOTI_ID.parse(id) : null;
    if (parsed && !out.laKey) out.laKey = String(parsed.laKey || '');
    if (!(out.title && out.body && out.thread && out.laKey && out.ts > 0) && parsed) {
      try {
        const probeNow = getEffectiveNowFromRef(baseTime, st);
        const schedules = generateSchedules(parsed.type, probeNow, parsed.laKey, st) || [];
        const idxNum = Number(parsed.idx);
        const matched = schedules.find(it => Number(it?.idx) === idxNum) || null;
        if (matched) {
          if (!out.title) out.title = String(matched.title || '');
          if (!out.body) out.body = String(matched.body || '');
          if (!out.thread) out.thread = String(matched.threadId || '');
          if (!out.ts && matched.triggerDate instanceof Date) out.ts = matched.triggerDate.getTime();
        }
      } catch (_) {}
    }
    if (!out.date) out.date = out.ts ? F.localFullFormat(new Date(out.ts), st) : '日時不明';
    if (!out.title) out.title = '(無題)';
    if (!out.body) out.body = '';
    if (!out.laKey) out.laKey = parsed ? String(parsed.laKey || 'unknown') : 'unknown';
    return out;
  };
  const getSortedManagedNotifications = (pendingList) => {
    const arr = [];
    for (const n of (pendingList || [])) {
      if (NOTI_ID.isManagedId(n?.identifier)) arr.push(extractNotiMeta(n, 0));
    }
    return arr.sort((a, b) => (a.ts || 0) - (b.ts || 0));
  };
  const setManagePendingFallback = (scheduledItems) => {
    try {
      const list = mergeManagedNotificationLists(scheduledItems || [], []);
      __managePendingFallback = list
        .map(n => extractPlannedNotiMeta(n, 0))
        .sort((a, b) => (a.ts || 0) - (b.ts || 0));
    } catch (_) {
      __managePendingFallback = [];
    }
  };
  async function pushManageNotifications(txTimeMs = null, scheduledFallback = null) {
    let payload = { pending: [], disabled: [] };
    try {
      const pending = await fetchAllPendingSafe();
      const sortedPending = getSortedManagedNotifications(pending);
      const mergedFallback = mergeManagedNotificationLists(sortedPending, scheduledFallback || __managePendingFallback || []);
      payload = {
        pending: sortedPending.length ? sortedPending : mergedFallback.map(n => extractPlannedNotiMeta(n, 0)),
        disabled: loadDisabledList().map(x => hydrateDisabledMeta(x, txTimeMs))
      };
    } catch (e) {
      console.error("pushManageNotifications failed", e);
      try {
        const mergedFallback = mergeManagedNotificationLists([], scheduledFallback || __managePendingFallback || []);
        payload = { pending: mergedFallback.map(n => extractPlannedNotiMeta(n, 0)), disabled: loadDisabledList().map(x => hydrateDisabledMeta(x, txTimeMs)) };
      } catch (_) {}
    }
    const payloadJson = JSON.stringify(payload);
    const currentGen = Number.isFinite(txTimeMs) ? txTimeMs : null;
    safeEvalJsWithGen(`if (typeof renderManageNotifications === 'function') { renderManageNotifications(${payloadJson}); }`, currentGen);
  }
  await wv.loadHTML(html, "https://localhost/");
  const _safeEvalJS = (js) => { try { wv.evaluateJavaScript(String(js || "")); } catch (_) {} };
  let __scriptableUiUpdateGen = 0;
  const nextUiUpdateGen = () => {
    __scriptableUiUpdateGen += 1;
    return __scriptableUiUpdateGen;
  };
  const safeEvalJsWithGen = (body, forcedGen = null) => {
    const gen = Number.isFinite(forcedGen) ? forcedGen : nextUiUpdateGen();
    _safeEvalJS(`
      try {
        window.__LAST_UPDATE_GEN = Number(window.__LAST_UPDATE_GEN || 0);
        const __incomingGen = ${gen};
        if (__incomingGen >= window.__LAST_UPDATE_GEN) {
          window.__LAST_UPDATE_GEN = __incomingGen;
          ${body}
        } else {
          // stale Scriptable UI update ignored
        }
      } catch (e) { console.error(e); }
    `);
    return gen;
  };
  const sendFeedback = (opts) => _safeEvalJS(makeFeedbackJS(opts));
  const notifySuccess = (msg, opts = {}) =>
    sendFeedback({ toast: String(msg || ""), refreshKeychain: true, ...(opts || {}) });
  const notifyError = (msg = "失敗", opts = {}) =>
    sendFeedback({ toast: String(msg || "失敗"), pulse: "err", refreshKeychain: true, ...(opts || {}) });
  const commitDeletion = async (ids, pending, toastMsg) => {
    let removed = [];
    try { removed = await cancelPendingBySpecs({ kind: "ids", ids }, pending); } catch (_) { removed = []; }
    try { const st = loadSettings(); const rs = loadRunState(st); removeIdsFromRunState(rs, removed, st); saveRunState(rs, st); } catch (_) {}
    await syncSchedulesAndManageUI(getReferenceDate(), loadSettings());
    notifySuccess(String(toastMsg || ""), { refreshKeychain: true });
  };
  const _decode = (s) => { try { return decodeURIComponent(String(s || "")); } catch (_) { return String(s || ""); } };
  const _parseJson = (s, fallback=null) => {
    try {
      const t = String(s || "").trim();
      if (!t) return fallback;
      return JSON.parse(t);
    } catch (_) { return fallback; }
  };
  const pullPendingSettingsSafe = async () => {
    try {
      const raw = await wv.evaluateJavaScript("JSON.stringify(pendingSettings)");
      const obj = _parseJson(raw, null);
      return obj ? normalizeSettings(obj) : loadSettings();
    } catch (_) {
      return loadSettings();
    }
  };
  const parseScriptableRequest = (url) => {
    const u = String(url || "");
    const m = u.match(/^scriptable-([a-z0-9_-]+):\/\/(.*)$/i);
    if (!m) return null;
    const action = String(m[1] || "").toLowerCase();
    const restAll = String(m[2] || "");
    const parts = restAll.split("?");
    const path = _decode(parts[0] || "");
    const rawQuery = String(parts[1] || "");
    const query = {};
    if (rawQuery) {
      rawQuery.split("&").forEach(kv => {
        const p = kv.split("=");
        const k = _decode(p[0] || "");
        const v = _decode(p.slice(1).join("=") || "");
        if (k) query[k] = v;
      });
    }
    const payload = NULL_PAYLOAD_ACTIONS.has(action) ? null
                  : RAW_PATH_ACTIONS.has(action) ? path
                  : _parseJson(path, null);
    return { action, path, payload, query, url: u };
  };
  const jsRefreshKeychainSoon = () => "try{ setTimeout(function(){ sendCommand('scriptable-keychain://1'); }, 80); }catch(_){ }";
  const jsToast = (msg) => `try{ toast(${JSON.stringify(String(msg || ""))}); }catch(_){ }`;
  const jsPulse = (kind) => `try{ pulse(document.documentElement, ${JSON.stringify(String(kind || "ok"))}); }catch(_){ }`;
  const makeFeedbackJS = (o) => {
    const opt = o || {};
    const out = [];
    if (opt.pulse) out.push(jsPulse(opt.pulse));
    if (opt.toast) out.push(jsToast(opt.toast));
    if (opt.refreshKeychain) out.push(jsRefreshKeychainSoon());
    return out.join("\n");
  };
  const WEBVIEW_HANDLERS = Object.create(null);
  const getKeychainRaw = (k) => { try { return Keychain.contains(k) ? Keychain.get(k) : null; } catch (_) { return null; } };
  const fetchAllKeychainRaw = () => ({
    settingsRaw: getKeychainRaw(KEYCHAIN_KEY),
    runStateProdRaw: getKeychainRaw(RUNSTATE_KEY_PROD),
    runStateTestRaw: getKeychainRaw(RUNSTATE_KEY_TEST),
    disabledProdRaw: getKeychainRaw(DISABLED_NOTI_KEY_PROD),
    disabledTestRaw: getKeychainRaw(DISABLED_NOTI_KEY_TEST),
    cacheRaw: getKeychainRaw(CACHE_KEY)
  });
  const updateCountUI = (type, val, gen = null) => {
    safeEvalJsWithGen(`var el=document.getElementById('count-${type}'); if(el)el.value=${val};`, gen);
  };
  const updateGridUI = (html, gen = null) => {
    safeEvalJsWithGen(`const el=document.getElementById('dynamic-grid'); if(el) el.innerHTML = ${JSON.stringify(html)};`, gen);
  };
  const updateRealmOverrideUI = (st, gen = null) => {
    const html = buildRealmDisplayHtml(st);
    safeEvalJsWithGen(`
      (function(){
        var el = document.getElementById('realm-override-fields');
        if (el) el.innerHTML = ${JSON.stringify(html)};
      })();
    `, gen);
  };
  const copyRealmOverrideSettings = (dst, src) => {
    if (!dst || typeof dst !== "object") dst = {};
    if (!dst.notify || typeof dst.notify !== "object") dst.notify = {};
    if (!dst.notify.pan || typeof dst.notify.pan !== "object") dst.notify.pan = {};
    const pan = src?.notify?.pan || {};
    dst.notify.pan.treasureRealmOverride = pan.treasureRealmOverride || null;
    dst.notify.pan.dailyRealmOverride = pan.dailyRealmOverride || null;
    return dst;
  };
  const getRealmOverrideValidation = (st, baseTime = null) => {
    const settings = st || loadSettings();
    const effectiveNow = getEffectiveNowFromRef(baseTime, settings);
    const laKey = fmtLaKey(effectiveNow);
    const treasureRealmKey = getEffectiveTreasureRealmKey(laKey, settings);
    const dailyRealmKey = getEffectiveDailyRealmKey(laKey, settings);
    return {
      laKey,
      treasureRealmKey,
      dailyRealmKey,
      duplicate: !!treasureRealmKey && treasureRealmKey === dailyRealmKey,
    };
  };
  const persistSettingsAndSyncUI = (st, txTimeMs = null) => {
    saveSettings(st);
    const json = JSON.stringify(st);
    const currentGen = Number.isFinite(txTimeMs) ? txTimeMs : null;
    return safeEvalJsWithGen(`
      window.currentSettings = ${json};
      window.pendingSettings = JSON.parse(JSON.stringify(window.currentSettings));
      if (typeof applySettingsToUI === 'function') applySettingsToUI(window.currentSettings);
    `, currentGen);
  };
  const updatePreviewCards = (st, gen = null, previewTimeMs = null) => {
    const effectiveGen = Number.isFinite(gen) ? gen : null;
    const refMs = Number.isFinite(previewTimeMs) ? previewTimeMs : (effectiveGen != null ? effectiveGen : GLOBAL_REFERENCE_TIME_MS);
    now = getEffectiveNow(new Date(refMs), st);
    const newImages = getPreviewImages(now, st);
    updateGridUI(generateCardsHtml(newImages, st), gen);
  };
  const pushRemainInfoForTime = (baseTime = null, st = null, rsOverride = null, laKeyOverride = null) => {
    const settings = st || loadSettings();
    const referenceTimeMs = getReferenceTimeMs(baseTime);
    const effectiveNow = getEffectiveNowFromRef(referenceTimeMs, settings);
    const remainLaKey = isLaKey(laKeyOverride) ? String(laKeyOverride) : fmtLaKey(effectiveNow);
    const remainInfo = buildRemainInfo(settings, rsOverride || loadRunState(settings), remainLaKey).info;
    const remainJson = JSON.stringify(remainInfo);
    const laKeyJson = JSON.stringify(remainLaKey);
    safeEvalJsWithGen(`
      window.__APP_CONTEXT = Object.assign({}, window.__APP_CONTEXT || {}, {
        remainInfo: ${remainJson},
        remainLaKey: ${laKeyJson}
      });
