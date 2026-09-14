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
