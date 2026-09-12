(function () {
  'use strict';
  const q = new URLSearchParams(location.search);
  const id = q.get('id') || q.get('fund_id');
  const C = window.KHATER || {};
  const H = { apikey: C.key, Authorization: 'Bearer ' + C.key, Accept: 'application/json' };
  const HS = ['weekly', '4weeks', 'ytd', 'last12m', '1y', '2y', '3y', '4y', '5y', '6y', 'max'];
  const L = {
    weekly: 'أسبوعي', '4weeks': '4 أسابيع', ytd: 'منذ بداية العام', last12m: '12 شهراً',
    '1y': 'سنة', '2y': 'سنتان', '3y': '3 سنوات', '4y': '4 سنوات', '5y': '5 سنوات', '6y': '6 سنوات', max: 'الأقصى'
  };
  function esc(x) { return String(x == null ? '—' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(x) { return x == null || !Number.isFinite(Number(x)) ? '—' : Number(x).toLocaleString('en-US', { maximumFractionDigits: 2 }); }
  function pct(x) { return x == null || !Number.isFinite(Number(x)) ? '—' : (Number(x) >= 0 ? '+' : '') + num(x) + '%'; }
  function warnings(w) {
    if (w == null) return [];
    if (Array.isArray(w)) return w.map(function (x) { return typeof x === 'string' ? x : (x && x.message) || JSON.stringify(x); });
    if (typeof w === 'object') return Object.entries(w).map(function (e) { return e[0] + ': ' + JSON.stringify(e[1]); });
    return [String(w)];
  }
  async function get(path) {
    const r = await fetch(C.url + path, { headers: H });
    const t = await r.text();
    let j;
    try { j = t ? JSON.parse(t) : null; } catch (e) { throw Error('استجابة غير صالحة من Supabase'); }
    if (!r.ok) throw Error((j && j.message) || 'HTTP ' + r.status);
    return j;
  }
  function finiteNav(v) { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; }
  function finiteReturn(v) { if (v == null || String(v).trim() === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; }
  function todayISO() { return new Date().toISOString().slice(0, 10); }
  function isCurrentOrPast(date) { return !!date && String(date).slice(0, 10) <= todayISO(); }
  function sourcePriority(source) {
    const s = String(source || '');
    if (s.indexOf('weekly') >= 0 || s.indexOf('live') >= 0) return 20;
    if (s.indexOf('integrated') >= 0 || s.indexOf('historical') >= 0 || s.indexOf('eima_') >= 0) return 10;
    return 0;
  }
  function buildOfficialSeries(perfRows) {
    const byHorizon = Object.create(null);
    (perfRows || []).forEach(function (row) {
      if (!row || !row.horizon || !row.report_date || !isCurrentOrPast(row.report_date) || finiteReturn(row.return_pct) == null) return;
      const horizon = String(row.horizon), date = String(row.report_date);
      byHorizon[horizon] = byHorizon[horizon] || Object.create(null);
      const previous = byHorizon[horizon][date];
      if (!previous || sourcePriority(row.source_id) >= sourcePriority(previous.source_id)) {
        byHorizon[horizon][date] = Object.assign({}, row, { return_pct: finiteReturn(row.return_pct), series_role: sourcePriority(row.source_id) >= 20 ? 'live' : 'historical' });
      }
    });
    Object.keys(byHorizon).forEach(function (horizon) {
      byHorizon[horizon] = Object.keys(byHorizon[horizon]).sort().map(function (date) { return byHorizon[horizon][date]; });
    });
    return byHorizon;
  }
  function buildNavSeries(perfRows, priceRows) {
    const byDate = Object.create(null);
    (priceRows || []).forEach(function (row) {
      const date = row.as_of_date, nav = finiteNav(row.nav);
      if (!date || !isCurrentOrPast(date) || nav == null) return;
      byDate[date] = { date: date, nav: nav, source: row.source_id || 'fund_price_history' };
    });
    if (!Object.keys(byDate).length) {
      (perfRows || []).forEach(function (row) {
        const date = row.report_date, nav = finiteNav(row.nav_value);
        if (!date || !isCurrentOrPast(date) || nav == null || byDate[date]) return;
        byDate[date] = { date: date, nav: nav, source: row.source_id || 'fund_performance_history', fallback: true };
      });
    }
    return Object.keys(byDate).sort().map(function (d) { return byDate[d]; });
  }
  function windowStart(horizon, endDate) {
    const end = endDate ? new Date(endDate + 'T00:00:00') : new Date();
    if (Number.isNaN(end.getTime())) return null;
    if (horizon === 'max' || !horizon) return null;
    if (horizon === 'ytd') return end.getFullYear() + '-01-01';
    const days = { weekly: 7, '4weeks': 28, last12m: 365, '1y': 365, '2y': 730, '3y': 1095, '4y': 1460, '5y': 1825, '6y': 2190 }[horizon];
    if (!days) return null;
    const start = new Date(end.getTime()); start.setDate(start.getDate() - days); return start.toISOString().slice(0, 10);
  }
  function sliceNav(series, horizon, endDate) {
    const all = series || []; if (!all.length) return [];
    const end = endDate || all[all.length - 1].date, start = windowStart(horizon, end);
    const capped = all.filter(function (p) { return p.date <= end && isCurrentOrPast(p.date); });
    if (!start) return capped; return capped.filter(function (p) { return p.date >= start; });
  }
  function seriesReturn(points) {
    if (!points || points.length < 2) return null;
    const first = points[0].nav, last = points[points.length - 1].nav;
    if (!first) return null; return ((last / first) - 1) * 100;
  }
  async function loadFund() {
    if (!id) throw Error('معرّف الصندوق غير موجود في الرابط');
    if (!C.url || !C.key) throw Error('config.js غير متاح أو مفاتيح Supabase غير موجودة');
    const fr = await get('/rest/v1/funds?fund_id=eq.' + encodeURIComponent(id) + '&select=fund_id,canonical_name,management_company,category,currency,inception_date,price_update_url,metadata&limit=1');
    if (!fr.length) throw Error('الصندوق غير موجود: ' + id);
    const [sr, pr, nh] = await Promise.all([
      get('/rest/v1/fund_smartscore_latest?fund_id=eq.' + encodeURIComponent(id) + '&select=fund_id,final_score,raw_score,rating,data_tier,data_confidence,data_quality,score_as_of,signal_as_of,latest_day_change_pct,latest_signal_status,performance_score,risk_score,benchmark_score,consistency_score,inflation_score,score_explanation,risk_method,track_factor,warnings,qualification_status,calculation_inputs,methodology_version&limit=1'),
      get('/rest/v1/fund_performance_history?fund_id=eq.' + encodeURIComponent(id) + '&select=report_date,horizon,nav_value,return_pct,rank,currency,report_status,source_id&order=report_date.desc&limit=2000'),
      get('/rest/v1/fund_price_history?fund_id=eq.' + encodeURIComponent(id) + '&select=as_of_date,nav,source_id,currency&order=as_of_date.asc&limit=5000')
    ]);
    const navSeries = buildNavSeries(pr, nh);
    return { fund: fr[0], score: sr[0] || {}, performance: pr || [], prices: nh || [], navSeries: navSeries, officialPerformance: pr || [], officialSeriesByHorizon: buildOfficialSeries(pr) };
  }
  window.FUND = { id: id, C: C, L: L, HS: HS, esc: esc, num: num, pct: pct, warnings: warnings, get: get, loadFund: loadFund, buildNavSeries: buildNavSeries, buildOfficialSeries: buildOfficialSeries, windowStart: windowStart, sliceNav: sliceNav, seriesReturn: seriesReturn };
})();
