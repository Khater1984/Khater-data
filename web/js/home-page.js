/* Experience V2 — Now / Financial Intelligence Terminal.
 * UI orchestration only. Canonical financial values remain in domain services.
 */
(function(window){
  'use strict';
  const fmt=(n,d=2)=>n==null||!Number.isFinite(Number(n))?'—':Number(n).toLocaleString('en-US',{maximumFractionDigits:d});
  const last=s=>s&&Array.isArray(s.rows)&&s.rows.length?s.rows[s.rows.length-1]:null;
  const change=(rows,days=30)=>{
    if(!Array.isArray(rows)||rows.length<2)return null;
    const latest=rows[rows.length-1], lv=Number(latest.value);
    if(!Number.isFinite(lv))return null;
    const cutoff=new Date(latest.ts_date+'T00:00:00'); cutoff.setDate(cutoff.getDate()-days);
    for(let i=rows.length-1;i>=0;i--){
      const r=rows[i],v=Number(r.value),d=new Date(r.ts_date+'T00:00:00');
      if(d<=cutoff&&Number.isFinite(v)&&v!==0)return (lv-v)/v*100;
    }
    return null;
  };
  const signed=v=>v==null?'—':`${v>0?'+':''}${fmt(v)}%`;
  const tone=v=>v==null?'':v>0?'up':v<0?'dn':'';
  const defs=[
    ['USD / EGP','usd_egp_mid'],['EGX30','egx30_close'],['Gold / EGP','gold_egp_oz'],['Silver / EGP','silver_egp_oz'],['S&P 500 / EGP','spy_egp'],['NASDAQ 100 / EGP','qqq_egp'],['BTC / EGP','btc_egp']
  ];
  function derive(ch,infl,tbill){
    const {egx,gold,usd}=ch;
    if(egx==null||gold==null||usd==null)return ['السياق قيد الاكتمال','إشارة أو أكثر لم تصل بعد إلى طبقة البيانات المشتركة.'];
    if(gold>2&&usd>0)return ['تحوّط نقدي / ذهب حاضر في المشهد','ارتفاع الذهب مع تحرك الدولار يجعل حماية القوة الشرائية جزءًا مهمًا من القراءة قبل مقارنة الصناديق.'];
    if(tbill!=null&&infl!=null&&tbill>=infl)return ['العائد النقدي يفرض خط أساس مرتفعًا',`العائد النقدي (${fmt(tbill)}%) يتطلب من أي مخاطرة إضافية أن تقدم تفوقًا واضحًا.`];
    if(egx>0&&gold>0)return ['زخم متعدد الأصول مع عائد نقدي مهم','الأسهم والذهب يتحركان إيجابيًا؛ المقارنة مع خط الأساس النقدي أهم من مطاردة اتجاه واحد.'];
    return ['سوق متباين — المقارنة أهم من الاتجاه','لا يوجد اتجاه واحد يختصر المشهد؛ ننتقل من السياق إلى الفئة ثم إلى الصندوق.'];
  }
  function rowHtml(label,series){
    const r=last(series), c=change(series?.rows);
    return `<div class="pulse-row"><span class="pulse-name">${label}</span><b>${r?fmt(r.value):'—'}</b><strong class="${tone(c)}">${signed(c)}</strong><small>${r?.ts_date||'غير متاح'}</small></div>`;
  }
  async function render(){
    const pulse=document.getElementById('market-pulse'); if(!pulse)return;
    try{
      const series=await Promise.all(defs.map(async([label,key])=>{try{return [label,await window.KHATER_DATA.macro.getSeries(key)]}catch(e){return [label,null]}}));
      const extra=await Promise.all([
        window.KHATER_DATA.macro.getSeries('cpi_headline_mom_pct').catch(()=>null),
        window.KHATER_DATA.macro.getSeries('tbill_364_avg_yield_pct').catch(()=>null)
      ]);
      const infl=last(extra[0]),tbill=last(extra[1]);
      const map=Object.fromEntries(series.map(([label,s])=>[label,s]));
      const changes={usd:change(map['USD / EGP']?.rows),egx:change(map['EGX30']?.rows),gold:change(map['Gold / EGP']?.rows)};
      const [label,copy]=derive(changes,infl?.value,tbill?.value);
      document.getElementById('regime-title').textContent=label;
      document.getElementById('regime-copy').textContent=copy;
      const latest=series.map(([,s])=>last(s)?.ts_date).filter(Boolean).sort().pop()||'—';
      document.getElementById('terminal-stamp').textContent=`LAST OBSERVATION · ${latest}`;
      pulse.innerHTML='<div class="pulse-row pulse-head"><span>المؤشر</span><span>القيمة</span><span>30 يوم</span><span>المشاهدة</span></div>'+series.map(([l,s])=>rowHtml(l,s)).join('');
      const regimeDot=document.querySelector('.regime-dot');
      if(regimeDot)regimeDot.style.background=changes.gold>2&&changes.usd>0?'var(--t-gold)':'var(--t-green)';
    }catch(error){
      document.getElementById('regime-title').textContent='القراءة الحية غير متاحة الآن';
      document.getElementById('regime-copy').textContent='الخدمة لم تُرجع البيانات المطلوبة. لن نستبدلها بقيم fallback أو أرقام غير مؤرخة.';
      document.getElementById('terminal-stamp').textContent='DATA STATUS · INCOMPLETE';
      console.error('[home-v2-terminal]',error);
    }
  }
  window.KHATER_HOME={render};
  document.addEventListener('DOMContentLoaded',render,{once:true});
})(window);