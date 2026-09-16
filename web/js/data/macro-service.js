/* Canonical macro-domain data service. Supabase is the sole source of truth. */
(function(window){
  'use strict';
  const api=window.KHATER_DATA&&window.KHATER_DATA.supabase;
  if(!api) throw new Error('macro-service.js requires supabase-client.js');
  const SERIES={
    usd_egp_mid:['الدولار / جنيه','سعر الصرف','asset'],gold_egp_oz:['الذهب بالجنيه','أونصة','asset'],silver_egp_oz:['الفضة بالجنيه','أونصة','asset'],egx30_close:['EGX30','المؤشر','asset'],spy_egp:['S&P 500 بالجنيه','SPY','asset'],qqq_egp:['ناسداك بالجنيه','QQQ','asset'],btc_egp:['بيتكوين بالجنيه','BTC','asset'],cpi_headline_mom_pct:['التضخم العام','تغير شهري %','inflation'],cpi_core_mom_pct:['التضخم الأساسي','تغير شهري %','inflation'],bank_deposit_1_3m_avg_pct:['وديعة 1–3 أشهر','% سنوي','rate'],bank_deposit_3_6m_avg_pct:['وديعة 3–6 أشهر','% سنوي','rate'],bank_deposit_6_12m_avg_pct:['وديعة 6–12 شهر','% سنوي','rate'],tbill_91_avg_yield_pct:['أذون 91 يومًا','% سنوي','rate'],tbill_364_avg_yield_pct:['أذون 364 يومًا','% سنوي','rate']
  };
  const TODAY=()=>new Date().toISOString().slice(0,10);
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null;};
  const validDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||'').slice(0,10));
  const rowsOf=s=>Array.isArray(s?.rows)?s.rows:[];
  async function getSeries(key){
    if(!SERIES[key])throw new Error('Unknown macro series: '+key);
    const rows=[];let offset=0;
    while(true){
      const path='/rest/v1/macro_series?select=series_key,ts_date,value,source_id&series_key=eq.'+encodeURIComponent(key)+'&ts_date=lte.'+TODAY()+'&order=ts_date.asc&offset='+offset+'&limit=1000';
      const batch=await api.get(path,{cacheKey:'macro/'+key+'/'+offset,cache:false});
      if(!Array.isArray(batch))throw new Error('Invalid response for '+key);
      batch.forEach(r=>{const date=String(r.ts_date||'').slice(0,10),value=num(r.value);if(validDate(date)&&date<=TODAY()&&value!==null)rows.push({series_key:key,ts_date:date,value,source_id:r.source_id||null});});
      if(batch.length<1000)break;
      offset+=1000;if(offset>100000)throw new Error('Pagination limit exceeded for '+key);
    }
    const byDate=Object.create(null),conflicts=[];
    rows.forEach(r=>{if(!byDate[r.ts_date])byDate[r.ts_date]=r;else if(Number(byDate[r.ts_date].value)!==Number(r.value))conflicts.push({date:r.ts_date,kept:byDate[r.ts_date].source_id,conflicting:r.source_id});});
    return {key,meta:SERIES[key],rows:Object.values(byDate).sort((a,b)=>a.ts_date.localeCompare(b.ts_date)),conflicts,error:null};
  }
  async function getAll(){
    const keys=Object.keys(SERIES);
    const out=await Promise.all(keys.map(async key=>{try{return await getSeries(key);}catch(error){return {key,meta:SERIES[key],rows:[],conflicts:[],error:String(error?.message||error)};}}));
    const map=Object.create(null);out.forEach(x=>map[x.key]=x);
    return {series:map,keys,conflicts:out.flatMap(x=>x.conflicts),errors:out.filter(x=>x.error).map(x=>({key:x.key,error:x.error}))};
  }
  function index100(rows){if(!rows.length)return[];const base=rows[0].value;if(!Number.isFinite(base)||base===0)return[];return rows.map(r=>({date:r.ts_date,value:r.value/base*100}));}
  function purchasingPower(rows){let level=100;return rows.map(r=>{level*=1/(1+r.value/100);return{date:r.ts_date,value:level};});}
  const rateSeries=rows=>rows.map(r=>({date:r.ts_date,value:r.value}));
  function deriveSeries(series,mode){const rows=rowsOf(series);if(mode==='assets')return index100(rows);if(mode==='money')return purchasingPower(rows);if(mode==='rates')return rateSeries(rows);throw new Error('Unknown macro view mode: '+mode);}
  function keysForMode(mode){if(!['assets','money','rates'].includes(mode))throw new Error('Unknown macro view mode: '+mode);const kind=mode==='assets'?'asset':mode==='money'?'inflation':'rate';return Object.keys(SERIES).filter(k=>SERIES[k][2]===kind);}
  function rangeText(seriesList){const dates=seriesList.flatMap(rowsOf).map(x=>x.ts_date).filter(validDate).sort();return dates.length?dates[0]+' → '+dates[dates.length-1]:'—';}
  function buildView(data,mode){const keys=keysForMode(mode);return{mode,keys,series:keys.map(key=>({key,meta:SERIES[key],rows:deriveSeries(data.series[key],mode)})),range:rangeText(keys.map(k=>data.series[k]))};}
  function latest(rows){const r=rowsOf(rows);return r.length?r[r.length-1]:null;}
  function previous(rows){const r=rowsOf(rows);return r.length>1?r[r.length-2]:null;}
  function recent(rows,count=3){return rowsOf(rows).slice(-count);}
  function mean(rows){const r=rowsOf(rows).map(x=>Number(x.value)).filter(Number.isFinite);return r.length?r.reduce((a,b)=>a+b,0)/r.length:null;}
  function monthlySnapshots(rows,count=36){const map=new Map();rowsOf(rows).forEach(r=>{const month=String(r.ts_date).slice(0,7),current=map.get(month);if(!current||r.ts_date>current.date)map.set(month,{date:r.ts_date,value:Number(r.value)});});return[...map.values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-count);}
  function compoundedRate(rows){const r=monthlySnapshots(rows,13);if(r.length<12)return null;return(r.slice(-12).reduce((level,x)=>level*(1+Number(x.value)/100),1)-1)*100;}
  function annualizedInflation(rows){return compoundedRate(rows);}
  function monthlyChanges(rows,count=24){const s=monthlySnapshots(rows,count+1),out=[];for(let i=1;i<s.length;i++){const a=s[i-1],b=s[i];if(Number.isFinite(a.value)&&a.value!==0&&Number.isFinite(b.value))out.push({date:b.date,value:(b.value-a.value)/a.value*100});}return out.slice(-count);}
  function previous12Rate(rows){const r=monthlySnapshots(rows,24);if(r.length<24)return null;return(r.slice(-24,-12).reduce((level,x)=>level*(1+Number(x.value)/100),1)-1)*100;}
  function readout(data){
    const s=data.series,headline=s.cpi_headline_mom_pct?.rows||[],tb91=latest(s.tbill_91_avg_yield_pct?.rows),tb364=latest(s.tbill_364_avg_yield_pct?.rows),dep=latest(s.bank_deposit_6_12m_avg_pct?.rows),inflation12=annualizedInflation(headline),priorInflation12=previous12Rate(headline);
    return{inflation12,priorInflation12,inflationTrend:inflation12!==null&&priorInflation12!==null?inflation12-priorInflation12:null,realCashMargin:tb91&&inflation12!==null?tb91.value-inflation12:null,rateCurve:tb364&&tb91?tb364.value-tb91.value:null,depositBillSpread:tb91&&dep?tb91.value-dep.value:null,latest:{inflation:latest(headline),tb91,tb364,deposit:dep},conflicts:data.conflicts.length,errors:data.errors||[],completeness:{inflation:headline.length,tb91:rowsOf(s.tbill_91_avg_yield_pct).length,tb364:rowsOf(s.tbill_364_avg_yield_pct).length,deposit:rowsOf(s.bank_deposit_6_12m_avg_pct).length}};
  }
  window.KHATER_DATA.macro={SERIES,getSeries,getAll,deriveSeries,keysForMode,rangeText,buildView,latest,previous,recent,mean,annualizedInflation,monthlySnapshots,monthlyChanges,readout};
})(window);
