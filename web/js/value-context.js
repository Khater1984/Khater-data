/* Value of Money — embedded economic context layer. Keeps macro context inside the Signature surface. */
(function(window){
  'use strict';
  const $=id=>document.getElementById(id);
  const svc=window.KHATER_DATA&&window.KHATER_DATA.macro;
  if(!svc) return;
  const latest=s=>{const r=s&&Array.isArray(s.rows)?s.rows:[];return r.length?r[r.length-1]:null};
  const prev=s=>{const r=s&&Array.isArray(s.rows)?s.rows:[];return r.length>1?r[r.length-2]:null};
  const delta=s=>{const a=latest(s),b=prev(s);return a&&b? a.value-b.value:null};
  const fmt=(n,d=2)=>n==null?'—':new Intl.NumberFormat('ar-EG',{maximumFractionDigits:d}).format(n);
  const pct=(n)=>n==null?'—':`${n>0?'+':''}${fmt(n,2)}%`;
  function tone(n){return n==null?'flat':n>0?'up':n<0?'down':'flat'}
  function card(label,key,unit,dec=2){const s=svc.getSeries?null:null;return `<article class="context-metric" data-key="${key}"><div class="context-metric-top"><span>${label}</span><span class="context-date">—</span></div><strong>—</strong><div class="context-change flat">—</div><small>${unit}</small></article>`}
  async function render(){
    const root=$('embedded-economic-context'); if(!root) return;
    root.innerHTML='<div class="context-loading"><span></span><span></span><span></span></div>';
    try{
      const data=await svc.getAll();
      const keys=[
        ['التضخم العام','cpi_headline_mom_pct','% شهري',2],
        ['الدولار / الجنيه','usd_egp_mid','جنيه لكل دولار',2],
        ['الذهب / الجنيه','gold_egp_oz','جنيه للأونصة',2],
        ['EGX30','egx30_close','نقطة',1],
        ['أذون 91 يومًا','tbill_91_avg_yield_pct','% سنوي',2]
      ];
      const rows=keys.map(([label,key,unit,dec])=>{
        const s=data.series[key],a=latest(s),d=delta(s);
        return {label,key,unit,dec,a,d};
      });
      const gold=rows.find(x=>x.key==='gold_egp_oz'),fx=rows.find(x=>x.key==='usd_egp_mid'),egx=rows.find(x=>x.key==='egx30_close'),tb=rows.find(x=>x.key==='tbill_91_avg_yield_pct'),inf=rows.find(x=>x.key==='cpi_headline_mom_pct');
      let headline='السياق الاقتصادي يحدد معنى العائد';
      let copy='قيمة المال لا تُقرأ من أداء أصل واحد؛ سعر الصرف والتضخم والعائد النقدي وحركة الأصول تغيّر الصورة التي نراها في الرسم أعلاه.';
      if(gold?.d>0 && fx?.d>0){headline='الذهب والدولار يرفعان أهمية حماية القيمة';copy='صعود الذهب مع تحرك الدولار يعني أن مقارنة أي عائد اسمي تحتاج إلى النظر أولًا إلى القوة الشرائية وسعر الصرف.'}
      else if(tb?.a?.value && inf?.a?.value && tb.a.value>inf.a.value*12){headline='العائد النقدي مرجع أساسي للمقارنة';copy='مستوى العائد النقدي يجعل تكلفة المخاطرة مهمة: لا يكفي أن يرتفع أصل ما، بل يجب أن يُقرأ تفوقه مقابل المرجع النقدي.'}
      else if(egx?.d>0){headline='السوق والأسعار يتحركان معًا';copy='حركة EGX30 يجب قراءتها بجانب التضخم وسعر الصرف حتى لا تختلط حركة السوق بأثر تغير قيمة الجنيه.'}
      root.innerHTML=`<div class="context-head"><div><span class="section-kicker">ECONOMIC CONTEXT</span><h2>${headline}</h2><p>${copy}</p></div><a href="./macro.html" class="context-reference">التفاصيل التاريخية ←</a></div><div class="context-metrics">${rows.map(x=>`<article class="context-metric"><div class="context-metric-top"><span>${x.label}</span><span class="context-date">${x.a?.ts_date||'—'}</span></div><strong>${x.a?fmt(x.a.value,x.dec):'—'}</strong><div class="context-change ${tone(x.d)}">${x.d==null?'—':pct(x.d)}</div><small>${x.unit}</small></article>`).join('')}</div><div class="context-footer"><span>السياق الاقتصادي جزء من قراءة قيمة المال، وليس توصية مستقلة.</span><span>المصدر: Supabase · آخر مشاهدة فعلية</span></div>`;
    }catch(err){root.innerHTML='<div class="context-error">تعذر تحميل السياق الاقتصادي حاليًا. قراءة قيمة المال الأساسية ما زالت متاحة.</div>'}
  }
  window.addEventListener('DOMContentLoaded',render);
})(window);
