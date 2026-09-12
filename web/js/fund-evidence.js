(function(){'use strict';
const F=window.FUND;
function esc(v){return F.esc(v)}
function has(v){return v!==null&&v!==undefined&&String(v).trim()!==''}
function n(v){return has(v)&&Number.isFinite(Number(v))?Number(v):null}
function num(v,d=2){const x=n(v);return x===null?'غير متاح':x.toLocaleString('en-US',{maximumFractionDigits:d})}
function pct(v){const x=n(v);return x===null?'غير متاح':(x>=0?'+':'')+num(x)+'%'}
function weight(v){const x=n(v);return x===null?'غير متاح':num(x*100,0)+'%'}
function metricCard(letter,name,score,w){const s=n(score);return '<article class="ev-component"><div class="ev-component-top"><span class="ev-letter">'+esc(letter)+'</span><div><b>'+esc(name)+'</b><small>وزن المكوّن · '+weight(w)+'</small></div></div><strong class="ev-score">'+(s===null?'غير متاح':num(s,1))+'</strong><div class="ev-meter"><i style="width:'+(s===null?0:Math.max(0,Math.min(100,s)))+'%"></i></div></article>'}
function evidenceItem(label,value,sub){return '<div class="ev-item"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong>'+(sub?'<small>'+esc(sub)+'</small>':'')+'</div>'}
window.FUND_TABS=window.FUND_TABS||{};
window.FUND_TABS.evidence=async function(){
 const host=document.getElementById('evidence-tab');
 try{
  const e=F.evidence;
  if(!e){host.innerHTML='<div class="empty">لا يوجد تقييم محفوظ لهذا الصندوق في قاعدة البيانات.</div>';return}
  const ci=e.calculation_inputs||{},w=e.effective_weights||{},av=e.component_availability||{},warnings=Array.isArray(e.warnings)?e.warnings:Object.values(e.warnings||{});
  const available=['performance','risk','benchmark','consistency','inflation'].filter(k=>av[k]===true).length;
  const rank=n(e.qualified_rank),pool=n(e.peer_cohort_size);
  const explanation=has(e.score_explanation)?String(e.score_explanation):'لا يوجد شرح محفوظ.';
  host.innerHTML='<div class="ev-shell">'+
   '<section class="ev-verdict"><div class="ev-verdict-kicker">EVIDENCE · WHY THIS SCORE</div><div class="ev-verdict-main"><div><h3>لماذا حصل الصندوق على هذه النتيجة؟</h3><p>'+esc(explanation)+'</p></div><div class="ev-final"><span>FINAL SCORE</span><strong>'+num(e.final_score,1)+'</strong><small>'+esc(e.rating||'NOT RATED')+'</small></div></div><div class="ev-meta"><span>التقييم بتاريخ '+esc(e.report_date)+'</span><span>'+esc(e.methodology_version)+'</span><span>جودة البيانات · '+esc(e.data_quality)+'</span><span>الثقة · '+esc(e.data_confidence)+'</span></div></section>'+ 
   '<section class="ev-section"><div class="ev-section-head"><div><span class="ev-kicker">SCORE DRIVERS</span><h3>مكوّنات SmartScore</h3></div><span class="ev-count">'+available+'/5 مكوّنات متاحة</span></div><div class="ev-components">'+metricCard('P','Performance',e.performance_score,w.performance)+metricCard('R','Risk',e.risk_score,w.risk)+metricCard('B','Benchmark',e.benchmark_score,w.benchmark)+metricCard('C','Consistency',e.consistency_score,w.consistency)+metricCard('I','Inflation / Safe Alternative',e.inflation_score,w.inflation)+'</div></section>'+ 
   '<section class="ev-section"><div class="ev-section-head"><div><span class="ev-kicker">CONTEXT</span><h3>الأدلة التي استخدمها التقييم</h3></div></div><div class="ev-context">'+evidenceItem('الترتيب المؤهل',rank===null?'غير متاح':String(rank)+(pool===null?'':' من '+pool),'داخل مجموعة المقارنة المستخدمة في التقييم')+evidenceItem('العائد المستخدم للأداء',pct(ci.perf_return),'المدخل المحفوظ داخل التقييم')+evidenceItem('العائد السابق 12 شهراً',pct(ci.prev_last12m),'مدخل محفوظ لدعم قياس الاتساق')+evidenceItem('المرجع الأساسي',pct(ci.primary_bench_return),'العائد المرجعي المحفوظ في evaluation')+evidenceItem('المرجع الثانوي',pct(ci.secondary_bench_return),'عند توفره في مدخلات التقييم')+evidenceItem('البديل الآمن',pct(ci.safe_yield_12m),'القيمة المحفوظة في مدخلات التقييم')+evidenceItem('التضخم المتتالي',pct(ci.trailing_cpi_12m),'القيمة المحفوظة في مدخلات التقييم')+evidenceItem('طريقة قياس المخاطر',ci.risk_method||'غير متاح','محفوظة بواسطة محرك التقييم')+evidenceItem('نوع مجموعة الترتيب',ci.ranking_pool||'غير متاح',ci.tier_cohort_size==null?'':'حجم مجموعة Tier · '+num(ci.tier_cohort_size,0))+'</div></section>'+ 
   '<section class="ev-section"><div class="ev-section-head"><div><span class="ev-kicker">METHODOLOGY</span><h3>نزاهة حساب الدرجة</h3></div></div><div class="ev-checks">'+evidenceItem('الإصدار',e.methodology_version,'الإصدار المحفوظ للتقييم')+evidenceItem('طبقة البيانات',e.data_tier,'المستوى المحفوظ للصندوق عند التقييم')+evidenceItem('عامل المسار',n(e.track_factor)===null?'غير متاح':num(e.track_factor,2),'يُستخدم في الانتقال من Raw Score إلى Final Score')+evidenceItem('حالة التأهل',e.qualification_status||'غير متاح','الحالة المحفوظة في evaluation')+evidenceItem('المكوّنات المتاحة',available+' / 5','القيمة مأخوذة من component_availability')+evidenceItem('إعادة تطبيع الأوزان',ci.weights_renormalized===true?'نعم':ci.weights_renormalized===false?'لا':'غير متاح','محفوظة في calculation_inputs')+'</div></section>'+ 
   '<section class="ev-section ev-warnings"><div class="ev-section-head"><div><span class="ev-kicker">WARNINGS</span><h3>تحذيرات التقييم</h3></div></div>'+(warnings.length?'<div class="ev-warning-list">'+warnings.map(x=>'<div>'+esc(typeof x==='string'?x:(x&&x.message)||JSON.stringify(x))+'</div>').join('')+'</div>':'<div class="ev-clear">لا توجد تحذيرات محفوظة لهذا التقييم.</div>')+'</section>'+ 
   '<p class="ev-note">هذه الصفحة تعرض Evidence المحفوظ من طبقة البيانات الموحدة. لا تعيد الواجهة حساب الدرجة ولا تصل مباشرة إلى جداول Supabase.</p></div>';
 }catch(err){host.innerHTML='<div class="empty">تعذر تحميل Evidence المحفوظ من طبقة البيانات: '+esc(err.message)+'</div>'}
};})();
