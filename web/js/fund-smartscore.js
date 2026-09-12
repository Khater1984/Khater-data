(function(){
  'use strict';
  const F=window.FUND;
  function esc(v){return F.esc(v)}
  function pct(v){return v==null||!Number.isFinite(Number(v))?'غير متاح':F.num(v)+'%'}
  function render(){
    const s=F.score||{}, c=s.smartscore_components||{}, status=F.scoreMethodology||{};
    const items=[
      ['P','Performance','الأداء',c.performance,30],
      ['R','Risk','المخاطر',c.risk,25],
      ['B','Benchmark','تحقيق المرجع',c.benchmark,25],
      ['I','Inflation','الحماية من التضخم',c.inflation,10],
      ['C','Consistency','الاتساق',c.consistency,10]
    ];
    const statusClass=status.matches?'ok':'warn';
    const statusText=status.matches?'متوافق مع المنهجية النشطة V3.0':'التقييم المحفوظ لا يحمل إصدار V3.0';
    document.getElementById('smartscore-tab').innerHTML=
      '<div class="score-contract '+statusClass+'">'+
        '<div><b>SMARTSCORE V3.0</b><span>'+esc(statusText)+'</span></div>'+
        '<small>الأوزان: P 30% · R 25% · B 25% · I 10% · C 10%</small>'+ 
      '</div>'+ 
      '<div class="score-grid">'+items.map(function(x){
        const value=x[3];
        return '<div class="card score-card">'+
          '<div class="score-head"><b>'+x[0]+'</b><span>'+x[4]+'%</span></div>'+ 
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
        '<span>Methodology · '+esc(s.methodology_version||'غير متاح')+'</span>'+ 
        '<span>Data Quality · '+esc(s.data_quality||'غير متاح')+'</span>'+ 
      '</div>'+ 
      '<div class="score-note">'+esc(status.reason||'')+'</div>';
  }
  window.FUND_TABS=window.FUND_TABS||{};
  window.FUND_TABS.smartscore=render;
})();
