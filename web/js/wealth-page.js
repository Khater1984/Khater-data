import { mountPurchasingAccordion } from "./accordion.js";

const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\\':'&#39;'}[c]));
const fmt=(n,d=1)=>Number.isFinite(Number(n))?Number(n).toLocaleString('ar-EG',{maximumFractionDigits:d}):'—';
const LABELS={usd_egp_mid:'الدولار',gold_egp_oz:'الذهب',silver_egp_oz:'الفضة',egx30_close:'EGX30',spy_egp:'S&P 500',qqq_egp:'ناسداك 100',btc_egp:'بيتكوين'};
const COLORS=window.KHATER_THEME?.series||{};
let snapshot=null,chart=null,lines={};
const state={group:'value',range:'all'};

function visible(row){
  if(state.range==='all')return true;
  const years=state.range==='5'?5:2;
  const latest=snapshot?.latestDate||new Date().toISOString().slice(0,10);
  const end=new Date(`${latest}T00:00:00`);
  const start=new Date(end);start.setFullYear(start.getFullYear()-years);
  return new Date(row.date+'T00:00:00')>=start;
}
function lineColor(key){return COLORS[key]||'#087f63';}
function render(){
  if(!snapshot||!chart)return;
  Object.values(lines).forEach(s=>chart.removeSeries(s));lines={};
  const rows=state.group==='value'?snapshot.assets:state.group==='money'?snapshot.money:snapshot.rates;
  rows.forEach(item=>{
    const data=(item.rows||[]).filter(visible).map(r=>({time:r.date,value:r.value}));
    if(!data.length)return;
    const series=chart.addLineSeries({color:lineColor(item.key),lineWidth:2,title:item.label});
    series.setData(data);lines[item.key]=series;
  });
  chart.timeScale().fitContent();
}
function renderLegend(){
  const root=$('assetLegend');if(!root)return;
  const rows=state.group==='value'?snapshot.assets:state.group==='money'?snapshot.money:snapshot.rates;
  root.innerHTML=rows.map(item=>`<span class="legend-item"><i style="background:${esc(lineColor(item.key))}"></i>${esc(item.label)} · ${fmt(item.value)}</span>`).join('');
}
function setupChart(){
  const el=$('chart');
  chart=LightweightCharts.createChart(el,{layout:window.KHATER_THEME?.chartLayout?.()||{background:{color:'#fff'},textColor:'#607477'},grid:window.KHATER_THEME?.chartGrid?.()||{vertLines:{color:'#f8fafb'},horzLines:{color:'#f8fafb'}},rightPriceScale:{borderColor:'#d9e2e1'},timeScale:{borderColor:'#d9e2e1'}});
  new ResizeObserver(()=>chart.applyOptions({width:el.clientWidth,height:440})).observe(el);
  chart.subscribeCrosshairMove(param=>{
    const tip=$('tip');if(!tip)return;
    if(!param.time){tip.style.display='none';return;}
    const values=Object.entries(lines).map(([key,s])=>{const v=param.seriesData.get(s);return v?`<div>${esc(LABELS[key]||s.options().title||key)}: <b>${fmt(v.value)}</b></div>`:''}).join('');
    tip.innerHTML=`<div class="muted">${esc(param.time)}</div>${values}`;tip.style.display='block';
  });
}
function wire(){
  document.querySelectorAll('.seg button').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.seg button').forEach(x=>x.classList.remove('on'));document.querySelectorAll('.seg button').forEach(x=>x.setAttribute('aria-selected','false'));b.classList.add('on');b.setAttribute('aria-selected','true');state.group=b.dataset.g;render();renderLegend();}));
  document.querySelectorAll('.ranges button').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.ranges button').forEach(x=>x.classList.remove('on'));document.querySelectorAll('.ranges button').forEach(x=>x.setAttribute('aria-selected','false'));b.classList.add('on');b.setAttribute('aria-selected','true');state.range=b.dataset.r;render();}));
}
function status(){
  const dates=[...snapshot.assets,...snapshot.money,...snapshot.rates].map(x=>x.date).filter(Boolean).sort();
  $('wealth-stamp')?.replaceChildren(document.createTextNode(`آخر مشاهدة · ${dates.at(-1)||'غير متاح'}`));
  $('wealth-coverage')?.replaceChildren(document.createTextNode(`${snapshot.coverage.assets} من ${snapshot.coverage.totalAssets} أصول متاحة`));
}
window.addEventListener('DOMContentLoaded',async()=>{
  try{
    snapshot=await window.KHATER_DATA.wealth.snapshot();
    setupChart();wire();status();render();renderLegend();
    mountPurchasingAccordion($('pp-root'),snapshot);
    const cash=snapshot.money?.[0]?.value;
    if(cash!=null)$('pound').textContent=`القوة الشرائية للمؤشر النقدي تبدأ من 100 وتتحرك مع التضخم الشهري الفعلي الموجود في قاعدة البيانات. آخر قراءة: ${fmt(cash)}.`;
  }catch(error){
    console.error('[wealth-page]',error);
    $('investment-title').textContent='تعذر تحميل قيمة الثروة';
    $('chart').innerHTML='<div class="error-state">تعذر قراءة البيانات الفعلية من طبقة البيانات. لا توجد أرقام بديلة.</div>';
  }
});
