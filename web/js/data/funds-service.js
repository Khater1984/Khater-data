/* Canonical data service for the funds universe screen. UI code must not know Supabase table details. */
(function (window) {
  'use strict';
  const transport = window.KHATER_DATA && window.KHATER_DATA.supabase;
  if (!transport) throw new Error('funds-service.js requires supabase-client.js');

  const SELECT = {
    funds: 'fund_id,canonical_name,management_company,category',
    nav: 'fund_id,nav,as_of_date',
    score: 'fund_id,final_score,rating,risk_score,benchmark_score,data_confidence,qualification_status,warnings,methodology_version',
    horizons: 'horizon',
    performance: 'fund_id,report_date,return_pct,horizon',
    macro: 'ts_date,value,unit'
  };
  const ORDER = ['weekly','4weeks','ytd','last12m','1y','2y','3y','4y','5y','6y'];
  const BENCH = {
    inflation:{label:'التضخم',type:'inflation',series:'cpi_headline_mom_pct'},
    tbill:{label:'أذون الخزانة',type:'tbill',series:'tbill_364_avg_yield_pct'},
    rate:{label:'ودائع البنوك',type:'tbill',series:'bank_deposit_1_3m_avg_pct'},
    usd:{label:'الدولار',type:'level',series:'usd_egp_mid'},
    gold:{label:'الذهب',type:'level',series:'gold_egp_oz'},
    silver:{label:'الفضة',type:'level',series:'silver_egp_oz'},
    egx30:{label:'البورصة المصرية',type:'level',series:'egx30_close'},
    spy:{label:'الأسهم الأمريكية',type:'level',series:'spy_egp'},
    qqq:{label:'أسهم التكنولوجيا',type:'level',series:'qqq_egp'},
    btc:{label:'البيتكوين',type:'level',series:'btc_egp'}
  };

  const path = (table, params, select, order, limit) => {
    const qs = ['select=' + encodeURIComponent(select)];
    Object.keys(params || {}).forEach(k => qs.push(k + '=eq.' + encodeURIComponent(String(params[k]))));
    if (order) qs.push('order=' + encodeURIComponent(order));
    if (limit) qs.push('limit=' + limit);
    return '/rest/v1/' + table + '?' + qs.join('&');
  };
  const asDate = v => String(v || '').slice(0,10);
  const today = () => new Date().toISOString().slice(0,10);
  const validNumber = v => v != null && Number.isFinite(Number(v));
  const cleanCurrent = rows => (rows || []).filter(r => asDate(r.report_date) && asDate(r.report_date) <= today() && validNumber(r.return_pct));
  const cleanNav = rows => (rows || []).filter(r => asDate(r.as_of_date) && asDate(r.as_of_date) <= today() && validNumber(r.nav));

  function category(c) {
    c = String(c || '').toLowerCase();
    if(c.includes('gold')) return 'صناديق الذهب';
    if(c.includes('money market')) return 'صناديق النقد';
    if(c.includes('fixed income')) return 'صناديق الدخل الثابت';
    if(c.includes('balanced') || c.includes('mixed') || c.includes('allocator')) return 'الصناديق المتوازنة';
    if(c.includes('index') || c.includes('etf') || c.includes('traded') || c.includes('passive')) return 'صناديق المؤشرات';
    if(c.includes('equity') || c.includes('thematic') || c.includes('sector')) return 'صناديق الأسهم';
    if(c.includes('protected') || c.includes('guaranteed')) return 'صناديق محمية';
    return c || 'غير مصنف';
  }

  async function getUniverse() {
    const [funds, navs, scores, horizons] = await Promise.all([
      transport.get(path('funds', {}, SELECT.funds, 'canonical_name.asc', 1000), {cacheKey:'funds/universe'}),
      transport.get(path('nav_official', {}, SELECT.nav, 'as_of_date.desc', 1000), {cacheKey:'funds/nav'}),
      transport.get(path('fund_smartscore_latest', {}, SELECT.score, null, 1000), {cacheKey:'funds/scores'}),
      transport.get(path('fund_performance_history', {}, SELECT.horizons, 'report_date.desc', 2000), {cacheKey:'funds/horizons'})
    ]);
    const navByFund = Object.create(null), scoreByFund = Object.create(null);
    cleanNav(navs).forEach(r => { if (!navByFund[r.fund_id]) navByFund[r.fund_id] = r; });
    (scores || []).forEach(r => { if (!scoreByFund[r.fund_id]) scoreByFund[r.fund_id] = r; });
    const list = (funds || []).map(f => {
      const s = scoreByFund[f.fund_id] || {};
      const n = navByFund[f.fund_id] || {};
      return {
        id:f.fund_id, name:f.canonical_name || '—', manager:f.management_company || '', cat:category(f.category),
        nav:validNumber(n.nav) ? Number(n.nav) : null,
        score:validNumber(s.final_score) ? Number(s.final_score) : null,
        rating:s.rating || '', risk:validNumber(s.risk_score) ? Number(s.risk_score) : null,
        benchmark:validNumber(s.benchmark_score) ? Number(s.benchmark_score) : null,
        confidence:s.data_confidence || '', qualification:s.qualification_status || '', warnings:s.warnings || [], ret:null
      };
    });
    const hs = [...new Set((horizons || []).map(x => x.horizon).filter(x => ORDER.includes(x)))].sort((a,b)=>ORDER.indexOf(a)-ORDER.indexOf(b));
    return {list, horizons:hs};
  }

  async function getPerformanceSnapshot(horizon) {
    if (!ORDER.includes(horizon)) throw new Error('أفق غير صالح');
    const rows = await transport.get(path('fund_performance_history',{horizon},SELECT.performance,'report_date.desc',1000), {cacheKey:'funds/performance/'+horizon});
    const valid = cleanCurrent(rows);
    if (!valid.length) throw new Error('لا توجد بيانات أداء صالحة لهذا الأفق');
    const latestDate = valid.reduce((m,r)=>asDate(r.report_date)>m?asDate(r.report_date):m,'');
    const map = Object.create(null);
    valid.filter(r=>asDate(r.report_date)===latestDate).forEach(r=>{ if(map[r.fund_id] == null) map[r.fund_id]=Number(r.return_pct); });
    return {horizon,date:latestDate,map};
  }

  function startDate(end,horizon) {
    const d = new Date(end + 'T00:00:00Z');
    if(horizon==='weekly') d.setUTCDate(d.getUTCDate()-7);
    else if(horizon==='4weeks') d.setUTCDate(d.getUTCDate()-28);
    else if(horizon==='last12m') d.setUTCFullYear(d.getUTCFullYear()-1);
    else if(horizon==='ytd') { d.setUTCMonth(0,1); return asDate(d.toISOString()); }
    else if(/^\dy$/.test(horizon)) d.setUTCFullYear(d.getUTCFullYear()-Number(horizon[0]));
    else return null;
    return asDate(d.toISOString());
  }

  async function getBenchmark(key,horizon,end) {
    const b=BENCH[key]; if(!b) return null;
    if(b.type==='inflation' && (horizon==='weekly'||horizon==='4weeks')) return null;
    const start=startDate(end,horizon); if(!start) return null;
    const rows=await transport.get(path('macro_series',{series_key:b.series},SELECT.macro,'ts_date.asc',5000), {cacheKey:'funds/benchmark/'+key+'/'+horizon+'/'+end});
    const v=(rows||[]).filter(x=>asDate(x.ts_date)>=start && asDate(x.ts_date)<=end && validNumber(x.value));
    if(!v.length) return null;
    let value;
    if(b.type==='level') { const a=Number(v[0].value), z=Number(v[v.length-1].value); if(!a) return null; value=(z/a-1)*100; }
    else if(b.type==='inflation') { let factor=1; v.forEach(x=>factor*=1+Number(x.value)/100); value=(factor-1)*100; }
    else { const avg=v.reduce((s,x)=>s+Number(x.value),0)/v.length; const days=Math.max(1,(new Date(v[v.length-1].ts_date)-new Date(v[0].ts_date))/86400000); value=avg*days/365; }
    return {key,label:b.label,value,start:asDate(v[0].ts_date),end:asDate(v[v.length-1].ts_date),calculated:true};
  }

  async function getBenchmarks(horizon,end) {
    const out={};
    await Promise.all(Object.keys(BENCH).map(async k=>{ try { out[k]=await getBenchmark(k,horizon,end); } catch(e) { out[k]=null; } }));
    return out;
  }

  window.KHATER_DATA.funds = { getUniverse, getPerformanceSnapshot, getBenchmark, getBenchmarks, BENCH, ORDER };
})(window);
