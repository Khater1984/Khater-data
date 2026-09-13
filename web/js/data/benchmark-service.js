/* Canonical interactive benchmark layer. DB batch RPC is paged so the UI never loses benchmark rows to the API row limit. */
(function(window){
'use strict';
const D=window.KHATER_DATA||{}, S=D.supabase;
if(!S) throw new Error('benchmark-service.js requires supabase-client.js');
const esc=D.escape||((s)=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c])));
const BENCHMARKS=Object.freeze({
 inflation:{key:'inflation',label:'التضخم',series:'cpi_headline_mom_pct',type:'inflation_compound',icon:'٪'},
 tbill:{key:'tbill',label:'أذون الخزانة',series:'tbill_364_avg_yield_pct',type:'yield_average',icon:'أذ'},
 deposits:{key:'deposits',label:'ودائع البنوك',series:'bank_deposit_1_3m_avg_pct',type:'yield_average',icon:'و'},
 usd:{key:'usd',label:'الدولار',series:'usd_egp_mid',type:'price_return',icon:'$'},
 gold:{key:'gold',label:'الذهب',series:'gold_egp_oz',type:'price_return',icon:'ذ'},
 silver:{key:'silver',label:'الفضة',series:'silver_egp_oz',type:'price_return',icon:'ف'},
 egx30:{key:'egx30',label:'البورصة المصرية',series:'egx30_close',type:'price_return',icon:'م'},
 spy:{key:'spy',label:'الأسهم الأمريكية',series:'spy_egp',type:'price_return',icon:'س'},
 qqq:{key:'qqq',label:'أسهم التكنولوجيا',series:'qqq_egp',type:'price_return',icon:'ت'},
 btc:{key:'btc',label:'البيتكوين',series:'btc_egp',type:'price_return',icon:'ب'}
});
const KEYS=Object.keys(BENCHMARKS);
async function getBatch(horizon){
 if(!horizon) return {rows:[],byFund:Object.create(null),meta:{distinctDates:0,dates:[]}};
 const url=String((S.config||{}).url||'').replace(/\/$/,'')+'/rest/v1/rpc/fund_benchmark_comparison_batch';
 const all=[];
 const pageSize=1000;
 for(let offset=0;offset<100000;offset+=pageSize){
   const response=await fetch(url+'?limit='+pageSize+'&offset='+offset,{method:'POST',headers:{apikey:S.config.key,Authorization:'Bearer '+S.config.key,'Content-Type':'application/json',Accept:'application/json','Prefer':'count=exact'},body:JSON.stringify({p_horizon:horizon,p_series_keys:KEYS.map(k=>BENCHMARKS[k].series)})});
   const body=await response.json().catch(()=>null);
   if(!response.ok) throw new Error((body&&(body.message||body.error||body.hint))||('HTTP '+response.status));
   const page=Array.isArray(body)?body:[];
   all.push(...page);
   if(page.length<pageSize)break;
 }
 const byFund=Object.create(null), dates=new Set();
 all.forEach(r=>{const id=String(r.fund_id);(byFund[id]||(byFund[id]=Object.create(null)))[r.series_key]=r;if(r.report_date)dates.add(String(r.report_date));});
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
window.KHATER_DATA.benchmarks={BENCHMARKS,KEYS,getBatch,evaluate,cardModel};
})(window);
