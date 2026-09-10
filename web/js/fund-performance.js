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
    try { sessionStorage.setItem('khater.horizon', h); } catch (e) {}
  }

  function officialByHorizon(rows) {
    const by = {};
    (rows || []).forEach(function (x) {
      if (x.horizon && !by[x.horizon]) by[x.horizon] = x;
    });
    return by;
  }

  function svgChart(points) {
    const w = 820, h = 260, p = 22;
    if (!points.length) return '';
    const navs = points.map(function (x) { return x.nav; });
    const mn = Math.min.apply(null, navs);
    const mx = Math.max.apply(null, navs);
    const rg = mx - mn || 1;
    function X(i) {
      return points.length === 1 ? w / 2 : p + i * (w - 2 * p) / (points.length - 1);
    }
    function Y(v) {
      return h - p - ((v - mn) / rg) * (h - 2 * p);
    }
    const line = points.map(function (pt, i) { return X(i).toFixed(2) + ',' + Y(pt.nav).toFixed(2); }).join(' ');
    const last = points[points.length - 1];
    const area = p + ',' + (h - p) + ' ' + line + ' ' + X(points.length - 1).toFixed(2) + ',' + (h - p);
    const dots = points.map(function (pt, i) {
      return '<circle class="chart-hit" data-i="' + i + '" cx="' + X(i).toFixed(2) + '" cy="' + Y(pt.nav).toFixed(2) + '" r="9" fill="transparent"></circle>';
    }).join('');
    return (
      '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" role="img">' +
        '<line class="axis" x1="0" y1="' + (h / 2) + '" x2="' + w + '" y2="' + (h / 2) + '"/>' +
        '<polyline class="chart-fill" points="' + area + '"/>' +
        '<polyline class="chart-line" points="' + line + '"/>' +
        '<circle class="chart-point" cx="' + X(points.length - 1).toFixed(2) + '" cy="' + Y(last.nav).toFixed(2) + '" r="4.5"/>' +
        dots +
      '</svg>'
    );
  }

  function bindTooltip(host, points) {
    const wrap = host.querySelector('.chart-wrap');
    const tip = host.querySelector('.chart-tip');
    if (!wrap || !tip || points.length < 1) return;
    const first = points[0].nav;
    function show(i, evt) {
      const pt = points[i];
      if (!pt) return;
      const fromStart = first ? ((pt.nav / first) - 1) * 100 : null;
      tip.hidden = false;
      tip.innerHTML =
        '<b>' + F.esc(pt.date) + '</b>' +
        '<span>NAV ' + F.num(pt.nav) + '</span>' +
        '<span>العائد من أول نقطة في الأفق ' + F.pct(fromStart) + '</span>';
      const rect = wrap.getBoundingClientRect();
      const x = evt.clientX - rect.left;
      const y = evt.clientY - rect.top;
      tip.style.left = Math.min(Math.max(12, x + 14), Math.max(12, rect.width - 180)) + 'px';
      tip.style.top = Math.max(8, y - 64) + 'px';
    }
    wrap.querySelectorAll('.chart-hit').forEach(function (el) {
      el.addEventListener('mousemove', function (evt) { show(Number(el.dataset.i), evt); });
      el.addEventListener('mouseenter', function (evt) { show(Number(el.dataset.i), evt); });
    });
    wrap.addEventListener('mouseleave', function () { tip.hidden = true; });
  }

  function recordFor(rows, horizon) {
    const matches = (rows || []).filter(function (x) { return x.horizon === horizon && x.return_pct != null; });
    return matches.sort(function (a, b) { return String(b.report_date).localeCompare(String(a.report_date)); })[0] || null;
  }

  function performanceRecord(rows, horizon, windowPts) {
    const official = recordFor(rows, horizon);
    let html = '<div class="pf-official">';
    html += '<div class="pf-official-grid">';
    html += '<div><span>العائد الرسمي</span><strong>' + (official ? F.pct(official.return_pct) : 'غير متاح') + '</strong><small>' + (official ? F.esc(official.report_date) : 'لا يوجد سجل رسمي') + '</small></div>';
    html += '<div><span>NAV عند التقرير</span><strong>' + (official ? F.num(official.nav_value) : 'غير متاح') + '</strong><small>' + (official ? F.esc(official.currency || '') : '') + '</small></div>';
    html += '<div><span>أول NAV في السلسلة</span><strong>' + (windowPts[0] ? F.num(windowPts[0].nav) : 'غير متاح') + '</strong><small>' + (windowPts[0] ? F.esc(windowPts[0].date) : '') + '</small></div>';
    html += '<div><span>آخر NAV في السلسلة</span><strong>' + (windowPts.length ? F.num(windowPts[windowPts.length - 1].nav) : 'غير متاح') + '</strong><small>' + (windowPts.length ? F.esc(windowPts[windowPts.length - 1].date) : '') + '</small></div>';
    html += '</div></div>';
    if (!windowPts.length) return html + '<div class="empty">لا توجد نقاط NAV فعلية متاحة لهذا الأفق.</div>';
    const recent = windowPts.slice(-8).reverse();
    html += '<div class="pf-actual-head"><span>ACTUAL NAV OBSERVATIONS</span><small>آخر ' + recent.length + ' نقاط محفوظة</small></div>';
    html += '<div class="table-scroll"><table><thead><tr><th>التاريخ</th><th>NAV</th><th>المصدر</th></tr></thead><tbody>';
    html += recent.map(function (x) { return '<tr><td>' + F.esc(x.date) + '</td><td class="num">' + F.num(x.nav) + '</td><td>' + F.esc(x.source || '—') + '</td></tr>'; }).join('');
    html += '</tbody></table></div>';
    return html;
  }

  function render() {
    const host = document.getElementById('performance-tab');
    if (!host) return;
    const horizon = currentHorizon();
    const series = F.navSeries || [];
    const windowPts = F.sliceNav(series, horizon);
    const headline = F.seriesReturn(windowPts);
    const first = windowPts[0];
    const last = windowPts[windowPts.length - 1];
    const wantedStart = F.windowStart(horizon, last && last.date);
    const incomplete = !!(wantedStart && first && first.date > wantedStart);

    const tabs = PERIODS.map(function (x) {
      return '<button type="button" data-h="' + x + '" aria-pressed="' + (x === horizon ? 'true' : 'false') + '" class="' + (x === horizon ? 'active' : '') + '">' + F.esc(F.L[x] || x) + '</button>';
    }).join('');

    let chartBody;
    if (windowPts.length < 2) {
      chartBody =
        '<div class="empty data-gap">' +
          '<strong>فجوة بيانات / Insufficient Data</strong>' +
          '<p>لا توجد مشاهدات NAV كافية لرسم الأفق «' + F.esc(F.L[horizon]) + '» لهذا الصندوق. لم يتم توليد أي نقطة.</p>' +
          '<p>النقاط المتاحة للصندوق كله: ' + series.length + '</p>' +
        '</div>';
    } else {
      chartBody = '<div class="chart-wrap">' + svgChart(windowPts) + '<div class="chart-tip" hidden></div></div>';
    }

    host.innerHTML =
      '<div class="pf-shell">' +
        '<div class="tab-nav perf-horizons" id="perf-horizons">' + tabs + '</div>' +
        '<div class="perf-strip">' +
          '<div><span>مشاهدات NAV</span><strong>' + windowPts.length + '</strong><small>نقطة فعلية</small></div>' +
          '<div><span>بداية الأفق</span><strong>' + (first ? F.num(first.nav) : '—') + '</strong><small>' + (first ? F.esc(first.date) : 'غير متاح') + '</small></div>' +
          '<div><span>نهاية الأفق</span><strong>' + (last ? F.num(last.nav) : '—') + '</strong><small>' + (last ? F.esc(last.date) : 'غير متاح') + '</small></div>' +
          '<div><span>التغير من NAV</span><strong class="' + (headline != null && headline >= 0 ? 'positive' : 'negative') + '">' + F.pct(headline) + '</strong><small>أول نقطة ← آخر نقطة</small></div>' +
        '</div>' +
        '<div class="perf-grid">' +
          '<div class="card chart-card">' +
            '<div class="chart-top"><div><span class="perf-kicker">ACTUAL NAV SERIES</span><h3>' + F.esc(F.L[horizon]) + ' · حركة NAV</h3></div><strong>' + F.pct(headline) + '</strong></div>' +
            chartBody +
            '<div class="perf-legend"><span><i></i>NAV الفعلي</span><span>الأفق: ' + F.esc(F.L[horizon]) + '</span><span>' + (incomplete ? 'سلسلة أقصر من الأفق' : 'سلسلة مكتملة') + '</span></div>' +
            '<p class="note">' +
              (windowPts.length >= 2
                ? ('مشاهدات فعلية: ' + windowPts.length + ' · من ' + first.date + ' إلى ' + last.date + ' · التغير = (آخر NAV ÷ أول NAV) − 1.')
                : 'الرسم لا يُعرض إلا من مشاهدات NAV الحقيقية المحفوظة في قاعدة البيانات.') +
              (incomplete ? ' تنبيه: السلسلة المتاحة أقصر من الأفق الزمني المطلوب.' : '') +
            '</p>' +
          '</div>' +
          '<div class="card table-card">' +
            '<div class="record-head"><div><span class="perf-kicker">PERFORMANCE RECORD</span><h3>' + F.esc(F.L[horizon]) + '</h3><small>السجل الرسمي + نقاط NAV الفعلية لنفس الأفق</small></div><b>' + F.esc(F.L[horizon]) + '</b></div>' +
            performanceRecord(F.performance || [], horizon, windowPts) +
          '</div>' +
        '</div>' +
        '<div class="pf-footnote">كل زر زمني يعيد بناء الرسم والملخص وPerformance Record من البيانات المحملة فعليًا لهذا الصندوق. لا يتم إنشاء نقاط مفقودة أو نسخ بيانات من أفق آخر.</div>' +
      '</div>';

    const heroRet = document.querySelector('.pulse .metric:nth-child(2) .metric-value');
    const heroNote = document.querySelector('.pulse .metric:nth-child(2) .note');
    const heroMuted = document.querySelector('.pulse .metric:nth-child(2) .muted');
    if (heroMuted) heroMuted.textContent = 'RETURN · ' + (F.L[horizon] || horizon);
    if (heroRet) heroRet.textContent = F.pct(headline);
    if (heroNote) heroNote.textContent = windowPts.length >= 2 ? (first.date + ' → ' + last.date) : 'بيانات غير كافية';

    host.querySelectorAll('#perf-horizons button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setHorizon(btn.getAttribute('data-h'));
        render();
      });
    });
    bindTooltip(host, windowPts);
  }

  window.addEventListener('popstate', render);
  window.FUND_TABS = window.FUND_TABS || {};
  window.FUND_TABS.performance = render;
})();
