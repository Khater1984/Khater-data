/* VALUE OF WEALTH read model — the page asks for comparable wealth paths, not raw Supabase data. */
(function(window){
  'use strict';
  const macro=window.KHATER_DATA&&window.KHATER_DATA.macro;
  if(!macro) throw new Error('wealth-service.js requires macro-service.js');
  if(typeof macro.deriveSeries!=='function') throw new Error('wealth-service.js requires macro-service derivation helpers');

  const ASSETS=[
    ['usd_egp_mid','الدولار','سعر الصرف'],
    ['gold_egp_oz','الذهب','أونصة بالجنيه'],
    ['silver_egp_oz','الفضة','أونصة بالجنيه'],
    ['egx30_close','EGX30','المؤشر'],
    ['spy_egp','S&P 500','SPY بالجنيه'],
    ['qqq_egp','ناسداك 100','QQQ بالجنيه'],
    ['btc_egp','بيتكوين','BTC بالجنيه']
  ];
  const CASH=[['cpi_headline_mom_pct','القوة الشرائية للنقد','التضخم العام']];
  const RATES=[
    ['bank_deposit_1_3m_avg_pct','وديعة 1–3 أشهر','% سنوي'],
    ['bank_deposit_3_6m_avg_pct','وديعة 3–6 أشهر','% سنوي'],
    ['bank_deposit_6_12m_avg_pct','وديعة 6–12 شهر','% سنوي'],
    ['tbill_91_avg_yield_pct','أذون 91 يومًا','% سنوي'],
    ['tbill_364_avg_yield_pct','أذون 364 يومًا','% سنوي']
  ];
  const last=rows=>rows&&rows.length?rows[rows.length-1]:null;
  const normalize=rows=>macro.deriveSeries({rows:Array.isArray(rows)?rows:[]},'assets');
  const purchasing=rows=>macro.deriveSeries({rows:Array.isArray(rows)?rows:[]},'money');
  const rate=rows=>macro.deriveSeries({rows:Array.isArray(rows)?rows:[]},'rates');
  const change=(rows,days)=>{
    if(rows.length<2)return null;
    const latest=rows[rows.length-1],cut=new Date(latest.date+'T00:00:00');cut.setDate(cut.getDate()-days);
    for(let i=rows.length-2;i>=0;i--){const d=new Date(rows[i].date+'T00:00:00');if(d<=cut&&rows[i].value!==0)return(latest.value-rows[i].value)/rows[i].value*100;}
    return null;
  };
  async function read(defs,derive){
    return Promise.all(defs.map(async([key,label,unit])=>{
      const raw=await macro.getSeries(key);
      const rows=derive(raw.rows||[]);
      return{key,label,unit,rows,value:last(rows)?.value??null,date:last(rows)?.date??null,change30:change(rows,30),source:raw};
    }))
  }
  async function snapshot(){
    const [assets,money,rates]=await Promise.all([
      read(ASSETS,normalize),read(CASH,purchasing),read(RATES,rate)
    ]);
    const all=[...assets,...money,...rates];
    return{
      assets,money,rates,
      latestDate:all.map(x=>x.date).filter(Boolean).sort().pop()||null,
      coverage:{assets:assets.filter(x=>x.value!==null).length,totalAssets:assets.length},
      source:'Supabase via macro-service',
      methodology:{base:100,start:'أول نقطة متاحة لكل سلسلة',purchasing:'تراكم عكسي للتضخم الشهري المعلن'}
    };
  }
  window.KHATER_DATA.wealth={snapshot};
})(window);
