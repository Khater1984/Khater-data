(function(){
  'use strict';
  const F=window.FUND;
  function service(){const s=window.KHATER_DATA&&window.KHATER_DATA.fund;if(!s)throw new Error('طبقة بيانات الصندوق غير متاحة');return s;}
  function row(item,ret,maxAbs){const v=item.o?.value!=null?Number(item.o.value):null,d=ret!=null&&v!=null?ret-v:null,pct=v==null?0:Math.max(3,Math.min(100,Math.abs(v)/Math.max(1,maxAbs)*100)),cls=v==null?'na':v>=0?'up':'down';return '<article class="bm-row '+cls+'"><div class="bm-name"><span class="bm-icon">'+item.b.icon+'</span><div><strong>'+F.esc(item.b.label)+'</strong><small>'+F.esc(item.o?(item.o.start+' → '+item.o.end):'لا توجد مشاهدة متاحة')+(item.o?.estimated?' · محسوب':'')+'</small></div></div><div class="bm-bar"><i style="width:'+pct+'%"></i></div><strong class="bm-value">'+F.pct(v)+'</strong><span class="bm-gap">'+(d==null?'—':(d>=0?'تفوق الصندوق ':'تقدم المؤشر ')+F.pct(Math.abs(d)))+'</span></article>'}
  async function render(){
    const host=document.getElementById('benchmark-tab');
    const S=service();
    let h=new URLSearchParams(location.search).get('h')||'last12m';
    if(!F.HS.includes(h))h='last12m';
    const sel=S.performanceSeries(F.performance||[],h),latest=sel[sel.length-1]||null,ret=latest?.return_pct!=null?Number(latest.return_pct):null,end=latest?.report_date||null;
    const B=S.BENCHMARKS||[];
    const out=end?await Promise.all(B.map(async b=>{try{return{b,o:await S.getBenchmark(b,end,h)}}catch(e){return{b,o:null}}})):B.map(b=>({b,o:null}));
    const valid=out.filter(x=>x.o?.value!=null),maxAbs=Math.max(1,...valid.map(x=>Math.abs(Number(x.o.value)))),wins=valid.filter(x=>ret!=null&&ret>=Number(x.o.value)).length,top=valid.slice().sort((a,b)=>Number(b.o.value)-Number(a.o.value))[0];
    host.innerHTML='<section class="bm-shell"><header class="bm-hero"><div><span class="bm-kicker">MARKET CONTEXT · '+F.esc(F.L[h]||h)+'</span><h2>أين يقف الصندوق أمام السوق؟</h2><p>مقارنة العائد خلال نفس الفترة مع التضخم، أدوات الدخل الثابت، والأسواق والأصول المرجعية.</p></div><div class="bm-fund-return"><small>عائد الصندوق</small><strong>'+F.pct(ret)+'</strong><span>'+F.esc(end||'لا يوجد تاريخ')+'</span></div></header><div class="bm-summary"><div><span>مقارنات متاحة</span><strong>'+valid.length+' / '+B.length+'</strong></div><div><span>تفوق على</span><strong class="bm-positive">'+wins+'</strong><small>من المؤشرات المتاحة</small></div><div><span>أعلى مرجع</span><strong>'+F.pct(top?.o?.value)+'</strong><small>'+F.esc(top?.b?.label||'غير متاح')+'</small></div><div><span>قراءة الفترة</span><strong class="'+(ret==null?'':'bm-positive')+'">'+(ret==null?'—':(ret>=0?'إيجابية':'سالبة'))+'</strong><small>'+F.esc(F.L[h]||h)+'</small></div></div><div class="bm-head"><div><h3>لوحة المقارنة</h3><span>القيمة = عائد المرجع · الشريط = الحجم النسبي · التفوق = عائد الصندوق ناقص المرجع</span></div><span class="bm-legend"><i class="up"></i>موجب <i class="down"></i>سالب</span></div><div class="bm-list">'+out.map(x=>row(x,ret,maxAbs)).join('')+'</div><footer class="bm-note">تستخدم المقارنة المشاهدات الفعلية المتاحة في قاعدة البيانات. عبارة «محسوب» تعني أن المرجع احتُسب من السلسلة المتاحة، ولا تعني أنه عائد رسمي منشور.</footer></section>';
  }
  window.FUND_TABS=window.FUND_TABS||{};window.FUND_TABS.benchmark=render;
})();
