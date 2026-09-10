const C=window.KHATER||{};
const $=id=>document.getElementById(id);
if(!C.url||!C.key){document.body.innerHTML='<main class="page"><h2>خطأ في الاتصال</h2><p>تحقق من config.js</p></main>';throw Error('config missing')}
const HDR={apikey:C.key,Authorization:'Bearer '+C.key};
const esc=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&','<':'<','>':'>','"':'"',"'":'&#39;'}[x]));
const fmt=x=>x==null?'—':Number(x).toLocaleString('en-US',{maximumFractionDigits:2});
const pct=x=>x==null?'—':fmt(x)+'%';
const LABEL={weekly:'أسبوع','4weeks':'4 أسابيع',ytd:'منذ بداية العام',last12m:'12 شهرًا','1y':'سنة','2y':'سنتان','3y':'3 سنوات','4y':'4 سنوات','5y':'5 سنوات','6y':'6 سنوات'};
const ORDER=['weekly','4weeks','ytd','last12m','1y','2y','3y','4y','5y','6y'];
const BENCH={
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
const arCategory=c=>{c=(c||'').toLowerCase();if(c.includes('gold'))return'صناديق الذهب';if(c.includes('money market'))return'صناديق النقد';if(c.includes('fixed income'))return'صناديق الدخل الثابت';if(c.includes('balanced')||c.includes('mixed')||c.includes('allocator'))return'الصناديق المتوازنة';if(c.includes('index')||c.includes('etf')||c.includes('traded')||c.includes('passive'))return'صناديق المؤشرات';if(c.includes('equity')||c.includes('thematic')||c.includes('sector'))return'صناديق الأسهم';if(c.includes('protected')||c.includes('guaranteed'))return'صناديق محمية';return c||'غير مصنف'};
const arRating=x=>{const s=String(x||'').toLowerCase();if(s.includes('excellent'))return'ممتاز';if(s.includes('good'))return'جيد';if(s.includes('average')||s.includes('fair'))return'متوسط';if(s.includes('weak')||s.includes('poor'))return'ضعيف';return x||'غير مقيم'};
const arConf=x=>{const s=String(x||'').toLowerCase();if(s.includes('high'))return'مرتفعة';if(s.includes('moderate'))return'متوسطة';if(s.includes('limited'))return'محدودة';if(s.includes('insufficient'))return'غير كافية';return x||'—'};
const arQual=x=>{const s=String(x||'').toLowerCase();if(s.includes('qualified'))return'مؤهل';if(s.includes('watch'))return'تحت المراقبة';if(s.includes('unqualified')||s.includes('fail'))return'غير مؤهل';return x||'—'};
const arWarn=x=>String(x||'').replace(/_/g,' ')
  .replace('return not yet verified against funds.metadata.scores, but passes benchmark plausibility check','العائد يمر باختبار المعقولية ولم يُطابق بعد سجل الدرجات')
  .replace('return not yet verified against funds.metadata.scores','العائد لم يُطابق بعد سجل الدرجات');
async function get(path){const r=await fetch(C.url+path,{headers:HDR});const j=await r.json();if(!r.ok)throw Error(j.message||('HTTP '+r.status));return j}
let A=[],perfCache={},benchCache={},selected=new Set(),BENCHVAL={};
function horizonStart(end,h){const d=new Date(end+'T00:00:00Z');if(h==='weekly')d.setUTCDate(d.getUTCDate()-7);else if(h==='4weeks')d.setUTCDate(d.getUTCDate()-28);else if(h==='last12m')d.setUTCFullYear(d.getUTCFullYear()-1);else if(h==='ytd'){d.setUTCMonth(0,1);return d.toISOString().slice(0,10)}else if(/^\dy$/.test(h))d.setUTCFullYear(d.getUTCFullYear()-Number(h[0]));else return null;return d.toISOString().slice(0,10)}
async function performance(h){if(perfCache[h])return perfCache[h];const d=await get('/rest/v1/fund_performance_history?select=report_date&horizon=eq.'+encodeURIComponent(h)+'&order=report_date.desc&limit=1');if(!d.length)throw Error('لا توجد بيانات للفترة');const date=d[0].report_date;const r=await get('/rest/v1/fund_performance_history?select=fund_id,return_pct&horizon=eq.'+encodeURIComponent(h)+'&report_date=eq.'+date+'&limit=1000');const map={};r.forEach(x=>map[x.fund_id]=x.return_pct==null?null:Number(x.return_pct));return perfCache[h]=({date,map})}
async function benchmark(k,h,end){
  const b=BENCH[k]; if(!b) return null;
  if(b.type==='inflation' && (h==='weekly'||h==='4weeks')) return null;
  const start=horizonStart(end,h); if(!start) return null;
  const cache=k+'|'+h+'|'+end; if(benchCache[cache]) return benchCache[cache];
  const r=await get('/rest/v1/macro_series?select=ts_date,value,unit&series_key=eq.'+encodeURIComponent(b.series)+'&ts_date=gte.'+start+'&ts_date=lte.'+end+'&order=ts_date.asc&limit=5000');
  const v=r.filter(x=>x.value!=null); if(!v.length) return null;
  let out=null;
  if(b.type==='level'){const a=Number(v[0].value),z=Number(v[v.length-1].value); if(a) out={value:(z/a-1)*100,start:v[0].ts_date,end:v[v.length-1].ts_date,calculated:true}}
  else if(b.type==='inflation'){let f=1; v.forEach(x=>f*=1+Number(x.value)/100); out={value:(f-1)*100,start:v[0].ts_date,end:v[v.length-1].ts_date,calculated:true}}
  else {const avg=v.reduce((s,x)=>s+Number(x.value),0)/v.length; const days=Math.max(1,(new Date(v[v.length-1].ts_date)-new Date(v[0].ts_date))/86400000); out={value:avg*days/365,start:v[0].ts_date,end:v[v.length-1].ts_date,calculated:true}}
  return benchCache[cache]=out;
}
async function renderBench(h,end){
  const out={};
  await Promise.all(Object.keys(BENCH).map(async k=>{try{out[k]=await benchmark(k,h,end)}catch(e){out[k]=null}}));
  BENCHVAL=out;
  const cards=Object.entries(BENCH).filter(([k])=>out[k] && out[k].value!=null).map(([k,b])=>{
    const x=out[k];
    return '<label class="benchcard '+(selected.has(k)?'on':'')+'"><input type="checkbox" data-b="'+k+'" '+(selected.has(k)?'checked':'')+'><div><div class="benchname">'+b.label+'</div><div class="benchval">'+pct(x.value)+(x.calculated?'<span class="calculated">محسوب من السلسلة</span>':'')+'</div><div class="benchdate">'+esc(x.start)+' → '+esc(x.end)+'</div></div></label>';
  }).join('');
  $('bench').innerHTML=(cards||'<div class="empty">لا تتوفر معايير قابلة للمقارنة على هذا الأفق.</div>')+
    '<label class="benchcard '+(window.BESTCAT?'on':'')+'"><input type="checkbox" id="bestcat" '+(window.BESTCAT?'checked':'')+'><div><div class="benchname">الأعلى في فئته</div><div class="benchval">أفضل عائد داخل الفئة</div><div class="benchdate">يُضاف إلى شرط التفوق على الكل</div></div></label>';
  $('bench').querySelectorAll('[data-b]').forEach(el=>el.onchange=()=>{el.checked?selected.add(el.dataset.b):selected.delete(el.dataset.b);draw()});
  const bcel=$('bestcat'); if(bcel) bcel.onchange=()=>{window.BESTCAT=bcel.checked;draw()};
}
function scorePass(f,s){if(!s)return true;if(s==='na')return f.score==null;if(s==='90')return f.score!=null&&f.score>=90;if(s==='75')return f.score!=null&&f.score>=75&&f.score<90;if(s==='50')return f.score!=null&&f.score>=50&&f.score<75;return f.score!=null&&f.score<50}
function firstWarning(f){if(!Array.isArray(f.warnings)||!f.warnings.length)return '—'; const w=f.warnings[0]; return arWarn(typeof w==='string'?w:(w&&w.message)||JSON.stringify(w))}
function verdict(f,active){
  if(!active.length) return '<span class="verdict hold">اختر معيارًا للمقارنة</span>';
  if(f.ret==null) return '<span class="verdict hold">لا يوجد عائد</span>';
  const lost=active.filter(k=>!(f.ret>BENCHVAL[k].value));
  if(!lost.length) return '<span class="verdict win">هزم المعايير المختارة</span>';
  return '<span class="verdict hold">خارج شرط التفوق</span>';
}
function drawKpis(r,p,h){
  const scored=r.filter(x=>x.score!=null);
  const avg=scored.length?scored.reduce((s,x)=>s+Number(x.score),0)/scored.length:null;
  const byRet=[...r].sort((a,b)=>(b.ret??-Infinity)-(a.ret??-Infinity));
  const age=Math.round((Date.now()-new Date(p.date+'T00:00:00Z'))/86400000);
  const freshness=age<=14?'fresh':age<=45?'stale':'';
  const freshnessText=age<=14?'تاريخ تقرير الأفق':age<=45?'مضى '+age+' يومًا على التقرير':'تقرير أقدم نسبيًا';
  $('kpis').innerHTML=
    '<div class="kpi"><span>المعروض الآن</span><b>'+r.length+' / '+A.length+'</b></div>'+
    '<div class="kpi"><span>الأفق</span><b>'+LABEL[h]+'</b></div>'+
    '<div class="kpi"><span>تاريخ تقرير العائد</span><b class="'+freshness+'">'+p.date+'</b><em class="'+freshness+'">'+freshnessText+'</em></div>'+
    '<div class="kpi"><span>متوسط التقييم</span><b>'+fmt(avg)+'</b></div>'+
    '<div class="kpi"><span>أعلى عائد في النتيجة</span><b>'+(byRet[0]?pct(byRet[0].ret):'—')+'</b></div>';
}
async function updateHorizonMeta(h){
  const box=$('horizonMeta'); if(!box) return;
  try{
    const r=await get('/rest/v1/fund_performance_history?select=report_date&horizon=eq.'+encodeURIComponent(h)+'&order=report_date.asc&limit=2000');
    const dates=[...new Set(r.map(x=>x.report_date).filter(Boolean))];
    if(!dates.length){box.textContent='لا توجد لقطات أداء لهذا الأفق.';return;}
    box.innerHTML='تاريخ تقرير هذا الأفق في القاعدة: <b>'+esc(dates[dates.length-1])+'</b>'+(dates.length>1?' · عدد اللقطات المتاحة: '+dates.length+' ('+esc(dates[0])+' → '+esc(dates[dates.length-1])+')':' · لقطة واحدة فقط');
  }catch(e){box.textContent='تعذر التحقق من تاريخ الأفق.';}
}
async function draw(){
  const h=$('h').value; if(!h) return;
  const p=await performance(h);
  A.forEach(f=>f.ret=p.map[f.id]??null);
  await renderBench(h,p.date);
  const active=[...selected].filter(k=>BENCHVAL[k]?.value!=null);
  const qv=$('q').value.trim().toLowerCase(),cv=$('cat').value,mv=$('mgr').value,sv=$('score').value;
  let r=A.filter(f=>(!qv||(f.name+' '+f.manager).toLowerCase().includes(qv))&&(!cv||f.cat===cv)&&(!mv||f.manager===mv)&&scorePass(f,sv));
  r=r.filter(f=>!active.length||active.every(k=>f.ret!=null&&f.ret>BENCHVAL[k].value));
  if(window.BESTCAT){const mx={}; r.forEach(f=>{if(f.ret==null)return; if(mx[f.cat]==null||f.ret>mx[f.cat]) mx[f.cat]=f.ret}); r=r.filter(f=>f.ret!=null&&f.ret===mx[f.cat]);}
  const sort=$('viewSort').value;
  r.sort((a,b)=>sort==='score'?(b.score??-Infinity)-(a.score??-Infinity):(b.ret??-Infinity)-(a.ret??-Infinity));
  drawKpis(r,p,h);
  const labels=[...active.map(k=>BENCH[k].label),...(window.BESTCAT?['الأعلى في فئته']:[])];
  $('resultInfo').textContent=labels.length?'شرط التفوق على: '+labels.join(' + '):'بدون شرط معيار — كل الصناديق المطابقة للبحث';
  $('rows').innerHTML=r.length?r.map((f,i)=>{
    const cc=String(f.confidence||'').toLowerCase().replace(/[^a-z]/g,'');
    return '<tr onclick="location.href=\'fund.html?id='+encodeURIComponent(f.id)+'&h='+encodeURIComponent(h)+'\'">'+ 
      '<td>'+(i+1)+'</td>'+
      '<td class="fund"><b>'+esc(f.name)+'</b><div class="muted">'+esc(f.manager)+'</div></td>'+
      '<td>'+esc(f.cat)+'</td>'+
      '<td class="num '+(f.ret!=null?(f.ret>=0?'pos':'neg'):'')+'">'+pct(f.ret)+'</td>'+
      '<td>'+verdict(f,active)+'</td>'+
      '<td class="num score">'+fmt(f.score)+'</td>'+
      '<td><span class="rating">'+esc(arRating(f.rating))+'</span></td>'+
      '<td class="num">'+fmt(f.risk)+'</td>'+
      '<td class="confidence '+cc+'">'+esc(arConf(f.confidence))+'</td>'+
      '<td>'+esc(arQual(f.qualification))+'</td>'+
      '<td class="warning">'+esc(firstWarning(f))+'</td></tr>';
  }).join(''):'<tr><td colspan="11" class="empty">لا توجد صناديق تطابق الشروط الحالية.</td></tr>';
  $('msg').textContent=active.length?'يظهر في الجدول فقط من تفوّق على كل المعايير المحددة.':'لم يُحدد معيار بعد. اختر التضخم أو الذهب أو أذون الخزانة لتصفية عادلة.';
}
(async()=>{
  try{
    const [funds,navs,ss,hs]=await Promise.all([
      get('/rest/v1/funds?select=fund_id,canonical_name,management_company,category&limit=1000'),
      get('/rest/v1/nav_official?select=fund_id,nav,as_of_date&limit=1000'),
      get('/rest/v1/fund_smartscore_latest?select=fund_id,final_score,rating,risk_score,benchmark_score,data_confidence,qualification_status,warnings,methodology_version&limit=1000'),
      get('/rest/v1/fund_performance_history?select=horizon&limit=1000')
    ]);
    const nm={},sm={}; navs.forEach(x=>nm[x.fund_id]=x); ss.forEach(x=>sm[x.fund_id]=x);
    A=funds.map(f=>{const s=sm[f.fund_id]||{}; return {id:f.fund_id,name:f.canonical_name||'—',manager:f.management_company||'',cat:arCategory(f.category),nav:nm[f.fund_id]?.nav??null,score:s.final_score==null?null:Number(s.final_score),rating:s.rating||'',risk:s.risk_score==null?null:Number(s.risk_score),benchmark:s.benchmark_score==null?null:Number(s.benchmark_score),confidence:s.data_confidence||'',qualification:s.qualification_status||'',warnings:s.warnings||[],ret:null}});
    const horizons=[...new Set(hs.map(x=>x.horizon).filter(x=>LABEL[x]))].sort((a,b)=>ORDER.indexOf(a)-ORDER.indexOf(b));
    $('h').innerHTML=horizons.map(x=>'<option value="'+x+'">'+LABEL[x]+'</option>').join('');
    $('h').value=horizons.includes('last12m')?'last12m':horizons.includes('1y')?'1y':horizons[0];
    [...new Set(A.map(x=>x.cat))].sort().forEach(x=>$('cat').insertAdjacentHTML('beforeend','<option value="'+esc(x)+'">'+esc(x)+'</option>'));
    [...new Set(A.map(x=>x.manager).filter(Boolean))].sort().forEach(x=>$('mgr').insertAdjacentHTML('beforeend','<option value="'+esc(x)+'">'+esc(x)+'</option>'));
    ['q','cat','mgr','score','h','viewSort'].forEach(id=>$(id).addEventListener('input',()=>{if(id==='h')updateHorizonMeta($('h').value);draw()}));
    $('reset').onclick=()=>{selected.clear();window.BESTCAT=false;$('q').value='';$('cat').value='';$('mgr').value='';$('score').value='';$('viewSort').value='return';$('h').value=horizons.includes('last12m')?'last12m':$('h').value;draw();updateHorizonMeta($('h').value)};
    await updateHorizonMeta($('h').value);
    await draw();
  }catch(e){
    console.error(e);
    $('rows').innerHTML='<tr><td colspan="11" class="error-state">تعذر تحميل بيانات الصناديق.<br><small>'+esc(e.message)+'</small></td></tr>';
  }
})();
