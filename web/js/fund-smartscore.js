(function(){
  'use strict';
  const F=window.FUND;
  function esc(v){return F.esc(v)}
  function pct(v){return v==null||!Number.isFinite(Number(v))?'غير متاح':F.num(v)+'%'}
  function weight(v){if(v==null||!Number.isFinite(Number(v)))return'غير متاح';return F.num(Number(v)*100,0)+'%'}
  function render(){
    const s=F.score||{}, c=s.smartscore_components||{}, e=F.evidence||{}, w=e.effective_weights||{};
    const items=[
      ['P','Performance','الأداء',c.performance,w.performance],
      ['R','Risk','المخاطر',c.risk,w.risk],
      ['B','Benchmark','تحقيق المرجع',c.benchmark,w.benchmark],
      ['I','Inflation','الحماية من التضخم',c.inflation,w.inflation],
      ['C','Consistency','الاتساق',c.consistency,w.consistency]
    ];
    const version=s.methodology_version||e.methodology_version||'غير متاح';
    const weightsAvailable=items.every(x=>x[4]!=null&&Number.isFinite(Number(x[4])));
    const statusClass=version!=='غير متاح'?'ok':'warn';
    const statusText=version!=='غير متاح'?'الإصدار المحفوظ للتقييم: '+version:'إصدار المنهجية غير متاح في التقييم المحفوظ';
    document.getElementById('smartscore-tab').innerHTML=
      '<div class="score-contract '+statusClass+'">'+
        '<div><b>SMARTSCORE · '+esc(version)+'</b><span>'+esc(statusText)+'</span></div>'+ 
        '<small>الأوزان المحفوظة '+(weightsAvailable?'متاحة من سجل التقييم':'غير متاحة من سجل التقييم')+'</small>'+ 
      '</div>'+ 
      '<div class="score-grid">'+items.map(function(x){
        const value=x[3];
        return '<div class="card score-card">'+
          '<div class="score-head"><b>'+x[0]+'</b><span>'+weight(x[4])+'</span></div>'+ 
          '<div class="score-name">'+x[1]+'<br>'+x[2]+'</div>'+ 
          '<strong>'+pct(value)+'</strong>'+ 
          (value!=null?'<div class="meter"><i style="width:'+Math.max(0,Math.min(100,Number(value)))+'%"></i></div>':'')+
        '</div>';
      }).join('')+'</div>'+ 
      '<div class="score-meta">'+
        '<span>Raw Score · '+F.num(s.raw_score)+'</span>'+ 
        '<span>Final Score · '+F.num(s.final_score)+'</span>'+ 
        '<span>Rating · '+esc(s.rating||'غير متاح')+'</span>'+ 
        '<span>Track Factor · '+F.num(s.track_factor)+'</span>'+ 
        '<span>Data Quality · '+esc(s.data_quality||'غير متاح')+'</span>'+ 
      '</div>'+ 
      '<div class="score-note">'+esc((e.score_explanation||'')+' '+(e.component_availability?'المكونات المتاحة محفوظة ضمن سجل التقييم.':''))+'</div>';
  }
  window.FUND_TABS=window.FUND_TABS||{};
  window.FUND_TABS.smartscore=render;
})();
