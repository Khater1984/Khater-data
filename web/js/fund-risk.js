(function(){'use strict';
const F=window.FUND;
function has(v){return v!=null&&String(v).trim()!==''}
function num(v){return has(v)&&Number.isFinite(Number(v))?F.num(v):'غير متاح'}
function riskMethodLabel(v){
  if(v==='dispersion_proxy')return 'مؤشر تشتّت العوائد';
  return has(v)?v:'غير متاح';
}
function render(){
  const s=F.score||{};
  const ci=s.calculation_inputs||{};
  const rawScore=has(s.risk_score)?Number(s.risk_score):null;
  const metric=has(ci.risk_metric)?Number(ci.risk_metric):null;
  const obs=has(ci.volatility_obs_count)?Number(ci.volatility_obs_count):null;
  const unavailable=(rawScore===0&&metric==null);
  const scoreShown=unavailable?'غير متاح':(rawScore==null?'غير متاح':F.num(rawScore));
  const scoreCaption=unavailable?'لا توجد درجة مخاطر قابلة للتفسير لهذا التقييم المحفوظ.':'درجة ترتيب المخاطر داخل مجموعة المقارنة.';
  const method=riskMethodLabel(s.risk_method||ci.risk_method);
  const metricShown=metric!=null&&Number.isFinite(metric)?F.num(metric):'غير متاح';
  const obsShown=obs!=null&&Number.isFinite(obs)?F.num(obs):'غير متاح';
  let status, statusClass;
  if(unavailable){status='غير قابل للتقييم حالياً';statusClass='warn'}
  else if(rawScore!=null){status='تقييم متاح';statusClass='ok'}
  else if(metric!=null){status='المؤشر متاح · الدرجة غير متاحة';statusClass='warn'}
  else{status='بيانات المخاطر غير متاحة';statusClass='warn'}
  const host=document.getElementById('risk-tab');
  host.innerHTML='<div class="risk-shell">'
    +'<section class="risk-hero">'
      +'<div class="risk-hero-copy">'
        +'<span class="risk-kicker">RISK DNA · RISK ASSESSMENT</span>'
        +'<h3>كيف يتم تقييم مخاطر هذا الصندوق؟</h3>'
        +'<p>'+(s.risk_method==='dispersion_proxy'?'عند عدم توفر سجل NAV يومي كافٍ، يعتمد المحرك على مؤشر تشتّت العوائد كبديل احترازي.':'الواجهة تعرض منهج المخاطر المحفوظ في تقييم SmartScore ولا تعيد حسابه.')+'</p>'
        +'<span class="risk-status '+statusClass+'">'+status+'</span>'
      +'</div>'
      +'<div class="risk-score-box">'
        +'<span>RISK SCORE</span>'
        +'<strong>'+scoreShown+'</strong>'
        +'<small>'+scoreCaption+'</small>'
      +'</div>'
    +'</section>'
    +'<section class="risk-cards">'
      +'<article class="risk-info-card"><span class="risk-card-kicker">METHOD</span><h4>'+F.esc(method)+'</h4><p>'+(s.risk_method==='dispersion_proxy'?'مقياس بديل لتقييم تشتّت العوائد عندما لا تتوفر بيانات NAV اليومية الكافية.':'المنهج المحفوظ من محرك التقييم.')+'</p></article>'
      +'<article class="risk-info-card"><span class="risk-card-kicker">RISK METRIC</span><h4>'+metricShown+'</h4><p>'+(metric!=null?'قيمة المؤشر المحفوظة في سجل التقييم.':'لا توجد قيمة Risk Metric محفوظة لهذا التقييم.')+'</p></article>'
      +'<article class="risk-info-card"><span class="risk-card-kicker">OBSERVATIONS</span><h4>'+obsShown+'</h4><p>عدد مشاهدات NAV اليومية المستخدمة لهذا المسار، عند توفرها في سجل التقييم.</p></article>'
      +'</section>'
    +'<section class="risk-details">'
      +'<div class="risk-details-head"><div><span class="risk-kicker">ASSESSMENT CONTEXT</span><h3>سياق تقييم المخاطر</h3></div><span class="risk-tier">'+F.esc(s.data_tier||'غير متاح')+'</span></div>'
      +'<div class="risk-facts">'
        +'<div><span>مجموعة المقارنة</span><b>'+num(ci.tier_cohort_size)+'</b><small>Tier cohort</small></div>'
        +'<div><span>مجموعة الفئة</span><b>'+num(ci.category_cohort_size)+'</b><small>Category cohort</small></div>'
        +'<div><span>طريقة التقييم</span><b>'+F.esc(method)+'</b><small>Saved methodology</small></div>'
        +'<div><span>تاريخ التقييم</span><b>'+F.esc(s.score_as_of||'غير متاح')+'</b><small>Score as of</small></div>'
      +'</div>'
    +'</section>'
    +'<section class="risk-note-panel">'
      +'<div class="risk-note-icon">i</div>'
      +'<div><strong>حدود القراءة</strong><p>هذه الصفحة لا تستنتج درجة جديدة من العوائد. عندما لا تكون مكونات المخاطر اللازمة محفوظة، تظهر النتيجة كـ «غير متاح» بدلاً من تفسير الصفر على أنه مستوى مخاطرة حقيقي.</p></div>'
    +'</section>'
  +'</div>';
}
window.FUND_TABS=window.FUND_TABS||{};window.FUND_TABS.risk=render;
})();