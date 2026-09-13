/* Visual layer only. Reads already-rendered fund fields; no financial calculations or data fetching. */
(function(){
'use strict';
function num(v){const n=Number(String(v||'').replace(/[%+,]/g,'').trim());return Number.isFinite(n)?n:null;}
function addSignal(row,index,total){
  const fund=row.children[1], retCell=row.children[3], compare=row.children[4], scoreCell=row.children[5], qual=row.children[9];
  if(!fund||!retCell||!scoreCell||!qual)return;
  const score=num(scoreCell.textContent), ret=num(retCell.textContent), q=(qual.textContent||'').trim();
  let cls='neutral',label='قراءة متوازنة';
  const weak=score!=null&&score<60, incomplete=score==null||/غير مؤهل|تحت المراقبة|—/.test(q);
  if(index<Math.max(5,Math.ceil(total*.15))&&ret!=null&&(weak||incomplete)){cls='warning';label='عائد مرتفع · يحتاج مراجعة';}
  else if(score!=null&&score>=75&&!incomplete){cls='positive';label='إشارة إيجابية';}
  else if(compare&&/هزم الكل/.test(compare.textContent)){cls='positive';label='متفوق على المراجع';}
  let signal=fund.querySelector('.row-signal');
  if(!signal){signal=document.createElement('div');signal.className='row-signal';fund.appendChild(signal);}
  const wanted='row-signal '+cls;
  if(signal.className!==wanted){signal.className=wanted;signal.innerHTML='<i class="signal-dot"></i><strong>'+label+'</strong>';}
  if(cls==='warning')row.classList.add('terminal-row-highlight');else row.classList.remove('terminal-row-highlight');
  if(scoreCell.dataset.polished!=='1'){
    scoreCell.dataset.polished='1';
    if(score==null){scoreCell.innerHTML='<span class="smart-score"><span class="smart-score-ring" style="--score:0"><b>—</b></span><span class="smart-score-copy"><span>غير مقيم</span><em>لا توجد نتيجة</em></span></span>';}
    else {const capped=Math.max(0,Math.min(100,score));const tone=score>=75?'قوي':score>=60?'متوسط':'منخفض';scoreCell.innerHTML='<span class="smart-score"><span class="smart-score-ring" style="--score:'+capped+'"><b>'+Math.round(score)+'</b></span><span class="smart-score-copy"><span>SmartScore</span><em>'+tone+'</em></span></span>';}
  }
  if(!retCell.querySelector('.return-sub')){const sub=document.createElement('span');sub.className='return-sub';sub.textContent=row.querySelector('.report-date')?.textContent||'العائد الرسمي';retCell.appendChild(sub);}
  if(qual.dataset.polished!=='1'){
    qual.dataset.polished='1';
    const txt=q;qual.innerHTML='<span class="qual-pill '+(/مؤهل/.test(txt)&&!(/غير|تحت/.test(txt))?'good':/غير|تحت/.test(txt)?'bad':'')+'">'+txt+'</span>';
  }
  if(compare&&compare.dataset.polished!=='1'){
    compare.dataset.polished='1';const raw=compare.textContent.trim(),good=/هزم الكل/.test(raw);compare.innerHTML='<span class="compare-main '+(good?'':'hold')+'">'+(good?'● ':'○ ')+raw+'</span><span class="compare-sub">نفس تاريخ التقرير</span>';
  }
}
function run(){const rows=[...document.querySelectorAll('#rows > tr')].filter(r=>r.children.length>5&&!r.classList.contains('empty')&&!r.classList.contains('loading')&&!r.classList.contains('error-state'));rows.forEach((r,i)=>addSignal(r,i,rows.length));}
let scheduled=false;
const obs=new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;run();});});
obs.observe(document.getElementById('rows')||document.documentElement,{subtree:true,childList:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
})();
