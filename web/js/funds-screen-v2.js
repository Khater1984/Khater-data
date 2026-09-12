/* Funds screen controller. Rendering only; financial semantics live in the canonical data services. */
(function(){
'use strict';
const $=id=>document.getElementById(id), D=window.KHATER_DATA||{}, F=D.funds;
if(!F) throw new Error('Funds data service is not loaded');

const LABEL={weekly:'أسبوع','4weeks':'4 أسابيع',ytd:'منذ بداية العام',last12m:'12 شهرًا','1y':'سنة','2y':'سنتان','3y':'3 سنوات','4y':'4 سنوات','5y':'5 سنوات','6y':'6 سنوات'};
const esc=D.escape||((s)=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c])));
const fmt=x=>x==null?'—':Number(x).toLocaleString('en-US',{maximumFractionDigits:2});
const pct=x=>x==null?'—':fmt(x)+'%';
const rating=x=>{const s=String(x||'').toLowerCase();if(s.includes('excellent'))return'ممتاز';if(s.includes('good'))return'جيد';if(s.includes('average')||s.includes('fair'))return'متوسط';if(s.includes('weak')||s.includes('poor'))return'ضعيف';return x||'غير مقيم'};
const conf=x=>{const s=String(x||'').toLowerCase();if(typeof x==='number')return x>=90?'مرتفعة':x>=70?'متوسطة':'محدودة';if(s.includes('high'))return'مرتفعة';if(s.includes('moderate'))return'متوسطة';if(s.includes('limited'))return'محدودة';if(s.includes('insufficient'))return'غير كافية';return x||'—'};
const qual=x=>{const s=String(x||'').toLowerCase();if(s.includes('qualified'))return'مؤهل';if(s.includes('watch'))return'تحت المراقبة';if(s.includes('unqualified')||s.includes('fail'))return'غير مؤهل';return x||'—'};
const warn=f=>{if(!Array.isArray(f.warnings)||!f.warnings.length)return'—';const raw=typeof f.warnings[0]==='string'?f.warnings[0]:(f.warnings[0]?.message||'');const legacy='return not yet verified against funds.metadata.scores, but passes benchmark plausibility check';if(raw===legacy)return'—';return esc(raw.replace(/_/g,' '));};

let universe=[], selected=new Set(), bestCat=false, benchmarkValues={}, currentSnapshot=null, benchmarkMatrix={}, drawSeq=0;

function scorePass(f,s){
  if(!s)return true;
  if(s==='na')return f.score==null;
  if(s==='90')return f.score!=null&&f.score>=90;
  if(s==='75')return f.score!=null&&f.score>=75&&f.score<90;
  if(s==='50')return f.score!=null&&f.score>=50&&f.score<75;
  return f.score!=null&&f.score<50;
}

function activeBenchmarkKeys(){
  const keys=[...selected];
  if(bestCat)keys.push('bestCategory');
  return keys;
}

function selectedLabels(){
  return activeBenchmarkKeys().map(k=>k==='bestCategory'?'الأعلى في فئته':F.BENCH[k]?.label||k);
}

function drawKpis(rows,p,h){
  const scored=rows.filter(x=>x.score!=null);
  const avg=scored.length?scored.reduce((s,x)=>s+Number(x.score),0)/scored.length:null;
  const top=[...rows].sort((a,b)=>(b.ret??-Infinity)-(a.ret??-Infinity))[0];
  const age=Math.round((Date.now()-new Date(p.date+'T00:00:00Z'))/86400000);
  $('kpis').innerHTML=
    '<div class="kpi"><span>المعروض الآن</span><b>'+rows.length+' / '+universe.length+'</b></div>'+
    '<div class="kpi"><span>الأفق</span><b>'+LABEL[h]+'</b></div>'+
    '<div class="kpi"><span>بيانات العائد الرسمي</span><b>'+p.fundsWithReturn+' / '+universe.length+'</b><em>'+p.records.toLocaleString('en-US')+' نقطة رسمية</em></div>'+
    '<div class="kpi"><span>تاريخ آخر تقرير رسمي</span><b>'+p.date+'</b><em>'+ (age<=14?'تقرير حديث نسبيًا':'تقرير أقدم نسبيًا') +'</em></div>'+\
    '<div class="kpi"><span>متوسط التقييم</span><b>'+fmt(avg)+'</b></div>'+\
    '<div class="kpi"><span>أعلى عائد في النتيجة</span><b>'+(top?pct(top.ret):'—')+'</b></div>';
}

