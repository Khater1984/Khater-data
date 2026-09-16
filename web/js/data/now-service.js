/* NOW experience read model — the page asks for a market snapshot, not raw Supabase data. */
(function(window){
  'use strict';
  const macro=window.KHATER_DATA&&window.KHATER_DATA.macro;
  if(!macro) throw new Error('now-service.js requires macro-service.js');

  const SERIES=[
    ['USD / EGP','usd_egp_mid','system'],
    ['EGX30','egx30_close','equity'],
    ['Gold / EGP','gold_egp_oz','hedge'],
    ['Silver / EGP','silver_egp_oz','hedge'],
    ['S&P 500 / EGP','spy_egp','global'],
    ['NASDAQ 100 / EGP','qqq_egp','global'],
    ['BTC / EGP','btc_egp','risk']
  ];

  const last=series=>series&&Array.isArray(series.rows)&&series.rows.length?series.rows[series.rows.length-1]:null;
  const change=(rows,days=30)=>{
    if(!Array.isArray(rows)||rows.length<2)return null;
    const latest=rows[rows.length-1],lv=Number(latest.value);
    if(!Number.isFinite(lv))return null;
    const cutoff=new Date(latest.ts_date+'T00:00:00');
    cutoff.setDate(cutoff.getDate()-days);
    for(let i=rows.length-1;i>=0;i--){
      const r=rows[i],v=Number(r.value),d=new Date(r.ts_date+'T00:00:00');
      if(d<=cutoff&&Number.isFinite(v)&&v!==0)return(lv-v)/v*100;
    }
    return null;
  };

  async function snapshot(){
    const items=await Promise.all(SERIES.map(async([label,key,group],index)=>{
      let series=null;
      try{series=await macro.getSeries(key);}catch(error){console.warn('[now-service]',key,error);}
      const latest=last(series);
      return {label,key,group,index,series,value:latest?.value??null,date:latest?.ts_date??null,change30:change(series?.rows)};
    }));

    const [inflation,tbill]=await Promise.all([
      macro.getSeries('cpi_headline_mom_pct').catch(()=>null),
      macro.getSeries('tbill_364_avg_yield_pct').catch(()=>null)
    ]);

    return {
      series:items,
      references:{
        inflation:last(inflation)?.value??null,
        tbill364:last(tbill)?.value??null
      },
      latestDate:items.map(x=>x.date).filter(Boolean).sort().pop()||null,
      source:'Supabase via macro-service'
    };
  }

  window.KHATER_DATA.now={snapshot};
})(window);
