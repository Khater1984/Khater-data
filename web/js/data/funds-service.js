/* Funds-universe adapter. Bulk discovery lives here; financial semantics delegate to the canonical fund service. */
(function (window) {
  'use strict';
  const transport = window.KHATER_DATA && window.KHATER_DATA.supabase;
  const fund = window.KHATER_DATA && window.KHATER_DATA.fund;
  if (!transport) throw new Error('funds-service.js requires supabase-client.js');
  if (!fund) throw new Error('funds-service.js requires fund-service.js');

  const SELECT = {
    funds:'fund_id,canonical_name,management_company,category',
    nav:'fund_id,nav,as_of_date',
    score:'fund_id,final_score,rating,risk_score,benchmark_score,data_confidence,qualification_status,warnings,methodology_version',
    horizons:'horizon',
    performance:'fund_id,report_date,return_pct,horizon'
  };
  const ORDER = [...fund.HORIZONS];
  const BENCH = Object.fromEntries(fund.BENCHMARKS.map(b => [b.key,b]));

  const path=(table,params,select,order,limit,offset)=>{
    const qs=['select='+encodeURIComponent(select)];
    Object.keys(params||{}).forEach(k=>qs.push(k+'=eq.'+encodeURIComponent(String(params[k]))));
    if(order)qs.push('order='+encodeURIComponent(order));
    if(limit!=null)qs.push('limit='+limit);
    if(offset!=null)qs.push('offset='+offset);
    return'/rest/v1/'+table+'?'+qs.join('&');
  };
  const asDate=v=>String(v||'').slice(0,10),today=()=>new Date().toISOString().slice(0,10),validNumber=v=>v!=null&&Number.isFinite(Number(v));
  const cleanNav=rows=>(rows||[]).filter(r=>asDate(r.as_of_date)&&asDate(r.as_of_date)<=today()&&validNumber(r.nav));

  function category(c){
    c=String(c||'').toLowerCase();
    if(c.includes('gold'))return'صناديق الذهب';
    if(c.includes('money market'))return'صناديق النقد';
    if(c.includes('fixed income'))return'صناديق الدخل الثابت';
    if(c.includes('balanced')||c.includes('mixed')||c.includes('allocator'))return'الصناديق المتوازنة';
    if(c.includes('index')||c.includes('etf')||c.includes('traded')||c.includes('passive'))return'صناديق المؤشرات';
    if(c.includes('equity')||c.includes('thematic')||c.includes('sector'))return'صناديق الأسهم';
    if(c.includes('protected')||c.includes('guaranteed'))return'صناديق محمية';
    return c||'غير مصنف';
  }

  function warningText(warnings){
    if(!Array.isArray(warnings)||!warnings.length)return'—';
    const raw=typeof warnings[0]==='string'?warnings[0]:(warnings[0]?.message||'');
    const legacy='return not yet verified against funds.metadata.scores, but passes benchmark plausibility check';
    if(raw===legacy)return'—';
    return raw.replace(/_/g,' ');
  }

  async function paged(table, params, select, order, pageSize, maxPages, cachePrefix){
    const all=[];
    for(let page=0;page<maxPages;page++){
      const offset=page*pageSize;
      const batch=await transport.get(path(table,params,select,order,pageSize,offset),{cacheKey:cachePrefix+'/'+offset});
      if(!Array.isArray(batch)||!batch.length)break;
      all.push(...batch);
      if(batch.length<pageSize)break;
    }
    return all;
  }

  async function getUniverse(){
    const [funds,navs,scores,horizons]=await Promise.all([
      paged('funds',{},SELECT.funds,'canonical_name.asc',1000,5,'funds/universe/v5'),
      paged('fund_price_history',{},SELECT.nav,'as_of_date.desc',5000,10,'funds/nav/v5'),
      paged('fund_smartscore_latest',{},SELECT.score,null,1000,5,'funds/scores/v5'),
      paged('fund_performance_history',{},SELECT.horizons,'report_date.desc',5000,10,'funds/horizons/v5')
    ]);
    const navByFund=Object.create(null),scoreByFund=Object.create(null);
    cleanNav(navs).forEach(r=>{if(!navByFund[r.fund_id])navByFund[r.fund_id]=r;});
    (scores||[]).forEach(r=>{if(!scoreByFund[r.fund_id])scoreByFund[r.fund_id]=r;});
    const list=(funds||[]).map(f=>{
      const s=scoreByFund[f.fund_id]||{},n=navByFund[f.fund_id]||{};
      return {
        id:String(f.fund_id),name:f.canonical_name||'—',manager:f.management_company||'',cat:category(f.category),
        nav:validNumber(n.nav)?Number(n.nav):null,score:validNumber(s.final_score)?Number(s.final_score):null,
        rating:s.rating||'',risk:validNumber(s.risk_score)?Number(s.risk_score):null,
        benchmark:validNumber(s.benchmark_score)?Number(s.benchmark_score):null,confidence:s.data_confidence||'',
        qualification:s.qualification_status||'',warnings:s.warnings||[],ret:null
      };
    });
    const hs=[...new Set((horizons||[]).map(x=>x.horizon).filter(x=>ORDER.includes(x)))].sort((a,b)=>ORDER.indexOf(a)-ORDER.indexOf(b));
    return {list,horizons:hs,counts:{funds:list.length,scoreRows:scores.length,horizonRows:horizons.length}};
  }

  async function getPerformanceSnapshot(horizon){
    if(!ORDER.includes(horizon))throw new Error('أفق غير صالح');
    const all=await paged('fund_performance_history',{horizon},SELECT.performance,'report_date.desc',5000,10,'funds/performance/'+horizon+'/v2');
    const canonical=fund.canonicalPerformance(all).data.filter(r=>String(r.horizon)===String(horizon));
    if(!canonical.length)throw new Error('لا توجد بيانات أداء رسمية صالحة لهذا الأفق');
    const latestDate=canonical.reduce((m,r)=>asDate(r.report_date)>m?asDate(r.report_date):m,'');
    const latestByFund=Object.create(null);
    canonical.forEach(r=>{
      const id=String(r.fund_id),d=asDate(r.report_date);
      if(!latestByFund[id]||d>asDate(latestByFund[id].report_date))latestByFund[id]=r;
    });
    const map=Object.create(null),returnDates=Object.create(null);
    Object.keys(latestByFund).forEach(id=>{map[id]=Number(latestByFund[id].return_pct);returnDates[id]=asDate(latestByFund[id].report_date);});
    return {horizon,date:latestDate,map,returnDates,records:canonical.length,fundsWithReturn:Object.keys(map).length,series:canonical};
  }

  async function getBenchmark(key,horizon,end){return fund.getBenchmark(BENCH[key]||key,end,horizon);}
  async function getBenchmarks(horizon,end){return fund.getBenchmarks(horizon,end);}
  function evaluateBenchmarks(funds,benchmarkValues,selectedKeys,includeBestCategory){
    const keys=(selectedKeys||[]).slice();
    if(includeBestCategory&&!keys.includes('bestCategory'))keys.push('bestCategory');
    return fund.evaluateBenchmarks(funds,benchmarkValues,keys,includeBestCategory);
  }

  window.KHATER_DATA.funds={getUniverse,getPerformanceSnapshot,getBenchmark,getBenchmarks,evaluateBenchmarks,BENCH,ORDER,warningText};
})(window);