async function refreshBench(h,end){
  benchmarkValues=await F.getBenchmarks(h,end);
  [...selected].forEach(k=>{if(!benchmarkValues[k])selected.delete(k);});
  renderBench();
}

function renderBench(){
  const cards=Object.entries(F.BENCH)
    .filter(([k])=>benchmarkValues[k]&&benchmarkValues[k].value!=null)
    .map(([k,b])=>{
      const x=benchmarkValues[k];
      return '<label class="benchcard '+(selected.has(k)?'on':'')+'">'+
        '<input type="checkbox" data-b="'+k+'" '+(selected.has(k)?'checked':'')+'>'+
        '<div><div class="benchname">'+esc(b.label)+'</div>'+\
        '<div class="benchval">'+pct(x.value)+'<span class="calculated">محسوب من السلسلة</span></div>'+\
        '<div class="benchdate">'+esc(x.start)+' → '+esc(x.end)+'</div></div></label>';
    }).join('');
  const bestAvailable=!!currentSnapshot&&currentSnapshot.fundsWithReturn>0;
  const bestCard=bestAvailable?'<label class="benchcard '+(bestCat?'on':'')+'"><input type="checkbox" id="bestcat" '+(bestCat?'checked':'')+'><div><div class="benchname">الأعلى في فئته</div><div class="benchval">أفضل عائد داخل الفئة</div><div class="benchdate">نفس الأفق · مقارنة داخل الفئة</div></div></label>':'';
  $('bench').innerHTML=(cards||'<div class="empty">لا تتوفر معايير خارجية ببيانات فعلية لهذا الأفق.</div>')+bestCard;
  $('bench').querySelectorAll('[data-b]').forEach(el=>el.onchange=()=>{el.checked?selected.add(el.dataset.b):selected.delete(el.dataset.b);drawRows()});
  const bc=$('bestcat');
  if(bc)bc.onchange=()=>{bestCat=bc.checked;drawRows()};
}

function buildDerivedRows(){
  const h=$('h').value;
  return universe.map(f=>Object.assign({},f,{ret:currentSnapshot.map[f.id]??null,returnDate:currentSnapshot.returnDates[f.id]??null,horizon:h}));
}

function applyFilters(){
  if(!currentSnapshot)return;
  const h=$('h').value;
  const q=$('q').value.trim().toLowerCase();
  const cat=$('cat').value;
  const mgr=$('mgr').value;
  const sc=$('score').value;
  const base=buildDerivedRows();
  const benchmarkKeys=activeBenchmarkKeys();
  benchmarkMatrix=F.evaluateBenchmarks(base,benchmarkValues,benchmarkKeys,false);

  const rowsBeforeFilters=base.filter(f=>
    (!q||(f.name+' '+f.manager).toLowerCase().includes(q))&&
    (!cat||f.cat===cat)&&
    (!mgr||f.manager===mgr)&&
    scorePass(f,sc)
  );

  const rows=rowsBeforeFilters.filter(f=>{
    const evaln=benchmarkMatrix[f.id];
    return !benchmarkKeys.length || (evaln && evaln.allPassed);
  });

  const noBaseFilters=!q&&!cat&&!mgr&&!sc&&!benchmarkKeys.length;
  if(noBaseFilters&&rowsBeforeFilters.length!==universe.length){
    throw new Error('سلامة البيانات: وصل '+rowsBeforeFilters.length+' صندوقًا إلى طبقة العرض بينما قاعدة الصناديق تحتوي '+universe.length+'.');
  }

  const sort=$('viewSort').value;
  rows.sort((a,b)=>{
    const primary=sort==='score'?(b.score??-Infinity)-(a.score??-Infinity):(b.ret??-Infinity)-(a.ret??-Infinity);
    if(primary!==0)return primary;
    const secondary=(b.ret??-Infinity)-(a.ret??-Infinity);
    if(secondary!==0)return secondary;
    return String(a.name).localeCompare(String(b.name),'ar');
  });

  drawKpis(rows,currentSnapshot,h);
  const labels=selectedLabels();
  $('resultInfo').textContent=labels.length?'شروط التفوق: '+labels.join(' + ')+' — يجب اجتياز '+labels.length+'/'+labels.length:'بدون شرط معيار — كل الصناديق المطابقة للبحث';

  $('rows').innerHTML=rows.length?rows.map((f,i)=>{
    const e=benchmarkMatrix[f.id]||{selectedCount:0,passedCount:0,allPassed:true};
    const compare=!benchmarkKeys.length?'—':(e.allPassed?'<span class="verdict win">هزم الكل · '+e.passedCount+'/'+e.selectedCount+'</span>':'<span class="verdict hold">'+e.passedCount+'/'+e.selectedCount+'</span>');
    return '<tr onclick="location.href=\'fund.html?id='+encodeURIComponent(f.id)+'&h='+encodeURIComponent(h)+'\'">'+
      '<td>'+(i+1)+'</td>'+\
      '<td class="fund"><b>'+esc(f.name)+'</b><div class="muted">'+esc(f.manager)+'</div></td>'+\
      '<td>'+esc(f.cat)+'</td>'+\
      '<td class="return">'+pct(f.ret)+'</td>'+\
      '<td>'+compare+'</td>'+\
      '<td>'+fmt(f.score)+'</td>'+\
      '<td>'+esc(rating(f.rating))+'</td>'+\
      '<td>'+fmt(f.risk)+'</td>'+\
      '<td>'+esc(conf(f.confidence))+'</td>'+\
      '<td>'+esc(qual(f.qualification))+'</td>'+\
      '<td>'+warn(f)+'</td></tr>';
  }).join(''):'<tr><td colspan="11" class="empty">لا توجد صناديق تطابق الشروط الحالية.</td></tr>';

  $('msg').textContent=benchmarkKeys.length?'يظهر في الجدول فقط من اجتاز جميع المعايير المحددة على الأفق نفسه.':'لم يُحدد معيار للمقارنة — جميع المعايير اختيارية.';
}

