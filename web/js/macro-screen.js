/* ECONOMIC INTELLIGENCE experience — rendering only; calculations stay in macro-service.js. */
(function(window,document){
'use strict';
const svc=window.KHATER_DATA&&window.KHATER_DATA.macro;if(!svc)throw new Error('macro-screen.js requires macro-service.js');
const $=id=>document.getElementById(id),fmt=(n,d=1)=>Number.isFinite(Number(n))?Number(n).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:d}):'—';
const esc=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\\':'&#39;'}[c]));
const theme=()=>window.KHATER_THEME||{};
let data=null,model=null;
function toChartRows(rows){return(Array.isArray(rows)?rows:[]).map(r=>({date:String(r.date||r.ts_date||'').slice(0,10),value:Number(r.value)})).filter(r=>/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&Number.isFinite(r.value));}
function pathPoints(rows,w,h,pad,minY,maxY){const xs=rows.map(r=>new Date(r.date).getTime()),minX=Math.min(...xs),maxX=Math.max(...xs),spanX=Math.max(1,maxX-minX),spanY=Math.max(1e-9,maxY-minY);return rows.map(r=>`${pad+(new Date(r.date).getTime()-minX)/spanX*(w-pad*2)},${h-pad-(r.value-minY)/spanY*(h-pad*2)}`).join(' ')}
function renderLineChart(hostId,seriesList){
 const host=$(hostId);if(!host)return;const usable=seriesList.map(s=>({label:s.label,rows:toChartRows(s.rows)})).filter(s=>s.rows.length);if(!usable.length){host.innerHTML='<div class="chart-empty">لا توجد بيانات متاحة للرسم.</div>';return;}
 const rows=usable.flatMap(s=>s.rows),w=1000,h=360,pad=38,ys=rows.map(r=>r.value).filter(Number.isFinite),minY=Math.min(...ys),maxY=Math.max(...ys),t=theme();
 if(!t.paletteAt||!t.color||!t.color.chartGrid)throw new Error('macro-screen.js requires platform-theme.js');
 const axis=t.color.chartGrid;
 host.innerHTML=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="رسم بياني اقتصادي"><line x1="${pad}" y1="${h-pad}" x2="${w-pad}" y2="${h-pad}" stroke="${axis}"/><line x1="${pad}" y1="${pad}" x2="${pad}" y2="${h-pad}" stroke="${axis}"/>${usable.map((s,i)=>`<polyline fill="none" stroke="${t.paletteAt(i)}" stroke-width="3" points="${pathPoints(s.rows,w,h,pad,minY,maxY)}"/>`).join('')}</svg><div class="chart-legend">${usable.map((s,i)=>`<span><i style="background:${t.paletteAt(i)}"></i>${esc(s.label)}</span>`).join('')}</div>`;
}
function renderHero(){
 const r=svc.readout(data),range=model.range;
 $('coverage').textContent=range;$('source').textContent='Supabase · public.macro_series';$('hero-date').textContent=range.split(' → ').at(-1)||'—';
 $('conflict-note').textContent=r.errors.length?`تعذر تحميل ${r.errors.length} سلسلة؛ تم عرض المتاح فقط.`:r.conflicts?`تم رصد ${r.conflicts} تعارضًا زمنيًا داخل طبقة البيانات`:'لا توجد تعارضات زمنية مرصودة';
 $('regime-title').textContent=r.realCashMargin==null?'البيانات المتاحة لا تكفي للمقارنة':'هامش العائد النقدي فوق التضخم المركب';
 $('regime-copy').textContent=r.realCashMargin==null?'لم يتم اختراع قراءة بديلة. راجع تشخيص السلاسل أدناه.':`التضخم المركب لآخر 12 شهرًا ${fmt(r.inflation12,1)}% مقابل ${fmt(r.latest.tb91?.value,2)}% لأذون 91 يومًا؛ الفارق الحسابي ${fmt(r.realCashMargin,1)} نقطة مئوية.`;
 $('metric-inflation').textContent=r.inflation12==null?'—':fmt(r.inflation12,1)+'%';$('metric-margin').textContent=r.realCashMargin==null?'—':fmt(r.realCashMargin,1)+' pp';$('metric-curve').textContent=r.rateCurve==null?'—':fmt(r.rateCurve,1)+' pp';$('metric-spread').textContent=r.depositBillSpread==null?'—':fmt(r.depositBillSpread,1)+' pp';
 $('metric-inflation-note').textContent=r.inflationTrend==null?'مقارنة سابقة غير مكتملة':`${r.inflationTrend>=0?'+':''}${fmt(r.inflationTrend,1)} pp مقابل الـ12 شهر السابقة`;
 $('metric-margin-note').textContent='أذون 91 يومًا − تضخم 12 شهرًا';$('metric-curve-note').textContent='أذون 364 يومًا − أذون 91 يومًا';$('metric-spread-note').textContent='أذون 91 يومًا − وديعة 6–12 شهر';
}
function renderRates(){renderLineChart('rates-chart',model.rates.map(s=>({label:s.label,rows:s.rows})));}
function renderInflation(){renderLineChart('inflation-chart',[{label:'التضخم العام',rows:model.inflation.headline},{label:'التضخم الأساسي',rows:model.inflation.core}]);}
function renderChanges(){const labels={usd_egp_mid:'الدولار',gold_egp_oz:'الذهب',egx30_close:'EGX30',spy_egp:'S&P 500'};const rows=model.transmission.filter(x=>x.change).map(x=>({label:labels[x.key]||x.label,value:x.change.value,date:x.change.date}));$('change-grid').innerHTML=rows.length?rows.map(x=>`<article class="change-item"><span>${esc(x.label)}</span><strong class="${x.value>=0?'up':'down'}">${x.value>=0?'+':''}${fmt(x.value,1)}%</strong><small>${esc(x.date||'—')}</small></article>`).join(''):'<div class="chart-empty">لا توجد تغيرات شهرية كافية لهذه السلاسل.</div>';}
function renderRateTable(){$('rate-table-body').innerHTML=model.rates.map(x=>`<tr><th>${esc(x.label)}</th><td class="num">${fmt(x.record?.value,2)}</td><td>${esc(x.record?.ts_date||'—')}</td></tr>`).join('');}
function renderDiagnostics(){const items=[['التضخم العام',model.completeness.inflation],['أذون 91 يومًا',model.completeness.tb91],['أذون 364 يومًا',model.completeness.tb364],['وديعة 6–12 شهر',model.completeness.deposit]];const host=$('data-diagnostics');if(!host)return;host.innerHTML=items.map(([label,count])=>`<span><strong>${esc(label)}</strong><b>${fmt(count,0)}</b> قراءة</span>`).join('')+(model.errors.length?`<small class="diagnostic-error">${model.errors.map(e=>`${esc(e.key)}: ${esc(e.error)}`).join(' · ')}</small>`:'');}
function renderMethod(){$('method-range').textContent=model.range;$('method-conflicts').textContent=model.conflicts.length?`تم الاحتفاظ بأول قيمة لكل تاريخ مع تسجيل ${model.conflicts.length} تعارضًا للمراجعة.`:'لم تُرصد تعارضات قيم على التاريخ نفسه.';renderDiagnostics();}
async function init(){try{data=await svc.getAll();model=data.readModel||svc.buildEconomicReadModel(data);window.__KHATER_MACRO_DATA={data,model};renderHero();renderRates();renderInflation();renderChanges();renderRateTable();renderMethod();}catch(e){console.error('[macro-screen]',e);$('macro-error').hidden=false;$('macro-error').textContent='تعذر قراءة البيانات الفعلية من طبقة البيانات: '+String(e?.message||e);}}
document.addEventListener('DOMContentLoaded',init);
})(window,document);
