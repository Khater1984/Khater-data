/* FUNDS RESPONSIVE UI
   Presentation/interaction layer only. Reads existing DOM; never calculates financial values. */
(function(){'use strict';
function boot(){
  const page=document.body,rail=document.querySelector('.control-rail'),table=document.querySelector('#rows');
  if(!page||!rail||!table)return;

  if(!document.querySelector('.funds-mobile-filter-backdrop')){
    const backdrop=document.createElement('div');
    backdrop.className='funds-mobile-filter-backdrop';
    backdrop.setAttribute('aria-hidden','true');
    document.body.appendChild(backdrop);
    backdrop.addEventListener('click',closeFilters);
  }
  if(!document.querySelector('.funds-mobile-filter-trigger')){
    const btn=document.createElement('button');
    btn.className='funds-mobile-filter-trigger';
    btn.type='button';
    btn.setAttribute('aria-label','فتح فلاتر الصناديق');
    btn.setAttribute('aria-expanded','false');
    btn.innerHTML='<span aria-hidden="true">☷</span><span>الفلاتر</span>';
    document.body.appendChild(btn);
    btn.addEventListener('click',()=>page.classList.contains('filters-open')?closeFilters():openFilters());
  }
  function openFilters(){page.classList.add('filters-open');const b=document.querySelector('.funds-mobile-filter-trigger');if(b)b.setAttribute('aria-expanded','true');}
  function closeFilters(){page.classList.remove('filters-open');const b=document.querySelector('.funds-mobile-filter-trigger');if(b)b.setAttribute('aria-expanded','false');}

  function wireRows(){
    table.querySelectorAll('tr').forEach(row=>{
      if(row.dataset.responsiveBound==='1')return;
      if(row.querySelector('.loading,.empty,.error-state'))return;
      row.dataset.responsiveBound='1';
      row.setAttribute('tabindex','0');
      row.setAttribute('aria-expanded','false');
      const toggle=()=>{
        if(window.matchMedia('(max-width: 640px)').matches){
          const open=row.classList.toggle('funds-row-expanded');
          row.setAttribute('aria-expanded',String(open));
        }
      };
      row.addEventListener('click',e=>{
        if(e.target.closest('a,input,button,select'))return;
        toggle();
      });
      row.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle();}});
    });
  }
  const observer=new MutationObserver(wireRows);
  observer.observe(table,{childList:true});
  wireRows();
  window.addEventListener('resize',()=>{if(window.innerWidth>640)closeFilters();});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
