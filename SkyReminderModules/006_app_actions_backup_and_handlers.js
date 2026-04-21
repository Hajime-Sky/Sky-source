      if (typeof updateRemainBadges === 'function') updateRemainBadges();
      if (typeof populateDataTab === 'function') populateDataTab();
    `, referenceTimeMs);
    return { referenceTimeMs, effectiveNow, remainLaKey, remainInfo };
  };
const commitMutationAndSync = async (mutationFn, sideEffectsFn = null, successMsg = null, syncOptions = null) => {
  if (typeof sideEffectsFn === "string" && successMsg == null) {
    successMsg = sideEffectsFn;
    sideEffectsFn = null;
  }
  const txTimeMs = getReferenceTimeMs();
  const options = buildSyncOptions(syncOptions && syncOptions.targetType, syncOptions && syncOptions.anchorLaKeys, syncOptions);
  const snapSt = Store.load(KEYCHAIN_KEY, DEFAULT_SETTINGS, normalizeSettings);
  let snapRsProd = null, snapDisProd = null, snapRsTest = null, snapDisTest = null, snapCache = null;
  try { snapRsProd = Keychain.contains(RUNSTATE_KEY_PROD) ? Keychain.get(RUNSTATE_KEY_PROD) : null; } catch (_) {}
  try { snapDisProd = Keychain.contains(DISABLED_NOTI_KEY_PROD) ? Keychain.get(DISABLED_NOTI_KEY_PROD) : null; } catch (_) {}
  try { snapRsTest = Keychain.contains(RUNSTATE_KEY_TEST) ? Keychain.get(RUNSTATE_KEY_TEST) : null; } catch (_) {}
  try { snapDisTest = Keychain.contains(DISABLED_NOTI_KEY_TEST) ? Keychain.get(DISABLED_NOTI_KEY_TEST) : null; } catch (_) {}
  try { snapCache = Keychain.contains(CACHE_KEY) ? Keychain.get(CACHE_KEY) : null; } catch (_) {}
  try {
    await mutationFn(txTimeMs, options);
  } catch (e) {
    console.error("Mutation failed. Rolling back internal state...", e);
    try {
      Store.save(KEYCHAIN_KEY, snapSt, normalizeSettings);
      if (snapRsProd !== null) Keychain.set(RUNSTATE_KEY_PROD, snapRsProd); else { Store.clear(RUNSTATE_KEY_PROD); safeRemoveKeychainKey(RUNSTATE_KEY_PROD, false); }
      if (snapDisProd !== null) Keychain.set(DISABLED_NOTI_KEY_PROD, snapDisProd); else { Store.clear(DISABLED_NOTI_KEY_PROD); safeRemoveKeychainKey(DISABLED_NOTI_KEY_PROD, false); }
      if (snapRsTest !== null) Keychain.set(RUNSTATE_KEY_TEST, snapRsTest); else { Store.clear(RUNSTATE_KEY_TEST); safeRemoveKeychainKey(RUNSTATE_KEY_TEST, false); }
      if (snapDisTest !== null) Keychain.set(DISABLED_NOTI_KEY_TEST, snapDisTest); else { Store.clear(DISABLED_NOTI_KEY_TEST); safeRemoveKeychainKey(DISABLED_NOTI_KEY_TEST, false); }
      if (snapCache !== null) Keychain.set(CACHE_KEY, snapCache); else { Store.clear(CACHE_KEY); safeRemoveKeychainKey(CACHE_KEY, false); }
      persistSettingsAndSyncUI(snapSt, txTimeMs);
      try { updateRealmOverrideUI(snapSt, txTimeMs); } catch (e) { console.error("Realm override UI rollback error:", e); }
      await syncSchedulesAndManageUI(new Date(txTimeMs), snapSt, null, []);
    } catch (rbErr) {
      console.error("Critical: State rollback failed.", rbErr);
    }
    notifySuccess("処理中にエラーが発生し、状態を復元しました", { pulse: "err", refreshKeychain: true });
    return false;
  }
  try {
    const sideEffectResult = (typeof sideEffectsFn === "function") ? await sideEffectsFn(txTimeMs, options) : null;
    const newSt = loadSettings();
    persistSettingsAndSyncUI(newSt, txTimeMs);
    try { updateRealmOverrideUI(newSt, txTimeMs); } catch (e) { console.error("Realm override UI update error:", e); }
    const scheduledResult = await syncSchedulesAndManageUI(new Date(txTimeMs), newSt, options.targetType, options.anchorLaKeys, sideEffectResult);
    const finalSuccessMsg = (typeof successMsg === "function") ? successMsg(txTimeMs, newSt, scheduledResult) : successMsg;
    if (finalSuccessMsg) notifySuccess(finalSuccessMsg, { refreshKeychain: true });
    return true;
  } catch (commitErr) {
    console.error("Side effects or synchronization failed after state mutation:", commitErr);
    notifySuccess("状態は更新されましたが、同期に一部失敗しました", { pulse: "err", refreshKeychain: true });
    return false;
  }
};
const syncSchedulesAndManageUI = async (baseTime, st, targetType = null, anchorLaKeys = [], sideEffectResult = null) => {
  const referenceTimeMs = getReferenceTimeMs(baseTime);
  const normalizedAnchors = normalizeLaKeyArray(anchorLaKeys);
  now = getEffectiveNowFromRef(referenceTimeMs, st);
  const scheduleResult = await withMutex(() => scheduleAllEvents(now, st, targetType, normalizedAnchors));
  const scheduledFallback = sideEffectResult && Array.isArray(sideEffectResult.scheduledItems)
    ? sideEffectResult.scheduledItems
    : (scheduleResult && Array.isArray(scheduleResult.scheduledItems) ? scheduleResult.scheduledItems : null);
  try { await pushManageNotifications(referenceTimeMs, scheduledFallback); } catch (e) { console.error("Manage notif error:", e); }
  try {
    const remainAnchor = normalizedAnchors.length ? normalizedAnchors[0] : null;
    pushRemainInfoForTime(referenceTimeMs, st, null, remainAnchor);
  } catch (e) { console.error("Remain sync error:", e); }
  try { updatePreviewCards(st, referenceTimeMs, referenceTimeMs); } catch (e) { console.error("Preview update error:", e); }
  return scheduleResult;
};
const buildSettingsExportPayload = () => ({
    settings: loadSettings(),
    now: getReferenceDate(GLOBAL_REFERENCE_TIME_MS).toISOString(),
    script: String(Script.name()),
  });
const buildNonImageKeychainBackupPayload = () => {
    const { settingsRaw, runStateProdRaw, runStateTestRaw, disabledProdRaw, disabledTestRaw, cacheRaw } = fetchAllKeychainRaw();
    const backupSettingsRaw = getKeychainRaw(BACKUP_PREFIX + KEYCHAIN_KEY);
    return {
      format: "sky-nonimage-keychain-backup-v1",
      keys: {
        [KEYCHAIN_KEY]: settingsRaw,
        [RUNSTATE_KEY_PROD]: runStateProdRaw,
        [RUNSTATE_KEY_TEST]: runStateTestRaw,
        [DISABLED_NOTI_KEY_PROD]: disabledProdRaw,
        [DISABLED_NOTI_KEY_TEST]: disabledTestRaw,
        [CACHE_KEY]: cacheRaw,
        [BACKUP_PREFIX + KEYCHAIN_KEY]: backupSettingsRaw,
      },
      now: getReferenceDate(GLOBAL_REFERENCE_TIME_MS).toISOString(),
      script: String(Script.name()),
      backupStorageMode: String(loadSettings().backupStorageMode || DEFAULT_SETTINGS.backupStorageMode),
    };
  };
function getSettingsBackupFileManager(settings = null) {
    const st = settings || loadSettings();
    return String(st?.backupStorageMode || DEFAULT_SETTINGS.backupStorageMode) === 'local' ? FileManager.local() : FileManager.iCloud();
  }
function getSettingsBackupDir(settings = null, fmOverride = null) {
    const fm = fmOverride || getSettingsBackupFileManager(settings);
    const dir = fm.joinPath(fm.documentsDirectory(), SETTINGS_BACKUP_DIRNAME);
    if (!fm.fileExists(dir)) fm.createDirectory(dir, true);
    return dir;
  }
function getSettingsBackupDirLabel(settings = null) {
    const st = settings || loadSettings();
    const mode = String(st?.backupStorageMode || DEFAULT_SETTINGS.backupStorageMode) === 'local' ? 'local' : 'iCloud';
    return `${mode} / ${SETTINGS_BACKUP_DIRNAME}`;
  }
function buildSettingsBackupFilename(now = new Date()) {
    const d = (now instanceof Date) ? now : new Date(now);
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    const base = String(Script.name() || 'SkyReminder').replace(/[\/:*?"<>|\s]+/g, '_');
    return `${base}_${stamp}${SETTINGS_BACKUP_EXT}`;
  }
function writeSettingsBackupFile(payload, settings = null, fmOverride = null) {
    const fm = fmOverride || getSettingsBackupFileManager(settings);
    const dir = getSettingsBackupDir(settings, fm);
    const path = fm.joinPath(dir, buildSettingsBackupFilename(getReferenceDate(GLOBAL_REFERENCE_TIME_MS)));
    fm.writeString(path, JSON.stringify(payload, null, 2));
    return path;
  }
function listSettingsBackupFiles(settings = null, fmOverride = null) {
    const fm = fmOverride || getSettingsBackupFileManager(settings);
    const dir = getSettingsBackupDir(settings, fm);
    const names = fm.listContents(dir) || [];
    return names
      .filter(name => String(name || '').endsWith(SETTINGS_BACKUP_EXT))
      .map(name => {
        const path = fm.joinPath(dir, name);
        let mtime = 0;
        try { mtime = Number(fm.modificationDate(path)?.getTime?.() || 0); } catch (_) { mtime = 0; }
        return { name, path, mtime };
      })
      .sort((a, b) => (b.mtime - a.mtime) || String(b.name).localeCompare(String(a.name)));
  }
function readLatestSettingsBackupFile(settings = null, fmOverride = null) {
    const fm = fmOverride || getSettingsBackupFileManager(settings);
    const files = listSettingsBackupFiles(settings, fm);
    if (!files.length) return null;
    const latest = files[0];
    const raw = fm.readString(latest.path);
    const parsed = JSON.parse(String(raw || '{}'));
    return { ...latest, raw, parsed };
  }
function setKeychainRawValue(key, raw) {
    const k = String(key || '').trim();
    if (!k) return;
    if (raw == null) {
      try { if (Keychain.contains(k)) Keychain.remove(k); } catch (_) {}
      try { Store.clear(k); } catch (_) {}
      return;
    }
    const value = typeof raw === 'string' ? raw : JSON.stringify(raw);
    Keychain.set(k, String(value));
    try { Store.clear(k); } catch (_) {}
  }
const buildKeychainExportPayload = () => {
    const { settingsRaw, runStateProdRaw, runStateTestRaw, disabledProdRaw, disabledTestRaw, cacheRaw } = fetchAllKeychainRaw();
    const tryParse = (s) => {
      if (s == null || s === undefined) return s;
      if (typeof s !== "string") return s;
      const t = s.trim();
      if (!t) return s;
      if (!(t.startsWith("{") || t.startsWith("[") || t.startsWith("\""))) return s;
      try { return JSON.parse(s); } catch (_) { return s; }
    };
    return {
      keys: {
        [KEYCHAIN_KEY]: tryParse(settingsRaw),
        [RUNSTATE_KEY_PROD]: tryParse(runStateProdRaw),
        [RUNSTATE_KEY_TEST]: tryParse(runStateTestRaw),
        [DISABLED_NOTI_KEY_PROD]: tryParse(disabledProdRaw),
        [DISABLED_NOTI_KEY_TEST]: tryParse(disabledTestRaw),
        [CACHE_KEY]: tryParse(cacheRaw),
      },
      now: getReferenceDate(GLOBAL_REFERENCE_TIME_MS).toISOString(),
      script: String(Script.name()),
      architectureReview: buildArchitectureReview(),
    };
  };
  const parseBackupPayload = (parsed) => {
    if (!parsed || typeof parsed !== 'object') return null;
    const keys = parsed.keys && typeof parsed.keys === 'object' ? parsed.keys : null;
    if (!keys) return null;
    const settingsCandidateRaw = keys[KEYCHAIN_KEY];
    if (settingsCandidateRaw == null) return null;
    let settingsCandidate = null;
    try { settingsCandidate = typeof settingsCandidateRaw === 'string' ? JSON.parse(settingsCandidateRaw) : settingsCandidateRaw; } catch (_) { settingsCandidate = null; }
    if (!settingsCandidate || typeof settingsCandidate !== 'object' || Array.isArray(settingsCandidate)) return null;
    const importedSettings = normalizeSettings(settingsCandidate);
    return { keys, settings: importedSettings };
  };
  const parsePayloadIds = (payload) => (Array.isArray(payload) ? payload : []).map(String).filter(Boolean);
  const escapeForJsString = (str) => String(str).replace(/\\/g, "\\\\").replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/\t/g, "\\t").replace(/"/g, "\\\"");
  const processDisablingNotifications = (pending, includePredicate) => {
    const disabled = loadDisabledList();
    const exists = new Set(disabled.map(x => String(x?.id || "")).filter(Boolean));
    const idsToCancel = [];
    for (const n of (pending || [])) {
      const id = String(n?.identifier || "");
      if (!id || !NOTI_ID.isManagedId(id) || exists.has(id) || !includePredicate(id)) continue;
      idsToCancel.push(id);
      disabled.push(extractNotiMeta(n, getReferenceTimeMs()));
    }
    return { ids: idsToCancel, disabled };
  };
  const applyNotificationDisabling = async (processed, pending, msg) => {
    saveDisabledList(processed.disabled);
    await commitDeletion(processed.ids, pending, msg);
  };
const _getSettingsFromRequest = async (r) => r.payload ? normalizeSettings(r.payload) : await pullPendingSettingsSafe();
WEBVIEW_HANDLERS[WV_ACTION.PREVIEW] = async (r) => {
  const newSettings = await _getSettingsFromRequest(r);
  updatePreviewCards(newSettings);
};
WEBVIEW_HANDLERS[WV_ACTION.SAVE] = async (r) => {
  const prevSettings = loadSettings();
  const incomingSettings = (r && r.settings) ? normalizeSettings(r.settings) : await _getSettingsFromRequest(r);
  const mergedPreview = copyRealmOverrideSettings(normalizeSettings(Object.assign({}, prevSettings, incomingSettings || {})), prevSettings);
  const reschedulePlan = buildSettingsReschedulePlan(prevSettings, mergedPreview);
  const rescheduleTypes = Array.isArray(reschedulePlan.types) ? reschedulePlan.types.slice() : [];
  const syncOptions = rescheduleTypes.length ? buildSyncOptions(reschedulePlan.targetType, reschedulePlan.anchorLaKeys) : null;
  await commitMutationAndSync(async (txTimeMs) => {
    const currentSettings = loadSettings();
    const newSettings = copyRealmOverrideSettings(normalizeSettings(Object.assign({}, currentSettings, incomingSettings || {})), currentSettings);
    saveSettings(newSettings);
    if (rescheduleTypes.length) {
      const resetLaKeys = getTodayNextLaKeysForRef(txTimeMs, newSettings);
      const rs = loadRunState(newSettings);
      let removedCacheCount = 0;
      for (const type of rescheduleTypes) {
        removedCacheCount += clearScheduleCacheByType(type);
        resetTypePendingStateAllDays(rs, type, newSettings, resetLaKeys);
      }
      saveRunState(rs, newSettings);
      try { console.log(`[[UDXDBG]] ${new Date(txTimeMs).toISOString()} [settings.save.reschedule] ${JSON.stringify({ types: rescheduleTypes, targetType: reschedulePlan.targetType || null, useCache: newSettings.useCache !== false, removedCacheCount, resetLaKeys })}`); } catch (_) {}
    }
  }, async (txTimeMs) => {
    if (!rescheduleTypes.length) return null;
    const st = loadSettings();
    let removedPendingCount = 0;
    for (const type of rescheduleTypes) {
      const removed = await cancelPendingNotificationsByType(type, st);
      removedPendingCount += Array.isArray(removed) ? removed.length : 0;
    }
    try { console.log(`[[UDXDBG]] ${new Date(txTimeMs).toISOString()} [settings.postsave.reschedule] ${JSON.stringify({ types: rescheduleTypes, removedPendingCount, useCache: st.useCache !== false, testMode: !!st.testMode })}`); } catch (_) {}
    return null;
  }, "設定を保存し、表示を更新しました", syncOptions);
};
WEBVIEW_HANDLERS[WV_ACTION.SAVE_REALM_OVERRIDES] = async (r) => {
  const currentSettings = loadSettings();
  const incomingSettings = (r && r.settings) ? normalizeSettings(r.settings) : await _getSettingsFromRequest(r);
  const nextSettings = normalizeSettings(JSON.parse(JSON.stringify(currentSettings || DEFAULT_SETTINGS)));
  nextSettings.notify.pan.treasureRealmOverride = incomingSettings?.notify?.pan?.treasureRealmOverride || null;
  nextSettings.notify.pan.dailyRealmOverride = incomingSettings?.notify?.pan?.dailyRealmOverride || null;
  const validation = getRealmOverrideValidation(nextSettings, null);
  if (validation.duplicate) {
    try { console.log(`[[UDXDBG]] [pan.realmoverride.duplicate.allowed] ${JSON.stringify(validation)}`); } catch (_) {}
  }
  const mergedPreview = normalizeSettings(JSON.parse(JSON.stringify(nextSettings)));
  const resetLaKeys = getTodayNextLaKeysForRef(null, mergedPreview);
  const needsOriginalSin = mergedPreview?.notify?.originalSin?.enabled !== false && !!mergedPreview?.notify?.originalSin?.idleWindowEnabled;
  const syncOptions = buildSyncOptions(needsOriginalSin ? null : 'pan', resetLaKeys);
  await commitMutationAndSync(async (txTimeMs) => {
    const st = loadSettings();
    st.notify.pan.treasureRealmOverride = nextSettings.notify.pan.treasureRealmOverride;
    st.notify.pan.dailyRealmOverride = nextSettings.notify.pan.dailyRealmOverride;
    saveSettings(st);
    let removedCacheCount = clearScheduleCacheByType('pan');
    if (needsOriginalSin) removedCacheCount += clearScheduleCacheByType('originalSin');
    const rs = loadRunState(st);
    const resetKeys = getTodayNextLaKeysForRef(txTimeMs, st);
    resetTypePendingStateAllDays(rs, 'pan', st, resetKeys);
    if (needsOriginalSin) resetTypePendingStateAllDays(rs, 'originalSin', st, resetKeys);
    saveRunState(rs, st);
    try { console.log(`[[UDXDBG]] ${new Date(txTimeMs).toISOString()} [pan.realmoverride.save] ${JSON.stringify({ treasureRealmOverride: st?.notify?.pan?.treasureRealmOverride || null, dailyRealmOverride: st?.notify?.pan?.dailyRealmOverride || null, removedCacheCount, resetKeys })}`); } catch (_) {}
  }, async (txTimeMs) => {
    const st = loadSettings();
    const removed = await cancelPendingNotificationsByType('pan', st);
    let removedPendingCount = Array.isArray(removed) ? removed.length : 0;
    if (needsOriginalSin) {
      const removedOs = await cancelPendingNotificationsByType('originalSin', st);
      removedPendingCount += Array.isArray(removedOs) ? removedOs.length : 0;
    }
    try { console.log(`[[UDXDBG]] ${new Date(txTimeMs).toISOString()} [pan.realmoverride.reschedule] ${JSON.stringify({ removedPendingCount, useCache: st.useCache !== false, testMode: !!st.testMode, needsOriginalSin })}`); } catch (_) {}
    return null;
  }, "地方の上書きを保存しました", syncOptions);
};
WEBVIEW_HANDLERS[WV_ACTION.DYE_COMPLETE] = async (_r) => {
  await commitMutationAndSync(
    async (txTimeMs) => {
      const st = loadSettings();
      const { laKey } = getDayContext(txTimeMs, st);
      const rs = loadRunState(st);
      const day = getDayState(rs, laKey, st);
      const ts = ensureTypeState(day, "dye");
      ts.pendingIds = [];
      ts.lastDoneAt = new Date(txTimeMs).toISOString();
      clearScheduleCacheByType("originalSin");
      saveRunState(rs, st);
    },
    async (txTimeMs) => {
      const st = loadSettings();
      const { laKey } = getDayContext(txTimeMs, st);
      const p = providerForType("dye", st);
      if (!p) return;
      const tids = [p.buildThreadId(st, laKey), p.buildTestThreadId(st, laKey)];
      const specs = tids.map(tid => ({ kind: "thread", threadId: tid }));
      const removed = await cancelPendingBySpecs(specs);
      if (removed?.length) {
        const rs = loadRunState(st);
        removeIdsFromRunState(rs, removed, st);
        saveRunState(rs, st);
      }
    },
    "染料の通知を完了扱いにしました"
  );
};
WEBVIEW_HANDLERS[WV_ACTION.PAN_TREASURE_COMPLETE] = async (_r) => {
  const st = loadSettings();
  const effectiveNow = getEffectiveNowFromRef(null, st);
  const laKey = fmtLaKey(effectiveNow);
  const rs = loadRunState(st);
  const day = getDayState(rs, laKey, st);
  const ts = ensureTypeState(day, "pan");
  const wasDone = !!ts.forestTreasureDone;
  await commitMutationAndSync(
    async (txTimeMs) => {
      if (wasDone) {
        unmarkPanForestTreasureDone(txTimeMs, loadSettings());
        clearScheduleCacheByType("originalSin");
      } else {
        markPanForestTreasureDone(txTimeMs, loadSettings());
        clearScheduleCacheByType("originalSin");
      }
    },
    async (txTimeMs) => {
      const nowDone = !wasDone;
      const btnText = nowDone ? "雨林大キャン回収を未完了にする" : "雨林大キャン回収を完了扱いにする";
      const btnClass = nowDone ? "btn btn-action-temp flash-ok" : "btn btn-action-temp";
      safeEvalJsWithGen(`
        var btns = document.querySelectorAll('[onclick*="pantreasurecomplete"]');
        btns.forEach(function(b){ b.textContent = ${JSON.stringify(btnText)}; b.className = ${JSON.stringify(btnClass)}; });
      `, txTimeMs);
      return null;
    },
    wasDone ? "雨林大キャン回収を未完了にしました" : "雨林大キャン回収を完了扱いにしました"
  );
};
WEBVIEW_HANDLERS[WV_ACTION.PAN_DAILY_COMPLETE] = async (_r) => {
  const st = loadSettings();
  const effectiveNow = getEffectiveNowFromRef(null, st);
  const laKey = fmtLaKey(effectiveNow);
  const rs = loadRunState(st);
  const day = getDayState(rs, laKey, st);
  const ts = ensureTypeState(day, "pan");
  const wasDone = !!ts.forestDailyDone;
  await commitMutationAndSync(
    async (txTimeMs) => {
      if (wasDone) {
        unmarkPanForestDailyDone(txTimeMs, loadSettings());
        clearScheduleCacheByType("originalSin");
      } else {
        markPanForestDailyDone(txTimeMs, loadSettings());
        clearScheduleCacheByType("originalSin");
      }
    },
    async (txTimeMs) => {
      const nowDone = !wasDone;
      const btnText = nowDone ? "雨林デイリーを未完了にする" : "雨林デイリーを完了扱いにする";
      const btnClass = nowDone ? "btn btn-action-temp flash-ok" : "btn btn-action-temp";
      safeEvalJsWithGen(`
        var btns = document.querySelectorAll('[onclick*="pandailycomplete"]');
        btns.forEach(function(b){ b.textContent = ${JSON.stringify(btnText)}; b.className = ${JSON.stringify(btnClass)}; });
      `, txTimeMs);
      return null;
    },
    wasDone ? "雨林デイリーを未完了にしました" : "雨林デイリーを完了扱いにしました"
  );
};
WEBVIEW_HANDLERS[WV_ACTION.ORIGINAL_SIN_COMPLETE] = async (_r) => {
  const st = loadSettings();
  const effectiveNow = getEffectiveNowFromRef(null, st);
  const laKey = fmtLaKey(effectiveNow);
  const state = getOriginalSinStateForLaKey(laKey, st);
  const wasDone = !!state.done;
  const weekLaKeys = getOriginalSinWeekLaKeys(effectiveNow, st);
  await commitMutationAndSync(
    async (txTimeMs) => {
      if (wasDone) unmarkOriginalSinDone(txTimeMs, loadSettings());
      else markOriginalSinDone(txTimeMs, loadSettings());
      clearScheduleCacheByType("originalSin");
    },
    async (txTimeMs) => {
      const nowDone = !wasDone;
      const btnText = nowDone ? "今週の原罪を未完了にする" : "今週の原罪を完了扱いにする";
      const btnClass = nowDone ? "btn btn-action-temp flash-ok" : "btn btn-action-temp";
      safeEvalJsWithGen(`
        var btns = document.querySelectorAll('[onclick*="originalsincomplete"]');
        btns.forEach(function(b){ b.textContent = ${JSON.stringify(btnText)}; b.className = ${JSON.stringify(btnClass)}; });
      `, txTimeMs);
      return null;
    },
    wasDone ? "今週の原罪を未完了にしました" : "今週の原罪を完了扱いにしました",
    buildSyncOptions("originalSin", weekLaKeys)
  );
};
WEBVIEW_HANDLERS[WV_ACTION.KEYCHAIN] = async (_r) => {
  try {
    const st = loadSettings();
    const rsKey = getRunStateKey(st);
    const disKey = getDisabledNotiKey(st);
    const data = {
      settings: st,
      runstate: loadRunState(st),
      disabled: loadDisabledList(st),
      keys: {
        settings: KEYCHAIN_KEY,
        runstate: rsKey,
        disabled: disKey,
        cache: CACHE_KEY
      },
      architectureReview: buildArchitectureReview()
    };
    const json = JSON.stringify(data);
    safeEvalJsWithGen(`
      var txt = JSON.stringify(${json}, null, 2);
      var pre = document.getElementById('keychain-pre');
      if (pre) pre.textContent = txt;
      var overlayPre = document.getElementById('keychain-overlay-pre');
      if (overlayPre) overlayPre.textContent = txt;
    `, getReferenceTimeMs());
  } catch (e) { console.error("Keychain fetch error", e); }
};
WEBVIEW_HANDLERS["setcount"] = async (r) => {
  const type = String(r.path || "").trim();
  const val = Number(r.query?.v || 0);
  if (!type || !Number.isFinite(val)) return;
  let newCount = 0;
  let operateLaKey = "";
  await commitMutationAndSync(async (txTimeMs) => {
    const settings = loadSettings();
    operateLaKey = resolveOperateLaKey(r.query?.la, txTimeMs, settings);
    let latestRs = null;
    newCount = await withMutex(() => {
      const rs = loadRunState(settings);
      const day = getDayState(rs, operateLaKey, settings);
      const ts = ensureTypeState(day, type);
      const p = providerForType(type, settings);
      let effectiveLimit = getDailyLimitForType(settings, type, operateLaKey);
      if (!p || !p.isEnabled(settings)) effectiveLimit = 0;
      const prevCount = Number(ts.count || 0);
      let c = Math.max(0, val);
      if (effectiveLimit > 0 && c > effectiveLimit) c = effectiveLimit;
      if (effectiveLimit === 0) c = 0;
      ts.count = c;
      if (c <= 0) delete ts.lastDoneAt;
      else if (c > prevCount && type !== "originalSin" && type !== "updateTime") ts.lastDoneAt = new Date(txTimeMs).toISOString();
      clearScheduleCacheByType("originalSin");
      latestRs = saveRunState(rs, settings);
      return c;
    });
    updateCountUI(type, newCount, txTimeMs);
    if (latestRs) pushRemainInfoForTime(txTimeMs, settings, latestRs, operateLaKey);
  }, null, () => `カウントを ${newCount} に設定しました`, buildSyncOptions(null, operateLaKey ? [operateLaKey] : []));
};
WEBVIEW_HANDLERS[WV_ACTION.RESET_DAY] = async (r) => {
  const type = String(r.path || "").trim();
  let msg = "";
  let operateLaKey = "";
  await commitMutationAndSync(async (txTimeMs) => {
    const settings = loadSettings();
    operateLaKey = resolveOperateLaKey(r.query?.la, txTimeMs, settings);
    const rs = loadRunState(settings);
    const day = getDayState(rs, operateLaKey, settings);
    const clearState = (obj) => { if (obj) { obj.count = 0; obj.notifiedIds = []; delete obj.lastDoneAt; } };
    const clearExtraCompletion = (tp, obj) => {
      if (!obj) return;
      if (tp === "pan") {
        obj.forestTreasureDone = false;
        obj.forestDailyDone = false;
        delete obj.forestTreasureDoneAt;
        delete obj.forestDailyDoneAt;
      }
      if (tp === "originalSin") {
        obj.weekDone = false;
        delete obj.weekDoneAt;
      }
    };
    if (type === "all") {
      for (const tp of getEventTypesForDay(settings, day)) {
        clearState(day?.[tp]);
        clearExtraCompletion(tp, day?.[tp]);
        updateCountUI(tp, 0, txTimeMs);
      }
      msg = "本日の全実績リセットしました";
    } else {
      const ts = ensureTypeState(day, type);
      clearState(ts);
      clearExtraCompletion(type, ts);
      updateCountUI(type, 0, txTimeMs);
      msg = `リセットしました（LA: ${operateLaKey} / ${type}）`;
    }
    clearScheduleCacheByType("originalSin");
    const savedRs = saveRunState(rs, settings);
    pushRemainInfoForTime(txTimeMs, settings, savedRs, operateLaKey);
  }, null, () => msg, buildSyncOptions(null, operateLaKey ? [operateLaKey] : []));
};
WEBVIEW_HANDLERS[WV_ACTION.KEYCHAIN_COPY] = async (_r) => {
  const payload = buildKeychainExportPayload();
  try { Pasteboard.copyString(JSON.stringify(payload, null, 2)); } catch (_) {}
  notifySuccess("コピーしました", { refreshKeychain: false });
};
function buildHtmlDumpFilename(now = new Date()) {
  const d = (now instanceof Date) ? now : new Date(now);
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const base = String(Script.name() || 'SkyReminder').replace(/[\/:*?"<>|\s]+/g, '_');
  return `${base}_${stamp}.html.txt`;
}
WEBVIEW_HANDLERS[WV_ACTION.HTML_COPY] = async (_r) => {
  try {
    const html = await wv.evaluateJavaScript("document.documentElement.outerHTML");
    const st = loadSettings();
    const fm = getSettingsBackupFileManager(st);
    const dir = getSettingsBackupDir(st, fm);
    const path = fm.joinPath(dir, buildHtmlDumpFilename(getReferenceDate(GLOBAL_REFERENCE_TIME_MS)));
    fm.writeString(path, String(html || ""));
    notifySuccess(`現在のHTMLを書き出しました: ${String(path).split('/').pop()} (${getSettingsBackupDirLabel(st)})`, { refreshKeychain: false });
  } catch (e) {
    notifyError(`HTML書き出しに失敗しました: ${e}`, { refreshKeychain: false });
  }
};
WEBVIEW_HANDLERS[WV_ACTION.APPLY_PRESET] = async (r) => {
  const presetKey = String(r.path || '').trim();
  if (!SETTINGS_PRESETS[presetKey]) {
    notifyError('不明なプリセットです', { refreshKeychain: false });
    return;
  }
  const prevSettings = loadSettings();
  const nextSettings = applySettingsPreset(prevSettings, presetKey);
  const reschedulePlan = buildSettingsReschedulePlan(prevSettings, nextSettings);
  const rescheduleTypes = Array.isArray(reschedulePlan.types) ? reschedulePlan.types.slice() : [];
  const syncOptions = rescheduleTypes.length ? buildSyncOptions(reschedulePlan.targetType, reschedulePlan.anchorLaKeys) : null;
  await commitMutationAndSync(async (txTimeMs) => {
    saveSettings(nextSettings);
    if (rescheduleTypes.length) {
      const resetLaKeys = getTodayNextLaKeysForRef(txTimeMs, nextSettings);
      const rs = loadRunState(nextSettings);
      for (const type of rescheduleTypes) {
        clearScheduleCacheByType(type);
        resetTypePendingStateAllDays(rs, type, nextSettings, resetLaKeys);
      }
      saveRunState(rs, nextSettings);
    }
  }, async (_txTimeMs) => {
    const st = loadSettings();
    for (const type of rescheduleTypes) await cancelPendingNotificationsByType(type, st);
    return null;
  }, `プリセットを適用しました: ${SETTINGS_PRESETS[presetKey].label}`, syncOptions);
};
WEBVIEW_HANDLERS[WV_ACTION.SETTINGS_EXPORT] = async (_r) => {
  try {
    const st = loadSettings();
    const payload = buildNonImageKeychainBackupPayload();
    const path = writeSettingsBackupFile(payload, st);
    notifySuccess(`バックアップを書き出しました: ${String(path).split('/').pop()} (${getSettingsBackupDirLabel(st)})`, { refreshKeychain: false });
  } catch (e) {
    notifyError(`バックアップ書き出しに失敗しました: ${e}`, { refreshKeychain: false });
  }
};
WEBVIEW_HANDLERS[WV_ACTION.SETTINGS_IMPORT] = async (_r) => {
  const currentSettings = loadSettings();
  let loaded = null;
  try { loaded = readLatestSettingsBackupFile(currentSettings); } catch (_) { loaded = null; }
  if (!loaded) {
    notifyError("バックアップファイルが見つかりません", { refreshKeychain: false });
    return;
  }
  const parsedPayload = parseBackupPayload(loaded.parsed);
  if (!parsedPayload) {
    notifyError("バックアップファイルの形式が正しくありません", { refreshKeychain: false });
    return;
  }
  const importedSettings = parsedPayload.settings;
  const validation = getRealmOverrideValidation(importedSettings, null);
  if (validation.duplicate) {
    try { console.log(`[[UDXDBG]] [settings.import.realmoverride.duplicate.allowed] ${JSON.stringify(validation)}`); } catch (_) {}
  }
  const prevSettings = loadSettings();
  const allTypes = getAllProviderTypes(importedSettings);
  const syncOptions = allTypes.length ? buildSyncOptions(null, getTodayNextLaKeysForRef(null, importedSettings)) : null;
  await commitMutationAndSync(async (txTimeMs) => {
    const keys = parsedPayload.keys || {};
    for (const key of [KEYCHAIN_KEY, RUNSTATE_KEY_PROD, RUNSTATE_KEY_TEST, DISABLED_NOTI_KEY_PROD, DISABLED_NOTI_KEY_TEST, CACHE_KEY, BACKUP_PREFIX + KEYCHAIN_KEY]) {
      const raw = Object.prototype.hasOwnProperty.call(keys, key) ? keys[key] : null;
      if (key === KEYCHAIN_KEY) {
        setKeychainRawValue(key, JSON.stringify(importedSettings));
      } else {
        setKeychainRawValue(key, raw);
      }
    }
    const st = loadSettings();
    const resetLaKeys = getTodayNextLaKeysForRef(txTimeMs, st);
    const rs = loadRunState(st);
    for (const type of allTypes) {
      clearScheduleCacheByType(type);
      resetTypePendingStateAllDays(rs, type, st, resetLaKeys);
    }
    saveRunState(rs, st);
    try { console.log(`[[UDXDBG]] ${new Date(txTimeMs).toISOString()} [settings.import.restore] ${JSON.stringify({ file: loaded.name, allTypes, resetLaKeys })}`); } catch (_) {}
  }, async (_txTimeMs) => {
    const st = loadSettings();
    for (const type of allTypes) {
      await cancelPendingNotificationsByType(type, st);
    }
    return null;
  }, `バックアップを読み込みました: ${loaded.name} (${getSettingsBackupDirLabel(importedSettings)})`, syncOptions);
};
WEBVIEW_HANDLERS[WV_ACTION.DELETE_KEYCHAIN] = async (r) => {
  let key = String(r.path || "").trim();
  if (key === "RUNSTATE") key = getRunStateKey(loadSettings());
  await commitMutationAndSync(
    async () => {
      if (key) {
        safeRemoveKeychainKey(key)
        Store.clear(key);
      }
    },
    async () => {
      const { pending, managedIds } = await fetchManagedPendingContext();
      if (managedIds.length > 0) await removePendingIds(managedIds, pending);
    },
    "データを削除し初期化しました"
  );
};
WEBVIEW_HANDLERS["clearcache"] = async (_r) => {
  await commitMutationAndSync(
    async () => {
      safeRemoveKeychainKey(CACHE_KEY, false)
      Store.clear(CACHE_KEY);
    },
    async () => {
      const fm = FileManager.local();
      const dir = getImagesDir(fm);
      if (fm.fileExists(dir)) { try { fm.remove(dir); } catch (_) {} }
      const results = await syncAllConstellationImages(CONSTELLATION_REALMS, fm);
      const failed = (results || []).filter(x => !x || x.ok !== true);
      const st = loadSettings();
      st.imageAutoFetchEnabled = failed.length === 0;
      saveSettings(st);
      if (failed.length) throw new Error(`image_sync_failed:${failed.map(x => String(x?.realm || '?')).join(',')}`);
    },
    "画像を更新し、揮発キャッシュをクリアしました"
  );
};
WEBVIEW_HANDLERS["deleteimages"] = async (_r) => {
  await commitMutationAndSync(
    async () => { /* 内部状態の変更なし */ },
    async () => {
      const fm = FileManager.local();
      const dir = getImagesDir(fm);
      if (fm.fileExists(dir)) { try { fm.remove(dir); } catch (_) {} }
    },
    "画像キャッシュを削除しました"
  );
};
WEBVIEW_HANDLERS[WV_ACTION.DELETE_ALL_KEYCHAIN] = async (_r) => {
  await commitMutationAndSync(
    async () => {
      const keys = [KEYCHAIN_KEY, RUNSTATE_KEY_PROD, RUNSTATE_KEY_TEST, DISABLED_NOTI_KEY_PROD, DISABLED_NOTI_KEY_TEST, CACHE_KEY, BACKUP_PREFIX + KEYCHAIN_KEY];
      for (const k of keys) {
        safeRemoveKeychainKey(k)
        Store.clear(k);
      }
    },
    async () => {
      const fm = FileManager.local();
      const dir = getImagesDir(fm);
      if (fm.fileExists(dir)) { try { fm.remove(dir); } catch (e) { console.error(e); } }
      const { pending, managedIds } = await fetchManagedPendingContext();
      if (managedIds.length > 0) await removePendingIds(managedIds, pending);
    },
    "すべてのデータと画像を完全に削除しました"
  );
};
WEBVIEW_HANDLERS[WV_ACTION.NOTIF_LIST] = async (_r) => {
  await pushManageNotifications(getReferenceTimeMs());
};
WEBVIEW_HANDLERS[WV_ACTION.NOTIF_DISABLE] = async (r) => {
  await commitMutationAndSync(async (txTimeMs) => {
    let ids = parsePayloadIds(r.payload || r.ids).filter(id => NOTI_ID.isManagedId(id));
    if (!ids.length) throw new Error("オフ対象がありません");
    const pending = await fetchAllPendingSafe();
    let removed = [];
    try { removed = await cancelPendingBySpecs({ kind: "ids", ids }, pending); } catch (_) {}
    const st = loadSettings();
    let dList = loadDisabledList(st);
    ids.forEach(id => {
      if (dList.find(x => String(x?.id || '') === id)) return;
      const pendingMatch = (pending || []).find(n => String(n?.identifier || '') === id);
      dList.push(pendingMatch ? extractNotiMeta(pendingMatch, txTimeMs) : hydrateDisabledMeta({ id, ts: txTimeMs }, txTimeMs, st));
    });
    saveDisabledList(dList, st, txTimeMs);
    const rs = loadRunState(st);
    removeIdsFromRunState(rs, removed, st);
    saveRunState(rs, st);
  }, "選択した通知をオフにしました");
};
WEBVIEW_HANDLERS[WV_ACTION.NOTIF_DIS_ALL] = async (_r) => {
  await commitMutationAndSync(
    async (txTimeMs) => {
      const st = loadSettings();
      let dList = loadDisabledList(st);
      const { pending, managedIds } = await fetchManagedPendingContext();
      managedIds.forEach(id => {
        if (dList.find(x => String(x?.id || '') === id)) return;
        const pendingMatch = (pending || []).find(n => String(n?.identifier || '') === id);
        dList.push(pendingMatch ? extractNotiMeta(pendingMatch, txTimeMs) : hydrateDisabledMeta({ id, ts: txTimeMs }, txTimeMs, st));
      });
      saveDisabledList(dList, st, txTimeMs);
    },
    async () => {
      const { pending, managedIds } = await fetchManagedPendingContext();
      if (managedIds.length > 0) await removePendingIds(managedIds, pending);
      const st = loadSettings();
      const rs = loadRunState(st);
      removeIdsFromRunState(rs, managedIds, st);
      saveRunState(rs, st);
    },
    "すべての通知をオフにしました"
  );
};
WEBVIEW_HANDLERS[WV_ACTION.NOTIF_ENABLE] = async (r) => {
  await commitMutationAndSync(async (txTimeMs) => {
    let ids = parsePayloadIds(r.payload || r.ids);
    if (!ids.length) throw new Error("オン対象がありません");
    const st = loadSettings();
    let dList = loadDisabledList(st);
    dList = dList.filter(x => !ids.includes(String(x?.id || "")));
    saveDisabledList(dList, st, txTimeMs);
  }, "選択した通知をオンにしました");
};
WEBVIEW_HANDLERS[WV_ACTION.NOTIF_ENABLE_ALL] = async (_r) => {
  await commitMutationAndSync(async (txTimeMs) => {
    const st = loadSettings();
    saveDisabledList([], st, txTimeMs);
  }, "すべての通知をオンにしました");
};
const ALLOWED_EMBED_REQUEST_RE = /^(https?:\/\/)(www\.youtube(?:-nocookie)?\.com\/|i\.ytimg\.com\/|s\.ytimg\.com\/|yt3\.ggpht\.com\/|([A-Za-z0-9-]+\.)*googlevideo\.com\/|www\.google\.com\/recaptcha\/|consent\.youtube\.com\/)/i;
wv.shouldAllowRequest = (req) => {
  const handleWvError = (e) => { try { console.error(e); } catch (_) {} notifyError("WebViewエラーが発生しました（詳細はScriptableのログを確認）"); return false; };
  try {
    const url = String(req?.url || "");
    if (/^https?:\/\//i.test(url)) {
      if (ALLOWED_EMBED_REQUEST_RE.test(url)) {
        return true;
      }
      try { Safari.open(url); } catch (_) {}
      return false;
    }
    const r = parseScriptableRequest(url);
    if (!r) return true;
    const h = WEBVIEW_HANDLERS[r.action];
    if (!h) return true;
    (async () => {
      try { await h(r); }
      catch (e) { return handleWvError(e); }
    })();
    return false;
  } catch (e) {
    return handleWvError(e);
  }
};
  await wv.present();
}
async function checkAutomationTimeShift(now, settings) {
  const st = settings || loadSettings();
  const laParts = getVisualUTC(now, TZ_LA);
  const h = Number(laParts.h);
  const m = Number(laParts.mi);
  const isNormal = (h === 23 && m >= 45) || (h === 0 && m <= 30);
  if (isNormal) return;
  const laKey = fmtLaKey(now);
  let rs = loadRunState(st);
  const day = getDayState(rs, laKey, st);
  if (day.automationWarned) return;
  day.automationWarned = true;
  saveRunState(rs, st);
  const isDst = isDstAt(now, TZ_LA);
  const jstUpdateHour = isDst ? 16 : 17;
  const n = new Notification();
  n.identifier = `${ID_PREFIX.ACT}:warn:${laKey}`;
  n.title = "⚠️ オートメーション時刻の修正";
  n.body = `更新時刻が日本時間${jstUpdateHour}時に変わりました。ショートカットの実行時刻を${jstUpdateHour}時台に修正してください。`;
  n.sound = "default";
  n.openURL = "shortcuts://";
  n.setTriggerDate(new Date(getReferenceTimeMs() + 1000));
  try { await n.schedule(); } catch (_) {}
}
const getQueryParameters = (a) => (a?.queryParameters && Object.keys(a.queryParameters).length) ? a.queryParameters : null;
function findEventWindowForAction(obj, currentTime, settings) {
  const st = settings || loadSettings();
  const type = String(obj?.type || "").trim();
  const laKey = String(obj?.la || fmtLaKey(currentTime)).trim();
  if (!type || !isLaKey(laKey)) return null;
  const items = generateSchedules(type, currentTime, laKey, st) || [];
  const idx = Number(obj?.idx);
  if (Number.isFinite(idx)) {
    const hinted = items.find(it => Number(it?.idx) === idx);
    if (hinted) return { startTime: hinted.tapWindowStart, endTime: hinted.tapWindowEnd };
  }
  const active = items.find(it => inWindow(currentTime, it?.tapWindowStart, it?.tapWindowEnd));
  if (active) return { startTime: active.tapWindowStart, endTime: active.tapWindowEnd };
  return null;
}
