/* Home page controller. Data access stays in canonical domain services. */
(function(window){
  'use strict';
  const fmt=n=>Number(n).toLocaleString('en-US',{maximumFractionDigits:2});
  const last=s=>s&&Array.isArray(s.rows)&&s.rows.length?s.rows[s.rows.length-1]:null;
  const pctChange=(rows,period=30)=>{
    if(!rows||rows.length<2)return null;
    const latest=rows[rows.length-1];
    const cutoff=new Date(latest.ts_date+'T00:00:00'); cutoff.setDate(cutoff.getDate()-period);
    let base=null;
    for(let i=rows.length-1;i>=0;i--){if(new Date(rows[i].ts_date+'T00:00:00')<=cutoff){base=rows[i];break;}}
    if(!base||!Number(base.value))return null;
    return (Number(latest.value)-Number(base.value))/Number(base.value)*100;
  };
  const cls=v=>v==null?'':v>=0?'up':'dn';
  const signed=v=>v==null?'—':(v>0?'+':'')+fmt(v)+'%';
  function regime(egx30,gold,usd,inflation,tbill){
    if(egx30==null||gold==null||usd==null)return {label:'قراءة السياق قيد الاكتمال',cls:''};
    if(egx30>0 && gold>0 && (inflation==null || inflation<tbill))return {label:'ميل إيجابي مع متابعة الأسعار',cls:'regime--positive'};
    if(usd>0 || (inflation!=null && tbill!=null && inflation>=tbill))return {label:'ضغط نقدي / دفاعي',cls:'regime--caution'};
    return {label:'سوق متباين — المقارنة أهم من الاتجاه الواحد',cls:''};
  }
  async function render(){
    const strip=document.getElementById('strip'), context=document.getElementById('financial-context');
    if(!strip)return;
    try{
      const [usdSeries,goldSeries,egxSeries,inflSeries,tbillSeries,universe]=await Promise.all([
        window.KHATER_DATA.macro.getSeries('usd_egp_mid'),
        window.KHATER_DATA.macro.getSeries('gold_egp_oz'),
        window.KHATER_DATA.macro.getSeries('egx30_close'),
        window.KHATER_DATA.macro.getSeries('cpi_headline_mom_pct'),
        window.KHATER_DATA.macro.getSeries('tbill_364_avg_yield_pct'),
        window.KHATER_DATA.funds.getUniverse()
      ]);
      const usd=last(usdSeries),egx=last(egxSeries),gold=last(goldSeries),infl=last(inflSeries),tbill=last(tbillSeries);
      const priced=universe.list.filter(x=>x.nav!=null).length;
      strip.innerHTML=`
        <div class="kpi"><em>USD / EGP</em><b class="num">${usd?fmt(usd.value):'—'}</b><span class="muted">${usd?usd.ts_date:''}</span></div>
        <div class="kpi"><em>EGX30</em><b class="num">${egx?fmt(egx.value):'—'}</b><span class="muted">${egx?egx.ts_date:''}</span></div>
        <div class="kpi"><em>صناديق مسعّرة</em><b class="num">${priced} / ${universe.list.length}</b><span class="muted">Supabase</span></div>
        <div class="kpi"><em>مصدر البيانات</em><b>مباشر</b><span class="muted">public.macro_series + funds</span></div>`;
      if(context){
        const changes={usd:pctChange(usdSeries.rows),gold:pctChange(goldSeries.rows),egx:pctChange(egxSeries.rows)};
        const r=regime(changes.egx,changes.gold,changes.usd,infl?.value,tbill?.value);
        context.innerHTML=`
          <div class="home-context__head"><div><div class="kicker">الطبقة التي تسبق الفرصة</div><h2>ماذا يقول السوق أولًا؟</h2><p>نقرأ حركة الجنيه والأصول والأسعار قبل أن نطلب منك النظر إلى صندوق بعينه.</p></div><div class="home-context__date">آخر تحديث: ${egx?.ts_date||usd?.ts_date||'—'}</div></div>
          <div class="context-grid">
            <article class="context-card context-card--regime"><div><span class="context-card__label">Market Regime</span><h3>الصورة العامة</h3><div class="regime ${r.cls}"><i class="regime-dot"></i>${r.label}</div></div><div class="context-note">ليست توصية شراء؛ إنها نقطة بداية لفهم ما يحدث.</div></article>
            <article class="context-card"><span class="context-card__label">EGX30</span><h3>البورصة المصرية</h3><div class="context-card__value ${cls(changes.egx)}">${signed(changes.egx)}</div><div class="context-card__meta">تغير تقريبي خلال 30 يومًا</div></article>
            <article class="context-card"><span class="context-card__label">Gold / EGP</span><h3>الذهب بالجنيه</h3><div class="context-card__value ${cls(changes.gold)}">${signed(changes.gold)}</div><div class="context-card__meta">تغير تقريبي خلال 30 يومًا</div></article>
            <article class="context-card"><span class="context-card__label">USD / EGP</span><h3>الجنيه مقابل الدولار</h3><div class="context-card__value ${cls(changes.usd)}">${signed(changes.usd)}</div><div class="context-card__meta">تغير تقريبي خلال 30 يومًا</div></article>
          </div>
          <div class="context-links"><a class="context-link" href="./macro.html">افهم الاقتصاد الكلي ←</a><a class="context-link" href="./map.html">شاهد ماذا حدث للفلوس ←</a><a class="context-link" href="./categories.html">انتقل إلى خريطة الفئات ←</a></div>`;
      }
    }catch(e){
      strip.innerHTML='<div class="muted">تعذر تحميل الملخص من قاعدة البيانات</div>';
      if(context)context.innerHTML='<div class="empty">تعذر تحميل طبقة السياق المالي من قاعدة البيانات</div>';
      console.error('[home]',e);
    }
  }
  window.KHATER_HOME={render};
  document.addEventListener('DOMContentLoaded',render,{once:true});
})(window);