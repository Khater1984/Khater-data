/* Small presentation safety layer for funds.html. It does not calculate financial metrics. */
(function(){
'use strict';
function cleanDiagnostics(){
  document.querySelectorAll('.page-funds .warning').forEach(function(cell){
    const raw=cell.textContent.trim().toLowerCase();
    if(!raw||raw==='—')return;
    if(/not yet verified|plausibility|benchmark|metadata|developer|debug|internal|failed|error|undefined|null/.test(raw)){
      cell.textContent='تنبيه بيانات';
      cell.title='يوجد تنبيه متعلق بجودة أو اكتمال البيانات';
    }else if(/^[a-z0-9_ .,:;()\-/]+$/i.test(cell.textContent.trim())){
      cell.textContent='تنبيه بيانات';
    }
  });
}
function addHighReturnBadges(){
  const tbody=document.getElementById('rows');
  if(!tbody)return;
  const rows=[...tbody.querySelectorAll('tr')].filter(r=>r.children.length>5);
  if(!rows.length)return;
  const topN=Math.max(5,Math.ceil(rows.length*.15));
  rows.forEach(function(row,i){
    const fundCell=row.children[1], scoreCell=row.children[5], qualCell=row.children[9];
    if(!fundCell||!scoreCell||!qualCell)return;
    const retText=(row.children[3]?.textContent||'').replace('%','').replace(/,/g,'').trim();
    const ret=Number(retText), score=Number((scoreCell.textContent||'').replace(/,/g,'').trim());
    const q=(qualCell.textContent||'').trim();
    const weak=Number.isFinite(score)&&score<60;
    const incomplete=!Number.isFinite(score)||/غير مؤهل|تحت المراقبة/.test(q);
    const badge=fundCell.querySelector('.high-return-warning');
    if(i<topN&&Number.isFinite(ret)&&(weak||incomplete)){
      if(!badge){
        const span=document.createElement('span');
        span.className='high-return-warning';
        span.textContent='⚠ عائد مرتفع، تقييم يحتاج مراجعة';
        fundCell.querySelector('b')?.insertAdjacentElement('afterend',span);
      }
    }else if(badge){badge.remove();}
  });
}
function cleanEnglishIcons(){
  document.querySelectorAll('.page-funds .benchicon').forEach(function(el){
    const v=el.textContent.trim().toUpperCase();
    const map={TOP:'★',GOLD:'ذ',SILVER:'ف',FX:'$',EGX:'م',DEPOSIT:'و',BTC:'ب',NASDAQ:'ت','S&P':'س','CPI':'٪','T-BILL':'أذ'};
    if(map[v])el.textContent=map[v];
  });
}
function run(){cleanDiagnostics();addHighReturnBadges();cleanEnglishIcons();}
const obs=new MutationObserver(run);
obs.observe(document.documentElement,{subtree:true,childList:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
})();
