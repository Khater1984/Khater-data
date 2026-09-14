/* Market Intelligence mini-trends — lightweight, data-bound SVG renderer.
 * TradingView remains available for full interactive charts elsewhere; Home mini-trends
 * deliberately use SVG so there is no attribution/watermark inside tiny cards.
 */
(function(window){'use strict';
const COLORS={up:'#0b8f67',down:'#d13f3f',flat:'#71808d',fillUp:'rgba(11,143,103,.12)',fillDown:'rgba(209,63,63,.12)'};
const defs=[['USD / EGP','usd_egp_mid'],['EGX30','egx30_close'],['Gold / EGP','gold_egp_oz'],['Silver / EGP','silver_egp_oz'],['S&P 500 / EGP','spy_egp'],['NASDAQ 100 / EGP','qqq_egp'],['BTC / EGP','btc_egp']];
const seriesMap={};
function renderOne(el,rows){
  if(!Array.isArray(rows)||rows.length<2)return;
  const values=rows.map(r=>({d:r.ts_date,v:Number(r.value)})).filter(x=>x.d&&Number.isFinite(x.v)).slice(-45);
  if(values.length<2)return;
  const first=values[0].v,last=values[values.length-1].v,delta=last-first;
  const color=delta>0?COLORS.up:delta<0?COLORS.down:COLORS.flat;
  const fill=delta>0?COLORS.fillUp:delta<0?COLORS.fillDown:'rgba(113,128,141,.10)';
  const min=Math.min(...values.map(x=>x.v)),max=Math.max(...values.map(x=>x.v)),range=max-min||1;
  const w=240,h=48,p=2;
  const pts=values.map((x,i)=>{const px=p+(i/(values.length-1))*(w-p*2);const py=h-p-((x.v-min)/range)*(h-p*2);return [px,py]});
  const line=pts.map(p=>p.join(',')).join(' ');
  const area=`${p},${h-p} ${line} ${w-p},${h-p}`;
  el.replaceChildren();
  el.classList.add('trend-rendered');
  el.setAttribute('aria-label',`${el.dataset.label||'المؤشر'} اتجاه ${delta>=0?'صاعد':'هابط'}`);
  el.innerHTML=`<svg class="mini-trend" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" focusable="false" aria-hidden="true"><polygon points="${area}" fill="${fill}"/><polyline points="${line}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
}
async function boot(){
  if(!window.KHATER_DATA?.macro)return;
  await Promise.all(defs.map(async([label,key])=>{try{seriesMap[label]=await window.KHATER_DATA.macro.getSeries(key)}catch(e){seriesMap[label]=null}}));
  document.querySelectorAll('.trend-slot[data-label]').forEach(el=>{const s=seriesMap[el.dataset.label];if(s)renderOne(el,s.rows)});
}
window.KHATER_CHARTS={boot,renderOne};
document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,80),{once:true});
})(window);
