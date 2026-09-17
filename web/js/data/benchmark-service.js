/* Canonical interactive benchmark layer. DB performs benchmark calculations; this service handles transport and read shaping. */
(function(window){
'use strict';
const D=window.KHATER_DATA||{}, S=D.supabase, R=D.benchmarkRegistry;
if(!S) throw new Error('benchmark-service.js requires supabase-client.js');
if(!R) throw new Error('benchmark-service.js requires benchmark-registry.js');
const BENCHMARKS=Object.freeze(R.byKey);
const KEYS=R.keys;

function normalizeRow(key,row,endDate,horizon){
  if(!row||row.value==null||!Number.isFinite(Number(row.value))) return null;
  const b=BENCHMARKS[key];
  return {
    key:b.key,
    label:b.label,
    series:b.series,
    type:b.type,
    value:Number(row.value),
    start:row.actual_start||null,
    end:row.actual_end||null,
    requestedStart:R.horizonStart(endDate,horizon),
    requestedEnd:endDate,
    estimated:b.type==='yield_average',
    observations:row.n_observations==null?0:Number(row.n_observations),
    seriesType:row.series_type||null,
    unitMismatch:!!row.unit_mismatch
  };
}

async function getBenchmark(key,endDate,horizon){
  const b=BENCHMARKS[key];
  if(!b||!endDate||!R.horizons.includes(horizon)) return null;
  if(b.type==='inflation_compound'&&(horizon==='weekly'||horizon==='4weeks')) return null;
  const start=R.horizonStart(endDate,horizon);
  if(!start) return null;
  const body=await S.rpc('benchmark_return_generic',{
    p_series_key:b.series,
    p_start_date:start,
    p_end_date:endDate
  },{cacheKey:'benchmark-generic/v3/'+b.series+'/'+horizon+'/'+start+'/'+endDate});
  const row=Array.isArray(body)?body[0]:body;
  return normalizeRow(key,row,endDate,horizon);
}

async function getForFund(endDate,horizon){
  const entries=await Promise.all(KEYS.map(async key=>{
    try{return [key,await getBenchmark(key,endDate,horizon)];}
    catch(error){return [key,null];}
  }));
  return Object.fromEntries(entries);
}

async function getBatch(horizon){
  if(!horizon) return {rows:[],byFund:Object.create(null),meta:{distinctDates:0,dates:[]}};
  const all=[];
  const pageSize=1000;
  for(let offset=0;offset<100000;offset+=pageSize){
    const page=await S.rpc('fund_benchmark_comparison_batch',{
      p_horizon:horizon,
      p_series_keys:KEYS.map(k=>BENCHMARKS[k].series)
    },{cache:false,cacheKey:'benchmark-batch/v3/'+horizon+'/'+offset,limit:pageSize,offset});
    const rows=Array.isArray(page)?page:[];
    all.push(...rows);
    if(rows.length<pageSize) break;
  }
  const byFund=Object.create(null),dates=new Set();
  all.forEach(r=>{
    const id=String(r.fund_id);
    (byFund[id]||(byFund[id]=Object.create(null)))[r.series_key]=r;
    if(r.report_date) dates.add(String(r.report_date));
  });
  return {rows:all,byFund,meta:{distinctDates:dates.size,dates:[...dates].sort()}};
}

function evaluate(base,batch,selected){
 const keys=(selected||[]).filter(k=>BENCHMARKS[k]); const out=Object.create(null);
 (base||[]).forEach(f=>{
   const bucket=batch.byFund[String(f.id)]||{}; const comparisons=Object.create(null);
   keys.forEach(k=>{const r=bucket[BENCHMARKS[k].series], comparable=r&&r.benchmark_value!=null&&f.ret!=null; comparisons[k]={available:comparable,pass:comparable&&Number(f.ret)>Number(r.benchmark_value),value:r?r.benchmark_value:null,seriesType:r?r.series_type:null,actualStart:r?r.benchmark_actual_start:null,actualEnd:r?r.benchmark_actual_end:null,reportDate:r?r.report_date:null,nObservations:r?r.n_observations:0,unitMismatch:!!(r&&r.unit_mismatch),label:BENCHMARKS[k].label};});
   const vals=Object.values(comparisons), available=vals.filter(x=>x.available).length, passed=vals.filter(x=>x.pass).length;
   out[f.id]={comparisons,selectedCount:keys.length,availableCount:available,passedCount:passed,allAvailable:keys.length>0&&available===keys.length,allPassed:keys.length===0||(available===keys.length&&passed===keys.length)};
 });
 return out;
}

function cardModel(batch,k){
 const b=BENCHMARKS[k]; const rows=batch.rows.filter(r=>r.series_key===b.series&&r.benchmark_value!=null); const vals=rows.map(r=>Number(r.benchmark_value)).filter(Number.isFinite); const dates=[...new Set(rows.map(r=>String(r.report_date)))].sort();
 return {benchmark:b,rows,values:vals,dates,distinctDates:dates.length,unitMismatch:rows.some(r=>r.unit_mismatch)};
}

window.KHATER_DATA.benchmarks={BENCHMARKS,KEYS,getBenchmark,getForFund,getBatch,evaluate,cardModel};
})(window);
