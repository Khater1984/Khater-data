/* Macro Intelligence layer: interpretation only; source data and derivations remain in macro-service.js. */
(function(window){
  'use strict';
  const svc=window.KHATER_DATA&&window.KHATER_DATA.macro;
  if(!svc) throw new Error('macro-intelligence.js requires macro-service.js');

  const latest=s=>{const r=s?.rows||[];return r.length?r[r.length-1]:null;};
  const previous=s=>{const r=s?.rows||[];return r.length>1?r[r.length-2]:null;};
  const delta=(a,b)=>a&&b&&Number.isFinite(a.value)&&Number.isFinite(b.value)?a.value-b.value:null;
  const pct=(a,b)=>a&&b&&b.value!==0?((a.value/b.value)-1)*100:null;

  function snapshot(data){
    const s=data.series;
    const get=k=>latest(s[k]);
    const d=(k)=>delta(get(k),previous(s[k]));
    const out={
      usd_egp:get('usd_egp_mid'),gold_egp:get('gold_egp_oz'),silver_egp:get('silver_egp_oz'),
      egx30:get('egx30_close'),spy_egp:get('spy_egp'),qqq_egp:get('qqq_egp'),btc_egp:get('btc_egp'),
      inflation:get('cpi_headline_mom_pct'),coreInflation:get('cpi_core_mom_pct'),
      deposit:get('bank_deposit_3_6m_avg_pct'),tbill91:get('tbill_91_avg_yield_pct'),tbill364:get('tbill_364_avg_yield_pct')
    };
    out.changes={usd_egp:d('usd_egp_mid'),gold_egp:d('gold_egp_oz'),silver_egp:d('silver_egp_oz'),egx30:d('egx30_close'),inflation:d('cpi_headline_mom_pct'),tbill91:d('tbill_91_avg_yield_pct')};
    return out;
  }

  function regime(s){
    const inflation=s.inflation?.value;
    const egx=s.egx30?.value, gold=s.gold_egp?.value, usd=s.usd_egp?.value;
    if(inflation!==null&&inflation!==undefined&&gold&&usd&&egx){
      if(inflation>1.5&&gold>0&&usd>0) return {key:'inflation-hedge',label:'Inflation / Hedge',tone:'warning',text:'السوق يحتاج قراءة العائد الاسمي بجانب أثر التضخم وسعر الصرف.'};
      if(egx>0&&gold>0) return {key:'risk-on-mixed',label:'Mixed Risk-On',tone:'positive',text:'الأصول المحلية والذهب تتحركان معًا؛ المقارنة تحتاج فصل مصدر العائد.'};
    }
    return {key:'neutral',label:'Neutral / Monitor',tone:'neutral',text:'لا توجد إشارة كافية لتسمية نظام سوقي قوي من السلاسل المتاحة.'};
  }

  function build(data){
    const s=snapshot(data),r=regime(s);
    return {asOf:Object.values(data.series).flatMap(x=>x.rows||[]).map(x=>x.ts_date).sort().pop()||null,regime:r,snapshot:s,signals:[
      {key:'inflation',title:'التضخم أولًا',value:s.inflation?.value,text:'العائد الاسمي لا يكفي وحده؛ يجب مقارنة القوة الشرائية.'},
      {key:'fx',title:'سعر الصرف',value:s.usd_egp?.value,text:'جزء من عائد الأصول المقومة بالجنيه قد يكون مرتبطًا بالـFX.'},
      {key:'rates',title:'العائد النقدي',value:s.tbill91?.value,text:'أذون الخزانة توفر مرجعًا مباشرًا لعائد منخفض المخاطر.'},
      {key:'market',title:'السوق المحلي',value:s.egx30?.value,text:'EGX30 هو مرجع مقارنة، وليس توصية شراء أو بيع.'}
    ]};
  }
  window.KHATER_DATA.macroIntelligence={snapshot,regime,build};
})(window);
