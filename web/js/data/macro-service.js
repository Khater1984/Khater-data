/* Canonical macro-domain data service. Supabase is the sole source of truth. */
(function(window){
  'use strict';
  const api=window.KHATER_DATA&&window.KHATER_DATA.supabase;
  if(!api) throw new Error('macro-service.js requires supabase-client.js');

  // These keys are the canonical series already present in public.macro_series.
  const SERIES={
    usd_egp_mid:['الدولار / جنيه','سعر الصرف','asset'],
    gold_egp_oz:['الذهب بالجنيه','أونصة','asset'],
    silver_egp_oz:['الفضة بالجنيه','أونصة','asset'],
    egx30_close:['EGX30','المؤشر','asset'],
    spy_egp:['S&P 500 بالجنيه','SPY','asset'],
    qqq_egp:['ناسداك بالجنيه','QQQ','asset'],
    btc_egp:['بيتكوين بالجنيه','BTC','asset'],
    cpi_headline_mom_pct:['التضخم العام','تغير شهري %','inflation'],
    cpi_core_mom_pct:['التضخم الأساسي','تغير شهري %','inflation'],
    bank_deposit_1_3m_avg_pct:['وديعة 1–3 أشهر','% سنوي','rate'],
    bank_deposit_3_6m_avg_pct:['وديعة 3–6 أشهر','% سنوي','rate'],
    bank_deposit_6_12m_avg_pct:['وديعة 6–12 شهر','% سنوي','rate'],
    tbill_91_avg_yield_pct:['أذون 91 يومًا','% سنوي','rate'],
    tbill_364_avg_yield_pct:['أذون 364 يومًا','% سنوي','rate']
  };

  const TODAY=()=>new Date().toISOString().slice(0,10);
  function validDate(v){const d=String(v||'').slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(d)&&d<=TODAY();}
  function num(v){const n=Number(v);return Number.isFinite(n)?n:null;}

  async function getSeries(key){
    if(!SERIES[key]) throw new Error('Unknown macro series: '+key);
    const rows=[]; let offset=0;
    while(true){
      // Schema-verified columns: series_key, ts_date, value, source_id.
      const path='/rest/v1/macro_series?select=series_key,ts_date,value,source_id&series_key=eq.'+encodeURIComponent(key)+'&ts_date=lte.'+TODAY()+'&order=ts_date.asc&offset='+offset+'&limit=1000';
      const batch=await api.get(path,{cacheKey:'macro/'+key+'/'+offset});
      (batch||[]).forEach(r=>{
        const date=String(r.ts_date||'').slice(0,10), value=num(r.value);
        if(validDate(date)&&value!==null) rows.push({series_key:r.series_key,ts_date:date,value,source_id:r.source_id||null});
      });
      if(!batch||batch.length<1000)break;
      offset+=1000;
    }
    const byDate=Object.create(null),conflicts=[];
    rows.forEach(r=>{
      if(!byDate[r.ts_date]) byDate[r.ts_date]=r;
      else if(Number(byDate[r.ts_date].value)!==Number(r.value)) conflicts.push({date:r.ts_date,kept:byDate[r.ts_date].source_id,conflicting:r.source_id});
    });
    return {key,meta:SERIES[key],rows:Object.values(byDate).sort((a,b)=>a.ts_date.localeCompare(b.ts_date)),conflicts};
  }

  async function getAll(){
    const keys=Object.keys(SERIES),out=await Promise.all(keys.map(getSeries));
    const map=Object.create(null);out.forEach(x=>map[x.key]=x);
    return {series:map,keys,conflicts:out.flatMap(x=>x.conflicts)};
  }

  window.KHATER_DATA.macro={SERIES,getSeries,getAll};
})(window);
