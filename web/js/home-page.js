/* NOW experience controller — consumes the NOW read model only. */
(function(window){
  'use strict';
  const now=window.KHATER_DATA&&window.KHATER_DATA.now;
  if(!now) throw new Error('home-page.js requires now-service.js');

  const defs={
    'Gold / EGP':'hedge',
    'USD / EGP':'system',
    'EGX30':'equity'
  };
  const fmt=(n,d=2)=>n==null||!Number.isFinite(Number(n))?'—':Number(n).toLocaleString('en-US',{maximumFractionDigits:d});
  const tone=v=>v==null?'':v>0?'up':v<0?'dn':'flat';
  const signed=v=>v==null?'—':`${v>0?'+':''}${fmt(v)}%`;
  const href=g=>g==='equity'?'./categories.html':g==='hedge'?'./map.html':'./macro.html';
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};

  function signal(r){
    return `<a class="signal-card ${r.group}" href="${href(r.group)}"><div class="signal-meta"><span>${r.label}</span><em>${r.date||'—'}</em></div><div class="signal-main"><strong>${fmt(r.value)}</strong><span class="signal-change ${tone(r.change30)}">${signed(r.change30)} <small>30 يوم</small></span></div><div class="signal-chart trend-slot" data-label="${r.label}"></div></a>`;
  }

  function row(r){
    const dir=r.change30==null?'flat':r.change30>0?'up':r.change30<0?'dn':'flat';
    return `<div class="pulse-row" data-value="${r.value??''}" data-change="${r.change30??''}" data-index="${r.index}" data-direction="${dir}" data-label="${r.label}"><span class="pulse-name"><i class="pulse-group ${r.group}"></i>${r.label}</span><b>${fmt(r.value)}</b><strong class="${tone(r.change30)}">${signed(r.change30)}</strong><small>${r.date||'—'}</small><span class="trend-slot" data-label="${r.label}"></span></div>`;
  }

  let currentSort='change-desc',currentFilter='all';

  function ensureChrome(host){
    let toolbar=host.querySelector('.market-toolbar'),status=host.querySelector('.market-status'),empty=host.querySelector('.market-empty');
    if(!toolbar){
      toolbar=document.createElement('div');toolbar.className='market-toolbar';toolbar.setAttribute('role','toolbar');toolbar.setAttribute('aria-label','ترتيب وتصفية صورة السوق');
      toolbar.innerHTML='<div class="market-toolbar-group"><span class="market-toolbar-label">رتّب</span><button type="button" class="market-sort" data-sort="change-desc">الأعلى %</button><button type="button" class="market-sort" data-sort="change-asc">الأدنى %</button><button type="button" class="market-sort" data-sort="default">الأساسي</button><button type="button" class="market-sort" data-sort="name">الاسم</button></div><div class="market-toolbar-group"><span class="market-toolbar-label">عرض</span><button type="button" class="market-filter" data-filter="all">الكل</button><button type="button" class="market-filter" data-filter="up">صاعد</button><button type="button" class="market-filter" data-filter="dn">هابط</button></div>';
      host.insertBefore(toolbar,host.firstChild);toolbar.addEventListener('click',onToolbarClick);
    }
    if(!status){status=document.createElement('div');status.className='market-status';status.setAttribute('aria-live','polite');const head=host.querySelector('.pulse-head');if(head)host.insertBefore(status,head);else host.appendChild(status);}
    if(!empty){empty=document.createElement('div');empty.className='market-empty';empty.hidden=true;empty.innerHTML='<p>لا توجد مؤشرات تطابق العرض الحالي.</p><button type="button" class="market-empty-reset" data-filter="all">عرض الكل</button>';host.appendChild(empty);empty.addEventListener('click',e=>{if(e.target.closest('[data-filter]')){currentFilter='all';applyView();}});}
    syncActive(toolbar);return{toolbar,status,empty};
  }

  function syncActive(t){
    if(!t)return;
    t.querySelectorAll('[data-sort]').forEach(x=>{x.classList.toggle('active',x.dataset.sort===currentSort);x.setAttribute('aria-pressed',x.dataset.sort===currentSort?'true':'false');});
    t.querySelectorAll('[data-filter]').forEach(x=>{x.classList.toggle('active',x.dataset.filter===currentFilter);x.setAttribute('aria-pressed',x.dataset.filter===currentFilter?'true':'false');});
  }

  function onToolbarClick(e){
    const b=e.target.closest('button');if(!b)return;e.preventDefault();
    if(b.dataset.filter)currentFilter=b.dataset.filter;else if(b.dataset.sort)currentSort=b.dataset.sort;else return;
    applyView();
  }

  function applyView(){
    const host=document.getElementById('market-pulse');if(!host)return;
    const {toolbar,status,empty}=ensureChrome(host),rows=[...host.querySelectorAll('.pulse-row:not(.pulse-head)')];
    rows.forEach(r=>{r.hidden=!(currentFilter==='all'||(r.dataset.direction||'flat')===currentFilter);});
    const visible=rows.filter(r=>!r.hidden);
    visible.sort((a,b)=>{
      if(currentSort==='name')return(a.dataset.label||'').localeCompare(b.dataset.label||'','ar');
      if(currentSort==='default')return Number(a.dataset.index)-Number(b.dataset.index);
      const ac=num(a.dataset.change),bc=num(b.dataset.change);if(ac==null&&bc==null)return Number(a.dataset.index)-Number(b.dataset.index);if(ac==null)return 1;if(bc==null)return-1;
      return currentSort==='change-desc'?bc-ac:ac-bc;
    });
    visible.forEach(r=>host.insertBefore(r,empty));rows.filter(r=>r.hidden).forEach(r=>host.insertBefore(r,empty));
    const total=rows.length,shown=visible.length;
    if(status)status.textContent=total?`عرض ${shown} من ${total} · ${currentFilter==='all'?'الكل':currentFilter==='up'?'صاعد فقط':'هابط فقط'} · ${{'change-desc':'حسب أعلى تغيّر 30 يوم','change-asc':'حسب أدنى تغيّر 30 يوم','default':'الترتيب الأساسي','name':'حسب الاسم'}[currentSort]||''}`:'لا بيانات مرجعية متاحة حاليًا';
    if(empty)empty.hidden=!(total>0&&shown===0);syncActive(toolbar);
  }

  function derive(snapshot){
    const byLabel=Object.fromEntries(snapshot.series.map(r=>[r.label,r]));
    const ch={usd:byLabel['USD / EGP']?.change30,egx:byLabel['EGX30']?.change30,gold:byLabel['Gold / EGP']?.change30};
    const infl=snapshot.references?.inflation,tbill=snapshot.references?.tbill364;
    if(ch.egx==null||ch.gold==null||ch.usd==null)return['السياق قيد الاكتمال','تصل بعض الإشارات المرجعية متأخرة؛ ستظهر القراءة عند اكتمالها.'];
    if(ch.gold>2&&ch.usd>0)return['الذهب والدولار يقودان التحوّط','ارتفاع الذهب مع تحرّك الدولار يرفع أهمية حماية القوة الشرائية قبل مقارنة أداء الصناديق.'];
    if(tbill!=null&&infl!=null&&tbill>=infl)return['العائد النقدي يفرض خط أساس مرتفعًا',`العائد النقدي (${fmt(tbill)}%) يرفع معيار التفوق المطلوب من أي مخاطرة إضافية.`];
    if(ch.egx>0&&ch.gold>0)return['زخم متعدد الأصول مع خط أساس نقدي مهم','الأسهم والذهب يتحركان إيجابيًا؛ المقارنة مع العائد النقدي أهم من مطاردة اتجاه واحد.'];
    return['سوق متباين — المقارنة أهم من الاتجاه','لا يوجد اتجاه واحد يختصر المشهد؛ المقارنة بين الأصول هي القراءة الأهم.'];
  }

  async function render(){
    try{
      const snapshot=await now.snapshot();
      const d=derive(snapshot);
      const a=document.getElementById('regime-title'),b=document.getElementById('regime-copy'),m=document.getElementById('meaning-copy'),st=document.getElementById('terminal-stamp');
      if(a)a.textContent=d[0];if(b)b.textContent=d[1];if(m)m.textContent=d[1];if(st)st.textContent=`آخر قراءة · ${snapshot.latestDate||'—'}`;
      const leaders=document.getElementById('market-leaders');
      if(leaders)leaders.innerHTML=snapshot.series.filter(r=>defs[r.label]&&r.value!=null).map(r=>signal(r)).join('');
      const pulse=document.getElementById('market-pulse');
      if(pulse){pulse.innerHTML='<div class="pulse-row pulse-head"><span>المؤشر</span><span>القيمة</span><span>30 يوم</span><span>التاريخ</span><span>الاتجاه</span></div>'+snapshot.series.map(row).join('');currentSort='change-desc';currentFilter='all';applyView();}
      if(window.KHATER_CHARTS?.boot)window.KHATER_CHARTS.boot(snapshot.series);
    }catch(e){
      console.error('[now-experience]',e);const pulse=document.getElementById('market-pulse');if(pulse)pulse.innerHTML='<div class="market-error">تعذّر تحديث مرجع السوق. أعد المحاولة لاحقًا.</div>';
    }
  }

  window.KHATER_HOME=window.KHATER_HOME||{};
  window.KHATER_HOME.render=render;window.KHATER_HOME.applyView=applyView;window.KHATER_HOME_V4={render,applyView};
  document.addEventListener('DOMContentLoaded',()=>setTimeout(render,30),{once:true});
})(window);