function drawRows(){
  drawSeq++;
  try{applyFilters();}
  catch(e){
    console.error(e);
    $('rows').innerHTML='<tr><td colspan="11" class="error-state">تعذر بناء نتائج الصناديق بسبب خلل في سلامة البيانات.<br><small>'+esc(e.message)+'</small></td></tr>';
    $('resultInfo').textContent='تم إيقاف العرض لمنع نتيجة مضللة.';
  }
}

async function setHorizon(h){
  const seq=++drawSeq;
  $('rows').innerHTML='<tr><td colspan="11" class="loading">جاري تحميل البيانات الرسمية للأفق المحدد…</td></tr>';
  $('horizonMeta').textContent='جاري تحميل بيانات الأفق…';
  try{
    const p=await F.getPerformanceSnapshot(h);
    if(seq!==drawSeq)return;
    currentSnapshot=p;
    await refreshBench(h,p.date);
    if(seq!==drawSeq)return;
    applyFilters();
    $('horizonMeta').textContent='الأفق: '+LABEL[h]+' · آخر تقرير رسمي: '+p.date+' · الصناديق ذات العائد الرسمي: '+p.fundsWithReturn+'/'+universe.length;
  }catch(e){
    if(seq!==drawSeq)return;
    currentSnapshot=null;
    $('rows').innerHTML='<tr><td colspan="11" class="error-state">تعذر تحميل بيانات هذا الأفق.<br><small>'+esc(e.message)+'</small></td></tr>';
    $('horizonMeta').textContent='تعذر تحميل الأفق';
  }
}

(async()=>{
  try{
    const u=await F.getUniverse();
    universe=u.list;
    const horizons=u.horizons.filter(h=>F.ORDER.includes(h));
    $('h').innerHTML=horizons.map(x=>'<option value="'+x+'">'+LABEL[x]+'</option>').join('');
    $('h').value=horizons.includes('last12m')?'last12m':horizons[0]||'';

    [...new Set(universe.map(x=>x.cat))].sort().forEach(x=>$('cat').insertAdjacentHTML('beforeend','<option value="'+esc(x)+'">'+esc(x)+'</option>'));
    [...new Set(universe.map(x=>x.manager).filter(Boolean))].sort().forEach(x=>$('mgr').insertAdjacentHTML('beforeend','<option value="'+esc(x)+'">'+esc(x)+'</option>'));

    $('q').addEventListener('input',drawRows);
    ['cat','mgr','score','viewSort'].forEach(id=>$(id).addEventListener('change',drawRows));
    $('h').addEventListener('change',()=>setHorizon($('h').value));
    $('reset').onclick=()=>{
      selected.clear();bestCat=false;$('q').value='';$('cat').value='';$('mgr').value='';$('score').value='';$('viewSort').value='return';
      $('h').value=horizons.includes('last12m')?'last12m':horizons[0]||'';
      setHorizon($('h').value);
    };

    await setHorizon($('h').value);
  }catch(e){
    console.error(e);
    $('rows').innerHTML='<tr><td colspan="11" class="error-state">تعذر تحميل بيانات الصناديق.<br><small>'+esc(e.message)+'</small></td></tr>';
  }
})();
})();
