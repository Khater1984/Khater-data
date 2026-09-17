(function () {
  'use strict';
  const F = window.FUND;
  const PERIODS = ['weekly', '4weeks', 'ytd', 'last12m', '1y', '2y', '3y', '4y', '5y', '6y'];

  function service() {
    const s = window.KHATER_DATA && window.KHATER_DATA.fund;
    if (!s) throw new Error('طبقة بيانات الصندوق غير متاحة');
    return s;
  }

  function selectedHorizon() {
    const h = new URLSearchParams(location.search).get('h') || 'last12m';
    return PERIODS.indexOf(h) >= 0 ? h : 'last12m';
  }

  function n(v) {
    if (v == null || String(v).trim() === '') return null;
    const x = Number(v);
    return Number.isFinite(x) ? x : null;
  }

  function setHorizon(h) {
    const u = new URL(location.href);
    u.searchParams.set('id', F.id);
    u.searchParams.set('h', h);
    history.replaceState({}, '', u);
    render();
  }

  function selectedPerformanceRows(horizon) {
    return service().performanceSeries(F.performance || [], horizon);
  }

  function validate(rows, horizon) {
    if (!rows.length) return 'لا توجد سجلات أداء رسمية صالحة لهذا الأفق.';
    if (rows.some(function (r) { return String(r.horizon) !== horizon || !r.report_date || n(r.return_pct) == null; })) {
      return 'فحص سلامة بيانات الأداء فشل: عدم تطابق الأفق.';
    }
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i - 1].report_date) >= String(rows[i].report_date)) {
        return 'فحص سلامة بيانات الأداء فشل: التواريخ ليست تصاعدية.';
      }
    }
    return null;
  }

  function theme() {
    return window.KHATER_THEME || {};
  }

  function svgLook() {
    const T = theme();
    if (T && typeof T.svgAppearance === 'function') return T.svgAppearance();
    return { line: 'var(--shell-green)', fill: 'rgba(8,127,99,.12)', axis: 'var(--chart-grid)', width: 2.5 };
  }

  function svgChart(rows) {
    const w = 900, h = 280, padL = 54, padR = 18, padT = 18, padB = 36;
    const vals = rows.map(function (r) { return n(r.return_pct); });
    let mn = Math.min.apply(null, vals.concat([0]));
    let mx = Math.max.apply(null, vals.concat([0]));
    if (mn === mx) { mn -= 1; mx += 1; }
    const pad = (mx - mn) * 0.08;
    mn -= pad; mx += pad;
    const range = mx - mn;
    const X = function (i) { return padL + i * (w - padL - padR) / Math.max(1, rows.length - 1); };
    const Y = function (v) { return padT + (1 - (v - mn) / range) * (h - padT - padB); };
    const line = rows.map(function (r, i) { return X(i).toFixed(1) + ',' + Y(Number(r.return_pct)).toFixed(1); }).join(' ');
    const area = padL + ',' + Y(0).toFixed(1) + ' ' + line + ' ' + X(rows.length - 1).toFixed(1) + ',' + Y(0).toFixed(1);
    const ticks = 4;
    let grid = '';
    for (let i = 0; i <= ticks; i++) {
      const v = mn + (range * i) / ticks;
      const y = Y(v).toFixed(1);
      grid += '<line class="chart-grid" x1="' + padL + '" y1="' + y + '" x2="' + (w - padR) + '" y2="' + y + '"/>';
      grid += '<text class="chart-label" x="' + (padL - 8) + '" y="' + (Number(y) + 4) + '" text-anchor="end">' + v.toFixed(1) + '%</text>';
    }
    const lastIdx = rows.length - 1;
    const xLabels = [0, Math.floor(lastIdx / 2), lastIdx].filter(function (v, i, a) { return a.indexOf(v) === i; });
    const dates = xLabels.map(function (i) {
      return '<text class="chart-label" x="' + X(i).toFixed(1) + '" y="' + (h - 10) + '" text-anchor="middle">' + String(rows[i].report_date) + '</text>';
    }).join('');
    const dots = rows.map(function (r, i) {
      return '<circle class="chart-dot" cx="' + X(i).toFixed(1) + '" cy="' + Y(Number(r.return_pct)).toFixed(1) + '" r="3.5"></circle>' +
        '<circle class="chart-hit" data-i="' + i + '" cx="' + X(i).toFixed(1) + '" cy="' + Y(Number(r.return_pct)).toFixed(1) + '" r="12" fill="transparent"></circle>';
    }).join('');
    const look = svgLook();
    const zero = Y(0);
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="السجل الرسمي للعائد المتحرك">' +
      grid +
      '<line class="chart-axis" x1="' + padL + '" y1="' + zero.toFixed(1) + '" x2="' + (w - padR) + '" y2="' + zero.toFixed(1) + '" style="stroke:' + look.axis + '"/>' +
      '<polyline class="chart-fill" points="' + area + '" style="fill:' + look.fill + '"/>' +
      '<polyline class="chart-line" points="' + line + '" style="stroke:' + look.line + ';stroke-width:' + look.width + '"/>' +
      dots + dates +
      '</svg>';
  }

  function singleObservation(latest, horizon, rows) {
    const cls = Number(latest.return_pct) < 0 ? 'neg' : '';
    return '<div class="chart-single">' +
      '<div class="chart-single-value ' + cls + '">' + F.pct(latest.return_pct) + '</div>' +
      '<div class="chart-single-meta">' +
        '<b>مشاهدة رسمية واحدة لهذا الأفق</b>' +
        '<span>' + F.esc(latest.report_date) + ' · ' + F.esc(F.L[horizon] || horizon) + '</span>' +
        '<p>لا يوجد مسار تاريخي قابل للرسم بعد. الرقم المعروض هو العائد الرسمي المنشور، وليس تقديراً من سعر الوثيقة.</p>' +
      '</div>' +
    '</div>';
  }

  function bindTooltip(host, rows) {
    const wrap = host.querySelector('.chart-wrap');
    const tip = host.querySelector('.chart-tip');
    if (!wrap || !tip) return;
    wrap.querySelectorAll('.chart-hit').forEach(function (el) {
      el.addEventListener('mouseenter', function (e) {
        const r = rows[Number(el.dataset.i)];
        tip.hidden = false;
        tip.innerHTML = '<b>' + F.esc(r.report_date) + '</b><span>العائد الرسمي ' + F.pct(r.return_pct) + '</span><span>الأفق: ' + F.esc(F.L[r.horizon] || r.horizon) + '</span>';
        const box = wrap.getBoundingClientRect();
        tip.style.left = Math.min(Math.max(12, e.clientX - box.left + 12), Math.max(12, box.width - 220)) + 'px';
        tip.style.top = Math.max(8, e.clientY - box.top - 90) + 'px';
      });
    });
    wrap.addEventListener('mouseleave', function () { tip.hidden = true; });
  }

  function navSnapshot() {
    const prices = (F.prices || []).filter(function (x) { return x && x.as_of_date && n(x.nav) > 0; })
      .sort(function (a, b) { return String(a.as_of_date).localeCompare(String(b.as_of_date)); });
    return { latest: prices[prices.length - 1], previous: prices[prices.length - 2] };
  }

  function render() {
    const host = document.getElementById('performance-tab');
    if (!host) return;
    const horizon = selectedHorizon();
    const rows = selectedPerformanceRows(horizon);
    const error = validate(rows, horizon);
    const first = rows[0];
    const latest = rows[rows.length - 1];
    const nav = navSnapshot();
    const tabs = PERIODS.map(function (x) {
      return '<button type="button" data-h="' + x + '" aria-pressed="' + (x === horizon ? 'true' : 'false') + '" class="' + (x === horizon ? 'active' : '') + '">' + F.esc(F.L[x] || x) + '</button>';
    }).join('');

    if (error) {
      host.innerHTML = '<div class="tab-nav perf-horizons">' + tabs + '</div><div class="empty integrity-error"><strong>تعذر عرض سجل الأداء</strong><p>' + F.esc(error) + '</p><p>لم يتم عرض رسم أو مؤشرات متضاربة.</p></div>';
    } else {
      const navChange = nav.latest && nav.previous ? ((Number(nav.latest.nav) / Number(nav.previous.nav) - 1) * 100) : null;
      const chartBody = rows.length < 2
        ? singleObservation(latest, horizon, rows)
        : svgChart(rows) + '<div class="chart-tip" hidden></div>';
      host.innerHTML =
        '<div class="pf-shell">' +
          '<div class="tab-nav perf-horizons" id="perf-horizons">' + tabs + '</div>' +
          '<div class="perf-strip">' +
            '<div><span>العائد الرسمي الأحدث</span><strong>' + F.pct(latest.return_pct) + '</strong><small>' + F.esc(latest.report_date) + '</small></div>' +
            '<div><span>أول عائد رسمي</span><strong>' + F.pct(first.return_pct) + '</strong><small>' + F.esc(first.report_date) + '</small></div>' +
            '<div><span>عدد السجلات</span><strong>' + rows.length + '</strong><small>لأفق ' + F.esc(F.L[horizon]) + '</small></div>' +
            '<div><span>LATEST NAV · منفصل</span><strong>' + F.num(nav.latest && nav.latest.nav) + '</strong><small>' + F.esc((nav.latest && nav.latest.as_of_date) || 'غير متاح') + '</small></div>' +
          '</div>' +
          '<div class="perf-grid">' +
            '<div class="card chart-card">' +
              '<div class="chart-top"><div><span class="perf-kicker">السجل الرسمي</span><h3>العائد المتحرك — ' + F.esc(F.L[horizon]) + '</h3></div><strong>' + F.pct(latest.return_pct) + '</strong></div>' +
              '<div class="chart-wrap">' + chartBody + '</div>' +
              '<div class="perf-legend"><span><i></i>العائد الرسمي</span><span>من ' + F.esc(first.report_date) + ' إلى ' + F.esc(latest.report_date) + '</span><span>المصدر: fund_performance_history</span></div>' +
              '<p class="note">كل نقطة صف رسمي مستقل لنفس الأفق. لا يُعاد حساب العائد من سعر الوثيقة ولا يُخلط أفق آخر.</p>' +
            '</div>' +
            '<div class="card table-card">' +
              '<div class="record-head"><div><span class="perf-kicker">سجل الأداء</span><h3>' + F.esc(F.L[horizon]) + '</h3></div><b>' + rows.length + ' سجل</b></div>' +
              '<div class="pf-official"><div class="pf-official-grid">' +
                '<div><span>العائد الرسمي الأحدث</span><strong>' + F.pct(latest.return_pct) + '</strong><small>' + F.esc(latest.report_date) + '</small></div>' +
                '<div><span>أول عائد رسمي</span><strong>' + F.pct(first.return_pct) + '</strong><small>' + F.esc(first.report_date) + '</small></div>' +
                '<div><span>أحدث سعر وثيقة</span><strong>' + F.num(nav.latest && nav.latest.nav) + '</strong><small>' + F.esc((nav.latest && nav.latest.as_of_date) || 'غير متاح') + '</small></div>' +
                '<div><span>تغير السعر الأخير</span><strong>' + F.pct(navChange) + '</strong><small>ليس العائد الرسمي</small></div>' +
              '</div></div>' +
              '<div class="table-scroll"><table><thead><tr><th>التاريخ</th><th>العائد الرسمي</th><th>سعر الوثيقة عند التقرير</th><th>المصدر</th></tr></thead><tbody>' +
                rows.slice().reverse().map(function (r) {
                  return '<tr><td>' + F.esc(r.report_date) + '</td><td class="num">' + F.pct(r.return_pct) + '</td><td class="num">' + F.num(r.nav_value) + '</td><td>' + F.esc(r.source_id || 'fund_performance_history') + '</td></tr>';
                }).join('') +
              '</tbody></table></div>' +
            '</div>' +
          '</div>' +
          '<div class="pf-footnote">مصدر هذا القسم: fund_performance_history بعد فلترة الصندوق والأفق ' + F.esc(horizon) + '. الرسم والمؤشرات والسجل مشتقة من الصفوف نفسها دون حسابات بديلة.</div>' +
        '</div>';
      if (rows.length >= 2) bindTooltip(host, rows);
    }

    host.querySelectorAll('#perf-horizons button, .perf-horizons button').forEach(function (btn) {
      btn.addEventListener('click', function () { setHorizon(btn.dataset.h); });
    });
    const heroRet = document.querySelector('.pulse .metric:nth-child(2) .metric-value');
    const heroNote = document.querySelector('.pulse .metric:nth-child(2) .note');
    const heroMuted = document.querySelector('.pulse .metric:nth-child(2) .muted');
    if (heroRet) {
      heroRet.textContent = error ? '—' : F.pct(latest.return_pct);
      heroRet.classList.toggle('neg', !error && Number(latest.return_pct) < 0);
      heroRet.classList.toggle('pos', !error && Number(latest.return_pct) >= 0);
    }
    if (heroNote) heroNote.textContent = error ? 'بيانات رسمية غير مكتملة' : latest.report_date;
    if (heroMuted) heroMuted.textContent = 'العائد الرسمي · ' + (F.L[horizon] || horizon);
  }

  window.addEventListener('popstate', render);
  window.FUND_TABS = window.FUND_TABS || {};
  window.FUND_TABS.performance = render;
})();
