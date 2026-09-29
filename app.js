/* ============================================================
   app.js — 月齢カレンダーの画面
   選んだ日（sel）を唯一の状態として、各セクションをその日の姿で描き直す。
   ============================================================ */
(function () {
  "use strict";

  var A = window.Astro;
  var SYN = A.SYN;
  var JST = 9 * 3600000;
  var R = Math.PI / 180;
  var WD = ["日", "月", "火", "水", "木", "金", "土"];
  var TIDE = ["大潮", "中潮", "小潮", "長潮", "若潮"];
  // 月齢の整数部 % 15 → 潮回り。日本で一般に使われる月齢ベースの目安
  var TIDE_SEQ = [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 4, 1, 1, 1, 0];
  var SUN_RATIO = 0.46;            // 太陽の起潮力 ÷ 月の起潮力
  var MEAN_DIST = 384400, NEAR = 356400, FAR = 406700;

  /* 月面ガイドの地名。x,y は写真（1920px）上の座標 */
  var FEATURES = [
    { n: "雨の海", en: "Mare Imbrium", x: 700, y: 560,
      d: "月で最も目立つ海のひとつ。約38億年前の巨大衝突でできた盆地に、溶岩が流れ込んでできました。" },
    { n: "晴れの海", en: "Mare Serenitatis", x: 1060, y: 620,
      d: "丸い海。縁の谷は、1972年にアポロ17号が着陸した場所です。" },
    { n: "静かの海", en: "Mare Tranquillitatis", x: 1250, y: 830,
      d: "1969年7月20日、アポロ11号が人類初の月面着陸をした海です。" },
    { n: "危機の海", en: "Mare Crisium", x: 1520, y: 590,
      d: "周囲から孤立した楕円形の海。肉眼でも、右上に暗い斑点として見えます。" },
    { n: "嵐の大洋", en: "Oceanus Procellarum", x: 520, y: 900,
      d: "月で最大の暗い平原（約400万km²）。月の西の端まで広がる、巨大な溶岩の海です。" },
    { n: "コペルニクス", en: "Copernicus", x: 650, y: 990,
      d: "直径約93km、約8億年前にできた若いクレーター。周囲に放射状の明るい筋（光条）が広がります。" },
    { n: "ケプラー", en: "Kepler", x: 330, y: 860,
      d: "直径約32km。コペルニクスと同じく若く、明るい光条をもちます。" },
    { n: "ティコ", en: "Tycho", x: 1010, y: 1585,
      d: "直径約85km、約1億年前の若いクレーター。満月のころ、南半球の高地から四方へのびる光条が最も目立ちます。" }
  ];

  var sel, cur, view, orbitE = 0, tideS = 0, guideSel = 0, playing = false, lastFrame = 0;

  /* ---------- 日付まわり（すべて日本時間） ---------- */
  function jst(t) {
    var d = new Date(t + JST);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(),
             h: d.getUTCHours(), mi: d.getUTCMinutes(), wd: d.getUTCDay() };
  }
  function noon(s) { return Date.UTC(s.y, s.m - 1, s.d, 3, 0); }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function fmt(t) { var j = jst(t); return j.m + "月" + j.d + "日 " + pad(j.h) + ":" + pad(j.mi); }
  function comma(n) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function same(a, b) { return a.y === b.y && a.m === b.m && a.d === b.d; }
  function $(id) { return document.getElementById(id); }

  function info(s) {
    var t = noon(s), mo = A.moon(t);
    return { t: t, e: mo.elong, dist: mo.dist, age: A.age(t), k: A.illum(mo.elong) };
  }

  function phaseName(e) {
    var names = ["新月", "三日月", "上弦の月", "満ちていく凸月", "満月", "欠けていく凸月", "下弦の月", "欠けていく細い月"];
    return names[Math.floor(((e + 22.5) % 360) / 45)];
  }
  function tideOf(age) { return TIDE[TIDE_SEQ[Math.floor(age) % 15]]; }

  function until(t, ref) {
    var m = Math.max(0, Math.round((t - ref) / 60000)), d = Math.floor(m / 1440), h = Math.floor(m % 1440 / 60);
    return d > 0 ? "あと" + d + "日" + h + "時間" : "あと" + h + "時間";
  }

  /* ---------- 月の描画：写真＋影 ---------- */
  function moonInner(e) {
    var Rm = 810, C = 960, w = e > 180, f = (w ? 360 - e : e) * R;
    var rx = Math.abs(Rm * Math.cos(f)), sw = Math.cos(f) > 0 ? 0 : 1, O = Rm + 60;
    var lit = "M" + C + " " + (C - Rm) + "A" + Rm + " " + Rm + " 0 0 1 " + C + " " + (C + Rm) +
              "A" + rx.toFixed(1) + " " + Rm + " 0 0 " + sw + " " + C + " " + (C - Rm) + "Z";
    var out = "M" + (C - O) + " " + C + "a" + O + " " + O + " 0 1 0 " + 2 * O + " 0a" + O + " " + O +
              " 0 1 0 " + (-2 * O) + " 0Z";
    return '<image href="img/full-moon.jpg" width="1920" height="1920"/>' +
      '<g clip-path="url(#disc)"><path d="' + out + lit + '" fill="#04060e" fill-opacity=".93" fill-rule="evenodd" ' +
      'filter="url(#soft)"' + (w ? ' transform="translate(1920 0) scale(-1 1)"' : "") + "/></g>";
  }
  function moonSVG(e, px, extra) {
    return '<svg viewBox="150 150 1620 1620" width="' + px + '" height="' + px + '" ' + (extra || 'aria-hidden="true"') + ">" +
      moonInner(e) + "</svg>";
  }

  /* ---------- 今日の月 ---------- */
  function renderToday() {
    var i = cur, now = jst(Date.now()), isToday = same(sel, now);
    var ref = isToday ? Date.now() : i.t;
    var nf = A.nextPhase(ref, 180), nn = A.nextPhase(ref, 0);
    var ang = A.angular(i.dist), diff = (i.dist - MEAN_DIST) / MEAN_DIST * 100;
    var wd = WD[new Date(Date.UTC(sel.y, sel.m - 1, sel.d)).getUTCDay()];

    $("today").innerHTML =
      "<figure>" + moonSVG(i.e, 420, 'role="img" aria-label="' + phaseName(i.e) + '"') + "</figure>" +
      "<div>" +
        "<p>" + sel.y + "年" + sel.m + "月" + sel.d + "日（" + wd + "）" + (isToday ? "・今日" : "") + "</p>" +
        "<h2>月齢<strong>" + i.age.toFixed(1) + "</strong></h2>" +
        "<p>" + phaseName(i.e) + "</p>" +
        "<dl>" +
          "<dt>輝面比</dt><dd>" + Math.round(i.k * 100) + "%</dd>" +
          "<dt>潮回り</dt><dd>" + tideOf(i.age) + "</dd>" +
          "<dt>月までの距離</dt><dd>" + comma(i.dist) + " km（平均より " + (diff >= 0 ? "+" : "−") + Math.abs(diff).toFixed(1) + "%）</dd>" +
          "<dt>見かけの大きさ</dt><dd>" + ang.toFixed(1) + "′（" + (ang / 60).toFixed(2) + "°）</dd>" +
          "<dt>次の満月</dt><dd>" + fmt(nf) + "（" + until(nf, ref) + "）</dd>" +
          "<dt>次の新月</dt><dd>" + fmt(nn) + "（" + until(nn, ref) + "）</dd>" +
        "</dl>" +
        "<nav>" +
          '<button data-step="-1">‹ 前の日</button>' +
          '<button data-step="0"' + (isToday ? " disabled" : "") + ">今日にもどる</button>" +
          '<button data-step="1">次の日 ›</button>' +
        "</nav>" +
      "</div>";
  }

  /* ---------- カレンダー ---------- */
  function renderCal() {
    var v = view, first = Date.UTC(v.y, v.m - 1, 1) - JST, end = Date.UTC(v.y, v.m, 1) - JST;
    var ev = {}, now = jst(Date.now());
    A.events(first, end).forEach(function (e) { ev[jst(e.t).d] = e.name; });
    var days = new Date(v.y, v.m, 0).getDate();
    var wd0 = new Date(Date.UTC(v.y, v.m - 1, 1)).getUTCDay();

    var html = WD.map(function (w) { return "<span>" + w + "</span>"; }).join("");
    for (var b = 0; b < wd0; b++) html += "<span></span>";
    for (var d = 1; d <= days; d++) {
      var s = { y: v.y, m: v.m, d: d }, i = info(s), t = tideOf(i.age);
      var cls = (same(s, sel) ? " sel" : "") + (same(s, now) ? " today" : "") + (t === "大潮" ? " spring" : "");
      html += '<button data-d="' + d + '" class="' + cls.trim() + '" title="月齢' + i.age.toFixed(1) + "・" + t + '">' +
        "<b>" + d + "</b>" + moonSVG(i.e, 38) + "<span>" + i.age.toFixed(1) + "</span><i>" + (ev[d] || "") + "</i></button>";
    }
    $("grid").innerHTML = html;
    $("month-title").textContent = v.y + "年" + v.m + "月";
  }

  /* ---------- 図解用の小道具 ---------- */
  function halfDisc(r, fill) {   // 太陽側（左）だけ光る半円
    return '<path d="M0 ' + (-r) + "A" + r + " " + r + ' 0 0 0 0 ' + r + 'Z" style="fill:' + fill + '"/>';
  }
  function sunRays(x0, x1, ys, id) {
    var out = '<defs><marker id="' + id + '" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto">' +
      '<path d="M0 0L8 4L0 8Z" style="fill:var(--gold)"/></marker></defs>' +
      '<circle cx="-14" cy="' + (ys[0] + ys[ys.length - 1]) / 2 + '" r="52" style="fill:var(--gold);opacity:.85"/>';
    ys.forEach(function (y) {
      out += '<line x1="' + x0 + '" y1="' + y + '" x2="' + x1 + '" y2="' + y + '" style="stroke:var(--gold);stroke-width:1.5" marker-end="url(#' + id + ')"/>';
    });
    return out;
  }
  function txt(x, y, s, anchor) {
    return '<text x="' + x + '" y="' + y + '" text-anchor="' + (anchor || "middle") + '" style="fill:var(--dim);font-size:13px">' + s + "</text>";
  }

  /* ---------- ① 満ち欠けの軌道図 ---------- */
  function drawOrbit() {
    var e = orbitE, phi = (180 + e) * R, cx = 330, cy = 190, orb = 130;
    var mx = cx + orb * Math.cos(phi), my = cy - orb * Math.sin(phi);
    var svg = '<svg viewBox="0 0 640 380" role="img" aria-label="太陽・地球・月の位置関係を北極側から見た図">' +
      sunRays(56, 172, [90, 140, 190, 240, 290], "ah1") + txt(80, 66, "太陽の光") +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + orb + '" fill="none" style="stroke:var(--line);stroke-dasharray:4 6"/>' +
      '<line x1="' + cx + '" y1="' + cy + '" x2="' + mx.toFixed(1) + '" y2="' + my.toFixed(1) + '" style="stroke:var(--dim);stroke-dasharray:3 4"/>' +
      '<g transform="translate(' + cx + " " + cy + ')"><circle r="24" style="fill:var(--line)"/>' + halfDisc(24, "var(--sea)") + "</g>" +
      txt(cx, cy + 46, "地球") +
      '<g transform="translate(' + mx.toFixed(1) + " " + my.toFixed(1) + ')"><circle r="15" style="fill:var(--line);stroke:var(--dim)"/>' + halfDisc(15, "var(--moon)") + "</g>" +
      txt((mx + 30 * Math.cos(phi)).toFixed(1), (my - 30 * Math.sin(phi) + 5).toFixed(1), "月") +
      "</svg>";
    $("orbit-fig").innerHTML = svg +
      "<div>" + moonSVG(e, 120) + "<small>地球から見た月</small><p><strong>" + phaseName(e) + "</strong></p></div>";
  }
  function renderOrbit() {
    orbitE = cur.e;
    $("orbit-range").value = Math.round(orbitE);
    drawOrbit();
  }

  /* ---------- ② 同じ面を向ける ---------- */
  function renderLock() {
    var cx = 320, cy = 140, orb = 105, out = "";
    out += '<circle cx="' + cx + '" cy="' + cy + '" r="' + orb + '" fill="none" style="stroke:var(--line);stroke-dasharray:4 6"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="28" style="fill:var(--sea)"/>' + txt(cx, cy + 5, "地球");
    for (var k = 0; k < 4; k++) {
      var a = k * 90 * R, mx = cx + orb * Math.cos(a), my = cy - orb * Math.sin(a);
      var ux = (cx - mx) / orb, uy = (cy - my) / orb;
      out += '<circle cx="' + mx.toFixed(1) + '" cy="' + my.toFixed(1) + '" r="17" style="fill:var(--line);stroke:var(--moon)"/>' +
        '<circle cx="' + (mx + ux * 11).toFixed(1) + '" cy="' + (my + uy * 11).toFixed(1) + '" r="5" style="fill:var(--gold)"/>';
    }
    out += txt(cx, 268, "公転（反時計回り）と自転は、どちらも約27.3日で1周");
    $("lock-fig").innerHTML = out;
  }

  /* ---------- ③ 潮の仕組み ---------- */
  function tideH(th, thm, ths) {   // 角度はすべて度。月の潮＋太陽の潮の合成（最大 1+SUN_RATIO）
    return Math.cos(2 * (th - thm) * R) + SUN_RATIO * Math.cos(2 * (th - ths) * R);
  }
  function drawTide() {
    var cx = 340, cy = 170, K = 11, base = 76, earth = 56, orb = 140;
    var e = cur.e;
    var thm = 180 + e, ths = 180;                // 太陽は左（180°）、月は太陽から e 度反時計回り
    var pts = [];
    for (var th = 0; th < 360; th += 3) {
      var r = base + K * tideH(th, thm, ths);
      pts.push((cx + r * Math.cos(th * R)).toFixed(1) + " " + (cy - r * Math.sin(th * R)).toFixed(1));
    }
    var mx = cx + orb * Math.cos(thm * R), my = cy - orb * Math.sin(thm * R);
    var tho = thm + tideS, ro = base + K * tideH(tho, thm, ths);
    var ox = cx + earth * Math.cos(tho * R), oy = cy - earth * Math.sin(tho * R);
    var wx = cx + ro * Math.cos(tho * R), wy = cy - ro * Math.sin(tho * R);
    var out = sunRays(56, 176, [90, 140, 190, 240, 290], "ah2") +
      '<path d="M' + pts.join("L") + 'Z" style="fill:var(--sea);opacity:.55"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + earth + '" style="fill:var(--line)"/>' +
      '<g transform="translate(' + cx + " " + cy + ')" style="opacity:.25">' + halfDisc(earth, "var(--moon)") + "</g>" +
      '<g transform="translate(' + mx.toFixed(1) + " " + my.toFixed(1) + ')"><circle r="13" style="fill:var(--line);stroke:var(--dim)"/>' + halfDisc(13, "var(--moon)") + "</g>" +
      txt((mx + 28 * Math.cos(thm * R)).toFixed(1), (my - 28 * Math.sin(thm * R) + 5).toFixed(1), "月");
    [[0, "満潮"], [180, "満潮"], [90, "干潮"], [270, "干潮"]].forEach(function (p) {
      var a = thm + p[0], r = base + K * tideH(a, thm, ths) + 16;
      out += txt((cx + r * Math.cos(a * R)).toFixed(1), (cy - r * Math.sin(a * R) + 4).toFixed(1), p[1]);
    });
    out += '<line x1="' + ox.toFixed(1) + '" y1="' + oy.toFixed(1) + '" x2="' + wx.toFixed(1) + '" y2="' + wy.toFixed(1) + '" style="stroke:var(--gold);stroke-width:3"/>' +
      '<circle cx="' + ox.toFixed(1) + '" cy="' + oy.toFixed(1) + '" r="5" style="fill:var(--gold)"/>' + txt(cx, 328, "北極側から見た地球。青い部分が海");
    $("tide-fig").innerHTML = out;

    // 自転にともなう海面の高さ（1周＝月に対して24時間50分）
    var x0 = 50, w = 570, mid = 75, sc = 55 / (1 + SUN_RATIO), path = "", i;
    for (i = 0; i <= 360; i += 4) {
      path += (i ? "L" : "M") + (x0 + w * i / 360).toFixed(1) + " " + (mid - sc * tideH(thm + i, thm, ths)).toFixed(1);
    }
    var hNow = tideH(tho, thm, ths);
    var c = '<line x1="' + x0 + '" y1="' + mid + '" x2="' + (x0 + w) + '" y2="' + mid + '" style="stroke:var(--line);stroke-dasharray:3 4"/>' +
      '<path d="' + path + '" fill="none" style="stroke:var(--sea);stroke-width:2.5"/>' +
      '<line x1="' + (x0 + w * tideS / 360).toFixed(1) + '" y1="10" x2="' + (x0 + w * tideS / 360).toFixed(1) + '" y2="130" style="stroke:var(--gold);opacity:.5"/>' +
      '<circle cx="' + (x0 + w * tideS / 360).toFixed(1) + '" cy="' + (mid - sc * hNow).toFixed(1) + '" r="6" style="fill:var(--gold)"/>' +
      txt(x0 - 8, mid + 4, "海面", "end");
    [["0時間", 0], ["6時間13分", 90], ["12時間25分", 180], ["18時間38分", 270], ["24時間50分", 360]].forEach(function (p) {
      c += txt(x0 + w * p[1] / 360, 146, p[0]);
    });
    $("tide-curve").innerHTML = c;
  }

  /* ---------- ④ 大潮と小潮 ---------- */
  function renderSpring() {
    var i = cur, L = 40, W = 580, T = 24, H = 110;
    var y = function (v) { return T + H * (1.6 - v) / 1.2; };            // 0.4〜1.6
    var x = function (age) { return L + W * age / SYN; };
    var band = function (a, b, cls) {
      return '<rect x="' + x(a).toFixed(1) + '" y="' + T + '" width="' + (x(b) - x(a)).toFixed(1) + '" height="' + H + '" style="fill:var(--' + cls + ');opacity:.13"/>';
    };
    var out = band(14, 18, "gold") + band(29, SYN, "gold") + band(0, 3, "gold") + band(6, 9, "sea") + band(21, 24, "sea");
    var path = "";
    for (var a = 0; a <= SYN + 0.01; a += 0.25) {
      var psi = (a - 1) / SYN * 360;             // 潮の最大は朔望の約1日後
      var v = Math.sqrt(1 + SUN_RATIO * SUN_RATIO + 2 * SUN_RATIO * Math.cos(2 * psi * R));
      path += (a ? "L" : "M") + x(a).toFixed(1) + " " + y(v).toFixed(1);
    }
    out += '<path d="' + path + '" fill="none" style="stroke:var(--moon);stroke-width:2"/>' +
      '<line x1="' + x(i.age).toFixed(1) + '" y1="' + T + '" x2="' + x(i.age).toFixed(1) + '" y2="' + (T + H) + '" style="stroke:var(--gold);stroke-width:2"/>' +
      txt(x(1.5), T - 8, "大潮") + txt(x(16), T - 8, "大潮") + txt(x(7.5), T + H + 16, "小潮") + txt(x(22.5), T + H + 16, "小潮");
    [[0, 0], [90, SYN / 4], [180, SYN / 2], [270, SYN * 3 / 4], [360, SYN]].forEach(function (p) {
      out += moonSVG(p[0], 24, 'x="' + (x(p[1]) - 12).toFixed(1) + '" y="' + (T + H + 22) + '" aria-hidden="true"');
    });
    $("spring-fig").innerHTML = out;

    var s = "";
    [0, 15].forEach(function (from) {
      s += "<small>月齢 " + from + "〜" + (from + 14) + "</small><ol class=\"strip\">";
      for (var n = from; n < from + 15; n++) {
        var k = TIDE_SEQ[n % 15];
        s += '<li class="' + (k === 0 ? "spring " : k === 2 ? "neap " : "") + (n === Math.floor(i.age) ? "now" : "") +
          '" title="月齢' + n + "・" + TIDE[k] + '">' + TIDE[k].charAt(0) + "</li>";
      }
      s += "</ol>";
    });
    $("strip-fig").innerHTML = s;
  }

  /* ---------- ⑤ 距離 ---------- */
  function renderDist() {
    var d = cur.dist, L = 40, W = 560;
    var x = function (v) { return L + W * (v - 350000) / 60000; };
    var mx = Math.min(Math.max(x(d), 70), 570);
    $("dist-fig").innerHTML =
      '<line x1="' + x(NEAR) + '" y1="80" x2="' + x(FAR) + '" y2="80" style="stroke:var(--line);stroke-width:6;stroke-linecap:round"/>' +
      [[NEAR, "近地点 35.6万km", "start"], [MEAN_DIST, "平均 38.4万km", "middle"], [FAR, "遠地点 40.7万km", "end"]].map(function (p) {
        return '<line x1="' + x(p[0]) + '" y1="70" x2="' + x(p[0]) + '" y2="90" style="stroke:var(--dim)"/>' + txt(x(p[0]), 116, p[1], p[2]);
      }).join("") +
      '<circle cx="' + x(d).toFixed(1) + '" cy="80" r="9" style="fill:var(--gold)"/>' +
      txt(mx.toFixed(1), 50, comma(d) + " km");
  }
  function renderFull() {
    var t = noon(sel), rows = [];
    for (var n = 0; n < 12; n++) {
      t = A.nextPhase(t, 180);
      var dist = A.moon(t).dist, j = jst(t), sup = dist <= 362000;
      rows.push('<li class="' + (sup ? "super" : "") + '"><span>' + j.y + "/" + j.m + "/" + j.d + "</span>" +
        '<span style="background:var(--line);border-radius:5px;height:10px;display:block"><span style="display:block;height:10px;border-radius:5px;background:' +
        (sup ? "var(--gold)" : "var(--dim)") + ";width:" + Math.max(4, Math.min(100, (dist - 350000) / 600)).toFixed(0) + '%"></span></span>' +
        "<span>" + (dist / 10000).toFixed(1) + "万km" + (sup ? " ★" : "") + "</span></li>");
    }
    $("full-list").innerHTML = rows.join("");
  }

  /* ---------- ⑥ 月面ガイド ---------- */
  function litState(e, x, y) {
    var u = (x - 960) / 810, v = (y - 960) / 810, w = e > 180, f = (w ? 360 - e : e) * R;
    var ue = w ? -u : u, edge = Math.cos(f) * Math.sqrt(Math.max(0, 1 - v * v));
    return { lit: ue >= edge, near: Math.abs(ue - edge) < 0.18 };
  }
  function renderGuide() {
    var e = cur.e;
    var svg = '<svg viewBox="150 150 1620 1620" role="img" aria-label="月面の主な地名を示した月の写真">' + moonInner(e);
    var list = "";
    FEATURES.forEach(function (f, i) {
      var st = litState(e, f.x, f.y), on = i === guideSel;
      svg += '<g data-i="' + i + '" style="cursor:pointer" class="' + (st.lit ? "" : "dark") + '">' +
        '<circle cx="' + f.x + '" cy="' + f.y + '" r="' + (on ? 46 : 36) + '" fill="rgba(0,0,0,.25)" style="stroke:var(--gold);stroke-width:' + (on ? 8 : 5) + '"/>' +
        '<text x="' + f.x + '" y="' + (f.y + 15) + '" text-anchor="middle" style="fill:var(--gold);font-size:44px;font-weight:600">' + (i + 1) + "</text></g>";
      list += '<li><button data-i="' + i + '" class="' + (on ? "on" : "") + '"><strong>' + (i + 1) + "　" + f.n + "</strong> " +
        "<small>" + f.en + "　" + (st.lit ? (st.near ? "明暗の境目の近く。凹凸がくっきり見えます" : "いま光が当たっています") : "いまは影の中") + "</small>" +
        (on ? "<p>" + f.d + "</p>" : "") + "</button></li>";
    });
    $("guide-fig").innerHTML = svg + "</svg>";
    $("guide-list").innerHTML = list;
  }

  /* ---------- 全体の描き直し ---------- */
  function renderAll() {
    cur = info(sel);
    renderToday(); renderCal(); renderOrbit(); drawTide(); renderSpring();
    renderDist(); renderFull(); renderGuide();
  }

  function select(s, scroll) {
    sel = s; view = { y: s.y, m: s.m };
    renderAll();
    if (scroll) $("today").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function shiftDay(step) {
    var j = jst(noon(sel) + step * 86400000);
    select({ y: j.y, m: j.m, d: j.d }, false);
  }

  /* ---------- 操作 ---------- */
  function tick(ts) {
    if (!playing) return;
    tideS = (tideS + (ts - lastFrame) * 0.04) % 360;   // 40°/秒
    lastFrame = ts;
    $("tide-range").value = Math.round(tideS);
    drawTide();
    requestAnimationFrame(tick);
  }

  function bind() {
    $("today").addEventListener("click", function (ev) {
      var b = ev.target.closest("button[data-step]");
      if (!b) return;
      var step = +b.getAttribute("data-step");
      if (step === 0) { var n = jst(Date.now()); select({ y: n.y, m: n.m, d: n.d }, false); }
      else shiftDay(step);
    });
    $("grid").addEventListener("click", function (ev) {
      var b = ev.target.closest("button[data-d]");
      if (b) select({ y: view.y, m: view.m, d: +b.getAttribute("data-d") }, true);
    });
    $("prev").onclick = function () { view = view.m === 1 ? { y: view.y - 1, m: 12 } : { y: view.y, m: view.m - 1 }; renderCal(); };
    $("next").onclick = function () { view = view.m === 12 ? { y: view.y + 1, m: 1 } : { y: view.y, m: view.m + 1 }; renderCal(); };
    $("orbit-range").addEventListener("input", function () { orbitE = +this.value; drawOrbit(); });
    $("tide-range").addEventListener("input", function () { tideS = +this.value; drawTide(); });
    $("tide-play").onclick = function () {
      playing = !playing;
      this.textContent = playing ? "停止" : "再生";
      if (playing) { lastFrame = performance.now(); requestAnimationFrame(tick); }
    };
    function pick(ev) {
      var g = ev.target.closest("[data-i]");
      if (g) { guideSel = +g.getAttribute("data-i"); renderGuide(); }
    }
    $("guide-fig").addEventListener("click", pick);
    $("guide-list").addEventListener("click", pick);
  }

  var n0 = jst(Date.now());
  renderLock();
  bind();
  select({ y: n0.y, m: n0.m, d: n0.d }, false);
})();
