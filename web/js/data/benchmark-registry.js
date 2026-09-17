/* Canonical benchmark registry — labels, series semantics, and supported horizons live here. */
(function(window){
  'use strict';
  const list=Object.freeze([
    {key:'inflation',label:'التضخم',series:'cpi_headline_mom_pct',type:'inflation_compound',icon:'٪'},
    {key:'tbill',label:'أذون الخزانة',series:'tbill_364_avg_yield_pct',type:'yield_average',icon:'أذ'},
    {key:'deposits',label:'ودائع البنوك',series:'bank_deposit_1_3m_avg_pct',type:'yield_average',icon:'و'},
    {key:'usd',label:'الدولار',series:'usd_egp_mid',type:'price_return',icon:'$'},
    {key:'gold',label:'الذهب',series:'gold_egp_oz',type:'price_return',icon:'ذ'},
    {key:'silver',label:'الفضة',series:'silver_egp_oz',type:'price_return',icon:'ف'},
    {key:'egx30',label:'البورصة المصرية',series:'egx30_close',type:'price_return',icon:'م'},
    {key:'spy',label:'الأسهم الأمريكية',series:'spy_egp',type:'price_return',icon:'س'},
    {key:'qqq',label:'أسهم التكنولوجيا',series:'qqq_egp',type:'price_return',icon:'ت'},
    {key:'btc',label:'البيتكوين',series:'btc_egp',type:'price_return',icon:'ب'}
  ]);
  const byKey=Object.freeze(Object.fromEntries(list.map(x=>[x.key,x])));
  const keys=Object.freeze(list.map(x=>x.key));
  const horizons=Object.freeze(['weekly','4weeks','ytd','last12m','1y','2y','3y','4y','5y','6y']);
  function horizonStart(end,horizon){
    const d=new Date(String(end||'')+'T00:00:00Z');
    if(Number.isNaN(d.getTime())) return null;
    if(horizon==='weekly') d.setUTCDate(d.getUTCDate()-7);
    else if(horizon==='4weeks') d.setUTCDate(d.getUTCDate()-28);
    else if(horizon==='ytd') d.setUTCMonth(0,1);
    else if(/^\dy$/.test(horizon)) d.setUTCFullYear(d.getUTCFullYear()-Number(horizon[0]));
    else if(horizon==='last12m') d.setUTCFullYear(d.getUTCFullYear()-1);
    else return null;
    return d.toISOString().slice(0,10);
  }
  window.KHATER_DATA=window.KHATER_DATA||{};
  window.KHATER_DATA.benchmarkRegistry=Object.freeze({list,byKey,keys,horizons,horizonStart});
})(window);
