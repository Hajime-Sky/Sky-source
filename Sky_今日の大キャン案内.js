// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: yellow; icon-glyph: jedi;
const SKY_TZ = "America/Los_Angeles";
const SCRIPT_NAME = "Sky_今日の大キャン案内.js";
const REMOTE_SCRIPT_URL = "https://raw.githubusercontent.com/Hajime-Sky/Sky-source/main/Sky_%E4%BB%8A%E6%97%A5%E3%81%AE%E5%A4%A7%E3%82%AD%E3%83%A3%E3%83%B3%E6%A1%88%E5%86%85.js";
const IMAGE_BASE_URL = "https://Hajime-Sky.github.io/Sky-source/treasure-candles-images/";
const CACHE_META_KEY = "sky_daily_treasure_candles_image_cache_meta";
const MIN_SOURCE_IMAGE_SIZE = 1280;
const AUTOMATION_WARN_STATE_KEY = "sky_daily_treasure_candles_warn_state";
const APP_DIR_NAME = "HajimeSkyTools";
const TOOL_DIR_NAME = "treasure-candles";
const DATA_DIR_NAME = "data";
const IMAGES_DIR_NAME = "images";
const MIGRATION_STATE_KEY = "sky_treasure_candles_migrations";
const UPDATE_STATE_KEY = "sky_treasure_candles_update_state";
const CACHE_META_FILE = "image_cache_meta.json";
const AUTOMATION_WARN_STATE_FILE = "automation_warn_state.json";
const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const UPDATE_POLICIES = Object.freeze(["none", "daily", "always"]);
const TREASURE_CANDLE_CYCLE = Object.freeze({
  anchorSkyDate: "2025-08-21",
  realmById: Object.freeze(["forest", "valley", "waste", "vault", "prairie"]),
  rotationOrder: Object.freeze({
    prairie: Object.freeze([1, 3, 2]),
    forest: Object.freeze([2, 3, 1]),
    valley: Object.freeze([1, 2]),
    waste: Object.freeze([1, 2, 3]),
    vault: Object.freeze([1, 2])
  }),
  source: "Sky Wiki Treasure Candles calculator, anchor 2025-08-21 PDT"
});
const REALMS = [
  { key: "prairie", jp: "草原", en: "Daylight Prairie" },
  { key: "forest", jp: "雨林", en: "Hidden Forest" },
  { key: "valley", jp: "峡谷", en: "Valley of Triumph" },
  { key: "waste", jp: "捨てられた地", en: "Golden Wasteland" },
  { key: "vault", jp: "書庫", en: "Vault of Knowledge" }
];
const PATTERN_DATA = {
  prairie: {
    identifyConcise: "入口広場に入って最初に見える大キャンドルが、池の横なら草原A、三つの精霊の印の近くなら草原B、飛び降りる縁の近くなら草原Cです。",
    identifyDetailed: "草原に入ってすぐの入口広場で、最初に見つかる大キャンドルの位置を見ます。池の横にあるなら草原Aです。入口広場の左奥にある三つの精霊の印の近くにあるなら草原Bです。右側の、下へ飛び降りられる縁の近くにあるなら草原Cです。",
    patterns: [
      {
        label: "草原A",
        concise: [
          "入口広場 > 池 > 池の横",
          "蝶々の住処 > 草原の村へ抜ける出口 > 出口のすぐ手前",
          "鳥の巣と浮島 > 二つ目の小島の穴あき塔 > 塔の中",
          "洞窟エリア > 洞窟の入口 > 入口の右脇"
        ],
        detailed: [
          "一つ目は、入口広場の池の横です。広場に入って最初にある丸い池のすぐそばです。",
          "二つ目は、蝶々の住処の一番奥です。草原の村へ抜ける出口の直前にあります。蝶々の住処に入ったあと、途中で止まらず、いちばん奥の出口まで進んだ場所だと思ってください。",
          "三つ目は、鳥の巣と浮島のエリアです。最初に着く大きい島ではありません。その次にある、少し小さい島に向かってください。そこに穴の開いた塔のような岩があり、その岩の中にあります。",
          "四つ目は、洞窟エリアです。洞窟の入口まで行き、その入口の右脇にあります。洞窟の中の奥ではなく、入口そのもののすぐ横です。"
        ]
      },
      {
        label: "草原B",
        concise: [
          "入口広場 > 三つの精霊の印 > 印の近く",
          "鳥の巣と浮島 > 一つ目の大きい島の壊れ塔 > 塔の根元",
          "洞窟エリア > 草原の村へ向かう階段 > 階段の途中",
          "神殿前 > 神殿へ渡る橋 > 橋の途中"
        ],
        detailed: [
          "一つ目は、入口広場の左奥にある三つの精霊の印の近くです。",
          "二つ目は、鳥の巣と浮島のエリアです。今度は最初の大きい島が正解です。その島に、上が開いている壊れた塔のような岩があり、その根元にあります。",
          "三つ目は、洞窟エリアです。草原の村へ向かう階段を見つけ、その階段を上り切る前の途中にあります。洞窟全体の中央付近ではなく、村へ出るための階段の途中です。",
          "四つ目は、神殿前の橋です。神殿へ向かって伸びている石の橋の、途中にあります。神殿の中ではなく、橋の上です。"
        ]
      },
      {
        label: "草原C",
        concise: [
          "入口広場 > 飛び降りる縁 > 縁の近く",
          "蝶々の住処 > 丸い大岩 > 岩の手前",
          "草原の村 > 中央の小さな浮島 > 島の上",
          "神殿内部 > 左側の壺 > 壺の後ろ"
        ],
        detailed: [
          "一つ目は、入口広場の右側にある飛び降りる縁の近くです。",
          "二つ目は、蝶々の住処です。中央付近にある丸く大きな岩を探してください。その岩の手前にあります。出口の前でも、島の上でもなく、丸い岩の前です。",
          "三つ目は、草原の村です。中央に小さな浮島があり、その島の上にあります。光の子がいる小島だと覚えると伝わりやすいです。",
          "四つ目は、神殿の中です。神殿に入ったら左側を見てください。左側に並んでいる壺の後ろにあります。祭壇の真正面ではなく、左側の壺を目印にします。"
        ]
      }
    ]
  },
  forest: {
    identifyConcise: "入口広場に入って最初に見える大キャンドルが、地図の祭壇の横なら雨林A、精霊の印の横なら雨林B、調査の祭壇の横なら雨林Cです。",
    identifyDetailed: "雨林に入ってすぐの入口広場で、最初に見つかる大キャンドルの位置を見ます。地図の祭壇の横にあるなら雨林Aです。精霊の印の横にあるなら雨林Bです。調査の祭壇の横にあるなら雨林Cです。雨林は左右の言い方が人によってずれやすいので、祭壇や印のような固定物で判断してください。",
    patterns: [
      {
        label: "雨林A",
        concise: [
          "入口広場 > 地図の祭壇 > 祭壇の横",
          "小川エリア > 折れ橋方面へ抜ける出口 > 出口のそば",
          "晴れ間 > 二つ目の東屋 > 東屋の上",
          "大木が二本続く通路エリア > 最初の橋 > 橋の途中"
        ],
        detailed: [
          "一つ目は、入口広場の地図の祭壇の横です。",
          "二つ目は、小川エリアの奥です。折れ橋の方向へ抜ける出口の近くにあります。小川エリアの入口近くではなく、出口の近くです。",
          "三つ目は、晴れ間です。東屋がいくつか並んでいますが、最初の東屋ではありません。二つ目の東屋の上にあります。",
          "四つ目は、大木が二本続く通路のエリアです。最初に渡る橋の途中にあります。橋を渡り切った先ではなく、橋そのものの上です。"
        ]
      },
      {
        label: "雨林B",
        concise: [
          "入口広場 > 精霊の印 > 印の横",
          "最初の門の先の中庭 > 右側の屋根付き通路 > 通路の上",
          "小川エリア > 一つ目の東屋 > 東屋の上",
          "晴れ間 > 池 > 池の中央"
        ],
        detailed: [
          "一つ目は、入口広場の精霊の印の横です。",
          "二つ目は、最初の門を開けた先の中庭です。右側に屋根付きの通路があるので、その上にあります。地面ではなく、通路の屋根の上です。",
          "三つ目は、小川エリアです。入ってすぐ見つかる一つ目の東屋の上にあります。二つ目ではなく、一つ目です。",
          "四つ目は、晴れ間の池の中央です。池の岸ではなく、真ん中です。"
        ]
      },
      {
        label: "雨林C",
        concise: [
          "入口広場 > 調査の祭壇 > 祭壇の横",
          "最初の門の先の中庭 > 左の草道の最初の木のくぼみ > くぼみの中",
          "大木が二本続く通路エリア > 折れ橋方面へ進む木のくぼみ > くぼみの中",
          "神殿の先の聖なる池 > 一番奥の池 > 池の横"
        ],
        detailed: [
          "一つ目は、入口広場の調査の祭壇の横です。",
          "二つ目は、最初の門を開けた先の中庭です。左側の草道に入り、最初に見つかる木のくぼみの中にあります。奥の別の木ではなく、最初の木です。",
          "三つ目は、大木が二本続く通路のエリアです。折れ橋方面へ進む途中にある木のくぼみの中にあります。橋の上ではなく、木の中です。",
          "四つ目は、神殿を抜けた先の聖なる池です。いちばん奥まで進んだところにある池の横です。入口寄りではなく、最奥です。"
        ]
      }
    ]
  },
  valley: {
    identifyConcise: "入口広場に入って最初に見える大キャンドルが、着替えの場所の前なら峡谷A、滑り降りる坂の始まりなら峡谷Bです。",
    identifyDetailed: "峡谷に入ってすぐの入口広場で、最初に見つかる大キャンドルの位置を見ます。着替えをする場所の前にあるなら峡谷Aです。右側の滑り降りる坂の始まりにあるなら峡谷Bです。",
    patterns: [
      {
        label: "峡谷A",
        concise: [
          "入口広場 > 着替えの場所 > 場所の前",
          "スケートリンク > 天球儀の方向へ渡る橋 > 橋の上",
          "天球儀エリア > 最初の門を越えた先の二つ目の足場 > 足場の上",
          "円形劇場 > 左側の観客席 > 一番下の段の足元"
        ],
        detailed: [
          "一つ目は、入口広場の着替えをする場所の前です。",
          "二つ目は、スケートリンクです。中央から天球儀の方向へ渡っていく橋があり、その橋の上にあります。氷の上ではなく、橋の上です。",
          "三つ目は、天球儀エリアです。最初の門を越えたあと、二つ目に見つかる足場の上にあります。門の手前ではなく、門を越えたあとです。",
          "四つ目は、円形劇場の左側です。観客席の一番下の段の足元にあります。上の席ではなく、最下段です。"
        ]
      },
      {
        label: "峡谷B",
        concise: [
          "入口広場 > 滑り降りる坂 > 坂の始まり",
          "スケートリンク > 天球儀の方向へ渡る橋 > 橋の左の氷の上",
          "天球儀エリア > 高いアーチを越えた先の二つ目の足場 > 足場の上",
          "円形劇場 > 右側の観客席 > 一番下の段の足元"
        ],
        detailed: [
          "一つ目は、入口広場の右側にある滑り降りる坂の始まりです。",
          "二つ目は、スケートリンクです。天球儀の方向へ渡る橋の左側の、氷の上にあります。橋の上ではありません。",
          "三つ目は、天球儀エリアです。高いアーチをいくつか越えた先の、二つ目の足場の上にあります。低い足場ではなく、奥まで進んだ先の足場です。",
          "四つ目は、円形劇場の右側です。観客席の一番下の段の足元にあります。"
        ]
      }
    ]
  },
  waste: {
    identifyConcise: "入口広場に入って最初に見える大キャンドルが、現れた場所の真後ろのブロックの上なら捨てられた地A、倒れた神殿へ向かう階段の左側なら捨てられた地B、同じ階段の右側なら捨てられた地Cです。",
    identifyDetailed: "捨てられた地に入ってすぐの入口広場で、最初に見つかる大キャンドルの位置を見ます。現れた場所の真後ろにあるブロックの上なら捨てられた地Aです。倒れた神殿へ向かう階段の左側なら捨てられた地Bです。同じ階段の右側なら捨てられた地Cです。捨てられた地は入口の見分け方が特に重要なので、まず自分が現れた場所と階段の位置を先に確認してください。",
    patterns: [
      {
        label: "捨てられた地A",
        concise: [
          "入口広場 > 現れた場所の真後ろのブロック > ブロックの上",
          "最初の大きいエリア > 墓所へ向かう出口階段 > 階段の上",
          "墓所 > 二つ目の巨大な骨 > 骨の下",
          "戦場 > 壁に囲まれた中央建物 > 建物の上側のランプ付きブロックの横"
        ],
        detailed: [
          "一つ目は、入口広場で現れた場所の真後ろにあるブロックの上です。",
          "二つ目は、最初の大きいエリアです。墓所へ抜ける出口に向かう階段があり、その階段の上にあります。出口の前の地面ではなく、階段の上です。",
          "三つ目は、墓所です。中央付近に巨大な骨が並んでいますが、一つ目ではなく二つ目の巨大な骨の下にあります。",
          "四つ目は、戦場です。壁に囲まれた中央の建物の上側へ行き、ランプが付いたブロックの横を見てください。建物の外周ではなく、壁の内側です。"
        ]
      },
      {
        label: "捨てられた地B",
        concise: [
          "入口広場 > 倒れた神殿へ向かう階段 > 階段の左側",
          "最初の大きいエリア > カニがいる沈んだ建物 > 建物の横",
          "墓所 > 中央の大きな建物の右側の足場 > 足場の上",
          "座礁船エリア > 船 > 船の後ろ側"
        ],
        detailed: [
          "一つ目は、入口広場の階段の左側です。",
          "二つ目は、最初の大きいエリアです。カニがいる沈んだ建物の横にあります。普通の壁際ではなく、カニが集まりやすい沈んだ建物が目印です。",
          "三つ目は、墓所です。中央の大きな建物の右側に足場があり、その上にあります。建物の中ではなく、右側の足場です。",
          "四つ目は、座礁船エリアです。船の後ろ側にあります。船の先頭ではなく、後ろです。"
        ]
      },
      {
        label: "捨てられた地C",
        concise: [
          "入口広場 > 倒れた神殿へ向かう階段 > 階段の右側",
          "墓所 > 戦場へ抜ける出口階段 > 階段の上",
          "座礁船エリア > 船 > 船の前側",
          "戦場 > 手前の壁 > 壁の上の光の子の近く"
        ],
        detailed: [
          "一つ目は、入口広場の階段の右側です。",
          "二つ目は、墓所のいちばん奥です。戦場へ抜ける出口階段の上にあります。中央の骨の下ではなく、出口階段です。",
          "三つ目は、座礁船エリアです。船の前側にあります。後ろ側ではありません。",
          "四つ目は、戦場の手前側の壁の上です。光の子の近くにあります。中央建物ではなく、手前の壁です。"
        ]
      }
    ]
  },
  vault: {
    identifyConcise: "書庫は一階を見れば判別できます。一階に二本あり、右の通路の突き当たりと、昇降機のある部屋の一番奥にあるなら書庫Aです。一階に一本だけで、四人で開ける扉の左の壁際にあるなら書庫Bです。",
    identifyDetailed: "書庫は一階を見ると判別しやすいです。一階に二本あり、一本が右の通路の突き当たり、もう一本が昇降機のある部屋の一番奥にあるなら書庫Aです。一階に一本だけで、四人で開ける扉の左の壁際にあるなら書庫Bです。",
    patterns: [
      {
        label: "書庫A",
        concise: [
          "一階 > 右の通路 > 突き当たり",
          "一階 > 昇降機のある部屋 > 一番奥",
          "二階 > 四人で開ける扉の向かい側の足場 > 足場の上",
          "最上階の神殿 > 入ってすぐ右側 > 右寄り"
        ],
        detailed: [
          "一つ目は、一階の右の通路を進み切った突き当たりです。",
          "二つ目は、一階の昇降機がある部屋の一番奥です。昇降機の近くで止まらず、さらに奥まで見てください。",
          "三つ目は、二階です。四人で開ける扉の向かい側にある足場の上です。扉の横ではなく、向かい側です。",
          "四つ目は、最上階の神殿です。入ってすぐ右側にあります。奥ではなく、入ってすぐです。"
        ]
      },
      {
        label: "書庫B",
        concise: [
          "一階 > 四人で開ける扉 > 扉の左の壁際",
          "二階 > 四人で開ける扉の横の足場 > 足場の上",
          "四階 > 光の子がいる東屋付きの浮遊足場 > 足場の裏側",
          "最上階の神殿 > 左の階段 > 階段の上"
        ],
        detailed: [
          "一つ目は、一階の四人で開ける扉の左の壁際です。",
          "二つ目は、二階の四人で開ける扉のすぐ横にある足場の上です。向かい側ではなく、横です。",
          "三つ目は、四階です。光の子がいる東屋付きの浮遊足場があるので、その裏側にあります。表から見えにくいので、足場の裏へ回る意識が必要です。",
          "四つ目は、最上階の神殿です。左側の階段の上にあります。右側ではありません。"
        ]
      }
    ]
  }
};
function mod(n, m) {
  return ((n % m) + m) % m;
}
function pad2(n) {
  return String(n).padStart(2, "0");
}
function nthWeekdayOfMonth(year, monthIndex, weekday, nth) {
  const firstDow = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
  const delta = (weekday - firstDow + 7) % 7;
  return 1 + delta + ((nth - 1) * 7);
}
function getLaDstRangeUtcMs(localYear) {
  const startDay = nthWeekdayOfMonth(localYear, 2, 0, 2);
  const endDay = nthWeekdayOfMonth(localYear, 10, 0, 1);
  return {
    startUtcMs: Date.UTC(localYear, 2, startDay, 10, 0, 0),
    endUtcMs: Date.UTC(localYear, 10, endDay, 9, 0, 0)
  };
}
function getLaOffsetInfo(dateObj = new Date()) {
  const utcMs = dateObj.getTime();
  const approxLocalYear = new Date(utcMs - (8 * 60 * 60 * 1000)).getUTCFullYear();
  const { startUtcMs, endUtcMs } = getLaDstRangeUtcMs(approxLocalYear);
  const isDst = utcMs >= startUtcMs && utcMs < endUtcMs;
  return {
    offsetMinutes: isDst ? -420 : -480,
    abbr: isDst ? "PDT" : "PST"
  };
}
function getCurrentLATimeParts(dateObj = new Date()) {
  const offsetInfo = getLaOffsetInfo(dateObj);
  const laMs = dateObj.getTime() + (offsetInfo.offsetMinutes * 60000);
  const la = new Date(laMs);
  return {
    year: la.getUTCFullYear(),
    month: la.getUTCMonth() + 1,
    day: la.getUTCDate(),
    hour: la.getUTCHours(),
    minute: la.getUTCMinutes(),
    second: la.getUTCSeconds(),
    offsetMinutes: offsetInfo.offsetMinutes,
    abbr: offsetInfo.abbr
  };
}
function formatYMD(parts) {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}
function formatDateTime(parts) {
  return `${formatYMD(parts)} ${pad2(parts.hour)}:${pad2(parts.minute)}:${pad2(parts.second)}`;
}
function formatOffset(minutes) {
  const sign = minutes >= 0 ? "+" : "-";
  const abs = Math.abs(minutes);
  const hh = Math.floor(abs / 60);
  const mm = abs % 60;
  return `UTC${sign}${pad2(hh)}:${pad2(mm)}`;
}
function parseYMDToUtcDate(ymd) {
  const parts = String(ymd || "").split("-").map(n => Number(n));
  if (parts.length !== 3 || parts.some(n => !Number.isFinite(n))) return null;
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 0, 0, 0));
}
function daysBetweenUtcDates(a, b) {
  return Math.floor((a.getTime() - b.getTime()) / 86400000);
}
function getServerWallClockDate(dateObj = new Date()) {
  const la = getCurrentLATimeParts(dateObj);
  return new Date(Date.UTC(la.year, la.month - 1, la.day, 0, 0, 0));
}
function getCurrentSkyContext(dateObj = new Date()) {
  const la = getCurrentLATimeParts(dateObj);
  return {
    laDateTime: formatDateTime(la),
    skyYMD: formatYMD(la),
    tzLabel: `${SKY_TZ} ${la.abbr} (${formatOffset(la.offsetMinutes)})`,
    serverDate: getServerWallClockDate(dateObj)
  };
}
function calcByServerDate(serverDate, targetSkyYMD) {
  const anchorDate = parseYMDToUtcDate(TREASURE_CANDLE_CYCLE.anchorSkyDate);
  const dayDiff = anchorDate ? daysBetweenUtcDates(serverDate, anchorDate) : 0;
  const cycleRealmKey = TREASURE_CANDLE_CYCLE.realmById[mod(dayDiff, TREASURE_CANDLE_CYCLE.realmById.length)];
  const realmIndex = Math.max(0, REALMS.findIndex(r => r.key === cycleRealmKey));
  const realm = REALMS[realmIndex];
  const patterns = PATTERN_DATA[realm.key].patterns;
  const selector = mod(Math.ceil(serverDate.getUTCDate() / 5) - 1, patterns.length);
  const rotationOrder = TREASURE_CANDLE_CYCLE.rotationOrder[realm.key] || [];
  const rotationNumber = Number(rotationOrder[selector] || (selector + 1));
  const rotIndex = mod(rotationNumber - 1, patterns.length);
  const pattern = patterns[rotIndex];
  return {
    skyYMD: targetSkyYMD,
    realmIndex,
    realm,
    rotIndex,
    pattern,
    patternMeta: PATTERN_DATA[realm.key],
    cycle: {
      source: TREASURE_CANDLE_CYCLE.source,
      anchorSkyDate: TREASURE_CANDLE_CYCLE.anchorSkyDate,
      dayDiff,
      selector,
      rotationNumber
    }
  };
}
function calcForCurrentLATime(dateObj = new Date()) {
  const ctx = getCurrentSkyContext(dateObj);
  const result = calcByServerDate(ctx.serverDate, ctx.skyYMD);
  return {
    ...result,
    laNow: ctx.laDateTime,
    tzLabel: ctx.tzLabel
  };
}
function getExpectedLabels() {
  const labels = [];
  for (const realmKey of Object.keys(PATTERN_DATA)) {
    for (const pattern of PATTERN_DATA[realmKey].patterns) {
      labels.push(pattern.label);
    }
  }
  return labels;
}
function getImageUrl(label) {
  return `${IMAGE_BASE_URL}${encodeURIComponent(label)}.png`;
}
function getICloudFileManager() {
  return FileManager.iCloud();
}
function ensureDir(fm, path) {
  if (!fm.fileExists(path)) fm.createDirectory(path, true);
  return path;
}
function getAppDir(fm = getICloudFileManager()) {
  return ensureDir(fm, fm.joinPath(fm.documentsDirectory(), APP_DIR_NAME));
}
function getToolDir(fm = getICloudFileManager()) {
  return ensureDir(fm, fm.joinPath(getAppDir(fm), TOOL_DIR_NAME));
}
function getDataDir(fm = getICloudFileManager()) {
  return ensureDir(fm, fm.joinPath(getToolDir(fm), DATA_DIR_NAME));
}
function getDataPath(name, fm = getICloudFileManager()) {
  return fm.joinPath(getDataDir(fm), String(name || "data.json"));
}
function downloadFromICloudIfNeeded(fm, path) {
  try {
    if (typeof fm.isFileDownloaded === "function" && fm.fileExists(path) && !fm.isFileDownloaded(path)) {
      fm.downloadFileFromiCloud(path);
    }
  } catch (_) {}
}
function readJsonFile(name, fallback = null) {
  try {
    const fm = getICloudFileManager();
    const path = getDataPath(name, fm);
    if (!fm.fileExists(path)) return fallback;
    downloadFromICloudIfNeeded(fm, path);
    const parsed = JSON.parse(fm.readString(path));
    return parsed == null ? fallback : parsed;
  } catch (_) {
    return fallback;
  }
}
function writeJsonFile(name, value) {
  const fm = getICloudFileManager();
  fm.writeString(getDataPath(name, fm), JSON.stringify(value || {}, null, 2));
}
function readUpdateState() {
  const state = readJsonFile(UPDATE_STATE_KEY + ".json", {});
  const policy = UPDATE_POLICIES.includes(String(state?.policy || "")) ? String(state.policy) : "daily";
  return {
    ...(state || {}),
    policy,
    lastCheckedAtMs: Math.max(0, Number(state?.lastCheckedAtMs || 0) || 0),
    lastUpdatedAtMs: Math.max(0, Number(state?.lastUpdatedAtMs || 0) || 0),
    lastStatus: String(state?.lastStatus || "")
  };
}
function writeUpdateStatePatch(patch) {
  writeJsonFile(UPDATE_STATE_KEY + ".json", { ...readUpdateState(), ...(patch || {}) });
}
function setUpdatePolicy(policy) {
  const normalized = UPDATE_POLICIES.includes(String(policy || "")) ? String(policy) : "daily";
  writeUpdateStatePatch({ policy: normalized });
  return normalized;
}
function formatLocalDateTimeFromMs(ms) {
  const n = Number(ms || 0) || 0;
  if (!n) return "未実行";
  try {
    return new Date(n).toLocaleString("ja-JP");
  } catch (_) {
    return "未実行";
  }
}
function readAppliedMigrationIds() {
  const raw = readJsonFile(MIGRATION_STATE_KEY + ".json", { applied: [] });
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (Array.isArray(raw?.applied)) return raw.applied.map(String).filter(Boolean);
  if (raw?.applied && typeof raw.applied === "object") return Object.keys(raw.applied).filter(Boolean);
  return [];
}
function markMigrationApplied(id) {
  const key = String(id || "").trim();
  if (!key) return;
  const ids = readAppliedMigrationIds();
  if (!ids.includes(key)) ids.push(key);
  writeJsonFile(MIGRATION_STATE_KEY + ".json", { applied: Array.from(new Set(ids)).sort() });
}
function runMigrationOnce(id, fn) {
  if (readAppliedMigrationIds().includes(id)) return;
  fn();
  markMigrationApplied(id);
}
function copyLocalDirectoryToICloud(localFm, localDir, iCloudFm, targetDir) {
  if (!localFm.fileExists(localDir)) return;
  ensureDir(iCloudFm, targetDir);
  for (const name of localFm.listContents(localDir)) {
    const src = localFm.joinPath(localDir, name);
    const dst = iCloudFm.joinPath(targetDir, name);
    if (localFm.isDirectory && localFm.isDirectory(src)) {
      copyLocalDirectoryToICloud(localFm, src, iCloudFm, dst);
    } else if (!iCloudFm.fileExists(dst)) {
      iCloudFm.write(dst, localFm.read(src));
    }
  }
}
function runStorageMigrations() {
  runMigrationOnce("2026-04-22-keychain-meta-to-files-v1", () => {
    try {
      if (Keychain.contains(CACHE_META_KEY)) {
        writeJsonFile(CACHE_META_FILE, JSON.parse(Keychain.get(CACHE_META_KEY)));
        Keychain.remove(CACHE_META_KEY);
      }
    } catch (_) {}
    try {
      if (Keychain.contains(AUTOMATION_WARN_STATE_KEY)) {
        writeJsonFile(AUTOMATION_WARN_STATE_FILE, JSON.parse(Keychain.get(AUTOMATION_WARN_STATE_KEY)));
        Keychain.remove(AUTOMATION_WARN_STATE_KEY);
      }
    } catch (_) {}
  });
  runMigrationOnce("2026-04-22-local-images-to-icloud-v1", () => {
    try {
      const localFm = FileManager.local();
      const oldDir = localFm.joinPath(localFm.documentsDirectory(), "sky_daily_treasure_candles_images");
      const iCloudFm = getICloudFileManager();
      copyLocalDirectoryToICloud(localFm, oldDir, iCloudFm, getImagesDir());
      if (localFm.fileExists(oldDir)) localFm.remove(oldDir);
    } catch (_) {}
  });
}
async function updateScriptFromGitHubIfNeeded(force = false) {
  if (config.runsInWidget && !force) return false;
  const state = readUpdateState();
  const nowMs = Date.now();
  if (!force && state.policy === "none") return false;
  if (!force && state.policy === "daily" && state.lastCheckedAtMs && nowMs - Number(state.lastCheckedAtMs) < UPDATE_CHECK_INTERVAL_MS) return false;
  const nextState = { ...(state || {}), lastCheckedAtMs: nowMs };
  try {
    const req = new Request(REMOTE_SCRIPT_URL);
    req.timeoutInterval = 20;
    const remoteText = await req.loadString();
    if (!remoteText || !remoteText.includes("Sky_今日の大キャン案内")) throw new Error("remote script validation failed");
    const fm = FileManager.iCloud();
    const localPath = fm.joinPath(fm.documentsDirectory(), SCRIPT_NAME);
    let localText = "";
    if (fm.fileExists(localPath)) {
      downloadFromICloudIfNeeded(fm, localPath);
      localText = fm.readString(localPath);
    }
    if (remoteText !== localText) {
      fm.writeString(localPath, remoteText);
      writeJsonFile(UPDATE_STATE_KEY + ".json", { ...nextState, lastUpdatedAtMs: nowMs, lastStatus: "updated" });
      return true;
    }
    writeJsonFile(UPDATE_STATE_KEY + ".json", { ...nextState, lastStatus: "no-update" });
  } catch (e) {
    writeJsonFile(UPDATE_STATE_KEY + ".json", { ...nextState, lastStatus: `error:${String(e).slice(0, 160)}` });
  }
  return false;
}
// === iCloudファイルによる画像管理 ===
function getImagesDir() {
  const fm = getICloudFileManager();
  return ensureDir(fm, fm.joinPath(getToolDir(fm), IMAGES_DIR_NAME));
}
function getSafeTempName(name) {
  return String(name || "file").replace(/[^A-Za-z0-9_\-぀-ヿ㐀-鿿]/g, "_");
}
function getImagePath(label) {
  const fm = getICloudFileManager();
  return fm.joinPath(getImagesDir(), `${getSafeTempName(label)}.png`);
}
function removeAllImageFiles() {
  const fm = getICloudFileManager();
  const dir = getImagesDir();
  if (fm.fileExists(dir)) fm.remove(dir);
}
function makeMetaFromLabels(labels, updatedAt, lastError = null, imageSpecs = {}) {
  return {
    minSourceImageSize: MIN_SOURCE_IMAGE_SIZE,
    imageCount: labels.length,
    labels,
    imageSpecs,
    updatedAt,
    lastError
  };
}
function readCacheMeta() {
  const parsed = readJsonFile(CACHE_META_FILE, null);
  if (!parsed || !Array.isArray(parsed.labels)) return null;
  return parsed;
}
function writeCacheMeta(meta) {
  writeJsonFile(CACHE_META_FILE, meta);
}
function getCachedImageSize(label) {
  try {
    const image = getCachedImage(label);
    if (!image || !image.size) return null;
    return {
      width: Number(image.size.width) || 0,
      height: Number(image.size.height) || 0
    };
  } catch (e) {
    return null;
  }
}
function isCacheUsable(meta = readCacheMeta()) {
  const expectedLabels = getExpectedLabels();
  const fm = getICloudFileManager();
  for (const label of expectedLabels) {
    const path = getImagePath(label);
    if (!fm.fileExists(path)) return false;
    downloadFromICloudIfNeeded(fm, path);
  }
  if (!meta) return true;
  return meta.imageCount === expectedLabels.length;
}
function needsQualityRefresh(meta = readCacheMeta()) {
  if (!isCacheUsable(meta)) return true;
  if (!meta) return true;
  if (Number(meta.minSourceImageSize || 0) < MIN_SOURCE_IMAGE_SIZE) return true;
  const expectedLabels = getExpectedLabels();
  for (const label of expectedLabels) {
    const spec = (meta.imageSpecs && meta.imageSpecs[label]) || getCachedImageSize(label);
    const width = Number(spec && spec.width) || 0;
    const height = Number(spec && spec.height) || 0;
    if (width < MIN_SOURCE_IMAGE_SIZE || height < MIN_SOURCE_IMAGE_SIZE) return true;
  }
  return false;
}
function isCacheComplete(meta = readCacheMeta()) {
  return isCacheUsable(meta);
}
function getSavedImageCount() {
  const expectedLabels = getExpectedLabels();
  const fm = getICloudFileManager();
  return expectedLabels.filter(label => fm.fileExists(getImagePath(label))).length;
}
function getCachedImage(label) {
  const fm = getICloudFileManager();
  const path = getImagePath(label);
  if (fm.fileExists(path)) {
    downloadFromICloudIfNeeded(fm, path);
    return Image.fromFile(path);
  }
  return null;
}
// 画像のダウンロード
async function downloadAndProcessImage(label) {
  const url = getImageUrl(label);
  const request = new Request(url);
  request.timeoutInterval = 30;
  const data = await request.load();
  if (!data) {
    throw new Error(`取得データが空です: ${label}`);
  }
  const image = Image.fromData(data);
  if (!image) {
    throw new Error(`画像として読めません: ${label}`);
  }
  const width = Number(image && image.size && image.size.width) || 0;
  const height = Number(image && image.size && image.size.height) || 0;
  if (width <= 0 || height <= 0) {
    throw new Error(`画像サイズを取得できません: ${label}`);
  }
  const fm = getICloudFileManager();
  fm.write(getImagePath(label), data);
  return { width, height };
}
async function syncAllImages(progressCallback) {
  const labels = getExpectedLabels();
  const downloadedLabels = [];
  const imageSpecs = {};
  try {
    for (let i = 0; i < labels.length; i++) {
      const label = labels[i];
      if (progressCallback) await progressCallback(`ダウンロード中 ${i + 1}/${labels.length}: ${label}`);
      const spec = await downloadAndProcessImage(label);
      imageSpecs[label] = spec;
      downloadedLabels.push(label);
      if (progressCallback) await progressCallback(`保存完了 ${i + 1}/${labels.length}: ${label} (${spec.width}x${spec.height})`);
    }
    const meta = makeMetaFromLabels(labels, new Date().toISOString(), null, imageSpecs);
    writeCacheMeta(meta);
    return meta;
  } catch (e) {
    const meta = makeMetaFromLabels(downloadedLabels, new Date().toISOString(), String((e && e.message) || e || "unknown error"), imageSpecs);
    writeCacheMeta(meta);
    throw e;
  }
}
function buildTextOutput(res, cacheMeta) {
  const lines = [];
  lines.push(`基準LA時刻: ${res.laNow}`);
  lines.push(`タイムゾーン: ${res.tzLabel}`);
  lines.push(`Sky日付: ${res.skyYMD}`);
  lines.push(`今日の画像: ${res.pattern.label}`);
  lines.push(`地方: ${res.realm.jp} (${res.realm.en})`);
  lines.push(`Rotation: ${res.rotIndex + 1}/${res.patternMeta.patterns.length}`);
  if (res.cycle && res.cycle.source) lines.push(`サイクル: ${res.cycle.source}`);
  lines.push("");
  lines.push(`見分け方: ${res.patternMeta.identifyDetailed}`);
  lines.push("");
  res.pattern.detailed.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
  lines.push("");
  if (cacheMeta && cacheMeta.updatedAt) lines.push(`キャッシュ更新: ${cacheMeta.updatedAt}`);
  lines.push(`保存画像数: ${getSavedImageCount()}/${getExpectedLabels().length}`);
  lines.push("保存方式: ファイルシステム (Raw PNG)");
  lines.push(`想定最小解像度: ${MIN_SOURCE_IMAGE_SIZE}x${MIN_SOURCE_IMAGE_SIZE}`);
  return lines.join("\n");
}
function getWidgetCanvasSpec(family) {
  if (family === "small") return { width: 170, height: 170 };
  if (family === "medium") return { width: 360, height: 170 };
  if (family === "large") return { width: 360, height: 376 };
  return { width: 360, height: 170 };
}
function renderWidgetImageWithDate(image, family, dateText) {
  const spec = getWidgetCanvasSpec(family);
  const imageWidth = image.size.width;
  const imageHeight = image.size.height;
  if (!(imageWidth > 0) || !(imageHeight > 0)) return image;
  // 幅合わせ: キャンバスの幅を画像の幅に固定し、高さをウィジェットのアスペクト比に合わせて算出
  const canvasWidth = imageWidth;
  const canvasHeight = Math.round(canvasWidth * (spec.height / spec.width));
  const ctx = new DrawContext();
  ctx.size = new Size(canvasWidth, canvasHeight);
  ctx.opaque = true;
  ctx.respectScreenScale = false;
  // 余白を埋める色: Untitled Script 1.jsの背景色であるダークグレーを設定
  ctx.setFillColor(new Color("#1c1c1e"));
  ctx.fillRect(new Rect(0, 0, canvasWidth, canvasHeight));
  // 幅合わせで中央に描画
  const drawX = 0;
  const drawY = Math.round((canvasHeight - imageHeight) / 2);
  ctx.drawImageInRect(image, new Rect(drawX, drawY, imageWidth, imageHeight));
  const text = String(dateText || "").trim();
  if (text) {
    // 日付テキストは元の画像領域（1280）を基準にサイズと位置を決定
    const scale = imageWidth / 1280;
    const fontSize = Math.max(8, Math.floor(48 * scale));
    // 画像の上端(drawY)を基準に配置
    const textY = drawY + Math.floor(16 * scale);
    // 横方向中央揃えのため、幅は画像幅いっぱいに設定
    const textRect = new Rect(
      drawX,
      textY,
      imageWidth,
      Math.floor(68 * scale)
    );
    ctx.setTextAlignedCenter();
    ctx.setFont(Font.boldSystemFont(fontSize));
    const shadowOffset = Math.max(1, Math.floor(fontSize * 0.08));
    ctx.setTextColor(new Color("#000000", 0.86));
    const shadowRects = [
      new Rect(textRect.x + shadowOffset, textRect.y + shadowOffset, textRect.width, textRect.height),
      new Rect(textRect.x - shadowOffset, textRect.y + shadowOffset, textRect.width, textRect.height),
      new Rect(textRect.x, textRect.y + shadowOffset, textRect.width, textRect.height),
      new Rect(textRect.x + shadowOffset, textRect.y, textRect.width, textRect.height)
    ];
    shadowRects.forEach((sr) => ctx.drawTextInRect(text, sr));
    ctx.setTextColor(Color.white());
    ctx.drawTextInRect(text, textRect);
  }
  return ctx.getImage();
}
function readAutomationWarnState() {
  return readJsonFile(AUTOMATION_WARN_STATE_FILE, null);
}
function writeAutomationWarnState(laKey, laTime) {
  try {
    writeJsonFile(AUTOMATION_WARN_STATE_FILE, { laKey, laTime, warnedAt: new Date().toISOString() });
  } catch (e) {}
}
function isWithinExpectedAutomationWindow(la) {
  const h = Number(la.hour);
  const m = Number(la.minute);
  return (h === 23 && m >= 45) || (h === 0 && m <= 30);
}
function getMinutesFromLaMidnight(la) {
  const minutesFromMidnight = (Number(la.hour) * 60) + Number(la.minute);
  return minutesFromMidnight > 720 ? minutesFromMidnight - 1440 : minutesFromMidnight;
}
function formatSignedMinutesFromMidnight(minutesFromMidnight) {
  const delta = Number(minutesFromMidnight);
  if (delta === 0) return "±0分";
  return `${delta > 0 ? "+" : "-"}${Math.abs(delta)}分`;
}
function getExpectedJstUpdateHour(dateObj = new Date()) {
  return getLaOffsetInfo(dateObj).abbr === "PDT" ? 16 : 17;
}
async function notifyIfCalledOutsideLaMidnight(dateObj = new Date()) {
  const la = getCurrentLATimeParts(dateObj);
  if (isWithinExpectedAutomationWindow(la)) return;
  const laKey = formatYMD(la);
  const warnState = readAutomationWarnState();
  if (warnState && String(warnState.laKey || "") === laKey) return;
  writeAutomationWarnState(laKey, formatDateTime(la));
  const deltaText = formatSignedMinutesFromMidnight(getMinutesFromLaMidnight(la));
  const jstUpdateHour = getExpectedJstUpdateHour(dateObj);
  const n = new Notification();
  n.identifier = `sky_daily_treasure_candles:warn:${laKey}`;
  n.title = "⚠️ 大キャン更新時刻の見直し";
  n.body = `現在のLA時刻は ${formatDateTime(la)} (${la.abbr}) です。更新基準の00:00から ${deltaText} ずれています。通常はLA 23:45〜00:30に実行される想定です。日本時間では${jstUpdateHour}時台のショートカット実行を確認してください。`;
  n.sound = "default";
  n.setTriggerDate(new Date(Date.now() + 1000));
  try {
    await n.schedule();
  } catch (e) {}
}
function showErrorWidget(message, detail = "") {
  const widget = new ListWidget();
  widget.backgroundColor = new Color("#111111");
  widget.setPadding(14, 14, 14, 14);
  widget.addSpacer();
  const title = widget.addText(message);
  title.textColor = new Color("#ff453a");
  title.font = Font.boldSystemFont(16);
  title.centerAlignText();
  if (detail) {
    widget.addSpacer(6);
    const body = widget.addText(detail);
    body.textColor = new Color("#f2f2f7");
    body.font = Font.systemFont(11);
    body.centerAlignText();
    body.lineLimit = 4;
  }
  widget.addSpacer();
  return widget;
}
function getAppTempDir() {
  const fm = FileManager.local();
  const dir = fm.joinPath(fm.temporaryDirectory(), "sky_daily_treasure_candles_temp_v4");
  if (!fm.fileExists(dir)) fm.createDirectory(dir, true);
  return dir;
}
// === ウィジェット生成処理 ===
async function createWidget() {
  const res = calcForCurrentLATime();
  const meta = readCacheMeta();
  if (!isCacheUsable(meta)) {
    return showErrorWidget("初回同期が必要", "アプリ内表示またはショートカット実行で画像を保存してください。");
  }
  let image = getCachedImage(res.pattern.label);
  if (!image) {
    return showErrorWidget("画像読込エラー", res.pattern.label);
  }
  const family = config.widgetFamily || "medium";
  const widget = new ListWidget();
  widget.url = URLScheme.forRunningScript();
  widget.backgroundColor = new Color("#000000");
  let bgImage = renderWidgetImageWithDate(image, family, res.skyYMD);
  image = null; // 元画像のメモリを解放
  try {
    const fm = FileManager.local();
    const tempDir = getAppTempDir();
    const tempPath = fm.joinPath(tempDir, `widget_bg_${family}.png`);
    fm.writeImage(tempPath, bgImage);
    bgImage = null; // 合成画像のメモリを解放
    widget.backgroundImage = Image.fromFile(tempPath);
  } catch (e) {
    widget.backgroundImage = bgImage;
  }
  return widget;
}
async function showSimpleAlert(title, message) {
  const alert = new Alert();
  alert.title = title;
  alert.message = message;
  alert.addAction("OK");
  await alert.presentAlert();
}
function buildAppSummary(res, cacheMeta) {
  const lines = [];
  const updateState = readUpdateState();
  const policyLabel = updateState.policy === "none" ? "更新しない" : updateState.policy === "always" ? "毎回" : "24時間";
  lines.push(`今日の画像: ${res.pattern.label}`);
  lines.push(`地方: ${res.realm.jp}`);
  lines.push(`Sky日付: ${res.skyYMD}`);
  lines.push(`Rotation: ${res.rotIndex + 1}/${res.patternMeta.patterns.length}`);
  lines.push(`基準LA時刻: ${res.laNow}`);
  lines.push(`保存画像数: ${getSavedImageCount()}/${getExpectedLabels().length}`);
  if (cacheMeta && cacheMeta.updatedAt) lines.push(`最終更新: ${cacheMeta.updatedAt}`);
  if (cacheMeta) lines.push(`品質状態: ${needsQualityRefresh(cacheMeta) ? "再取得推奨" : "最新1280px想定"}`);
  if (cacheMeta && cacheMeta.lastError) lines.push(`前回エラー: ${cacheMeta.lastError}`);
  lines.push(`GitHub更新: ${policyLabel} / ${updateState.lastStatus || "未実行"}`);
  lines.push(`最終確認: ${formatLocalDateTimeFromMs(updateState.lastCheckedAtMs)}`);
  return lines.join("\n");
}
async function previewTodayText() {
  const res = calcForCurrentLATime();
  const meta = readCacheMeta();
  const fm = FileManager.local();
  const path = fm.joinPath(getAppTempDir(), "sky_daily_treasure_candles_status.txt");
  fm.writeString(path, buildTextOutput(res, meta));
  await QuickLook.present(path);
}
async function previewTodayImage() {
  const res = calcForCurrentLATime();
  const image = getCachedImage(res.pattern.label);
  if (!image) {
    await showSimpleAlert("画像がありません", "画像キャッシュが未完成です。画像を取得 / 再取得を実行してください。");
    return;
  }
  const composed = renderWidgetImageWithDate(image, "large", res.skyYMD);
  const fm = FileManager.local();
  const path = fm.joinPath(getAppTempDir(), `${getSafeTempName(res.pattern.label)}_preview.png`);
  fm.writeImage(path, composed);
  await QuickLook.present(path);
}
async function runSyncAndReport() {
  try {
    await syncAllImages((status) => {
      console.log(status);
    });
    const res = calcForCurrentLATime();
    const meta = readCacheMeta();
    await showSimpleAlert("取得完了", buildAppSummary(res, meta));
  } catch (e) {
    const res = calcForCurrentLATime();
    const meta = readCacheMeta();
    const detail = String((e && e.message) || e || "unknown error");
    await showSimpleAlert("同期に失敗しました", `${buildAppSummary(res, meta)}\n\n${detail}`);
  }
}
async function resetCacheAndReport() {
  try {
    const fm = getICloudFileManager();
    const metaPath = getDataPath(CACHE_META_FILE, fm);
    if (fm.fileExists(metaPath)) fm.remove(metaPath);
  } catch (_) {}
  removeAllImageFiles();
  const res = calcForCurrentLATime();
  await showSimpleAlert("キャッシュを削除しました", buildAppSummary(res, null));
}
function restartThisScript() {
  try {
    Safari.open("scriptable:///run?scriptName=" + encodeURIComponent(SCRIPT_NAME));
  } catch (e) {
    console.warn(`Could not restart treasure candle script: ${e}`);
  }
}
async function showUpdatePolicySettings() {
  const state = readUpdateState();
  const alert = new Alert();
  alert.title = "GitHub更新設定";
  alert.message = [
    "更新タイミングを選択してください。",
    "",
    `現在: ${state.policy === "none" ? "更新しない" : state.policy === "always" ? "毎回" : "24時間"}`,
    `最終確認: ${formatLocalDateTimeFromMs(state.lastCheckedAtMs)}`,
    `状態: ${state.lastStatus || "未実行"}`
  ].join("\n");
  alert.addAction("24時間");
  alert.addAction("毎回");
  alert.addAction("更新しない");
  alert.addCancelAction("戻る");
  const index = await alert.presentSheet();
  if (index === -1) return;
  const policy = index === 0 ? "daily" : index === 1 ? "always" : "none";
  setUpdatePolicy(policy);
  await showSimpleAlert("保存しました", `GitHub更新タイミングを「${index === 0 ? "24時間" : index === 1 ? "毎回" : "更新しない"}」にしました。`);
}
async function runManualUpdateAndMaybeRestart() {
  const before = readUpdateState();
  const updated = await updateScriptFromGitHubIfNeeded(true);
  const after = readUpdateState();
  if (updated || Number(after.lastUpdatedAtMs || 0) > Number(before.lastUpdatedAtMs || 0)) {
    await showSimpleAlert("更新しました", "GitHubから新しいスクリプトを保存しました。スクリプトを再起動します。");
    restartThisScript();
    Script.complete();
    return true;
  }
  await showSimpleAlert("更新はありません", `GitHubを確認しましたが、新しいスクリプトはありませんでした。\n\n状態: ${after.lastStatus || "no-update"}`);
  return false;
}
async function presentApp() {
  const initialMeta = readCacheMeta();
  if (!isCacheUsable(initialMeta) || needsQualityRefresh(initialMeta)) {
    await runSyncAndReport();
  }
  while (true) {
    const res = calcForCurrentLATime();
    const meta = readCacheMeta();
    const alert = new Alert();
    alert.title = "Sky 今日の大キャン案内";
    alert.message = buildAppSummary(res, meta);
    alert.addAction("今日の画像を表示");
    alert.addAction("説明テキストを表示");
    alert.addAction("画像を取得 / 再取得");
    alert.addAction("GitHub更新設定");
    alert.addAction("今すぐ更新");
    alert.addAction("データとキャッシュをリセット");
    alert.addCancelAction("終了");
    const index = await alert.presentSheet();
    if (index === -1) break;
    if (index === 0) {
      await previewTodayImage();
      continue;
    }
    if (index === 1) {
      await previewTodayText();
      continue;
    }
    if (index === 2) {
      await runSyncAndReport();
      continue;
    }
    if (index === 3) {
      await showUpdatePolicySettings();
      continue;
    }
    if (index === 4) {
      const restarted = await runManualUpdateAndMaybeRestart();
      if (restarted) return;
      continue;
    }
    if (index === 5) {
      await resetCacheAndReport();
      continue;
    }
  }
}
runStorageMigrations();
const didUpdateScript = await updateScriptFromGitHubIfNeeded(false);
if (didUpdateScript) {
  console.log("GitHub update applied. It will take effect on the next run.");
}
if (config.runsInWidget) {
  const widget = await createWidget();
  Script.setWidget(widget);
  Script.complete();
} else if (config.runsInApp) {
  await presentApp();
  Script.complete();
} else {
  const now = new Date();
  await notifyIfCalledOutsideLaMidnight(now);
  const meta = readCacheMeta();
  if (!isCacheUsable(meta) || needsQualityRefresh(meta)) {
    try {
      await syncAllImages();
    } catch (e) {}
  }
  Script.complete();
}
