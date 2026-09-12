/* Canonical fund-domain data service. Keep source semantics and financial calculations here; UI modules consume its result. */
(function (window) {
  'use strict';
  const api = window.KHATER_DATA && window.KHATER_DATA.supabase;
  if (!api) throw new Error('fund-service.js requires supabase-client.js');

  const SELECT = {
    fund: 'fund_id,canonical_name,management_company,category,currency,inception_date,price_update_url,metadata',
    score: 'fund_id,final_score,raw_score,rating,data_tier,data_confidence,data_quality,score_as_of,signal_as_of,latest_day_change_pct,latest_signal_status,performance_score,risk_score,benchmark_score,consistency_score,inflation_score,score_explanation,risk_method,track_factor,warnings,qualification_status,calculation_inputs,methodology_version',
    performance: 'fund_id,report_date,horizon,nav_value,return_pct,rank,currency,report_status,source_id',
    nav: 'as_of_date,nav,source_id,currency',
    evidence: 'evaluation_id,report_date,category,methodology_version,performance_score,risk_score,benchmark_score,consistency_score,inflation_score,smartscore,effective_weights,component_availability,data_confidence,peer_cohort_size,raw_rank,qualified_rank,qualification_status,calculation_inputs,warnings,calculated_at,data_tier,track_factor,final_score,rating,score_explanation,data_quality'
  };

  const SMARTSCORE_V3 = Object.freeze({
    version: 'V3.0',
    performance: 0.30,
    risk: 0.25,
    benchmark: 0.25,
    inflation: 0.10,
    consistency: 0.10,
    data_quality_in_score: false
  });

  /*
   * Every alternative is a first-class benchmark. The selected horizon is
   * passed into the same calculation engine for every series. No benchmark
   * value is hard-coded in the UI.
   */
  const BENCHMARKS = [
    {key:'inflation', label:'التضخم', series:'cpi_headline_mom_pct', type:'inflation', icon:'CPI'},
    {key:'tbill', label:'أذون الخزانة', series:'tbill_364_avg_yield_pct', type:'yield', icon:'T-BILL'},
    {key:'deposits', label:'ودائع البنوك', series:'bank_deposit_1_3m_avg_pct', type:'yield', icon:'DEPOSIT'},
    {key:'usd', label:'الدولار', series:'usd_egp_mid', type:'level', icon:'FX'},
    {key:'gold', label:'الذهب', series:'gold_egp_oz', type:'level', icon:'GOLD'},
    {key:'silver', label:'الفضة', series:'silver_egp_oz', type:'level', icon:'SILVER'},
    {key:'egx30', label:'البورصة المصرية', series:'egx30_close', type:'level', icon:'EGX'},
    {key:'spy', label:'الأسهم الأمريكية', series:'spy_egp', type:'level', icon:'S&P'},
    {key:'qqq', label:'أسهم التكنولوجيا', series:'qqq_egp', type:'level', icon:'NASDAQ'},
    {key:'btc', label:'البيتكوين', series:'btc_egp', type:'level', icon:'BTC'}
  ];

  const HORIZONS = Object.freeze(['weekly','4weeks','ytd','last12m','1y','2y','3y','4y','5y','6y']);

  function enc(value) { return encodeURIComponent(String(value)); }
  function path(table, filters, select, order, limit, offset) {
    const qs = ['select=' + encodeURIComponent(select)];
    Object.keys(filters || {}).forEach(function (key) { qs.push(key + '=eq.' + enc(filters[key])); });
    if (order) qs.push('order=' + encodeURIComponent(order));
    if (limit != null) qs.push('limit=' + String(limit));
    if (offset != null) qs.push('offset=' + String(offset));
    return '/rest/v1/' + table + '?' + qs.join('&');
  }
  function today() { return new Date().toISOString().slice(0, 10); }
  function currentOrPast(value) { return value && String(value).slice(0, 10) <= today(); }
  function validReturn(value) { const n = Number(value); return value != null && Number.isFinite(n) ? n : null; }
  function validNav(value) { const n = Number(value); return Number.isFinite(n) && n > 0 ? n : null; }

  function canonicalPerformance(rows) {
    const map = Object.create(null), conflicts = [];
    (rows || []).forEach(function (row) {
      if (!row || !row.fund_id || !row.horizon || !currentOrPast(row.report_date) || validReturn(row.return_pct) == null) return;
      const key = String(row.fund_id) + '|' + String(row.horizon) + '|' + String(row.report_date);
      const normalized = Object.assign({}, row, {return_pct: validReturn(row.return_pct)});
      if (!map[key]) map[key] = normalized;
      else if (Number(map[key].return_pct) !== Number(normalized.return_pct)) {
        conflicts.push({key:key,kept:map[key].source_id||null,conflicting:normalized.source_id||null});
      }
    });
    return {
      data: Object.values(map).sort((a,b) => String(a.fund_id).localeCompare(String(b.fund_id)) || String(a.horizon).localeCompare(String(b.horizon)) || String(a.report_date).localeCompare(String(b.report_date))),
      conflicts
    };
  }

  function performanceSeries(rows, horizon) {
    return canonicalPerformance(rows).data
      .filter(r => String(r.horizon) === String(horizon))
      .sort((a,b) => String(a.report_date).localeCompare(String(b.report_date)));
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

  function normalizeSmartScore(row) {
    const source = row || {};
    const out = Object.assign({}, source);
    out.inflation_score = source.inflation_score == null ? null : Number(source.inflation_score);
    out.smartscore_components = {
      performance: source.performance_score == null ? null : Number(source.performance_score),
      risk: source.risk_score == null ? null : Number(source.risk_score),
      benchmark: source.benchmark_score == null ? null : Number(source.benchmark_score),
      inflation: out.inflation_score,
      consistency: source.consistency_score == null ? null : Number(source.consistency_score)
    };
    return out;
  }

  function methodologyStatus(row) {
    const source = row || {};
    const version = String(source.methodology_version || '').toUpperCase();
    const matches = version === SMARTSCORE_V3.version;
    return {
      target: SMARTSCORE_V3.version,
      matches,
      storedVersion: source.methodology_version || null,
      reason: matches ? 'التقييم المحفوظ محسوب وفق المنهجية النشطة V3.0' : 'التقييم المحفوظ لا يحمل إصدار المنهجية النشطة V3.0',
      weights: {performance:SMARTSCORE_V3.performance,risk:SMARTSCORE_V3.risk,benchmark:SMARTSCORE_V3.benchmark,inflation:SMARTSCORE_V3.inflation,consistency:SMARTSCORE_V3.consistency},
      dataQualityInScore: SMARTSCORE_V3.data_quality_in_score
    };
  }

  function rangeDays(start, end) {
    return Math.max(1, (Date.parse(end) - Date.parse(start)) / 86400000);
  }

  /*
   * Level benchmarks use first/last actual observations in the requested
   * horizon. Yield benchmarks are annual rates and are compounded over the
   * actual observation intervals, making the result comparable with a
   * cumulative fund return. CPI is a monthly change series and is compounded
   * observation-by-observation. Weekly/4-week CPI is intentionally unavailable
   * because the source has no observations at that frequency.
   */
  async function getBenchmark(benchmark, endDate, horizon) {
    const b = typeof benchmark === 'string' ? BENCHMARKS.find(x=>x.key===benchmark) : benchmark;
    if (!b || !endDate || !HORIZONS.includes(horizon)) return null;
    const start = horizonStart(endDate, horizon);
    if (!start) return null;
    if (b.type === 'inflation' && (horizon === 'weekly' || horizon === '4weeks')) return null;

    const p = '/rest/v1/macro_series?select=ts_date,value,unit,source_id&series_key=eq.' + enc(b.series) + '&ts_date=gte.' + start + '&ts_date=lte.' + endDate + '&order=ts_date.asc&limit=5000';
    const rows = await api.get(p, {cacheKey:'fund-benchmark/v2/'+b.series+'/'+horizon+'/'+start+'/'+endDate});
    const v = (rows || []).filter(x => currentOrPast(x.ts_date) && x.value != null && Number.isFinite(Number(x.value)));
    if (!v.length) return null;

    const first = String(v[0].ts_date).slice(0,10);
    const last = String(v[v.length-1].ts_date).slice(0,10);

    if (b.type === 'level') {
      const x = Number(v[0].value), y = Number(v[v.length-1].value);
      if (!(x > 0) || !(y >= 0)) return null;
      return {key:b.key,label:b.label,series:b.series,type:b.type,value:(y/x-1)*100,start:first,end:last,requestedStart:start,requestedEnd:endDate,estimated:false,observations:v.length};
    }

    if (b.type === 'inflation') {
      const factor = v.reduce((acc,x) => acc * (1 + Number(x.value)/100), 1);
      return {key:b.key,label:b.label,series:b.series,type:b.type,value:(factor-1)*100,start:first,end:last,requestedStart:start,requestedEnd:endDate,estimated:false,observations:v.length};
    }

    let factor = 1;
    for (let i=0;i<v.length;i++) {
      const rate = Number(v[i].value);
      const from = String(v[i].ts_date).slice(0,10);
      const to = i+1<v.length ? String(v[i+1].ts_date).slice(0,10) : last;
      const days = i+1<v.length ? rangeDays(from,to) : 0;
      if (days > 0) factor *= Math.pow(Math.max(0,1+rate/100), days/365);
    }
    if (factor === 1 && v.length === 1) {
      factor = Math.pow(Math.max(0,1+Number(v[0].value)/100), rangeDays(first,last)/365);
    }
    return {key:b.key,label:b.label,series:b.series,type:b.type,value:(factor-1)*100,start:first,end:last,requestedStart:start,requestedEnd:endDate,estimated:true,observations:v.length};
  }

  async function getBenchmarks(horizon, endDate) {
    const entries = await Promise.all(BENCHMARKS.map(async b => {
      try { return [b.key, await getBenchmark(b,endDate,horizon)]; }
      catch (e) { return [b.key,null]; }
    }));
    return Object.fromEntries(entries);
  }

  function evaluateBenchmarks(funds, benchmarkValues, selectedKeys, includeBestCategory) {
    const selected = Array.isArray(selectedKeys) ? selectedKeys.filter(k => k && (benchmarkValues[k] || k === 'bestCategory')) : [];
    const categoryMax = Object.create(null);
    (funds || []).forEach(f => {
      if (f.ret == null) return;
      if (categoryMax[f.cat] == null || f.ret > categoryMax[f.cat]) categoryMax[f.cat] = f.ret;
    });
    const out = Object.create(null);
    (funds || []).forEach(f => {
      const comparisons = Object.create(null);
      selected.forEach(k => {
        if (k === 'bestCategory') {
          const max = categoryMax[f.cat];
          comparisons[k] = {available:f.ret != null && max != null,pass:f.ret != null && max != null && f.ret === max,value:max,label:'الأعلى في فئته',type:'category'};
        } else {
          const b = benchmarkValues[k];
          comparisons[k] = {available:f.ret != null && b && b.value != null,pass:f.ret != null && b && b.value != null && f.ret > b.value,value:b ? b.value : null,label:b ? b.label : k,type:b ? b.type : null,start:b ? b.start : null,end:b ? b.end : null,horizon:b ? b.horizon || null : null};
        }
      });
      const values = Object.values(comparisons);
      const availableCount = values.filter(x=>x.available).length;
      const passedCount = values.filter(x=>x.pass).length;
      out[f.id] = {comparisons,selectedCount:selected.length,availableCount,passedCount,allAvailable:selected.length>0 && availableCount===selected.length,allPassed:selected.length===0 || (availableCount===selected.length && passedCount===selected.length)};
    });
    return out;
  }

  async function getFundBundle(fundId) {
    if (!fundId) throw new Error('fund_id is required');
    const base='/fund-bundle/'+enc(fundId);
    const results=await Promise.all([
      api.get(path('funds',{fund_id:fundId},SELECT.fund,null,1),{cacheKey:base+'/fund'}),
      api.get(path('fund_smartscore_latest',{fund_id:fundId},SELECT.score,null,1),{cacheKey:base+'/score'}),
      api.get(path('fund_performance_history',{fund_id:fundId},SELECT.performance,'report_date.desc',2000),{cacheKey:base+'/performance'}),
      api.get(path('fund_price_history',{fund_id:fundId},SELECT.nav,'as_of_date.asc',5000),{cacheKey:base+'/nav'}),
      api.get(path('smartscore_evaluations',{fund_id:fundId},SELECT.evidence,'report_date.desc,calculated_at.desc',1),{cacheKey:base+'/evidence'})
    ]);
    const score=normalizeSmartScore(results[1][0]||{});
    const evidence=normalizeSmartScore(results[4][0]||null);
    const performanceResult=canonicalPerformance(results[2]),navResult=canonicalNAV(results[3]);
    const officialSeriesByHorizon=Object.create(null);
    performanceResult.data.forEach(row=>{(officialSeriesByHorizon[row.horizon]=officialSeriesByHorizon[row.horizon]||[]).push(row);});
    return {fund:results[0][0]||null,score,scoreMethodology:methodologyStatus(score),performance:performanceResult.data,officialPerformance:performanceResult.data,officialSeriesByHorizon,prices:navResult.data,navSeries:navResult.data,evidence,dataQuality:{performanceConflicts:performanceResult.conflicts,navConflicts:navResult.conflicts}};
  }

  window.KHATER_DATA.fund={getFundBundle,canonicalPerformance,performanceSeries,canonicalNAV,getBenchmark,getBenchmarks,evaluateBenchmarks,BENCHMARKS,SMARTSCORE_V3,methodologyStatus,HORIZONS};
})(window);
