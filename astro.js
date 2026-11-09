/* ============================================================
   astro.js — 月の位置と朔望の計算（依存なし）
   Meeus "Astronomical Algorithms" 第47章の主要項による簡略式。
   月の黄経・距離と太陽黄経から、離角（月と太陽の見かけの角度）を求め、
   月齢・輝面比・朔望の時刻・月までの距離をすべてそこから導く。
   時刻はすべて UTC のミリ秒。精度の目安：朔望の時刻で数分、距離で数百km。
   ============================================================ */
(function (root) {
  "use strict";

  var SYN = 29.530588853;          // 朔望月（日）
  var RATE = 12.19;                // 離角の平均増加率（度/日）— 求根の傾きに使う
  var DAY = 86400000;
  var R2D = Math.PI / 180;

  function norm(x) { x %= 360; return x < 0 ? x + 360 : x; }
  function wrap(x) { x = norm(x); return x > 180 ? x - 360 : x; }
  function sin(x) { return Math.sin(x * R2D); }

  // [D, M, M', F, 黄経の係数(1e-6度), 距離の係数(1e-3km)]
  var TERMS = [
    [0, 0, 1, 0, 6288774, -20905355], [2, 0, -1, 0, 1274027, -3699111],
    [2, 0, 0, 0, 658314, -2955968],   [0, 0, 2, 0, 213618, -569925],
    [0, 1, 0, 0, -185116, 48888],     [0, 0, 0, 2, -114332, -3149],
    [2, 0, -2, 0, 58793, 246158],     [2, -1, -1, 0, 57066, -152138],
    [2, 0, 1, 0, 53322, -170733],     [2, -1, 0, 0, 45758, -204586],
    [0, 1, -1, 0, -40923, -129620],   [1, 0, 0, 0, -34720, 108743],
    [0, 1, 1, 0, -30383, 104755],     [2, 0, 0, -2, 15327, 10321],
    [0, 0, 1, 2, -12528, 0],          [0, 0, 1, -2, 10980, 79661],
    [4, 0, -1, 0, 10675, -34782],     [0, 0, 3, 0, 10034, -23210],
    [4, 0, -2, 0, 8548, -21636],      [2, 1, -1, 0, -7888, 24208],
    [2, 1, 0, 0, -6766, 30824],       [1, 0, -1, 0, -5163, -8379],
    [1, 1, 0, 0, 4987, -16675],       [2, -1, 1, 0, 4036, -12831],
    [2, 0, 2, 0, 3994, -10445],       [4, 0, 0, 0, 3861, -11650],
    [2, 0, -3, 0, 3665, 14403],       [0, 1, -2, 0, -2689, -7003],
    [2, 0, -1, 2, -2602, 0],          [2, -1, -2, 0, 2390, 10056],
    [1, 0, 1, 0, -2348, 6322],        [2, -2, 0, 0, 2236, -9884]
  ];

  // [D, M, M', F, 黄緯の係数(1e-6度)]
  var TERMS_B = [
    [0, 0, 0, 1, 5128122], [0, 0, 1, 1, 280602], [0, 0, 1, -1, 277693], [2, 0, 0, -1, 173237],
    [2, 0, -1, 1, 55413], [2, 0, -1, -1, 46271], [2, 0, 0, 1, 32573], [0, 0, 2, 1, 17198],
    [2, 0, 1, -1, 9266], [0, 0, 2, -1, 8822], [2, -1, 0, -1, 8216], [2, 0, -2, -1, 4324],
    [2, 0, 1, 1, 4200], [2, 1, 0, -1, -3359], [2, -1, -1, 1, 2463], [2, -1, 0, 1, 2211],
    [2, -1, -1, -1, 2065], [0, 1, -1, -1, -1870], [4, 0, -1, -1, 1828], [0, 1, 0, 1, -1794],
    [0, 0, 0, 3, -1749], [0, 1, -1, 1, -1565], [1, 0, 0, 1, -1491], [0, 1, 1, 1, -1475],
    [0, 1, 1, -1, -1410], [0, 1, 0, -1, -1344], [1, 0, 0, -1, -1335], [0, 0, 3, 1, 1107],
    [4, 0, 0, -1, 1021], [4, 0, -1, 1, 833]
  ];

  /* 時刻 t → 月の状態 { elong: 離角(度), dist: 距離(km), lambda: 黄経(度), beta: 黄緯(度), T: ユリウス世紀 } */
  function moon(t) {
    var T = (t / DAY + 2440587.5 - 2451545) / 36525;
    var T2 = T * T;
    var Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T2;
    var D  = 297.8501921 + 445267.1114034 * T - 0.0018819 * T2;
    var M  = 357.5291092 + 35999.0502909 * T - 0.0001536 * T2;
    var Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T2;
    var F  = 93.2720950 + 483202.0175233 * T - 0.0036539 * T2;
    var E  = 1 - 0.002516 * T - 0.0000074 * T2;

    var sl = 0, sr = 0;
    for (var i = 0; i < TERMS.length; i++) {
      var k = TERMS[i];
      var e = Math.abs(k[1]) === 1 ? E : Math.abs(k[1]) === 2 ? E * E : 1;
      var arg = k[0] * D + k[1] * M + k[2] * Mp + k[3] * F;
      sl += k[4] * e * sin(arg);
      sr += k[5] * e * Math.cos(arg * R2D);
    }
    var A1 = 119.75 + 131.849 * T, A2 = 53.09 + 479264.290 * T;
    sl += 3958 * sin(A1) + 1962 * sin(Lp - F) + 318 * sin(A2);

    var lambda = norm(Lp + sl / 1e6);

    var sb = 0;
    for (var j = 0; j < TERMS_B.length; j++) {
      var kb = TERMS_B[j], eb = Math.abs(kb[1]) === 1 ? E : Math.abs(kb[1]) === 2 ? E * E : 1;
      sb += kb[4] * eb * sin(kb[0] * D + kb[1] * M + kb[2] * Mp + kb[3] * F);
    }
    sb += -2235 * sin(Lp) + 382 * sin(313.45 + 481266.484 * T) + 175 * sin(A1 - F) + 175 * sin(A1 + F) +
      127 * sin(Lp - Mp) - 115 * sin(Lp + Mp);
    var beta = sb / 1e6;

    var L0 = 280.46646 + 36000.76983 * T;
    var Ms = 357.52911 + 35999.05029 * T;
    var C = (1.914602 - 0.004817 * T) * sin(Ms) + 0.019993 * sin(2 * Ms) + 0.000289 * sin(3 * Ms);
    var sun = norm(L0 + C);

    return { elong: norm(lambda - sun), dist: 385000.56 + sr / 1000, lambda: lambda, beta: beta, T: T };
  }

  /* 場所（緯度lat・東経lon）での、月の高さ（度）から、月の出入りの基準の高さを引いた値。
     0を横切る時刻が、月の出・月の入り。基準は、視差と大気の屈折を含めた、上の縁が地平線に来る高さ */
  function moonAlt(t, lat, lon, parts) {
    var m = moon(t), T = m.T, eps = (23.439291 - 0.0130042 * T) * R2D;
    var lam = m.lambda * R2D, bet = m.beta * R2D;
    var ra = Math.atan2(Math.sin(lam) * Math.cos(eps) - Math.tan(bet) * Math.sin(eps), Math.cos(lam));
    var dec = Math.asin(Math.sin(bet) * Math.cos(eps) + Math.cos(bet) * Math.sin(eps) * Math.sin(lam));
    var gmst = norm(280.46061837 + 360.98564736629 * (t / DAY + 2440587.5 - 2451545));
    var H = (gmst + lon) * R2D - ra, p = lat * R2D;
    var alt = Math.asin(Math.sin(p) * Math.sin(dec) + Math.cos(p) * Math.cos(dec) * Math.cos(H)) / R2D;
    var hz = Math.asin(6378.14 / m.dist) / R2D;                // 地平視差（度）
    if (parts) return { H: ((H / R2D + 540) % 360) - 180, alt: alt };
    return alt - (0.7275 * hz - 34 / 60);
  }

  /* [t0, t1) の間の、月の出・月の入り・南中の時刻（UTCミリ秒）。なければ null */
  function moonDay(t0, t1, lat, lon) {
    var step = 600000, res = { rise: null, set: null, transit: null };
    var f = function (t) { return moonAlt(t, lat, lon); };
    var g = function (t) { return moonAlt(t, lat, lon, true).H; };
    var bis = function (fn, a, b) {
      for (var i = 0; i < 24; i++) { var c = (a + b) / 2; if ((fn(a) < 0) === (fn(c) < 0)) a = c; else b = c; }
      return (a + b) / 2;
    };
    var pf = f(t0), pg = g(t0);
    for (var t = t0 + step; t <= t1; t += step) {
      var cf = f(t), cg = g(t);
      if (res.rise === null && pf < 0 && cf >= 0) res.rise = bis(f, t - step, t);
      if (res.set === null && pf >= 0 && cf < 0) res.set = bis(f, t - step, t);
      if (res.transit === null && pg < 0 && cg >= 0 && cg - pg < 180) res.transit = bis(g, t - step, t);
      pf = cf; pg = cg;
    }
    return res;
  }

  /* 離角が target 度になる時刻を、初期値 t から求根（ニュートン法） */
  function solve(t, target) {
    for (var i = 0; i < 10; i++) {
      t -= wrap(moon(t).elong - target) / RATE * DAY;
    }
    return t;
  }

  /* t の後で最初に離角が target(0/90/180/270)になる時刻 */
  function nextPhase(t, target) {
    var d = norm(target - moon(t).elong);
    var r = solve(t + d / RATE * DAY, target);
    return r > t ? r : solve(r + SYN * DAY, target);
  }

  /* t の前で最後に離角が target になった時刻 */
  function prevPhase(t, target) {
    var d = norm(moon(t).elong - target);
    var r = solve(t - d / RATE * DAY, target);
    return r <= t ? r : solve(r - SYN * DAY, target);
  }

  /* 月齢＝直前の新月からの経過日数 */
  function age(t) { return (t - prevPhase(t, 0)) / DAY; }

  /* 離角 → 輝面比（0..1） */
  function illum(elong) { return (1 - Math.cos(elong * R2D)) / 2; }

  /* 月の見かけの直径（分角） */
  function angular(dist) { return 2 * Math.atan(1737.4 / dist) / R2D * 60; }

  /* [t0, t1) の朔望を時刻順に返す [{t, deg, name}] */
  var NAMES = { 0: "新月", 90: "上弦", 180: "満月", 270: "下弦" };
  function events(t0, t1) {
    var out = [], cur = t0;
    for (;;) {
      var best = null, deg = 0;
      [0, 90, 180, 270].forEach(function (g) {
        var e = nextPhase(cur, g);
        if (best === null || e < best) { best = e; deg = g; }
      });
      if (best >= t1) break;
      out.push({ t: best, deg: deg, name: NAMES[deg] });
      cur = best + 3600000;
    }
    return out;
  }

  root.Astro = {
    SYN: SYN, moon: moon, age: age, illum: illum, angular: angular,
    nextPhase: nextPhase, prevPhase: prevPhase, events: events, moonDay: moonDay
  };
})(typeof window !== "undefined" ? window : globalThis);
