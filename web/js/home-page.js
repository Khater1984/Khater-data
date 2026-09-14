/* Experience Architecture V1 — Home / Now hub.
 * Financial values remain owned by canonical domain services.
 */
(function(window){
  'use strict';
  const fmt=n=>Number(n).toLocaleString('en-US',{maximumFractionDigits:2});
  const last=s=>s&&Array.isArray(s.rows)&&s.rows.length?s.rows[s.rows.length-1]:null;
  const pctChange=(rows,period=30)=>{
    if(!rows||rows.length<2)return null;
    const latest=rows[rows.length-1];
    const cutoff=new Date(latest.ts_date+'T00:00:00'); cutoff.setDate(cutoff.getDate()-period);
    for(let i=rows.length-1;i>=0;i--){
      const d=new Date(rows[i].ts_date+'T00:00:00');
      if(d<=cutoff&&Number.isFinite(Number(rows[i].value))&&Number(rows[i].value)!==0)
        return (Number(latest.value)-Number(rows[i].value))/Number(rows[i].value)*100;
    }
    return null;
  };
  const signed=v=>v==null?'—':(v>0?'+':'')+fmt(v)+'%';
  const tone=v=>v==null?'':v>0?'up':'dn';

  function deriveRegime(changes,inflation,tbill){
    const {egx,gold,usd}=changes;
    if(egx==null||gold==null||usd==null)
      return {label:'قراءة السياق قيد الاكتمال',copy:'توجد إشارة أو أكثر لم تصل بعد إلى طبقة البيانات المشتركة.',cls:''};
    if(gold>2&&usd>0)
      return {label:'تحوّط نقدي / ذهب حاضر في المشهد',copy:'ارتفاع الذهب مع تحرك الدولار يجعل حماية القوة الشرائية جزءًا مهمًا من قراءة السوق قبل مقارنة الصناديق.',cls:'regime--caution'};
    if(egx>0&&gold>0&&(inflation==null||tbill==null||inflation<tbill))
      return {label:'زخم متعدد الأصول مع عائد نقدي مهم',copy:'الأسهم والذهب يتحركان إيجابيًا بينما يبقى العائد النقدي مرجعًا قويًا؛ التفوق الإضافي يحتاج مقارنة واضحة.',cls:'regime--positive'};
    if(tbill!=null&&inflation!=null&&tbill>=inflation)
      return {label:'العائد النقدي يفرض خط أساس مرتفعًا',copy:'أي مخاطرة إضافية تحتاج أن تُقاس مقابل العائد النقدي المتاح، لا مقابل الصفر.',cls:'regime--caution'};
    return {label:'سوق متباين — المقارنة أهم من الاتجاه الواحد',copy:'لا يوجد اتجاه واحد يختصر المشهد؛ لذلك ننتقل من السياق إلى الفئة ثم إلى الصندوق.',cls:''};
  }

  function setSignal(el,label,value,date,extra){
    el.querySelector('.x-signal__label').textContent=label;
    el.querySelector('.x-signal__value').textContent=value;
    el.querySelector('.x-signal__date').textContent=extra||date||'—';
  }

  async function render(){
    const signalBox=document.getElementById('market-signals');
    if(!signalBox)return;
    const obs=document.getElementById('home-observation');
    try{
      const [usdS,goldS,egxS,inflS,tbillS,universe]=await Promise.all([
        window.KHATER_DATA.macro.getSeries('usd_egp_mid'),
        window.KHATER_DATA.macro.getSeries('gold_egp_oz'),
        window.KHATER_DATA.macro.getSeries('egx30_close'),
        window.KHATER_DATA.macro.getSeries('cpi_headline_mom_pct'),
        window.KHATER_DATA.macro.getSeries('tbill_364_avg_yield_pct'),
        window.KHATER_DATA.funds.getUniverse()
      ]);
      const usd=last(usdS),gold=last(goldS),egx=last(egxS),infl=last(inflS),tbill=last(tbillS);
      const changes={usd:pctChange(usdS.rows),gold:pctChange(goldS.rows),egx:pctChange(egxS.rows)};
      const regime=deriveRegime(changes,infl?.value,tbill?.value);
      const dates=[usd?.ts_date,gold?.ts_date,egx?.ts_date].filter(Boolean).sort();
      const latestDate=dates[dates.length-1]||'—';
      document.getElementById('regime-title').textContent=regime.label;
      document.getElementById('regime-copy').textContent=regime.copy;
      document.getElementById('regime-title').className=regime.cls;
      document.getElementById('regime-stamp').textContent='آخر تحديث: '+latestDate;
      if(obs)obs.textContent='آخر مشاهدة فعلية: '+latestDate+' · قراءة تقريبية للأداء خلال 30 يومًا حيث تتوفر المقارنة.';
      const cards=signalBox.querySelectorAll('.x-signal');
      setSignal(cards[0],'USD / EGP',usd?fmt(usd.value):'—',usd?.ts_date,'30 يوم: '+signed(changes.usd));
      setSignal(cards[1],'EGX30',egx?fmt(egx.value):'—',egx?.ts_date,'30 يوم: '+signed(changes.egx));
      setSignal(cards[2],'Gold / EGP',gold?fmt(gold.value):'—',gold?.ts_date,'30 يوم: '+signed(changes.gold));
      const rate=tbill?.value,inflation=infl?.value;
      setSignal(cards[3],'T-Bill / Inflation',rate!=null?fmt(rate)+'%':'—',tbill?.ts_date,(rate!=null&&inflation!=null)?'أذون '+fmt(rate)+'% · تضخم '+fmt(inflation)+'%':'البيانات غير مكتملة');
      cards.forEach((card,i)=>{
        const val=card.querySelector('.x-signal__value');
        val.classList.remove('up','dn');
        if(i<3)val.classList.add(tone([changes.usd,changes.egx,changes.gold][i]));
      });
      const priced=Array.isArray(universe?.list)?universe.list.filter(x=>x.nav!=null).length:0;
      const bridge=document.querySelector('.x-bridge span');
      if(bridge)bridge.textContent=`${priced} صندوقًا مسعّرًا حاليًا · الفحص يبدأ من الأداء الرسمي ثم المرجع ثم الدليل.`;
    }catch(error){
      if(obs)obs.textContent='تعذر تحديث القراءة الحية الآن؛ لم نعرض رقمًا غير موثّق.';
      document.getElementById('regime-title').textContent='القراءة الحية غير متاحة الآن';
      document.getElementById('regime-copy').textContent='الخدمة لم تُرجع البيانات المطلوبة. لن نستبدلها بقيم fallback أو أرقام غير مؤرخة.';
      document.getElementById('regime-stamp').textContent='حالة البيانات: غير مكتملة';
      signalBox.innerHTML='<div class="empty" style="grid-column:1/-1">تعذر تحميل الإشارات الحية من طبقة البيانات المشتركة. أعد المحاولة لاحقًا بدل الاعتماد على رقم غير موثّق.</div>';
      console.error('[home-v1]',error);
    }
  }
  window.KHATER_HOME={render};
  document.addEventListener('DOMContentLoaded',render,{once:true});
})(window);
