/* Canonical fund-domain data service. Keep source semantics and financial calculations here; UI modules consume its result. */
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
  const BENCHMARKS = [
    {label:'التضخم',series:'cpi_headline_mom_pct',type:'inflation',icon:'CPI'},
    {label:'أذون الخزانة · 364 يوم',series:'tbill_364_avg_yield_pct',type:'yield',icon:'T-BILL'},
    {label:'بيتكوين / جنيه',series:'btc_egp',type:'level',icon:'BTC'},
    {label:'ناسداك / جنيه',series:'qqq_egp',type:'level',icon:'NASDAQ'},
    {label:'S&P 500 / جنيه',series:'spy_egp',type:'level',icon:'S&P'},
    {label:'الدولار / جنيه',series:'usd_egp_mid',type:'level',icon:'FX'},
    {label:'الفضة / جنيه',series:'silver_egp_oz',type:'level',icon:'SILVER'},
    {label:'الذهب / جنيه',series:'gold_egp_oz',type:'level',icon:'GOLD'},
    {label:'EGX30',series:'egx30_close',type:'level',icon:'EGX'}
  ];

  function enc(value) { return encodeURIComponent(String(value)); }
  function path(table, filters, select, order, limit) {
    const qs = ['select=' + encodeURIComponent(select)];
    Object.keys(filters || {}).forEach(function (key) { qs.push(key + '=eq.' + enc(filters[key])); });
    if (order) qs.push('order=' + encodeURIComponent(order));
    if (limit) qs.push('limit=' + String(limit));
    return '/rest/v1/' + table + '?' + qs.join('&');
  }
  function today() { return new Date().toISOString().slice(0, 10); }
  function currentOrPast(value) { return value && String(value).slice(0, 10) <= today(); }
  function validReturn(value) { const n = Number(value); return value != null && Number.isFinite(n) ? n : null; }
  function validNav(value) { const n = Number(value); return Number.isFinite(n) && n > 0 ? n : null; }

  function canonicalPerformance(rows) {
    const map = Object.create(null), conflicts = [];
    (rows || []).forEach(function (row) {
      if (!row || !row.horizon || !currentOrPast(row.report_date) || validReturn(row.return_pct) == null) return;
      const key = String(row.horizon) + '|' + String(row.report_date);
      const normalized = Object.assign({}, row, {return_pct: validReturn(row.return_pct)});
      if (!map[key]) map[key] = normalized;
      else if (Number(map[key].return_pct) !== Number(normalized.return_pct)) conflicts.push({key:key,kept:map[key].source_id||null,conflicting:normalized.source_id||null});
    });
    const data = Object.values(map).sort((a,b) => String(a.horizon).localeCompare(String(b.horizon)) || String(a.report_date).localeCompare(String(b.report_date)));
    return {data, conflicts};
  }
  function performanceSeries(rows, horizon) {
    return canonicalPerformance(rows).data.filter(r => String(r.horizon) === String(horizon)).sort((a,b) => String(a.report_date).localeCompare(String(b.report_date)));
  }
  function canonicalNAV(rows) {
    const map = Object.create(null), conflicts = [];
    (rows || []).forEach(function (row) {
      if (!row || !currentOrPast(row.as_of_date) || validNav(row.nav) == null) return;
      const key = String(row.as_of_date), normalized = Object.assign({}, row, {nav:validNav(row.nav)});
      if (!map[key]) map[key] = normalized;
      else if (Number(map[key].nav) !== Number(normalized.nav)) conflicts.push({key:key,kept:map[key].source_id||null,conflicting:normalized.source_id||null});
    });
    return {data:Object.values(map).sort((a,b)=>String(a.as_of_date).localeCompare(String(b.as_of_date))),conflicts};
  }

  function horizonStart(end, horizon) {
    const d = new Date(String(end) + 'T00:00:00Z');
    if (Number.isNaN(d.getTime())) return null;
    if (horizon === 'weekly') d.setUTCDate(d.getUTCDate()-7);
    else if (horizon === '4weeks') d.setUTCDate(d.getUTCDate()-28);
    else if (horizon === 'ytd') d.setUTCMonth(0,1);
    else if (horizon === 'last12m') d.setUTCFullYear(d.getUTCFullYear()-1);
    else if (/^\dy$/.test(horizon)) d.setUTCFullYear(d.getUTCFullYear()-Number(horizon[0]));
    else return null;
    return d.toISOString().slice(0,10);
  }

  async function getBenchmark(benchmark, endDate, horizon) {
    const start = horizonStart(endDate, horizon);
    if (!start || (benchmark.type === 'inflation' && (horizon === 'weekly' || horizon === '4weeks'))) return null;
    const p = '/rest/v1/macro_series?select=ts_date,value,unit,source_id&series_key=eq.' + enc(benchmark.series) + '&ts_date=gte.' + start + '&ts_date=lte.' + endDate + '&order=ts_date.asc&limit=5000';
    const rows = await api.get(p, {cacheKey:'fund-benchmark/'+benchmark.series+'/'+start+'/'+endDate});
    const v = (rows || []).filter(x => currentOrPast(x.ts_date) && x.value != null && Number.isFinite(Number(x.value)));
    if (!v.length) return null;
    const a=v[0].ts_date,z=v[v.length-1].ts_date;
    if (benchmark.type === 'level') {
      const x=Number(v[0].value),y=Number(v[v.length-1].value);
      return x ? {value:(y/x-1)*100,start:a,end:z,estimated:false} : null;
    }
    if (benchmark.type === 'inflation') {
      const factor=v.reduce((acc,x)=>acc*(1+Number(x.value)/100),1);
      return {value:(factor-1)*100,start:a,end:z,estimated:false};
    }
    const vals=v.map(x=>Number(x.value)),avg=vals.reduce((a,b)=>a+b,0)/vals.length;
    const days=Math.max(1,(Date.parse(z)-Date.parse(a))/86400000);
    return {value:avg*days/365,start:a,end:z,estimated:true};
  }

  async function getFundBundle(fundId) {
    if (!fundId) throw new Error('fund_id is required');
    const base='/fund-bundle/'+enc(fundId);
    const results=await Promise.all([
      api.get(path('funds',{fund_id:fundId},SELECT.fund,null,1),{cacheKey:base+'/fund'}),
      api.get(path('fund_smartscore_latest',{fund_id:fundId},SELECT.score,null,1),{cacheKey:base+'/score'}),
      api.get(path('fund_performance_history',{fund_id:fundId},SELECT.performance,'report_date.desc',2000),{cacheKey:base+'/performance'}),
      api.get(path('fund_price_history',{fund_id:fundId},SELECT.nav,'as_of_date.asc',5000),{cacheKey:base+'/nav'})
    ]);
    const performanceResult=canonicalPerformance(results[2]),navResult=canonicalNAV(results[3]);
    const officialSeriesByHorizon=Object.create(null);
    performanceResult.data.forEach(row=>{(officialSeriesByHorizon[row.horizon]=officialSeriesByHorizon[row.horizon]||[]).push(row);});
    return {fund:results[0][0]||null,score:results[1][0]||{},performance:performanceResult.data,officialPerformance:performanceResult.data,officialSeriesByHorizon,prices:navResult.data,navSeries:navResult.data,dataQuality:{performanceConflicts:performanceResult.conflicts,navConflicts:navResult.conflicts}};
  }

  window.KHATER_DATA.fund={getFundBundle,canonicalPerformance,performanceSeries,canonicalNAV,getBenchmark,BENCHMARKS};
})(window);
