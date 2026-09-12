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

  function uniqueByDate(rows) {
    const map = Object.create(null);
    (rows || []).forEach(function (x) {
      if (!x || !x.report_date) return;
      if (!map[x.report_date]) map[x.report_date] = x;
    });
    return Object.keys(map).sort().map(function (d) { return map[d]; });
  }

  function officialSeries(rows, horizon) {
    return uniqueByDate((rows || []).filter(function (x) {
      return x.horizon === horizon && n(x.return_pct) != null;
    })).map(function (x) {
      return {
        date: x.report_date,
        value: n(x.return_pct),
        nav: n(x.nav_value),
        currency: x.currency || null,
        source: x.source_id || 'fund_performance_history'
      };
    });
  }

  function actualNavSeries(rows, prices) {
    const map = Object.create(null);

    (rows || []).forEach(function (x) {
      if (!x || !x.report_date) return;
      const nav = n(x.nav_value);
      if (nav == null || nav <= 0) return;
      if (!map[x.report_date]) {
        map[x.report_date] = {
          date: x.report_date,
          nav: nav,
          source: x.source_id || 'fund_performance_history'
        };
      }
    });

    (prices || []).forEach(function (x) {
      const date = x && x.as_of_date;
      const nav = n(x && x.nav);
      if (!date || nav == null || nav <= 0) return;
      map[date] = {
        date: date,
        nav: nav,
        source: x.source_id || 'fund_price_history'
      };
    });

    return Object.keys(map).sort().map(function (d) { return map[d]; });
  }

  function svgChart(points, mode) {
    const w = 820, h = 280, p = 28;
    if (!points.length) return '';
    const vals = points.map(function (x) { return x.value; });
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
      return X(i).toFixed(2) + ',' + Y(pt.value).toFixed(2);
    }).join(' ');
    const zero = mode === 'return' && mn <= 0 && mx >= 0
      ? '<line class="axis-zero" x1="0" y1="' + Y(0).toFixed(2) + '" x2="' + w + '" y2="' + Y(0).toFixed(2) + '"/>'
      : '';
    const baseY = mode === 'return' && mn <= 0 && mx >= 0 ? Y(0) : h - p;
    const area = p + ',' + baseY.toFixed(2) + ' ' + line + ' ' + X(points.length - 1).toFixed(2) + ',' + baseY.toFixed(2);
    const dots = points.map(function (pt, i) {
      return '<circle class="chart-hit" data-i="' + i + '" cx="' + X(i).toFixed(2) + '" cy="' + Y(pt.value).toFixed(2) + '" r="10" fill="transparent"></circle>';
    }).join('');

    return '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" role="img" aria-label="' + F.esc(mode === 'return' ? 'Official performance history' : 'Actual NAV history') + '">' +
      zero +
      '<polyline class="chart-fill" points="' + area + '"/>' +
      '<polyline class="chart-line" points="' + line + '"/>' +
      '<circle class="chart-point" cx="' + X(points.length - 1).toFixed(2) + '" cy="' + Y(points[points.length - 1].value).toFixed(2) + '" r="4.5"/>' +
      dots +
      '</svg>';
  }

  function bindTooltip(host, points, mode) {
    const wrap = host.querySelector('.chart-wrap');
    const tip = host.querySelector('.chart-tip');
    if (!wrap || !tip || !points.length) return;

    function show(i, evt) {
      const pt = points[i];
      if (!pt) return;
      tip.hidden = false;
      let body = '<b>' + F.esc(pt.date) + '</b>';
      if (mode === 'return') {
        body += '<span>العائد الرسمي ' + F.pct(pt.value) + '</span>';
        if (pt.nav != null) body += '<span>NAV عند التقرير ' + F.num(pt.nav) + (pt.currency ? ' ' + F.esc(pt.currency) : '') + '</span>';
      } else {
        body += '<span>NAV ' + F.num(pt.value) + '</span>';
        body += '<span>المصدر: ' + F.esc(pt.source) + '</span>';
      }
      if (pt.source && mode === 'return') body += '<span>المصدر: ' + F.esc(pt.source) + '</span>';
      tip.innerHTML = body;
      const rect = wrap.getBoundingClientRect();
      const x = evt.clientX - rect.left;
      const y = evt.clientY - rect.top;
      tip.style.left = Math.min(Math.max(12, x + 14), Math.max(12, rect.width - 220)) + 'px';
      tip.style.top = Math.max(8, y - 90) + 'px';
    }

    wrap.querySelectorAll('.chart-hit').forEach(function (el) {
      el.addEventListener('mouseenter', function (evt) { show(Number(el.dataset.i), evt); });
      el.addEventListener('mousemove', function (evt) { show(Number(el.dataset.i), evt); });
    });
    wrap.addEventListener('mouseleave', function () { tip.hidden = true; });
  }

  function officialRecord(rows, horizon) {
    return (rows || [])
      .filter(function (x) { return x.horizon === horizon && n(x.return_pct) != null; })
      .sort(function (a, b) { return String(b.report_date).localeCompare(String(a.report_date)); })[0] || null;
  }

  function navByDate(rows) {
    const map = Object.create(null);
    (rows || []).forEach(function (x) {
      if (!x || !x.report_date) return;
      const nav = n(x.nav_value);
      if (nav != null && nav > 0 && !map[x.report_date]) map[x.report_date] = nav;
    });
    return map;
  }

  function performanceRecord(rows, prices, horizon, perf, latestNav) {
    const official = officialRecord(rows, horizon);
    const navMap = navByDate(rows);
    const firstPerf = perf[0];
    const lastPerf = perf[perf.length - 1];
    const firstNav = firstPerf && firstPerf.nav != null ? firstPerf.nav : null;
    const latest = latestNav || null;

    let html = '<div class="pf-official"><div class="pf-official-grid">';
    html += '<div><span>العائد الرسمي الأحدث</span><strong>' + (official ? F.pct(official.return_pct) : 'غير متاح') + '</strong><small>' + (official ? F.esc(official.report_date) : 'لا يوجد سجل رسمي') + '</small></div>';
    html += '<div><span>NAV عند آخر تقرير رسمي</span><strong>' + (official && n(official.nav_value) != null ? F.num(official.nav_value) : 'غير متاح') + '</strong><small>' + (official && official.currency ? F.esc(official.currency) : 'البيانات التاريخية') + '</small></div>';
    html += '<div><span>أول NAV تاريخي ظاهر</span><strong>' + (firstNav != null ? F.num(firstNav) : 'غير متاح') + '</strong><small>' + (firstPerf ? F.esc(firstPerf.date) : '') + '</small></div>';
    html += '<div><span>أحدث NAV فعلي</span><strong>' + (latest ? F.num(latest.nav) : 'غير متاح') + '</strong><small>' + (latest ? F.esc(latest.date) : 'لا يوجد') + '</small></div>';
    html += '<div><span>تغطية السجل الرسمي</span><strong>' + perf.length + '</strong><small>تقريرًا لهذا الأفق</small></div>';
    html += '<div><span>تغطية NAV التاريخية</span><strong>' + Object.keys(navMap).length + '</strong><small>تاريخًا فعليًا</small></div>';
    html += '</div></div>';

    if (!perf.length) return html + '<div class="empty">لا توجد بيانات أداء رسمية لهذا الأفق في Supabase.</div>';

    const recent = perf.slice(-10).reverse();
    html += '<div class="pf-actual-head"><span>OFFICIAL PERFORMANCE OBSERVATIONS</span><small>آخر ' + recent.length + ' تقارير</small></div>';
    html += '<div class="table-scroll"><table><thead><tr><th>التاريخ</th><th>العائد الرسمي</th><th>NAV</th><th>المصدر</th></tr></thead><tbody>';
    html += recent.map(function (x) {
      return '<tr><td>' + F.esc(x.date) + '</td><td class="num">' + F.pct(x.value) + '</td><td class="num">' + (x.nav == null ? '—' : F.num(x.nav)) + '</td><td>' + F.esc(x.source || '—') + '</td></tr>';
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
    const perf = horizon === 'max' ? [] : officialSeries(rows, horizon);
    const navSeries = actualNavSeries(rows, prices);
    const latestNav = navSeries.length ? navSeries[navSeries.length - 1] : null;

    const mode = horizon === 'max' ? 'nav' : 'return';
    const points = mode === 'return'
      ? perf.map(function (x) { return { date: x.date, value: x.value, nav: x.nav, currency: x.currency, source: x.source }; })
      : navSeries.map(function (x) { return { date: x.date, value: x.nav, source: x.source }; });

    const headline = mode === 'return'
      ? (official ? n(official.return_pct) : null)
      : (points.length >= 2 ? ((points[points.length - 1].value / points[0].value) - 1) * 100 : null);

    const first = points[0];
    const last = points[points.length - 1];
    const historicalNavCount = perf.filter(function (x) { return x.nav != null && x.nav > 0; }).length;
    const latestActualLabel = latestNav ? latestNav.date : 'غير متاح';

    const tabs = PERIODS.map(function (x) {
      return '<button type="button" data-h="' + x + '" aria-pressed="' + (x === horizon ? 'true' : 'false') + '" class="' + (x === horizon ? 'active' : '') + '">' + F.esc(F.L[x] || x) + '</button>';
    }).join('');

    let chartBody;
    if (points.length < 2) {
      chartBody =
        '<div class="empty data-gap"><strong>بيانات غير كافية للرسم</strong>' +
        '<p>الأفق «' + F.esc(F.L[horizon]) + '» يحتوي حالياً على ' + points.length + ' نقطة قابلة للرسم في البيانات الفعلية.</p>' +
        '<p>لم يتم اختراع أو استنتاج أي نقطة إضافية.</p></div>';
    } else {
      chartBody = '<div class="chart-wrap">' + svgChart(points, mode) + '<div class="chart-tip" hidden></div></div>';
    }

    const coverageNote = mode === 'return'
      ? ('الرسم يعرض سلسلة <strong>العائد الرسمي</strong> المخزنة لهذا الأفق في fund_performance_history. كل نقطة مرتبطة بتاريخ التقرير وNAV عند التقرير عند توفره. أحدث NAV من fund_price_history يُعرض منفصلاً ولا يُخلط مع العائد الرسمي.')
      : ('الأقصى يعرض سلسلة NAV الفعلية المجمعة من التاريخ المتاح في fund_performance_history ثم fund_price_history، من دون إنشاء نقاط مفقودة.');

    host.innerHTML =
      '<div class="pf-shell">' +
        '<div class="tab-nav perf-horizons" id="perf-horizons">' + tabs + '</div>' +
        '<div class="perf-strip">' +
          '<div><span>' + (mode === 'return' ? 'العائد الرسمي' : 'تغير NAV') + '</span><strong>' + F.pct(headline) + '</strong><small>' + (official ? F.esc(official.report_date) : (latestNav ? F.esc(latestNav.date) : 'غير متاح')) + '</small></div>' +
          '<div><span>النقاط التاريخية</span><strong>' + (mode === 'return' ? perf.length : navSeries.length) + '</strong><small>' + (mode === 'return' ? 'لهذا الأفق' : 'NAV فعلي') + '</small></div>' +
          '<div><span>NAV عند التقرير</span><strong>' + (official && n(official.nav_value) != null ? F.num(official.nav_value) : 'غير متاح') + '</strong><small>' + (official ? F.esc(official.report_date) : '') + '</small></div>' +
          '<div><span>أحدث NAV فعلي</span><strong>' + (latestNav ? F.num(latestNav.nav) : 'غير متاح') + '</strong><small>' + latestActualLabel + '</small></div>' +
        '</div>' +
        '<div class="perf-grid">' +
          '<div class="card chart-card">' +
            '<div class="chart-top"><div><span class="perf-kicker">' + (mode === 'return' ? 'OFFICIAL PERFORMANCE HISTORY' : 'ACTUAL NAV HISTORY') + '</span><h3>' + F.esc(F.L[horizon]) + ' · ' + (mode === 'return' ? 'العائد الرسمي التاريخي' : 'NAV الفعلي') + '</h3></div><strong>' + F.pct(headline) + '</strong></div>' +
            chartBody +
            '<div class="perf-legend"><span><i></i>' + (mode === 'return' ? 'العائد الرسمي' : 'NAV الفعلي') + '</span><span>المصدر: Supabase</span><span>' + F.esc(F.L[horizon]) + '</span></div>' +
            '<p class="note">' + coverageNote + '</p>' +
          '</div>' +
          '<div class="card table-card">' +
            '<div class="record-head"><div><span class="perf-kicker">PERFORMANCE RECORD</span><h3>' + F.esc(F.L[horizon]) + '</h3><small>العائد الرسمي وNAV المرتبط به من Supabase</small></div><b>' + F.esc(F.L[horizon]) + '</b></div>' +
            performanceRecord(rows, prices, horizon, perf, latestNav) +
          '</div>' +
        '</div>' +
        '<div class="pf-footnote">قاعدة العرض: الأفق الزمني يغيّر السلسلة المعروضة فعلياً. للأفق الأسبوعي و4 أسابيع وYTD و12 شهراً و1–6 سنوات يعرض الرسم سجل العائد الرسمي التاريخي لذلك الأفق فقط. أحدث NAV من fund_price_history يبقى مرجعاً منفصلاً حتى لا يتم خلط تاريخين مختلفين أو تحويل تغير NAV إلى عائد رسمي.</div>' +
      '</div>';

    const heroRet = document.querySelector('.pulse .metric:nth-child(2) .metric-value');
    const heroNote = document.querySelector('.pulse .metric:nth-child(2) .note');
    const heroMuted = document.querySelector('.pulse .metric:nth-child(2) .muted');
    if (heroMuted) heroMuted.textContent = 'RETURN · ' + (F.L[horizon] || horizon);
    if (heroRet) heroRet.textContent = F.pct(headline);
    if (heroNote) heroNote.textContent = official ? (official.report_date) : (latestNav ? latestNav.date : 'بيانات غير كافية');

    host.querySelectorAll('#perf-horizons button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setHorizon(btn.getAttribute('data-h'));
        render();
      });
    });
    bindTooltip(host, points, mode);
  }

  window.addEventListener('popstate', render);
  window.FUND_TABS = window.FUND_TABS || {};
  window.FUND_TABS.performance = render;
})();
