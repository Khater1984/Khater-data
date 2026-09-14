(function(){
  'use strict';
  function boot(){
    if(!document.body.classList.contains('experience-home')) return;
    const regime=document.querySelector('.x-regime');
    if(!regime || document.querySelector('.terminal-dashboard')) return;
    const wrap=document.createElement('section');
    wrap.className='terminal-dashboard';
    wrap.setAttribute('aria-label','لوحة السوق الديناميكية');
    wrap.innerHTML=`
      <div class="terminal-panel terminal-panel--wide">
        <div class="terminal-panel__head"><div><span class="x-kicker">MARKET PULSE</span><h2>نبض السوق</h2></div><span>آخر قراءة · 30 يومًا</span></div>
        <div id="market-pulse" class="pulse-table"><div class="pulse-row pulse-head"><span>الأصل</span><span>آخر قراءة</span><span>30 يومًا</span><span>المشاهدة</span></div></div>
      </div>
      <aside class="terminal-panel terminal-panel--side">
        <span class="x-kicker">DECISION FRAME</span><h2>من هنا إلى القرار</h2>
        <div class="decision-item"><b>01</b><span>هل حافظت قيمة المال؟</span><a href="./map.html">قيمة فلوسي →</a></div>
        <div class="decision-item"><b>02</b><span>لماذا يتحرك السوق هكذا؟</span><a href="./macro.html">الاقتصاد →</a></div>
        <div class="decision-item"><b>03</b><span>أين يستحق التحقيق؟</span><a href="./categories.html">المناطق →</a></div>
        <div class="decision-item"><b>04</b><span>من يستحق الفحص؟</span><a href="./funds.html">الصناديق →</a></div>
      </aside>`;
    regime.insertAdjacentElement('afterend',wrap);

    const fmt=n=>n==null?'—':Number(n).toLocaleString('en-US',{maximumFractionDigits:2});
    const last=s=>s&&Array.isArray(s.rows)&&s.rows.length?s.rows[s.rows.length-1]:null;
    function change(rows,days){
      if(!rows||rows.length<2)return null;
      const latest=rows[rows.length-1], cut=new Date(latest.ts_date+'T00:00:00'); cut.setDate(cut.getDate()-days);
      for(let i=rows.length-2;i>=0;i--){const d=new Date(rows[i].ts_date+'T00:00:00'); if(d<=cut&&Number(rows[i].value)!==0)return (Number(latest.value)-Number(rows[i].value))/Number(rows[i].value)*100;}
      return null;
    }
    const signed=v=>v==null?'—':(v>0?'+':'')+fmt(v)+'%';
    async function load(){
      const pulse=document.getElementById('market-pulse'); if(!pulse)return;
      try{
        const keys=[['USD / EGP','usd_egp_mid'],['EGX30','egx30_close'],['Gold / EGP','gold_egp_oz'],['Inflation','cpi_headline_mom_pct'],['T-Bill 364d','tbill_364_avg_yield_pct'],['Silver / EGP','silver_egp_oz'],['S&P / EGP','spy_egp']];
        const series=await Promise.all(keys.map(x=>window.KHATER_DATA.macro.getSeries(x[1])));
        const rows=keys.map((k,i)=>{const s=series[i],l=last(s);return {label:k[0],value:l?.value,date:l?.ts_date,ch:change(s?.rows,30)};});
        rows.forEach(r=>{const el=document.createElement('div');el.className='pulse-row';el.innerHTML=`<span class="pulse-name">${r.label}</span><b>${fmt(r.value)}</b><strong class="${r.ch==null?'':r.ch>=0?'up':'dn'}">${signed(r.ch)}</strong><small>${r.date||'غير متاح'}</small>`;pulse.appendChild(el);});
        const clock=document.getElementById('terminal-clock'); if(clock)clock.textContent='LIVE · '+new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
        const status=document.getElementById('terminal-status'); if(status)status.textContent='LIVE DATA · '+rows.filter(r=>r.value!=null).length+'/'+rows.length+' مؤشرات';
      }catch(e){
        pulse.innerHTML+='<div class="terminal-empty">تعذر تحميل نبض السوق من طبقة البيانات المشتركة.</div>';
        console.error('[experience-v2]',e);
      }
    }
    load();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();