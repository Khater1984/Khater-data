/* Now / Market Intelligence Brief — single dynamic renderer. */
(function(window){'use strict';
const defs=[['Gold / EGP','gold_egp_oz','hedge'],['USD / EGP','usd_egp_mid','system'],['EGX30','egx30_close','equity']];
const allDefs=[['USD / EGP','usd_egp_mid','system'],['EGX30','egx30_close','equity'],['Gold / EGP','gold_egp_oz','hedge'],['Silver / EGP','silver_egp_oz','hedge'],['S&P 500 / EGP','spy_egp','global'],['NASDAQ 100 / EGP','qqq_egp','global'],['BTC / EGP','btc_egp','risk']];
const fmt=(n,d=2)=>n==null||!Number.isFinite(Number(n))?'—':Number(n).toLocaleString('en-US',{maximumFractionDigits:d});
const last=s=>s&&Array.isArray(s.rows)&&s.rows.length?s.rows[s.rows.length-1]:null;
const change=(rows,days=30)=>{if(!Array.isArray(rows)||rows.length<2)return null;const latest=rows[rows.length-1],lv=Number(latest.value);if(!Number.isFinite(lv))return null;const cutoff=new Date(latest.ts_date+'T00:00:00');cutoff.setDate(cutoff.getDate()-days);for(let i=rows.length-1;i>=0;i--){const r=rows[i],v=Number(r.value),d=new Date(r.ts_date+'T00:00:00');if(d<=cutoff&&Number.isFinite(v)&&v!==0)return(lv-v)/v*100}return null};
const tone=v=>v==null?'':v>0?'up':v<0?'dn':'flat';
const signed=v=>v==null?'—':`${v>0?'+':''}${fmt(v)}%`;
const href=group=>group==='equity'?'./categories.html':group==='hedge'?'./map.html':'./macro.html';
const numAttr=v=>{const n=Number(v);return Number.isFinite(n)?n:null};

function signal(r){
  const c=change(r.series?.rows);
  return `<a class="signal-card ${r.group}" href="${href(r.group)}"><div class="signal-meta"><span>${r.label}</span><em>${r.date||'—'}</em></div><div class="signal-main"><strong>${fmt(r.value)}</strong><span class="signal-change ${tone(c)}">${signed(c)} <small>30 يوم</small></span></div><div class="signal-chart trend-slot" data-label="${r.label}"></div></a>`;
}

function row(r){
  const c=change(r.series?.rows);
  const dir=c==null?'flat':(c>0?'up':c<0?'dn':'flat');
  const changeAttr=c==null?'':String(c);
  const valueAttr=r.value==null?'':String(r.value);
  return `<div class="pulse-row" data-value="${valueAttr}" data-change="${changeAttr}" data-index="${r.index}" data-direction="${dir}" data-label="${r.label}"><span class="pulse-name"><i class="pulse-group ${r.group}"></i>${r.label}</span><b>${fmt(r.value)}</b><strong class="${tone(c)}">${signed(c)}</strong><small>${r.date||'—'}</small><span class="trend-slot" data-label="${r.label}"></span></div>`;
}

let currentSort='change-desc';
let currentFilter='all';

function ensureChrome(host){
  let toolbar=host.querySelector('.market-toolbar');
  let status=host.querySelector('.market-status');
  let empty=host.querySelector('.market-empty');
  if(!toolbar){
    toolbar=document.createElement('div');
    toolbar.className='market-toolbar';
    toolbar.setAttribute('role','toolbar');
    toolbar.setAttribute('aria-label','ترتيب وتصفية صورة السوق');
    toolbar.innerHTML=[
      '<div class="market-toolbar-group">',
      '<span class="market-toolbar-label">رتّب</span>',
      '<button type="button" class="market-sort" data-sort="change-desc">الأعلى %</button>',
      '<button type="button" class="market-sort" data-sort="change-asc">الأدنى %</button>',
      '<button type="button" class="market-sort" data-sort="default">الأساسي</button>',
      '<button type="button" class="market-sort" data-sort="name">الاسم</button>',
      '</div>',
      '<div class="market-toolbar-group">',
      '<span class="market-toolbar-label">عرض</span>',
      '<button type="button" class="market-filter" data-filter="all">الكل</button>',
      '<button type="button" class="market-filter" data-filter="up">صاعد</button>',
      '<button type="button" class="market-filter" data-filter="dn">هابط</button>',
      '</div>'
    ].join('');
    host.insertBefore(toolbar, host.firstChild);
    toolbar.addEventListener('click', onToolbarClick);
  }
  if(!status){
    status=document.createElement('div');
    status.className='market-status';
    status.setAttribute('aria-live','polite');
    const head=host.querySelector('.pulse-head');
    if(head) host.insertBefore(status, head);
    else host.appendChild(status);
  }
  if(!empty){
    empty=document.createElement('div');
    empty.className='market-empty';
    empty.hidden=true;
    empty.innerHTML='<p>لا توجد مؤشرات تطابق العرض الحالي.</p><button type="button" class="market-empty-reset" data-filter="all">عرض الكل</button>';
    host.appendChild(empty);
    empty.addEventListener('click', e=>{
      const b=e.target.closest('[data-filter]');
      if(!b) return;
      currentFilter=b.dataset.filter||'all';
      applyView();
    });
  }
  syncActiveButtons(toolbar);
  return {toolbar, status, empty};
}

function syncActiveButtons(toolbar){
  if(!toolbar) return;
  toolbar.querySelectorAll('[data-sort]').forEach(x=>{
    x.classList.toggle('active', x.dataset.sort===currentSort);
    x.setAttribute('aria-pressed', x.dataset.sort===currentSort?'true':'false');
  });
  toolbar.querySelectorAll('[data-filter]').forEach(x=>{
    x.classList.toggle('active', x.dataset.filter===currentFilter);
    x.setAttribute('aria-pressed', x.dataset.filter===currentFilter?'true':'false');
  });
}

function onToolbarClick(e){
  const b=e.target.closest('button');
  if(!b) return;
  e.preventDefault();
  if(b.dataset.filter){
    currentFilter=b.dataset.filter;
  } else if(b.dataset.sort){
    currentSort=b.dataset.sort;
  } else {
    return;
  }
  applyView();
}

function applyView(){
  const host=document.getElementById('market-pulse');
  if(!host) return;
  const {toolbar, status, empty}=ensureChrome(host);
  const rows=[...host.querySelectorAll('.pulse-row:not(.pulse-head)')];

  rows.forEach(row=>{
    const dir=row.dataset.direction||'flat';
    const show=currentFilter==='all' || dir===currentFilter;
    row.hidden=!show;
  });

  const visible=rows.filter(r=>!r.hidden);
  const sorter=(a,b)=>{
    if(currentSort==='change-desc' || currentSort==='change-asc'){
      const ac=numAttr(a.dataset.change);
      const bc=numAttr(b.dataset.change);
      if(ac==null && bc==null) return Number(a.dataset.index)-Number(b.dataset.index);
      if(ac==null) return 1;
      if(bc==null) return -1;
      return currentSort==='change-desc' ? (bc-ac) : (ac-bc);
    }
    if(currentSort==='name'){
      return (a.dataset.label||'').localeCompare(b.dataset.label||'','en');
    }
    return Number(a.dataset.index)-Number(b.dataset.index);
  };
  visible.sort(sorter);

  const anchor=empty;
  visible.forEach(r=>host.insertBefore(r, anchor));
  rows.filter(r=>r.hidden).forEach(r=>host.insertBefore(r, anchor));

  const total=rows.length;
  const shown=visible.length;
  const filterLabel=currentFilter==='all'?'الكل':currentFilter==='up'?'صاعد فقط':'هابط فقط';
  const sortLabel={
    'change-desc':'حسب أعلى تغيّر 30 يوم',
    'change-asc':'حسب أدنى تغيّر 30 يوم',
    'default':'الترتيب الأساسي',
    'name':'حسب الاسم'
  }[currentSort]||'';

  if(status){
    status.textContent = total===0
      ? 'لا بيانات مرجعية متاحة حاليًا'
      : `عرض ${shown} من ${total} · ${filterLabel} · ${sortLabel}`;
  }
  if(empty){
    empty.hidden = !(total>0 && shown===0);
  }
  syncActiveButtons(toolbar);
}

function controls(){
  const host=document.getElementById('market-pulse');
  if(!host) return;
  ensureChrome(host);
  applyView();
}

function derive(ch,infl,tbill){
  if(ch.egx==null||ch.gold==null||ch.usd==null)return['السياق قيد الاكتمال','تصل بعض الإشارات المرجعية متأخرة؛ ستظهر القراءة بمجرد اكتمالها.'];
  if(ch.gold>2&&ch.usd>0)return['الذهب والدولار يقودان التحوّط','ارتفاع الذهب مع تحرّك الدولار يرفع أهمية حماية القوة الشرائية قبل مقارنة أداء الصناديق.'];
  if(tbill!=null&&infl!=null&&tbill>=infl)return['العائد النقدي يفرض خط أساس مرتفعًا',`العائد النقدي (${fmt(tbill)}%) يرفع معيار التفوق المطلوب من أي مخاطرة إضافية.`];
  if(ch.egx>0&&ch.gold>0)return['زخم متعدد الأصول مع خط أساس نقدي مهم','الأسهم والذهب يتحركان إيجابيًا؛ المقارنة مع العائد النقدي أهم من مطاردة اتجاه واحد.'];
  return['سوق متباين — المقارنة أهم من الاتجاه','لا يوجد اتجاه واحد يختصر المشهد؛ المقارنة بين الأصول هي القراءة الأهم.'];
}

async function render(){
  try{
    const series=await Promise.all(allDefs.map(async([label,key,group],index)=>{
      let s=null;
      try{s=await window.KHATER_DATA.macro.getSeries(key)}catch(e){}
      const l=last(s);
      return{label,key,group,index,series:s,value:l?.value??null,date:l?.ts_date??null};
    }));
    const map=Object.fromEntries(series.map(r=>[r.label,r]));
    const ch={
      usd:change(map['USD / EGP'].series?.rows),
      egx:change(map['EGX30'].series?.rows),
      gold:change(map['Gold / EGP'].series?.rows)
    };
    const [infl,tbill]=await Promise.all([
      window.KHATER_DATA.macro.getSeries('cpi_headline_mom_pct').catch(()=>null),
      window.KHATER_DATA.macro.getSeries('tbill_364_avg_yield_pct').catch(()=>null)
    ]).then(x=>x.map(last));
    const d=derive(ch,infl?.value,tbill?.value);

    const regimeTitle=document.getElementById('regime-title');
    const regimeCopy=document.getElementById('regime-copy');
    const meaningCopy=document.getElementById('meaning-copy');
    const stamp=document.getElementById('terminal-stamp');
    if(regimeTitle) regimeTitle.textContent=d[0];
    if(regimeCopy) regimeCopy.textContent=d[1];
    if(meaningCopy) meaningCopy.textContent=`${d[1]} اختر مسار التحقيق المناسب بدلًا من الحكم على السوق من مؤشر واحد.`;
    const latest=series.map(r=>r.date).filter(Boolean).sort().pop()||'—';
    if(stamp) stamp.textContent=`آخر قراءة · ${latest}`;

    const leaders=document.getElementById('market-leaders');
    if(leaders){
      leaders.innerHTML=defs.map(([label])=>map[label]).filter(r=>r&&r.value!=null).map(signal).join('');
    }

    const pulse=document.getElementById('market-pulse');
    if(pulse){
      pulse.innerHTML='<div class="pulse-row pulse-head"><span>المؤشر</span><span>القيمة</span><span>30 يوم</span><span>التاريخ</span><span>الاتجاه</span></div>'+series.map(row).join('');
      currentSort='change-desc';
      currentFilter='all';
      controls();
    }

    if(window.KHATER_CHARTS?.boot) setTimeout(()=>window.KHATER_CHARTS.boot(),20);
  }catch(e){
    console.error('[now-brief]',e);
    const pulse=document.getElementById('market-pulse');
    if(pulse){
      pulse.innerHTML='<div class="market-error">تعذّر تحديث مرجع السوق. أعد المحاولة لاحقًا.</div>';
    }
  }
}

window.KHATER_HOME_V4={render, applyView};
document.addEventListener('DOMContentLoaded',()=>setTimeout(render,30),{once:true});
})(window);
