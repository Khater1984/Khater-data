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

  function validNumber(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function officialRecord(rows, horizon) {
    const matches = (rows || []).filter(function (x) {
      return x.horizon === horizon && x.return_pct != null;
    });
    return matches.sort(function (a, b) {
      return String(b.report_date).localeCompare(String(a.report_date));
    })[0] || null;
  }

  // One canonical NAV timeline: historical NAV observations from
  // fund_performance_history + newer NAV observations from fund_price_history.
  // fund-core.js already validates and merges those two Supabase sources.
  function actualNavSeries() {
    return (F.navSeries || []).filter(function (x) {
      return x && x.date && validNumber(x.nav) != null && Number(x.nav) > 0;
    }).map(function (x) {
      return { date: x.date, nav: Number(x.nav), source: x.source || 'Supabase' };
    }).sort(function (a, b) {
      return String(a.date).localeCompare(String(b.date));
    });
  }

  function seriesForHorizon(horizon) {
    const series = actualNavSeries();
    if (!series.length) return [];
    return F.sliceNav(series, horizon, null);
  }

  function svgChart(points) {
    const w = 820, h = 280, p = 28;
    const vals = points.map(function (x) { return x.nav; });
    if (!vals.length) return '';
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

  function bindTooltip(host, points) {
    const wrap = host.querySelector('.chart-wrap');
    const tip = host.querySelector('.chart-tip');
    if (!wrap || !tip || !points.length) return;
    const first = points[0].nav;
    function show(i, evt) {
      const pt = points[i];
      if (!pt) return;
      const change = first ? ((pt.nav / first) - 1) * 100 : null;
      tip.hidden = false;
      tip.innerHTML =
        '<b>' + F.esc(pt.date) + '</b>' +
        '<span>NAV ' + F.num(pt.nav) + '</span>' +
        '<span>التغير من أول NAV ' + F.pct(change) + '</span>' +
        '<span>المصدر: ' + F.esc(pt.source) + '</span>';
      const rect = wrap.getBoundingClientRect();
      const x = evt.clientX - rect.left;
      const y = evt.clientY - rect.top;
      tip.style.left = Math.min(Math.max(12, x + 14), Math.max(12, rect.width - 205)) + 'px';
      tip.style.top = Math.max(8, y - 86) + 'px';
    }
    wrap.querySelectorAll('.chart-hit').forEach(function (el) {
      el.addEventListener('mouseenter', function (evt) { show(Number(el.dataset.i), evt); });
      el.addEventListener('mousemove', function (evt) { show(Number(el.dataset.i), evt); });
    });
    wrap.addEventListener('mouseleave', function () { tip.hidden = true; });
  }

  function performanceRecord(rows, horizon, points) {
    const official = officialRecord(rows, horizon);
    const first = points[0];
    const last = points[points.length - 1];
    const navChange = first && last && first.nav ? ((last.nav / first.nav) - 1) * 100 : null;
    let html = '<div class="pf-official"><div class="pf-official-grid">';
    html += '<div><span>العائد الرسمي الأحدث</span><strong>' + (official ? F.pct(official.return_pct) : 'غير متاح') + '</strong><small>' + (official ? F.esc(official.report_date) : 'لا يوجد سجل رسمي') + '</small></div>';
    html += '<div><span>NAV عند آخر تقرير رسمي</span><strong>' + (official && official.nav_value != null ? F.num(official.nav_value) : 'غير متاح') + '</strong><small>' + (official && official.currency ? F.esc(official.currency) : 'البيانات التاريخية') + '</small></div>';
    html += '<div><span>أول NAV ضمن البيانات</span><strong>' + (first ? F.num(first.nav) : 'غير متاح') + '</strong><small>' + (first ? F.esc(first.date) : '') + '</small></div>';
    html += '<div><span>آخر NAV فعلي</span><strong>' + (last ? F.num(last.nav) : 'غير متاح') + '</strong><small>' + (last ? F.esc(last.date) : '') + '</small></div>';
    html += '<div><span>التغير المحسوب من NAV</span><strong>' + F.pct(navChange) + '</strong><small>أول NAV ← آخر NAV</small></div>';
    html += '<div><span>عدد نقاط NAV</span><strong>' + points.length + '</strong><small>سلسلة فعلية من Supabase</small></div>';
    html += '</div></div>';
    if (!points.length) return html + '<div class="empty">لا توجد نقاط NAV فعلية متاحة لهذا الأفق.</div>';
    const recent = points.slice(-8).reverse();
    html += '<div class="pf-actual-head"><span>ACTUAL NAV OBSERVATIONS</span><small>آخر ' + recent.length + ' نقاط محفوظة</small></div>';
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
    const points = seriesForHorizon(horizon);
    const first = points[0];
    const last = points[points.length - 1];
    const headline = first && last && first.nav ? ((last.nav / first.nav) - 1) * 100 : null;
    const allSeries = actualNavSeries();
    const wantedStart = F.windowStart(horizon, last && last.date);
    const incomplete = !!(wantedStart && first && first.date > wantedStart);

    const tabs = PERIODS.map(function (x) {
      return '<button type="button" data-h="' + x + '" aria-pressed="' + (x === horizon ? 'true' : 'false') + '" class="' + (x === horizon ? 'active' : '') + '">' + F.esc(F.L[x] || x) + '</button>';
    }).join('');

    const chartBody = points.length < 2
      ? '<div class="empty data-gap"><strong>فجوة بيانات / Insufficient Data</strong><p>لا توجد نقطتا NAV فعليتان على الأقل لرسم الأفق «' + F.esc(F.L[horizon]) + '».</p><p>إجمالي نقاط NAV الفعلية للصندوق: ' + allSeries.length + '</p></div>'
      : '<div class="chart-wrap">' + svgChart(points) + '<div class="chart-tip" hidden></div></div>';

    host.innerHTML =
      '<div class="pf-shell">' +
        '<div class="tab-nav perf-horizons" id="perf-horizons">' + tabs + '</div>' +
        '<div class="perf-strip">' +
          '<div><span>مشاهدات NAV</span><strong>' + points.length + '</strong><small>نقاط فعلية</small></div>' +
          '<div><span>بداية البيانات</span><strong>' + (first ? F.num(first.nav) : '—') + '</strong><small>' + (first ? F.esc(first.date) : 'غير متاح') + '</small></div>' +
          '<div><span>آخر NAV</span><strong>' + (last ? F.num(last.nav) : '—') + '</strong><small>' + (last ? F.esc(last.date) : 'غير متاح') + '</small></div>' +
          '<div><span>تغير NAV</span><strong class="' + (headline != null && headline >= 0 ? 'positive' : 'negative') + '">' + F.pct(headline) + '</strong><small>أول NAV ← آخر NAV</small></div>' +
        '</div>' +
        '<div class="perf-grid">' +
          '<div class="card chart-card">' +
            '<div class="chart-top"><div><span class="perf-kicker">ACTUAL NAV + HISTORICAL DATA</span><h3>' + F.esc(F.L[horizon]) + ' · حركة NAV</h3></div><strong>' + F.pct(headline) + '</strong></div>' +
            chartBody +
            '<div class="perf-legend"><span><i></i>NAV الفعلي</span><span>تاريخي + أحدث NAV</span><span>المصدر: Supabase</span></div>' +
            '<p class="note">' + (points.length >= 2
              ? ('الرسم مربوط بسلسلة NAV الفعلية في Supabase، ويجمع NAV التاريخي المحفوظ مع أحدث NAV متاح. من ' + first.date + ' إلى ' + last.date + '.')
              : 'لا يتم إنشاء أو استكمال أي نقطة غير موجودة في قاعدة البيانات.') +
              (incomplete ? ' البيانات المتاحة أقصر من كامل الأفق المطلوب؛ لذلك لا يتم تقديمها كسلسلة كاملة.' : '') + '</p>' +
          '</div>' +
          '<div class="card table-card">' +
            '<div class="record-head"><div><span class="perf-kicker">PERFORMANCE RECORD</span><h3>' + F.esc(F.L[horizon]) + '</h3><small>سجل رسمي + NAV الفعلي من Supabase</small></div><b>' + F.esc(F.L[horizon]) + '</b></div>' +
            performanceRecord(rows, horizon, points) +
          '</div>' +
        '</div>' +
        '<div class="pf-footnote">مصدر السلسلة: fund_performance_history للنقاط التاريخية وfund_price_history لأحدث NAV المتاح. كل زر يعيد حساب نافذة السلسلة من البيانات الفعلية للصندوق. لا توجد نقاط مصطنعة أو بيانات من صندوق آخر.</div>' +
      '</div>';

    const heroRet = document.querySelector('.pulse .metric:nth-child(2) .metric-value');
    const heroNote = document.querySelector('.pulse .metric:nth-child(2) .note');
    const heroMuted = document.querySelector('.pulse .metric:nth-child(2) .muted');
    if (heroMuted) heroMuted.textContent = 'RETURN · ' + (F.L[horizon] || horizon);
    if (heroRet) heroRet.textContent = F.pct(headline);
    if (heroNote) heroNote.textContent = first && last ? (first.date + ' → ' + last.date) : 'بيانات غير كافية';

    host.querySelectorAll('#perf-horizons button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setHorizon(btn.getAttribute('data-h'));
        render();
      });
    });
    bindTooltip(host, points);
  }

  window.addEventListener('popstate', render);
  window.FUND_TABS = window.FUND_TABS || {};
  window.FUND_TABS.performance = render;
})();
