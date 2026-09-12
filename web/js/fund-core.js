/* Fund UI compatibility facade. The canonical fund-domain service is loaded by fund.html before UI modules. */
(function () {
  'use strict';
  const priceCss = document.createElement('link');
  priceCss.rel = 'stylesheet';
  priceCss.href = 'css/fund-price.css?v=20260912price1';
  document.head.appendChild(priceCss);
  const q = new URLSearchParams(location.search);
  const id = q.get('id') || q.get('fund_id');
  const C = window.KHATER || {};
  const HS = ['weekly','4weeks','ytd','last12m','1y','2y','3y','4y','5y','6y','max'];
  const L = {weekly:'أسبوعي', '4weeks':'4 أسابيع', ytd:'منذ بداية العام', last12m:'12 شهراً', '1y':'سنة', '2y':'سنتان', '3y':'3 سنوات', '4y':'4 سنوات', '5y':'5 سنوات', '6y':'6 سنوات', max:'الأقصى'};
  function esc(x){return String(x==null?'—':x).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));}
  function num(x){return x==null||!Number.isFinite(Number(x))?'—':Number(x).toLocaleString('en-US',{maximumFractionDigits:2});}
  function pct(x){return x==null||!Number.isFinite(Number(x))?'—':(Number(x)>=0?'+':'')+num(x)+'%';}
  function warnings(w){if(w==null)return[];if(Array.isArray(w))return w.map(x=>typeof x==='string'?x:(x&&x.message)||JSON.stringify(x));if(typeof w==='object')return Object.entries(w).map(e=>e[0]+': '+JSON.stringify(e[1]));return[String(w)];}
  function service(){const s=window.KHATER_DATA&&window.KHATER_DATA.fund;if(!s)throw new Error('طبقة البيانات الموحدة للصندوق غير محملة');return s;}
  async function loadFund(){
    if(!id)throw Error('معرّف الصندوق غير موجود في الرابط');
    if(!C.url||!C.key)throw Error('config.js غير متاح أو مفاتيح Supabase غير موجودة');
    return service().getFundBundle(id);
  }
  window.FUND={id,C,L,HS,esc,num,pct,warnings,loadFund,
    buildOfficialSeries:rows=>Object.fromEntries(HS.map(h=>[h,service().performanceSeries(rows,h)])),
    buildNavSeries:(perfRows,priceRows)=>service().canonicalNAV(priceRows||[]).data,
    getCanonicalPerformance:(rows,h)=>service().performanceSeries(rows,h)
  };
})();
