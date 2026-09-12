/* Fund UI compatibility facade. Financial data access and canonicalization live in web/js/data/fund-service.js. */
(function () {
  'use strict';
  const q = new URLSearchParams(location.search);
  const id = q.get('id') || q.get('fund_id');
  const C = window.KHATER || {};
  const HS = ['weekly','4weeks','ytd','last12m','1y','2y','3y','4y','5y','6y','max'];
  const L = {weekly:'أسبوعي','4weeks:'4 أسابيع',ytd:'منذ بداية العام',last12m:'12 شهراً','1y':'سنة','2y':'سنتان','3y':'3 سنوات','4y':'4 سنوات','5y':'5 سنوات','6y':'6 سنوات',max:'الأقصى'};
  function esc(x){return String(x==null?'—':x).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));}
  function num(x){return x==null||!Number.isFinite(Number(x))?'—':Number(x).toLocaleString('en-US',{maximumFractionDigits:2});}
  function pct(x){return x==null||!Number.isFinite(Number(x))?'—':(Number(x)>=0?'+':'')+num(x)+'%';}
  function warnings(w){if(w==null)return[];if(Array.isArray(w))return w.map(x=>typeof x==='string'?x:(x&&x.message)||JSON.stringify(x));if(typeof w==='object')return Object.entries(w).map(e=>e[0]+': '+JSON.stringify(e[1]));return[String(w)];}
  function loadScript(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=false;s.onload=resolve;s.onerror=()=>reject(new Error('تعذر تحميل طبقة البيانات: '+src));document.head.appendChild(s);});}
  async function ensureDataLayer(){
    if(!window.KHATER_DATA?.supabase) await loadScript('js/data/supabase-client.js');
    if(!window.KHATER_DATA?.fund) await loadScript('js/data/fund-service.js');
  }
  async function loadFund(){
    if(!id)throw Error('معرّف الصندوق غير موجود في الرابط');
    if(!C.url||!C.key)throw Error('config.js غير متاح أو مفاتيح Supabase غير موجودة');
    await ensureDataLayer();
    const d=await window.KHATER_DATA.fund.getFundBundle(id);
    if(!d.fund)throw Error('الصندوق غير موجود: '+id);
    return d;
  }
  function service(){return window.KHATER_DATA&&window.KHATER_DATA.fund;}
  window.FUND={id,C,L,HS,esc,num,pct,warnings,loadFund,
    buildOfficialSeries:rows=>{const s=service();return s?Object.fromEntries(HS.map(h=>[h,s.performanceSeries(rows,h)])):{};},
    buildNavSeries:(perfRows,priceRows)=>{const s=service();return s?s.canonicalNAV(priceRows||[]).data:[];},
    getCanonicalPerformance:(rows,h)=>{const s=service();return s?s.performanceSeries(rows,h):[]}
  };
})();
