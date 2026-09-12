/* Canonical fund-domain data service. Keep source semantics here; UI modules consume its result. */
(function (window) {
  'use strict';
  const api = window.KHATER_DATA && window.KHATER_DATA.supabase;
  if (!api) throw new Error('fund-service.js requires supabase-client.js');

  const SELECT = {
    fund: 'fund_id,canonical_name,management_company,category,currency,inception_date,price_update_url,metadata',
    score: 'fund_id,final_score,raw_score,rating,data_tier,data_confidence,data_quality,score_as_of,signal_as_of,latest_day_change_pct,latest_signal_status,performance_score,risk_score,benchmark_score,consistency_score,inflation_score,score_explanation,risk_method,track_factor,warnings,qualification_status,calculation_inputs,methodology_version',
    performance: 'report_date,horizon,nav_value,return_pct,rank,currency,report_status,source_id',
    nav: 'as_of_date,nav,source_id,currency'
  };

  function enc(value) { return encodeURIComponent(String(value)); }
  function path(table, filters, select, order, limit) {
    const qs = ['select=' + encodeURIComponent(select)];
    Object.keys(filters || {}).forEach(function (key) { qs.push(key + '=eq.' + enc(filters[key])); });
    if (order) qs.push('order=' + encodeURIComponent(order));
    if (limit) qs.push('limit=' + String(limit));
    return '/rest/v1/' + table + '?' + qs.join('&');
  }
  function currentOrPast(value) { return value && String(value).slice(0, 10) <= new Date().toISOString().slice(0, 10); }
  function validReturn(value) { const n = Number(value); return value != null && Number.isFinite(n) ? n : null; }
  function validNav(value) { const n = Number(value); return Number.isFinite(n) && n > 0 ? n : null; }

  function canonicalPerformance(rows) {
    const map = Object.create(null);
    const conflicts = [];
    (rows || []).forEach(function (row) {
      if (!row || !row.horizon || !currentOrPast(row.report_date) || validReturn(row.return_pct) == null) return;
      const key = String(row.horizon) + '|' + String(row.report_date);
      const normalized = Object.assign({}, row, { return_pct: validReturn(row.return_pct) });
      if (!map[key]) {
        map[key] = normalized;
      } else if (Number(map[key].return_pct) !== Number(normalized.return_pct)) {
        conflicts.push({ key: key, kept: map[key].source_id || null, conflicting: normalized.source_id || null });
      }
    });
    const data = Object.values(map).sort(function (a, b) {
      return String(a.horizon).localeCompare(String(b.horizon)) || String(a.report_date).localeCompare(String(b.report_date));
    });
    return { data: data, conflicts: conflicts };
  }

  function canonicalNAV(rows) {
    const map = Object.create(null);
    const conflicts = [];
    (rows || []).forEach(function (row) {
      if (!row || !currentOrPast(row.as_of_date) || validNav(row.nav) == null) return;
      const key = String(row.as_of_date);
      const normalized = Object.assign({}, row, { nav: validNav(row.nav) });
      if (!map[key]) map[key] = normalized;
      else if (Number(map[key].nav) !== Number(normalized.nav)) conflicts.push({ key: key, kept: map[key].source_id || null, conflicting: normalized.source_id || null });
    });
    return { data: Object.values(map).sort(function (a, b) { return String(a.as_of_date).localeCompare(String(b.as_of_date)); }), conflicts: conflicts };
  }

  async function getFundBundle(fundId) {
    if (!fundId) throw new Error('fund_id is required');
    const base = '/fund-bundle/' + enc(fundId);
    const results = await Promise.all([
      api.get(path('funds', { fund_id: fundId }, SELECT.fund, null, 1), { cacheKey: base + '/fund' }),
      api.get(path('fund_smartscore_latest', { fund_id: fundId }, SELECT.score, null, 1), { cacheKey: base + '/score' }),
      api.get(path('fund_performance_history', { fund_id: fundId }, SELECT.performance, 'report_date.desc', 2000), { cacheKey: base + '/performance' }),
      api.get(path('fund_price_history', { fund_id: fundId }, SELECT.nav, 'as_of_date.asc', 5000), { cacheKey: base + '/nav' })
    ]);
    const performanceResult = canonicalPerformance(results[2]);
    const navResult = canonicalNAV(results[3]);
    const officialSeriesByHorizon = Object.create(null);
    performanceResult.data.forEach(function (row) { (officialSeriesByHorizon[row.horizon] = officialSeriesByHorizon[row.horizon] || []).push(row); });
    return {
      fund: results[0][0] || null,
      score: results[1][0] || {},
      performance: performanceResult.data,
      officialPerformance: performanceResult.data,
      officialSeriesByHorizon: officialSeriesByHorizon,
      prices: navResult.data,
      navSeries: navResult.data,
      dataQuality: { performanceConflicts: performanceResult.conflicts, navConflicts: navResult.conflicts }
    };
  }

  window.KHATER_DATA.fund = { getFundBundle: getFundBundle, canonicalPerformance: canonicalPerformance, canonicalNAV: canonicalNAV };
})(window);
