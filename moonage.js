/* ============================================================
   月齢カレンダー  (moon-age calendar)
   - 月齢計算は新月基準＋朔望月による簡易近似（誤差±1日程度）
   - 月の満ち欠けは SVG の円で描画（後日きれいな画像に差し替え可）
   - 使い方: <div id="moon-calendar"></div> と
             <script src="moon-age/moonage.js"></script> を置くだけ
   ============================================================ */
(function () {
  "use strict";

  var SYNODIC = 29.530588853;                 // 朔望月（日）
  var REF_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14, 0); // 基準の新月 2000-01-06 18:14 UT
  var WEEK = ["日", "月", "火", "水", "木", "金", "土"];
  var PHASE_NAME = ["新月", "三日月", "上弦", "十三夜", "満月", "寝待月", "下弦", "有明月"];

  /* --- その日（正午）の月齢を返す --- */
  function moonAge(year, month, day) {
    var t = Date.UTC(year, month - 1, day, 3, 0, 0); // JST正午 = UT 3時
    var diff = (t - REF_NEW_MOON) / 86400000;
    var age = diff % SYNODIC;
    if (age < 0) age += SYNODIC;
    return age;
  }

  /* --- 月齢 → 満ち欠けSVG（半円＋楕円方式） ---
     光る側の半円を描き、中央に楕円を重ねる。
     楕円を「明」で塗れば凸（半月超え）、「暗」で塗れば三日月になる。 */
  function moonSVG(age, size) {
    var phase = (((age % SYNODIC) + SYNODIC) % SYNODIC) / SYNODIC; // 0..1
    var r = size / 2 - 1.5;
    var c = size / 2;
    var rx = Math.abs(Math.cos(2 * Math.PI * phase)) * r; // 明暗境界の楕円の横半径
    var litRight = phase <= 0.5;                          // 上弦側は右が光る
    var gibbous = phase > 0.25 && phase < 0.75;           // 半月を超えているか
    var DARK = "#15151c", LIT = "#e8e6cf", LINE = "#3a3a48";

    var baseSweep = litRight ? 1 : 0;
    var half = "M " + c + " " + (c - r) +
               " A " + r + " " + r + " 0 0 " + baseSweep + " " + c + " " + (c + r) + " Z";

    return '<svg class="ma-moon" width="' + size + '" height="' + size +
           '" viewBox="0 0 ' + size + " " + size + '">' +
           '<circle cx="' + c + '" cy="' + c + '" r="' + r +
           '" fill="' + DARK + '" stroke="' + LINE + '" stroke-width="1"/>' +
           '<path d="' + half + '" fill="' + LIT + '"/>' +
           '<ellipse cx="' + c + '" cy="' + c + '" rx="' + rx + '" ry="' + r +
           '" fill="' + (gibbous ? LIT : DARK) + '"/>' +
           '<circle cx="' + c + '" cy="' + c + '" r="' + r +
           '" fill="none" stroke="' + LINE + '" stroke-width="1"/>' +
           "</svg>";
  }

  /* --- 月内の朔望（新月/上弦/満月/下弦）を {日付: 名称} のマップで返す。
     朔望の瞬間に正午が最も近い日に名称を付ける。 --- */
  function buildLabels(year, month, days) {
    var marks = [
      { age: 0, name: "新月" },
      { age: SYNODIC * 0.25, name: "上弦" },
      { age: SYNODIC * 0.5, name: "満月" },
      { age: SYNODIC * 0.75, name: "下弦" }
    ];
    var map = {};
    for (var d = 1; d <= days; d++) {
      var a0 = moonAge(year, month, d);
      var a1 = moonAge(year, month, d + 1);
      if (a1 < a0) a1 += SYNODIC;            // 月跨ぎ補正
      for (var i = 0; i < marks.length; i++) {
        for (var k = 0; k <= 1; k++) {       // 朔望(0)の周回も考慮
          var M = marks[i].age + k * SYNODIC;
          if (a0 <= M && M < a1) {
            var frac = (M - a0) / (a1 - a0); // 正午d〜正午d+1のどこで起きるか
            var day = frac < 0.5 ? d : d + 1;
            if (day >= 1 && day <= days) map[day] = marks[i].name;
          }
        }
      }
    }
    return map;
  }

  /* --- カレンダー本体を描画 --- */
  function render(container, year, month) {
    var first = new Date(year, month - 1, 1);
    var startDay = first.getDay();
    var days = new Date(year, month, 0).getDate();
    var today = new Date();
    var isThisMonth = today.getFullYear() === year && today.getMonth() + 1 === month;
    var labels = buildLabels(year, month, days);

    var html = '<div class="ma-head">' +
      '<button class="ma-nav" data-step="-1">‹</button>' +
      '<span class="ma-title">' + year + "年 " + month + "月</span>" +
      '<button class="ma-nav" data-step="1">›</button>' +
      "</div>";

    html += '<div class="ma-grid">';
    for (var w = 0; w < 7; w++) {
      var cls = w === 0 ? " ma-sun" : w === 6 ? " ma-sat" : "";
      html += '<div class="ma-wd' + cls + '">' + WEEK[w] + "</div>";
    }
    for (var b = 0; b < startDay; b++) html += '<div class="ma-cell ma-empty"></div>';

    for (var d = 1; d <= days; d++) {
      var dow = (startDay + d - 1) % 7;
      var dcls = dow === 0 ? " ma-sun" : dow === 6 ? " ma-sat" : "";
      var todayCls = isThisMonth && today.getDate() === d ? " ma-today" : "";
      var age = moonAge(year, month, d);
      var label = labels[d] || "";
      html += '<div class="ma-cell' + dcls + todayCls + '">' +
        '<div class="ma-date">' + d +
        (label ? '<span class="ma-label">' + label + "</span>" : "") + "</div>" +
        moonSVG(age, 34) +
        '<div class="ma-age">' + age.toFixed(1) + "</div>" +
        "</div>";
    }
    html += "</div>";

    container.innerHTML = html;
    container.querySelector('[data-step="-1"]').onclick = function () {
      var m = month - 1, y = year;
      if (m < 1) { m = 12; y--; }
      render(container, y, m);
    };
    container.querySelector('[data-step="1"]').onclick = function () {
      var m = month + 1, y = year;
      if (m > 12) { m = 1; y++; }
      render(container, y, m);
    };
  }

  /* --- スタイル注入（ページのCSS変数を利用） --- */
  function injectCSS() {
    if (document.getElementById("ma-style")) return;
    var s = document.createElement("style");
    s.id = "ma-style";
    s.textContent =
      "#moon-calendar{background:var(--surface-1,#1f1f27);border:1px solid var(--border,rgba(150,150,200,.07));" +
      "border-top:2px solid #4a5a78;border-radius:7px;padding:12px 14px 14px;max-width:340px;margin-bottom:14px;}" +
      ".ma-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;}" +
      ".ma-title{font-size:13px;font-weight:700;color:var(--text-bright,#c8c8d8);letter-spacing:.05em;}" +
      ".ma-nav{background:var(--btn-bg,#252535);color:var(--text,#9898a8);border:1px solid var(--border-hover,rgba(150,150,200,.18));" +
      "border-radius:4px;width:24px;height:24px;cursor:pointer;font-size:14px;line-height:1;transition:background .2s,color .2s;}" +
      ".ma-nav:hover{background:var(--btn-hover,#334455);color:var(--text-bright,#c8c8d8);}" +
      ".ma-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;}" +
      ".ma-wd{text-align:center;font-size:10px;font-weight:700;color:var(--label,#48485e);padding-bottom:3px;}" +
      ".ma-cell{background:var(--surface-2,#1b1b23);border:1px solid transparent;border-radius:5px;" +
      "padding:4px 2px 3px;text-align:center;min-height:62px;}" +
      ".ma-empty{background:transparent;}" +
      ".ma-today{border-color:#4a7fa8;box-shadow:0 0 0 1px rgba(74,127,168,.3);}" +
      ".ma-date{font-size:11px;color:var(--text,#9898a8);font-weight:600;line-height:1.2;min-height:24px;}" +
      ".ma-sun .ma-date,.ma-wd.ma-sun{color:#c87a7a;}" +
      ".ma-sat .ma-date,.ma-wd.ma-sat{color:#7a9ec8;}" +
      ".ma-label{display:block;font-size:8.5px;color:var(--link,#7a9ec8);font-weight:700;}" +
      ".ma-moon{display:block;margin:1px auto 0;}" +
      ".ma-age{font-size:8.5px;color:var(--text-dim,#50505e);font-family:'Consolas',monospace;margin-top:1px;}";
    document.head.appendChild(s);
  }

  function init() {
    var el = document.getElementById("moon-calendar");
    if (!el) return;
    injectCSS();
    var now = new Date();
    render(el, now.getFullYear(), now.getMonth() + 1);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
