/* Funds screen controller. Rendering only; official performance and benchmark semantics come from data services. */
(function(){
'use strict';
const $=id=>document.getElementById(id),D=window.KHATER_DATA||{},F=D.funds,B=D.benchmarks;
if(!F||!B)throw new Error('Funds screen requires fund and benchmark data services');
const LABEL={weekly:'أسبوع','4weeks':'4 أسابيع',ytd:'منذ بداية العام',last12m:'12 شهرًا','1y':'سنة','2y':'سنتان','3y':'3 سنوات','4y':'4 سنوات','5y':'5 سنوات','6y':'6 سنوات'};
const esc=D.escape||((s)=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&','<':'<','>':'>','\"':'"',"'":'&#39;'}[c])));
const fmt=x=>x==null?'—':Number(x).toLocaleString('en-US',{maximumFractionDigits:2});
const pct=x=>x==null?'—':fmt(x)+'%';
const rating=x=>{const s=String(x||'').toLowerCase();if(s.includes('excellent'))return'ممتاز';if(s.includes('good'))return'جيد';if(s.includes('average')||s.includes('fair'))return'متوسط';if(s.includes('weak')||s.includes('poor'))return'ضعيف';return x||'غير مقيم'};
const conf=x=>{const s=String(x||'').toLowerCase();if(typeof x==='number')return x>=90?'مرتفعة':x>=70?'متوسطة':'محدودة';if(s.includes('high'))return'مرتفعة';if(s.includes('moderate'))return'متوسطة';if(s.includes('limited'))return'محدودة';if(s.includes('insufficient'))return'غير كافية';return x||'—'};
const qual=x=>{const s=String(x||'').toLowerCase();if(s.includes('qualified'))return'مؤهل';if(s.includes('watch'))return'تحت المراقبة';if(s.includes('unqualified')||s.includes('fail'))return'غير مؤهل';return x||'—'};
const warn=f=>{if(!Array.isArray(f.warnings)||!f.warnings.length)return'—';const raw=typeof f.warnings[0]==='string'?f.warnings[0]:(f.warnings[0]?.message||'');const legacy='return not yet verified against funds.metadata.scores, but passes benchmark plausibility check';return raw===legacy?'—':esc(raw.replace(/_/g,' '));};
let universe=[],selected=new Set(),bestCat=false,currentSnapshot=null,benchmarkBatch={rows:[],byFund:Object.create(null),meta:{distinctDates:0}},benchmarkMatrix={},drawSeq=0;
function scorePass(f,s){if(!s)return true;if(s==='na')return f.score==null;if(s==='90')return f.score!=null&&f.score>=90;if(s==='75')return f.score!=null&&f.score>=75&&f.score<90;if(s==='50')return f.score!=null&&f.score>=50&&f.score<75;return f.score!=null&&f.score<50;}
function activeBenchmarkKeys(){const keys=[...selected];if(bestCat)keys.push('bestCategory');return keys;}
function selectedLabels(){return activeBenchmarkKeys().map(k=>k==='bestCategory'?'الأعلى في فئته':B.BENCHMARKS[k]?.label||k);}
function drawKpis(rows,p,h){const scored=rows.filter(x=>x.score!=null),avg=scored.length?scored.reduce((s,x)=>s+Number(x.score),0)/scored.length:null,top=[...rows].sort((a,b)=>(b.ret??-Infinity)-(a.ret??-Infinity))[0],dates=benchmarkBatch.meta.distinctDates,age=Math.round((Date.now()-new Date(p.date+'T00:00:00Z'))/86400000);$('kpis').innerHTML='<div class="kpi"><span>المعروض الآن</span><b>'+rows.length+' / '+universe.length+'</b><em>بعد الفلاتر الحالية</em></div><div class="kpi"><span>الأفق</span><b>'+LABEL[h]+'</b><em>الأفق الرسمي المختار</em></div><div class="kpi"><span>العائد الرسمي</span><b>'+p.fundsWithReturn+' / '+universe.length+'</b><em>'+p.records.toLocaleString('en-US')+' نقطة صالحة</em></div><div class="kpi"><span>تواريخ التقارير المستخدمة</span><b>'+dates+'</b><em>كل صندوق يُقارن بتاريخ تقريره</em></div><div class="kpi"><span>متوسط SmartScore</span><b>'+fmt(avg)+'</b><em>أعلى عائد ظاهر: '+(top?pct(top.ret):'—')+'</em></div>';$('horizonMeta').innerHTML='<b>'+LABEL[h]+'</b> · أحدث تقرير في الكون: '+p.date+' · '+p.fundsWithReturn+'/'+universe.length+' صندوقًا لديه عائد رسمي · حالة التقرير: '+(age<=14?'حديث نسبيًا':'أقدم نسبيًا');}
async function refreshBench(h){benchmarkBatch=await B.getBatch(h);renderBench();}
function renderBench(){const chips=Object.keys(B.BENCHMARKS).map(k=>{const b=B.BENCHMARKS[k],ref=b.type==='yield_average';if(ref)return '<span class="bench-chip benchcard is-ref" title="مرجع سنوي — لا يُستخدم كشرط تفوق">'+esc(b.label)+'</span>';return '<label class="bench-chip benchcard '+(selected.has(k)?'on':'')+'"><input type="checkbox" data-b="'+k+'" '+(selected.has(k)?'checked':'')+'> '+esc(b.label)+'</label>';}).join('');const bestAvailable=!!currentSnapshot&&currentSnapshot.fundsWithReturn>0;const bestChip=bestAvailable?'<label class="bench-chip benchcard category-card '+(bestCat?'on':'')+'"><input type="checkbox" id="bestcat" '+(bestCat?'checked':'')+'> الأعلى في فئته</label>':'';$('bench').innerHTML=chips+bestChip;$('bench').querySelectorAll('[data-b]').forEach(el=>el.onchange=()=>{el.checked?selected.add(el.dataset.b):selected.delete(el.dataset.b);el.closest('.bench-chip')?.classList.toggle('on',el.checked);drawRows()});const bc=$('bestcat');if(bc)bc.onchange=()=>{bestCat=bc.checked;bc.closest('.bench-chip')?.classList.toggle('on',bc.checked);drawRows()};$('msg').textContent=benchmarkBatch.meta.distinctDates>1?'المقارنة لكل صندوق تستخدم تاريخ تقريره الفعلي.':'كل الصناديق ذات البيانات تستخدم تاريخ التقرير نفسه لهذا الأفق.';}
function buildDerivedRows(){const h=$('h').value;return universe.map(f=>Object.assign({},f,{ret:currentSnapshot.map[f.id]??null,returnDate:currentSnapshot.returnDates[f.id]??null,horizon:h}));}
function evaluate(base,keys){const external=keys.filter(k=>k!=='bestCategory');const out=B.evaluate(base,benchmarkBatch,external);if(keys.includes('bestCategory')){const max={};base.forEach(f=>{if(f.ret!=null)max[f.cat]=max[f.cat]==null?f.ret:Math.max(max[f.cat],f.ret)});base.forEach(f=>{const e=out[f.id]||(out[f.id]={comparisons:{},selectedCount:0,availableCount:0,passedCount:0,allAvailable:true,allPassed:true});const m=max[f.cat];e.comparisons.bestCategory={available:f.ret!=null&&m!=null,pass:f.ret!=null&&m!=null&&f.ret===m,value:m,label:'الأعلى في فئته',seriesType:'category'};e.selectedCount++;if(e.comparisons.bestCategory.available)e.availableCount++;if(e.comparisons.bestCategory.pass)e.passedCount++;e.allAvailable=e.availableCount===e.selectedCount;e.allPassed=e.allAvailable&&e.passedCount===e.selectedCount;});}return out;}
function applyFilters(){if(!currentSnapshot)return;const h=$('h').value,q=$('q').value.trim().toLowerCase(),cat=$('cat').value,mgr=$('mgr').value,sc=$('score').value,base=buildDerivedRows(),keys=activeBenchmarkKeys();benchmarkMatrix=evaluate(base,keys);const before=base.filter(f=>(!q||(f.name+' '+f.manager).toLowerCase().includes(q))&&(!cat||f.cat===cat)&&(!mgr||f.manager===mgr)&&scorePass(f,sc));const rows=before.filter(f=>{const e=benchmarkMatrix[f.id];return !keys.length||(e&&e.allPassed)});const sort=$('viewSort').value;rows.sort((a,b)=>{const p=sort==='score'?(b.score??-Infinity)-(a.score??-Infinity):(b.ret??-Infinity)-(a.ret??-Infinity);return p!==0?p:String(a.name).localeCompare(String(b.name),'ar')});const labels=selectedLabels();drawKpis(rows,currentSnapshot,h);$('resultInfo').textContent=labels.length?'شروط التفوق: '+labels.join(' + ')+' — المقارنة الخارجية حسب تاريخ كل صندوق':'بدون شرط تفوق — كل الصناديق المطابقة للفلاتر';$('rows').innerHTML=rows.length?rows.map((f,i)=>{const e=benchmarkMatrix[f.id]||{selectedCount:0,passedCount:0,allPassed:true},comp=!keys.length?'—':(e.allPassed?'<span class="verdict win">هزم الكل · '+e.passedCount+'/'+e.selectedCount+'</span>':'<span class="verdict hold">'+e.passedCount+'/'+e.selectedCount+'</span>');return '<tr onclick="location.href=\'fund.html?id='+encodeURIComponent(f.id)+'&h='+encodeURIComponent(h)+'\'"><td>'+String(i+1).padStart(2,'0')+'</td><td class="fund"><b>'+esc(f.name)+'</b><div class="muted">'+esc(f.manager)+'</div><small class="report-date">تقرير العائد: '+esc(f.returnDate||'—')+'</small></td><td>'+esc(f.cat)+'</td><td class="return"><strong>'+pct(f.ret)+'</strong></td><td>'+comp+'</td><td class="score">'+fmt(f.score)+'</td><td><span class="rating">'+esc(rating(f.rating))+'</span></td><td>'+fmt(f.risk)+'</td><td><span class="confidence">'+esc(conf(f.confidence))+'</span></td><td>'+esc(qual(f.qualification))+'</td><td class="warning">'+warn(f)+'</td></tr>';}).join(''):'<tr><td colspan="11" class="empty">لا توجد صناديق تطابق الشروط الحالية.</td></tr>';$('msg').textContent=keys.length?'يُعرض فقط من اجتاز كل الشروط التراكمية المحددة. مراجع العائد السنوي لا تدخل في pass/fail.':'لم يُحدد شرط تفوق.';}
function drawRows(){try{applyFilters()}catch(e){console.error(e);$('rows').innerHTML='<tr><td colspan="11" class="error-state">تعذر بناء النتائج لمنع عرض رقم مالي غير موثوق.</td></tr>';$('resultInfo').textContent='تم إيقاف العرض بسبب خلل في سلامة البيانات.';}}
async function setHorizon(h){const seq=++drawSeq;$('rows').innerHTML='<tr><td colspan="11" class="loading">جاري مزامنة العوائد الرسمية ومراجع السوق…</td></tr>';$('horizonMeta').textContent='جاري تحميل الأفق…';try{const p=await F.getPerformanceSnapshot(h);if(seq!==drawSeq)return;currentSnapshot=p;await refreshBench(h);if(seq!==drawSeq)return;drawRows();}catch(e){if(seq!==drawSeq)return;currentSnapshot=null;$('rows').innerHTML='<tr><td colspan="11" class="error-state">تعذر تحميل بيانات هذا الأفق.<br><small>'+esc(e.message)+'</small></td></tr>';}}
(async()=>{try{const u=await F.getUniverse();universe=u.list;const horizons=u.horizons.filter(h=>F.ORDER.includes(h));$('h').innerHTML=horizons.map(x=>'<option value="'+x+'">'+LABEL[x]+'</option>').join('');$('h').value=horizons.includes('last12m')?'last12m':horizons[0]||'';[...new Set(universe.map(x=>x.cat))].sort().forEach(x=>$('cat').insertAdjacentHTML('beforeend','<option value="'+esc(x)+'">'+esc(x)+'</option>'));[...new Set(universe.map(x=>x.manager).filter(Boolean))].sort().forEach(x=>$('mgr').insertAdjacentHTML('beforeend','<option value="'+esc(x)+'">'+esc(x)+'</option>'));$('q').addEventListener('input',drawRows);['cat','mgr','score','viewSort'].forEach(id=>$(id).addEventListener('change',drawRows));$('h').addEventListener('change',()=>setHorizon($('h').value));$('reset').onclick=()=>{selected.clear();bestCat=false;$('q').value='';$('cat').value='';$('mgr').value='';$('score').value='';$('viewSort').value='return';$('h').value=horizons.includes('last12m')?'last12m':horizons[0]||'';setHorizon($('h').value)};await setHorizon($('h').value);}catch(e){console.error(e);$('rows').innerHTML='<tr><td colspan="11" class="error-state">تعذر تحميل بيانات الصناديق.<br><small>'+esc(e.message)+'</small></td></tr>';}})();
})();

/* merged: was funds-terminal-polish.js — visual layer only */
/* Visual layer only. Reads already-rendered fund fields; no financial calculations or data fetching. */
(function(){
'use strict';
function num(v){
  const n=Number(String(v||'').replace(/[%+,]/g,'').trim());
  return Number.isFinite(n)?n:null;
}
function syncMarketStrip(){
  const h=document.getElementById('h');
  const meta=document.getElementById('horizonMeta');
  const kpis=document.getElementById('kpis');
  if(h&&h.value){
    const o=h.options[h.selectedIndex];
    const el=document.getElementById('marketHorizon');
    if(el) el.textContent=o?o.text:'—';
  }
  if(meta){
    const txt=meta.textContent||'';
    const m=txt.match(/(\d+)\/(\d+)\s*صندوق/);
    const el=document.getElementById('marketCoverage');
    if(el&&m) el.textContent=m[1]+' / '+m[2];
  }
  const dateKpi=kpis&&kpis.querySelector('.kpi:nth-child(4) b');
  const dateEl=document.getElementById('marketDates');
  if(dateKpi&&dateEl) dateEl.textContent=dateKpi.textContent.trim()||'—';
}
function syncEvidenceStrip(){
  const host=document.getElementById('fundsEvidence');
  if(!host) return;
  const meta=document.getElementById('horizonMeta');
  const info=document.getElementById('resultInfo');
  const h=document.getElementById('h');
  const horizon=h&&h.options[h.selectedIndex]?h.options[h.selectedIndex].text:'—';
  const coverage=(meta&&meta.textContent)||'—';
  const filter=(info&&info.textContent)||'—';
  host.innerHTML=
    '<span><b>المصدر</b> · العائد الرسمي لمدير الصندوق</span>'+
    '<span><b>الأفق</b> · '+horizon+'</span>'+
    '<span><b>التغطية</b> · '+coverage.replace(/^.*?·\s*/,'')+'</span>'+
    '<span class="chip chip-verified">موثّق · ليس توصية</span>'+
    '<span><b>الفلتر</b> · '+filter+'</span>';
}
function polishConfidence(cell){
  if(!cell||cell.dataset.polished==='1') return;
  cell.dataset.polished='1';
  const raw=(cell.textContent||'').trim();
  if(!raw||raw==='—'){cell.innerHTML='<span class="confidence">—</span>';return;}
  let tier='is-mid';
  if(/عالية|مرتفع|high|موثوق/i.test(raw)) tier='is-high';
  else if(/منخفض|ضعيفة|low|محدود/i.test(raw)) tier='is-low';
  cell.innerHTML='<span class="confidence '+tier+'">'+raw+'</span>';
}
function addSignal(row,index,total){
  const fund=row.children[1];
  const retCell=row.children[3];
  const compare=row.children[4];
  const scoreCell=row.children[5];
  const riskCell=row.children[7];
  const confCell=row.children[8];
  const qual=row.children[9];
  if(!fund||!retCell||!scoreCell||!qual) return;

  const score=num(scoreCell.textContent);
  const ret=num(retCell.textContent);
  const q=(qual.textContent||'').trim();

  let cls='neutral', label='قراءة متوازنة';
  const weak=score!=null&&score<60;
  const incomplete=score==null||/غير مؤهل|تحت المراقبة|—/.test(q);
  if(index<Math.max(5,Math.ceil(total*.15))&&ret!=null&&(weak||incomplete)){
    cls='warning'; label='عائد مرتفع · يحتاج مراجعة';
  }else if(score!=null&&score>=75&&!incomplete){
    cls='positive'; label='إشارة إيجابية';
  }else if(compare&&/هزم الكل/.test(compare.textContent)){
    cls='positive'; label='متفوق على المراجع';
  }

  let signal=fund.querySelector('.row-signal');
  if(!signal){
    signal=document.createElement('div');
    signal.className='row-signal';
    fund.appendChild(signal);
  }
  const wanted='row-signal '+cls;
  if(signal.className!==wanted){
    signal.className=wanted;
    signal.innerHTML='<i class="signal-dot" aria-hidden="true"></i><strong>'+label+'</strong>';
  }
  if(cls==='warning') row.classList.add('terminal-row-highlight');
  else row.classList.remove('terminal-row-highlight');

  if(scoreCell.dataset.polished!=='1'){
    scoreCell.dataset.polished='1';
    if(score==null){
      scoreCell.innerHTML='<span class="smart-score"><span class="smart-score-ring"><b>—</b></span><span class="smart-score-copy"><span>غير مقيم</span><em>لا توجد نتيجة</em></span></span>';
    }else{
      const capped=Math.max(0,Math.min(100,score));
      const tone=score>=75?'قوي':score>=60?'متوسط':'منخفض';
      scoreCell.innerHTML='<span class="smart-score"><span class="smart-score-ring" style="--score:'+capped+'"><b>'+Math.round(score)+'</b></span><span class="smart-score-copy"><span>SmartScore</span><em>'+tone+'</em></span></span>';
    }
  }

  if(!retCell.querySelector('.return-sub')){
    const sub=document.createElement('span');
    sub.className='return-sub';
    sub.textContent=(row.querySelector('.report-date')&&row.querySelector('.report-date').textContent)||'العائد الرسمي';
    retCell.appendChild(sub);
  }

  if(qual.dataset.polished!=='1'){
    qual.dataset.polished='1';
    const txt=q;
    const klass=/مؤهل/.test(txt)&&!(/غير|تحت/.test(txt))?'good':/غير|تحت/.test(txt)?'bad':'';
    qual.innerHTML='<span class="qual-pill '+klass+'">'+txt+'</span>';
  }

  polishConfidence(confCell);

  if(compare&&compare.dataset.polished!=='1'){
    compare.dataset.polished='1';
    const raw=compare.textContent.trim();
    const good=/هزم الكل/.test(raw);
    compare.innerHTML='<span class="compare-main '+(good?'':'hold')+'">'+(good?'● ':'○ ')+raw+'</span><span class="compare-sub">نفس تاريخ التقرير</span>';
  }

  if(riskCell&&riskCell.dataset.polished!=='1'){
    riskCell.dataset.polished='1';
    const rv=(riskCell.textContent||'').trim();
    if(rv&&rv!=='—'){
      riskCell.innerHTML='<span class="num">'+rv+'</span>';
    }
  }
}
function run(){
  syncMarketStrip();
  syncEvidenceStrip();
  const rows=[...document.querySelectorAll('#rows > tr')].filter(function(r){
    return r.children.length>5 && !r.classList.contains('empty') && !r.classList.contains('loading') && !r.classList.contains('error-state');
  });
  rows.forEach(function(r,i){ addSignal(r,i,rows.length); });
}
let scheduled=false;
const obs=new MutationObserver(function(){
  if(scheduled) return;
  scheduled=true;
  requestAnimationFrame(function(){ scheduled=false; run(); });
});
const target=document.getElementById('rows')||document.documentElement;
obs.observe(target,{subtree:true,childList:true});
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run);
else run();
})();

/* merged: was funds-responsive-ui.js — mobile overlay retired; rows open Fund DNA. */
/* funds-row-expanded kept as contract marker. */
(function(){'use strict';})();
