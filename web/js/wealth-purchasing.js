const fmt=(n,d=1)=>n==null||!Number.isFinite(Number(n))?'—':Number(n).toLocaleString('ar-EG',{maximumFractionDigits:d});
const esc=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\\':'&#39;'}[c]));

function yearlyPower(rows){
  const sorted=(rows||[]).filter(r=>Number.isFinite(Number(r.value))).slice().sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
  const out=[];
  for(const r of sorted){
    const year=String(r.date).slice(0,4);
    const last=out[out.length-1];
    if(!last||last.year!==year) out.push({year,value:Number(r.value),date:r.date});
    else {last.value=Number(r.value);last.date=r.date;}
  }
  return out.filter(x=>x.year>='2016');
}

export function mountPurchasingPower(root,snapshot){
  if(!root)return;
  const rows=snapshot?.money?.[0]?.rows||[];
  const points=yearlyPower(rows);
  const latest=points.at(-1);
  const loss=latest?100-latest.value:null;
  root.innerHTML=`<section class="wealth-purchasing" aria-labelledby="purchasing-title">
    <div class="pp-head">
      <div><div class="section-kicker">PURCHASING POWER · 2016—2026</div><h2 id="purchasing-title">القوة الشرائية وسجل أداء الأصول في مصر</h2><p>ماذا بقي من 100 جنيه؟ الخط يوضح تآكل القوة الشرائية للنقد عبر الزمن، محسوبًا من السلسلة الفعلية التي وصلت من طبقة البيانات.</p></div>
      <div class="pp-latest"><span>آخر قراءة</span><strong>${latest?fmt(latest.value):'—'} <small>جنيه</small></strong><em>${latest?`تآكل ${fmt(loss)}% منذ البداية`:'غير متاح'}</em></div>
    </div>
    <div class="pp-chart-shell"><div id="pp-chart" role="img" aria-label="القوة الشرائية لمئة جنيه من 2016 إلى 2026"></div></div>
    <div class="pp-timeline" aria-label="القيم السنوية"></div>
    <div class="pp-note"><span>100 جنيه = نقطة البداية</span><span>القيمة المعروضة هي القوة الشرائية المتبقية، وليست رصيدًا نقديًا فعليًا.</span><span>المصدر: Supabase · طبقة البيانات الموحدة</span></div>
  </section>`;
  const chartEl=root.querySelector('#pp-chart');
  const timeline=root.querySelector('.pp-timeline');
  timeline.innerHTML=points.map((p,i)=>`<button type="button" class="pp-year ${i===points.length-1?'is-current':''}" data-year="${p.year}"><span>${esc(p.year)}</span><strong>${fmt(p.value)} <small>ج.م</small></strong><em>تآكل ${fmt(100-p.value)}%</em></button>`).join('');
  if(!window.LightweightCharts||!chartEl||!points.length)return;
  const chart=LightweightCharts.createChart(chartEl,{height:360,layout:window.KHATER_THEME?.chartLayout?.()||{background:{color:'#fff'},textColor:'#607477'},grid:window.KHATER_THEME?.chartGrid?.()||{vertLines:{color:'#f1f5f4'},horzLines:{color:'#e4ecea'}},rightPriceScale:{borderColor:'#d9e2e1'},timeScale:{borderColor:'#d9e2e1'},handleScroll:false,handleScale:false});
  const series=chart.addLineSeries({color:window.KHATER_THEME?.series?.cpi_headline_mom_pct||'#087f63',lineWidth:3,title:'القوة الشرائية'});
  series.setData(points.map(p=>({time:`${p.year}-12-31`,value:p.value})));
  chart.priceScale('right').applyOptions({scaleMargins:{top:.12,bottom:.14}});
  chart.timeScale().fitContent();
  new ResizeObserver(()=>chart.applyOptions({width:chartEl.clientWidth,height:360})).observe(chartEl);
  timeline.addEventListener('click',e=>{
    const button=e.target.closest('.pp-year');
    if(!button)return;
    const point=points.find(p=>p.year===button.dataset.year);
    if(!point)return;
    timeline.querySelectorAll('.pp-year').forEach(x=>x.classList.toggle('is-current',x===button));
    chart.timeScale().setVisibleRange({from:`${point.year}-01-01`,to:`${point.year}-12-31`});
  });
}
