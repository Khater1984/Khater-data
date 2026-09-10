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
    return v != null && Number.isFinite(Number(v)) ? Number(v) : null;
  }

  function officialSeries(rows, horizon) {
    const map = Object.create(null);
    (rows || []).forEach(function (x) {
      if (x.horizon !== horizon || !x.report_date) return;
      const ret = validNumber(x.return_pct);
      if (ret == null) return;
      map[x.report_date] = {
        date: x.report_date,
        value: ret,
        nav: validNumber(x.nav_value),
        source: x.source_id || 'fund_performance_history'
      };
    });
    return Object.keys(map).sort().map(function (d) { return map[d]; });
  }

  function maxNavSeries() {
    return (F.navSeries || []).map(function (x) {
      return { date: x.date, value: x.nav, nav: x.nav, source: x.source };
    });
  }

  function seriesForHorizon(rows, horizon) {
    return horizon === 'max' ? maxNavSeries() : officialSeries(rows, horizon);
  }

  function seriesLabel(horizon) {
    return horizon === 'max' ? 'NAV الفعلي' : 'العائد الرسمي التاريخي';
  }

  function svgChart(points, horizon) {
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
    const baseY = horizon === 'max' ? h - p : (mn <= 0 && mx >= 0 ? Y(0) : h - p);
    const area = p + ',' + baseY.toFixed(2) + ' ' + line + ' ' + X(points.length - 1).toFixed(2) + ',' + baseY.toFixed(2);
    const dots = points.map(function (pt, i) {
      return '<circle class="chart-hit" data-i="' + i + '" cx="' + X(i).toFixed(2) + '" cy="' + Y(pt.value).toFixed(2) + '" r="10" fill="transparent"></circle>';
    }).join('');
    const zero = horizon !== 'max' && mn <= 0 && mx >= 0
      ? '<line class="axis-zero" x1="0" y1="' + Y(0).toFixed(2) + '" x2="' + w + '" y2="' + Y(0).toFixed(2) + '"/>'
      : '';
    return (
      '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" role="img" aria-label="' + F.esc(seriesLabel(horizon)) + '">' +
        zero +
        '<polyline class="chart-fill" points="' + area + '"/>' +
        '<polyline class="chart-line" points="' + line + '"/>' +
        '<circle class="chart-point" cx="' + X(points.length - 1).toFixed(2) + '" cy="' + Y(points[points.length - 1].value).toFixed(2) + '" r="4.5"/>' +
        dots +
      '</svg>'
    );
  }

  function bindTooltip(host, points, horizon) {
    const wrap = host.querySelector('.chart-wrap');
    const tip = host.querySelector('.chart-tip');
    if (!wrap || !tip || !points.length) return;
    function show(i, evt) {
      const pt = points[i];
      if (!pt) return;
      tip.hidden = false;
      tip.innerHTML =
        '<b>' + F.esc(pt.date) + '</b>' +
        '<span>' + F.esc(seriesLabel(horizon)) + ' ' + F.pct(pt.value) + '</span>' +
        (pt.nav != null && horizon !== 'max' ? '<span>NAV عند التقرير ' + F.num(pt.nav) + '</span>' : '') +
        (pt.source ? '<span>المصدر: ' + F.esc(pt.source) + '</span>' : '');
      const rect = wrap.getBoundingClientRect();
      const x = evt.clientX - rect.left;
      const y = evt.clientY - rect.top;
      tip.style.left = Math.min(Math.max(12, x + 14), Math.max(12, rect.width - 210)) + 'px';
      tip.style.top = Math.max(8, y - 78) + 'px';
    }
    wrap.querySelectorAll('.chart-hit').forEach(function (el) {
      el.addEventListener('mousemove', function (evt) { show(Number(el.dataset.i), evt); });
      el.addEventListener('mouseenter', function (evt) { show(Number(el.dataset.i), evt); });
    });
    wrap.addEventListener('mouseleave', function () { tip.hidden = true; });
  }

  function recordFor(rows, horizon) {
    const matches = (rows || []).filter(function (x) {
      return x.horizon === horizon && x.return_pct != null;
    });
    return matches.sort(function (a, b) {
      return String(b.report_date).localeCompare(String(a.report_date));
    })[0] || null;
  }

  function recentRows(points, horizon) {
    if (!points.length) return '<div class="empty">لا توجد بيانات فعلية متاحة لهذا الأفق.</div>';
    const recent = points.slice(-8).reverse();
    let html = '<div class="pf-actual-head"><span>ACTUAL OBSERVATIONS</span><small>آخر ' + recent.length + ' نقاط محفوظة</small></div>';
    html += '<div class="table-scroll"><table><thead><tr><th>التاريخ</th><th>' + (horizon === 'max' ? 'NAV' : 'العائد') + '</th><th>NAV</th><th>المصدر</th></tr></thead><tbody>';
    html += recent.map(function (x) {
      return '<tr><td>' + F.esc(x.date) + '</td><td class="num">' + F.pct(x.value) + '</td><td class="num">' + (x.nav == null ? '—' : F.num(x.nav)) + '</td><td>' + F.esc(x.source || '—') + '</td></tr>';
    }).join('');
    html += '</tbody></table></div>';
    return html;
  }

  function performanceRecord(rows, horizon, points) {
    if (horizon === 'max') {
      const first = points[0], last = points[points.length - 1];
      const change = first && last && first.value ? ((last.value / first.value) - 1) * 100 : null;
      return '<div class="pf-official"><div class="pf-official-grid">' +
        '<div><span>أول NAV</span><strong>' + (first ? F.num(first.value) : 'غير متاح') + '</strong><small>' + (first ? F.esc(first.date) : '') + '</small></div>' +
        '<div><span>آخر NAV</span><strong>' + (last ? F.num(last.value) : 'غير متاح') + '</strong><small>' + (last ? F.esc(last.date) : '') + '</small></div>' +
        '<div><span>التغير المحسوب</span><strong>' + F.pct(change) + '</strong><small>آخر NAV ÷ أول NAV − 1</small></div>' +
        '<div><span>المشاهدات</span><strong>' + points.length + '</strong><small>بيانات فعلية</small></div>' +
      '</div></div>' + recentRows(points, horizon);
    }
    const official = recordFor(rows, horizon);
    let html = '<div class="pf-official"><div class="pf-official-grid">';
    html += '<div><span>العائد الرسمي الأحدث</span><strong>' + (official ? F.pct(official.return_pct) : 'غير متاح') + '</strong><small>' + (official ? F.esc(official.report_date) : 'لا يوجد سجل رسمي') + '</small></div>';
    html += '<div><span>NAV عند التقرير</span><strong>' + (official ? F.num(official.nav_value) : 'غير متاح') + '</strong><small>' + (official ? F.esc(official.currency || '') : '') + '</small></div>';
    html += '<div><span>أول تقرير محفوظ</span><strong>' + (points[0] ? F.pct(points[0].value) : 'غير متاح') + '</strong><small>' + (points[0] ? F.esc(points[0].date) : '') + '</small></div>';
    html += '<div><span>آخر تقرير محفوظ</span><strong>' + (points.length ? F.pct(points[points.length - 1].value) : 'غير متاح') + '</strong><small>' + (points.length ? F.esc(points[points.length - 1].date) : '') + '</small></div>';
    html += '</div></div>';
    return html + recentRows(points, horizon);
  }

  function render() {
    const host = document.getElementById('performance-tab');
    if (!host) return;
    const horizon = currentHorizon();
    const rows = F.performance || [];
    const points = seriesForHorizon(rows, horizon);
    const first = points[0];
    const last = points[points.length - 1];
    const headline = horizon === 'max'
      ? (first && last && first.value ? ((last.value / first.value) - 1) * 100 : null)
      : (last ? last.value : null);

    const tabs = PERIODS.map(function (x) {
      return '<button type="button" data-h="' + x + '" aria-pressed="' + (x === horizon ? 'true' : 'false') + '" class="' + (x === horizon ? 'active' : '') + '">' + F.esc(F.L[x] || x) + '</button>';
    }).join('');

    let chartBody;
    if (points.length < 2) {
      chartBody = '<div class="empty data-gap"><strong>فجوة بيانات / Insufficient Data</strong><p>الأفق «' + F.esc(F.L[horizon]) + '» يحتوي حالياً على ' + points.length + ' نقطة قابلة للرسم في قاعدة البيانات. لم يتم توليد أي نقطة إضافية.</p><p>لن يتم عرض رسم مضلل عند نقص السلسلة.</p></div>';
    } else {
      chartBody = '<div class="chart-wrap">' + svgChart(points, horizon) + '<div class="chart-tip" hidden></div></div>';
    }

    host.innerHTML =
      '<div class="pf-shell">' +
        '<div class="tab-nav perf-horizons" id="perf-horizons">' + tabs + '</div>' +
        '<div class="perf-strip">' +
          '<div><span>النقاط</span><strong>' + points.length + '</strong><small>' + (horizon === 'max' ? 'NAV فعلي' : 'تقارير أداء رسمية') + '</small></div>' +
          '<div><span>بداية السلسلة</span><strong>' + (first ? F.pct(first.value) : '—') + '</strong><small>' + (first ? F.esc(first.date) : 'غير متاح') + '</small></div>' +
          '<div><span>نهاية السلسلة</span><strong>' + (last ? F.pct(last.value) : '—') + '</strong><small>' + (last ? F.esc(last.date) : 'غير متاح') + '</small></div>' +
          '<div><span>القيمة الأحدث</span><strong class="' + (headline != null && headline >= 0 ? 'positive' : 'negative') + '">' + F.pct(headline) + '</strong><small>' + (horizon === 'max' ? 'تغير NAV من أول نقطة' : 'العائد الرسمي عند أحدث تقرير') + '</small></div>' +
        '</div>' +
        '<div class="perf-grid">' +
          '<div class="card chart-card">' +
            '<div class="chart-top"><div><span class="perf-kicker">HORIZON-SPECIFIC SERIES</span><h3>' + F.esc(F.L[horizon]) + ' · ' + F.esc(seriesLabel(horizon)) + '</h3></div><strong>' + F.pct(headline) + '</strong></div>' +
            chartBody +
            '<div class="perf-legend"><span><i></i>' + F.esc(seriesLabel(horizon)) + '</span><span>الأفق: ' + F.esc(F.L[horizon]) + '</span><span>المصدر: Supabase</span></div>' +
            '<p class="note">' + (points.length >= 2
              ? (horizon === 'max'
                ? ('NAV فعلي: ' + points.length + ' نقطة · من ' + first.date + ' إلى ' + last.date + ' · التغير = (آخر NAV ÷ أول NAV) − 1.')
                : ('سلسلة العائد الرسمي المحفوظة لهذا الأفق: ' + points.length + ' نقطة · من ' + first.date + ' إلى ' + last.date + '. لا يتم استبدالها بسلسلة أفق آخر.'))
              : 'لا يتم رسم الأفق عند عدم وجود نقطتين فعليتين على الأقل في قاعدة البيانات.') + '</p>' +
          '</div>' +
          '<div class="card table-card">' +
            '<div class="record-head"><div><span class="perf-kicker">PERFORMANCE RECORD</span><h3>' + F.esc(F.L[horizon]) + '</h3><small>' + (horizon === 'max' ? 'سجل NAV الفعلي' : 'السجل التاريخي الرسمي لنفس الأفق') + '</small></div><b>' + F.esc(F.L[horizon]) + '</b></div>' +
            performanceRecord(rows, horizon, points) +
          '</div>' +
        '</div>' +
        '<div class="pf-footnote">الأفق الأسبوعي و4 أسابيع ومنذ بداية العام و12 شهراً وسنوات 2–6 تستخدم السجل التاريخي لنفس الأفق من fund_performance_history. الأقصى فقط يستخدم NAV الفعلي المتاح. لا يتم تمديد أي سلسلة قبل أقدم سجل حقيقي.</div>' +
      '</div>';

    const heroRet = document.querySelector('.pulse .metric:nth-child(2) .metric-value');
    const heroNote = document.querySelector('.pulse .metric:nth-child(2) .note');
    const heroMuted = document.querySelector('.pulse .metric:nth-child(2) .muted');
    if (heroMuted) heroMuted.textContent = 'RETURN · ' + (F.L[horizon] || horizon);
    if (heroRet) heroRet.textContent = F.pct(headline);
    if (heroNote) heroNote.textContent = points.length >= 2 ? (first.date + ' → ' + last.date) : 'بيانات غير كافية';

    host.querySelectorAll('#perf-horizons button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setHorizon(btn.getAttribute('data-h'));
        render();
      });
    });
    bindTooltip(host, points, horizon);
  }

  window.addEventListener('popstate', render);
  window.FUND_TABS = window.FUND_TABS || {};
  window.FUND_TABS.performance = render;
})();
