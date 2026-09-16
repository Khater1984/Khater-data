/* NOW experience controller — renders only from the NOW read model. */
(function(window,document){
  'use strict';
  const data=window.KHATER_DATA&&window.KHATER_DATA.now;
  if(!data) throw new Error('now-page.js requires now-service.js');

  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\\':'&#39;'}[c]));
  const fmt=(value,digits=2)=>{
    const n=Number(value);
    return Number.isFinite(n)?n.toLocaleString('en-US',{maximumFractionDigits:digits}):'—';
  };
  const pct=value=>{
    const n=Number(value);
    if(!Number.isFinite(n))return '—';
    return `${n>0?'+':''}${n.toFixed(2)}%`;
  };
  const direction=value=>{
    const n=Number(value);
    return Number.isFinite(n)?(n>0?'up':n<0?'down':'flat'):'flat';
  };
  const date=value=>value?new Date(`${value}T00:00:00`).toLocaleDateString('ar-EG',{year:'numeric',month:'short',day:'numeric'}):'غير متاح';
  const groupLabel={system:'نظام نقدي',equity:'سوق محلي',hedge:'أصول تحوط',global:'أسواق عالمية',risk:'أصل عالي التقلب'};

  function render(snapshot){
    const items=snapshot.series||[];
    const available=items.filter(x=>x.value!==null).length;
    const latest=snapshot.latestDate?date(snapshot.latestDate):'غير متاح';

    $('now-stamp').textContent=`آخر مشاهدة · ${latest}`;
    $('now-coverage').textContent=`${available} من ${items.length} مراجع متاحة`;
    $('now-regime-title').textContent=available===items.length?'صورة مرجعية مكتملة':'الصورة الحالية بها مراجع متاحة وأخرى غير متاحة';
    $('now-regime-copy').textContent='هذه الصفحة لا تصدر حكمًا استثماريًا؛ تعرض آخر مشاهدات السلاسل الفعلية، وتُظهر تاريخ كل قراءة بدل تعويض البيانات الناقصة.';

    $('now-cards').innerHTML=items.map(item=>{
      const dir=direction(item.change30);
      const changeText=item.change30===null?'لا توجد مقارنة 30 يومًا':pct(item.change30)+' خلال نحو 30 يومًا';
      return `<article class="surface now-card">
        <div class="card-top"><span class="card-label">${esc(item.label)}</span><span class="card-group">${esc(groupLabel[item.group]||item.group||'مرجع')}</span></div>
        <div class="card-value">${item.value===null?'—':fmt(item.value)}</div>
        <div class="card-change ${dir}">${esc(changeText)}</div>
        <div class="card-date">آخر مشاهدة: ${esc(date(item.date))}</div>
      </article>`;
    }).join('');

    $('now-table-body').innerHTML=items.map(item=>{
      const available=item.value!==null;
      return `<tr><td>${esc(item.label)}</td><td class="num">${available?fmt(item.value):'—'}</td><td>${esc(date(item.date))}</td><td class="availability ${available?'up':'flat'}">${available?'متاح':'غير متاح'}</td></tr>`;
    }).join('');

    $('now-inflation').textContent=snapshot.references?.inflation===null?'—':fmt(snapshot.references.inflation)+'%';
    $('now-tbill').textContent=snapshot.references?.tbill364===null?'—':fmt(snapshot.references.tbill364)+'%';
    $('now-foot').textContent=`المصدر: ${snapshot.source||'Supabase عبر طبقة البيانات'} · آخر تاريخ ظاهر في المراجع: ${latest}`;
  }

  function fail(error){
    console.error('[now-page]',error);
    $('now-regime-title').textContent='تعذر تحميل لقطة السوق';
    $('now-regime-copy').textContent='لم تُستبدل البيانات الفعلية بأرقام افتراضية. راجع الاتصال أو مصدر البيانات ثم أعد المحاولة.';
    $('now-cards').innerHTML='<div class="now-error">تعذر قراءة البيانات الحالية من طبقة البيانات.</div>';
  }

  document.addEventListener('DOMContentLoaded',async()=>{
    try{ render(await data.snapshot()); }
    catch(error){ fail(error); }
  });
})(window,document);
