(function () {
  'use strict';

  const F = window.FUND;
  const PERIODS = ['weekly', '4weeks', 'ytd', 'last12m', '1y', '2y', '3y', '4y', '5y', '6y', 'max'];

  function currentHorizon() {
    const h = new URLSearchParams(location.search).get('h') || 'last12m';
    return PERIODS.indexOf(h) >= 0 ? h : 'last12m';
  }

  function setHorizon(h) {
    const url = new URL(location.href);
    url.searchParams.set('id', F.id);
    url.searchParams.set('h', h);
    history.replaceState({}, '', url);
  }

  function n(v) {
    const x = Number(v);
    return Number.isFinite(x) ? x : null;
  }

  function officialRecord(rows, horizon) {
    return (rows || [])
      .filter(function (x) { return x.horizon === horizon && n(x.return_pct) != null; })
      .sort(function (a, b) { return String(b.report_date).localeCompare(String(a.report_date)); })[0] || null;
  }

  /* IMPORTANT DATA RULE: performance history is a validation source, not a
   * time-series of the selected horizon. The graph uses the complete observed
   * NAV timeline, then applies the selected date window. */
  function historicalHorizonSeries(rows, prices, horizon) {
    const byDate = Object.create(null);
    (rows || []).forEach(function (x) {
      if (!x.report_date) return;
      const nav = n(x.nav_value);
      if (nav == null || nav <= 0) return;
      byDate[x.report_date] = {
        date: x.report_date,
        nav: nav,
        source: x.source_id || 'fund_performance_history'
      };
    });

    (prices || []).forEach(function (x) {
      const nav = n(x.nav);
      const date = x.as_of_date;
      if (nav == null || nav <= 0 || !date) return;
      byDate[date] = {
        date: date,
        nav: nav,
        source: x.source_id || 'fund_price_history'
      };
    });

    const all = Object.keys(byDate).sort().map(function (d) { return byDate[d]; });
    if (horizon === 'max') return all;
    const end = all.length ? all[all.length - 1].date : null;
    const start = F.windowStart(horizon, end);
    return start ? all.filter(function (x) { return x.date >= start; }) : all;
  }

  function svgChart(points) {
    const w = 820, h = 280, p = 28;
    if (!points.length) return '';
    const vals = points.map(function (x) { return x.nav; });
    let mn = Math.min.apply(null, vals);
    let mx = Math.max.apply(null, vals);
    if (mn === mx) { mn -= 1; mx += 1; }
    const rg = mx - mn;

    function X(i) {
      return points.length === 1 ? w / 2 : p + i * (w - 2 * p) / (points.length - 1);
    }
    function Y(v) {
      return h - p - ((v - mn) / rg) * (h - 2 * p);
    }

    const line = points.map(function (pt, i) {
      return X(i).toFixed(2) + ',' + Y(pt.nav).toFixed(2);
    }).join(' ');
    const area = p + ',' + (h - p) + ' ' + line + ' ' + X(points.length - 1).toFixed(2) + ',' + (h - p);
    const dots = points.map(function (pt, i) {
      return '<circle class="chart-hit" data-i="' + i + '" cx="' + X(i).toFixed(2) + '" cy="' + Y(pt.nav).toFixed(2) + '" r="10" fill="transparent"></circle>';
    }).join('');

    return '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" role="img" aria-label="Actual NAV history">' +
      '<polyline class="chart-fill" points="' + area + '"/>' +
      '<polyline class="chart-line" points="' + line + '"/>' +
      '<circle class="chart-point" cx="' + X(points.length - 1).toFixed(2) + '" cy="' + Y(points[points.length - 1].nav).toFixed(2) + '" r="4.5"/>' +
      dots +
      '</svg>';
  }

  function bindTooltip(host, points, official) {
    const wrap = host.querySelector('.chart-wrap');
    const tip = host.querySelector('.chart-tip');
    if (!wrap || !tip || !points.length) return;

    const first = points[0].nav;
    function show(i, evt) {
      const pt = points[i];
      if (!pt) return;
      const change = first ? ((pt.nav / first) - 1) * 100 : null;
      const reportReturn = official && pt.date === official.report_date ? F.pct(official.return_pct) : null;
      tip.hidden = false;
      tip.innerHTML =
        '<b>' + F.esc(pt.date) + '</b>' +
        '<span>NAV ' + F.num(pt.nav) + '</span>' +
        '<span>التغير داخل السلسلة ' + F.pct(change) + '</span>' +
        (reportReturn != null ? '<span>العائد الرسمي للأفق ' + reportReturn + '</span>' : '') +
        '<span>المصدر: ' + F.esc(pt.source) + '</span>';
      const rect = wrap.getBoundingClientRect();
      const x = evt.clientX - rect.left;
      const y = evt.clientY - rect.top;
      tip.style.left = Math.min(Math.max(12, x + 14), Math.max(12, rect.width - 215)) + 'px';
      tip.style.top = Math.max(8, y - 95) + 'px';
    }

    wrap.querySelectorAll('.chart-hit').forEach(function (el) {
      el.addEventListener('mouseenter', function (evt) { show(Number(el.dataset.i), evt); });
      el.addEventListener('mousemove', function (evt) { show(Number(el.dataset.i), evt); });
    });
    wrap.addEventListener('mouseleave', function () { tip.hidden = true; });
  }

  function performanceRecord(rows, horizon, points, official) {
    const first = points[0];
    const last = points[points.length - 1];
    const navChange = first && last && first.nav ? ((last.nav / first.nav) - 1) * 100 : null;

    let html = '<div class="pf-official"><div class="pf-official-grid">';
    html += '<div><span>العائد الرسمي الأحدث</span><strong>' + (official ? F.pct(official.return_pct) : 'غير متاح') + '</strong><small>' + (official ? F.esc(official.report_date) : 'لا يوجد سجل رسمي') + '</small></div>';
    html += '<div><span>NAV عند التقرير الرسمي</span><strong>' + (official && n(official.nav_value) != null ? F.num(official.nav_value) : 'غير متاح') + '</strong><small>' + (official && official.currency ? F.esc(official.currency) : 'البيانات التاريخية') + '</small></div>';
    html += '<div><span>أول NAV في السلسلة</span><strong>' + (first ? F.num(first.nav) : 'غير متاح') + '</strong><small>' + (first ? F.esc(first.date) : '') + '</small></div>';
    html += '<div><span>آخر NAV في السلسلة</span><strong>' + (last ? F.num(last.nav) : 'غير متاح') + '</strong><small>' + (last ? F.esc(last.date) : '') + '</small></div>';
    html += '<div><span>تغير NAV المحسوب</span><strong>' + F.pct(navChange) + '</strong><small>أول NAV ← آخر NAV</small></div>';
    html += '<div><span>عدد نقاط NAV</span><strong>' + points.length + '</strong><small>سلسلة فعلية من Supabase</small></div>';
    html += '</div></div>';

    if (!points.length) {
      return html + '<div class="empty">لا توجد نقاط NAV فعلية متاحة لهذا الأفق في قاعدة البيانات.</div>';
    }

    const recent = points.slice(-10).reverse();
    html += '<div class="pf-actual-head"><span>ACTUAL NAV OBSERVATIONS</span><small>آخر ' + recent.length + ' نقاط</small></div>';
    html += '<div class="table-scroll"><table><thead><tr><th>التاريخ</th><th>NAV</th><th>المصدر</th></tr></thead><tbody>';
    html += recent.map(function (x) {
      return '<tr><td>' + F.esc(x.date) + '</td><td class="num">' + F.num(x.nav) + '</td><td>' + F.esc(x.source) + '</td></tr>';
    }).join('');
    html += '</tbody></table></div>';
    return html;
  }

  function render() {
    const host = document.getElementById('performance-tab');
    if (!host) return;

    const horizon = currentHorizon();
    const rows = F.performance || [];
    const prices = F.prices || [];
    const official = officialRecord(rows, horizon);
    const points = historicalHorizonSeries(rows, prices, horizon);
    const first = points[0];
    const last = points[points.length - 1];

    // Headline is always the observed NAV movement of the selected window.
    // Official return_pct remains a separate validation value in the record.
    const headline = first && last && first.nav ? ((last.nav / first.nav) - 1) * 100 : null;

    const historicalPoints = points.length;
    const appendedPrices = points.filter(function (x) { return x.source !== 'fund_performance_history'; }).length;

    const tabs = PERIODS.map(function (x) {
      return '<button type="button" data-h="' + x + '" aria-pressed="' + (x === horizon ? 'true' : 'false') + '" class="' + (x === horizon ? 'active' : '') + '">' + F.esc(F.L[x] || x) + '</button>';
    }).join('');

    let chartBody;
    if (points.length < 2) {
      chartBody =
        '<div class="empty data-gap">' +
          '<strong>بيانات NAV غير كافية للرسم</strong>' +
          '<p>الأفق «' + F.esc(F.L[horizon]) + '» يحتوي حالياً على ' + points.length + ' نقطة NAV فعلية فقط من البيانات المتاحة في Supabase.</p>' +
          '<p>لم يتم إنشاء أو استنتاج أي نقطة إضافية.</p>' +
        '</div>';
    } else {
      chartBody = '<div class="chart-wrap">' + svgChart(points) + '<div class="chart-tip" hidden></div></div>';
    }

    host.innerHTML =
      '<div class="pf-shell">' +
        '<div class="tab-nav perf-horizons" id="perf-horizons">' + tabs + '</div>' +
        '<div class="perf-strip">' +
          '<div><span>تغير NAV الفعلي</span><strong>' + F.pct(headline) + '</strong><small>' + (first && last ? F.esc(first.date + ' → ' + last.date) : 'غير متاح') + '</small></div>' +
          '<div><span>NAV البداية</span><strong>' + (first ? F.num(first.nav) : '—') + '</strong><small>' + (first ? F.esc(first.date) : 'غير متاح') + '</small></div>' +
          '<div><span>آخر NAV</span><strong>' + (last ? F.num(last.nav) : '—') + '</strong><small>' + (last ? F.esc(last.date) : 'غير متاح') + '</small></div>' +
          '<div><span>النقاط التاريخية</span><strong>' + historicalPoints + '</strong><small>هذا الأفق فقط</small></div>' +
        '</div>' +
        '<div class="perf-grid">' +
          '<div class="card chart-card">' +
            '<div class="chart-top"><div><span class="perf-kicker">ACTUAL NAV HISTORY</span><h3>' + F.esc(F.L[horizon]) + ' · حركة NAV الفعلية</h3></div><strong>' + F.pct(headline) + '</strong></div>' +
            chartBody +
            '<div class="perf-legend"><span><i></i>NAV الفعلي</span><span>تاريخي + أحدث NAV</span><span>المصدر: Supabase</span></div>' +
            '<p class="note">' +
              (points.length >= 2
                ? ('السلسلة من كامل NAV المرصود ثم تُقص حسب أفق ' + F.esc(F.L[horizon]) + '. نقاط fund_price_history ضمن النافذة: ' + appendedPrices + '.')
                : 'لا توجد نقاط كافية للرسم؛ لم يتم توليد بيانات بديلة.') +
            '</p>' +
          '</div>' +
          '<div class="card table-card">' +
            '<div class="record-head"><div><span class="perf-kicker">PERFORMANCE RECORD</span><h3>' + F.esc(F.L[horizon]) + '</h3><small>العائد الرسمي + NAV الفعلي من Supabase</small></div><b>' + F.esc(F.L[horizon]) + '</b></div>' +
            performanceRecord(rows, horizon, points, official) +
          '</div>' +
        '</div>' +
        '<div class="pf-footnote">قاعدة الربط: الرسم يعرض حركة NAV الفعلية من fund_performance_history + fund_price_history بعد تطبيق نافذة التاريخ المختارة. العائد الرسمي من fund_performance_history يظهر منفصلاً للتحقق، ولا يُستخدم كسلسلة نقاط للرسم.</div>' +
      '</div>';

    const heroRet = document.querySelector('.pulse .metric:nth-child(2) .metric-value');
    const heroNote = document.querySelector('.pulse .metric:nth-child(2) .note');
    const heroMuted = document.querySelector('.pulse .metric:nth-child(2) .muted');
    if (heroMuted) heroMuted.textContent = 'RETURN · ' + (F.L[horizon] || horizon);
    if (heroRet) heroRet.textContent = F.pct(headline);
    if (heroNote) heroNote.textContent = official ? F.esc(official.report_date) : (first && last ? first.date + ' → ' + last.date : 'بيانات غير كافية');

    host.querySelectorAll('#perf-horizons button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setHorizon(btn.getAttribute('data-h'));
        render();
      });
    });
    bindTooltip(host, points, official);
  }

  window.addEventListener('popstate', render);
  window.FUND_TABS = window.FUND_TABS || {};
  window.FUND_TABS.performance = render;
})();
