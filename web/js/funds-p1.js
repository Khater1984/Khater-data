/* P1 guardrails for funds.html — database values only; no fabricated fallbacks. */
(function(){
  const C=window.KHATER||{};
  if(!C.url||!C.key) return;
  const HDR={apikey:C.key,Authorization:'Bearer '+C.key};
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
  const get=async path=>{const r=await fetch(C.url+path,{headers:HDR});const j=await r.json();if(!r.ok)throw Error(j.message||('HTTP '+r.status));return j};
  const BENCH={inflation:{type:'inflation',series:'cpi_headline_mom_pct'},tbill:{type:'tbill',series:'tbill_364_avg_yield_pct'},btc:{type:'level',series:'btc_egp'},qqq:{type:'level',series:'qqq_egp'},spy:{type:'level',series:'spy_egp'},usd:{type:'level',series:'usd_egp_mid'},silver:{type:'level',series:'silver_egp_oz'},gold:{type:'level',series:'gold_egp_oz'},egx30:{type:'level',series:'egx30_close'}};
  window.benchmark=async function(k,h,end){
    const b=BENCH[k];if(!b)return null;
    if(k==='inflation'&&(h==='weekly'||h==='4weeks'))return null;
    const d=new Date(end+'T00:00:00Z');
    if(h==='weekly')d.setUTCDate(d.getUTCDate()-7);else if(h==='4weeks')d.setUTCDate(d.getUTCDate()-28);else if(h==='last12m')d.setUTCFullYear(d.getUTCFullYear()-1);else if(h==='ytd')d.setUTCMonth(0,1);else if(/^\dy$/.test(h))d.setUTCFullYear(d.getUTCFullYear()-Number(h[0]));else return null;
    const requestedStart=d.toISOString().slice(0,10);
    const r=await get('/rest/v1/macro_series?select=ts_date,value,unit&series_key=eq.'+encodeURIComponent(b.series)+'&ts_date=gte.'+requestedStart+'&ts_date=lte.'+end+'&order=ts_date.asc&limit=5000');
    const v=r.filter(x=>x.value!=null);if(!v.length)return null;
    const actualStart=v[0].ts_date, actualEnd=v[v.length-1].ts_date;
    if(b.type==='level'){const a=Number(v[0].value),z=Number(v[v.length-1].value);if(!Number.isFinite(a)||a===0||!Number.isFinite(z))return null;return{value:(z/a-1)*100,start:actualStart,end:actualEnd,requestedStart,endRequested:end,unit:v[v.length-1].unit,calculated:true};}
    if(b.type==='inflation'){let f=1;for(const x of v){const n=Number(x.value);if(!Number.isFinite(n))return null;f*=1+n/100}return{value:(f-1)*100,start:actualStart,end:actualEnd,requestedStart,endRequested:end,unit:v[v.length-1].unit,calculated:true};}
    if(b.type==='tbill'){const nums=v.map(x=>Number(x.value));if(nums.some(n=>!Number.isFinite(n)))return null;const avg=nums.reduce((s,n)=>s+n,0)/nums.length;const days=Math.max(1,(new Date(actualEnd)-new Date(actualStart))/86400000);return{value:avg*days/365,start:actualStart,end:actualEnd,requestedStart,endRequested:end,unit:v[v.length-1].unit,calculated:true};}
    return null;
  };
  async function horizonEvidence(h){const r=await get('/rest/v1/fund_performance_history?select=report_date&horizon=eq.'+encodeURIComponent(h)+'&order=report_date.asc&limit=1000');const dates=[...new Set(r.map(x=>x.report_date).filter(Boolean))];return{count:dates.length,first:dates[0]||null,last:dates[dates.length-1]||null};}
  function ensureMeta(){const h=$('h');if(!h)return null;let box=$('horizonMeta');if(!box){box=document.createElement('div');box.id='horizonMeta';box.className='horizon-meta';h.insertAdjacentElement('afterend',box)}return box;}
  async function updateHorizonMeta(){const h=$('h');if(!h||!h.value)return;const box=ensureMeta();if(!box)return;box.textContent='جارٍ التحقق من تاريخ البيانات...';try{const e=await horizonEvidence(h.value);if(!e.last){box.textContent='لا توجد بيانات فعلية لهذه الفترة في قاعدة البيانات.';return}const base='آخر تاريخ متاح: '+e.last;if(e.count<=1)box.innerHTML=esc(base)+' · <b>لقطة واحدة فقط</b>؛ لا تُعامل كأنها سلسلة تاريخية كاملة.';else box.innerHTML=esc(base)+' · السجل التاريخي المتاح: <b>'+e.count+'</b> لقطة زمنية ('+esc(e.first)+' → '+esc(e.last)+').';}catch(err){box.textContent='تعذر التحقق من تاريخ البيانات.'}}
  function addSortControl(){const tb=document.querySelector('.toolbar');if(!tb||$('viewSort'))return;const s=document.createElement('select');s.id='viewSort';s.innerHTML='<option value="score">ترتيب العرض: SmartScore</option><option value="return">ترتيب العرض: العائد</option>';tb.insertBefore(s,$('reset')||null);s.addEventListener('change',sortRows);}
  function sortRows(){const body=$('rows'),s=$('viewSort');if(!body||!s)return;const rows=[...body.querySelectorAll('tr')];const val=(tr,idx)=>{const n=parseFloat((tr.children[idx]?.textContent||'').replace(/[^0-9+\-.]/g,''));return Number.isFinite(n)?n:-Infinity};rows.sort((a,b)=>val(b,s.value==='score'?4:3)-val(a,s.value==='score'?4:3));rows.forEach((tr,i)=>{if(tr.children[0])tr.children[0].textContent=i+1;body.appendChild(tr)});}
  function observeResults(){const body=$('rows');if(!body)return;new MutationObserver(()=>{addSortControl();sortRows()}).observe(body,{childList:true})}
  function init(){addSortControl();const h=$('h');if(h){h.addEventListener('change',updateHorizonMeta);setTimeout(updateHorizonMeta,500)}observeResults()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
