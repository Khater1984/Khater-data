/* Home page controller. Data access stays in canonical domain services. */
(function(window){
  'use strict';
  const fmt=n=>Number(n).toLocaleString('en-US',{maximumFractionDigits:2});
  const last=s=>s&&Array.isArray(s.rows)&&s.rows.length?s.rows[s.rows.length-1]:null;
  async function render(){
    const strip=document.getElementById('strip');
    if(!strip)return;
    try{
      const [usdData,egxData,universe]=await Promise.all([
        window.KHATER_DATA.macro.getSeries('usd_egp_mid'),
        window.KHATER_DATA.macro.getSeries('egx30_close'),
        window.KHATER_DATA.funds.getUniverse()
      ]);
      const usd=last(usdData),egx=last(egxData);
      const priced=universe.list.filter(x=>x.nav!=null).length;
      strip.innerHTML=`
        <div class="kpi"><em>USD / EGP</em><b class="num">${usd?fmt(usd.value):'—'}</b><span class="muted">${usd?usd.ts_date:''}</span></div>
        <div class="kpi"><em>EGX30</em><b class="num">${egx?fmt(egx.value):'—'}</b><span class="muted">${egx?egx.ts_date:''}</span></div>
        <div class="kpi"><em>صناديق مسعّرة</em><b class="num">${priced} / ${universe.list.length}</b><span class="muted">Supabase</span></div>
        <div class="kpi"><em>مصدر البيانات</em><b>مباشر</b><span class="muted">public.macro_series + funds</span></div>`;
    }catch(e){
      strip.innerHTML='<div class="muted">تعذر تحميل الملخص من قاعدة البيانات</div>';
      console.error('[home]',e);
    }
  }
  window.KHATER_HOME={render};
  document.addEventListener('DOMContentLoaded',render,{once:true});
})(window);
