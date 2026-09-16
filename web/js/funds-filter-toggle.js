/* Funds benchmark filter disclosure — compact two rows by default, expandable on demand. */
(function(window, document){
  'use strict';
  function bind(){
    var list=document.getElementById('bench');
    var button=document.getElementById('benchMore');
    if(!list || !button || button.dataset.bound==='true') return;
    button.dataset.bound='true';
    function sync(){
      var overflowing=list.scrollHeight>list.clientHeight+2;
      button.hidden=!overflowing && !list.classList.contains('is-expanded');
      button.textContent=list.classList.contains('is-expanded')?'إظهار أقل':'إظهار المزيد';
      button.setAttribute('aria-expanded',String(list.classList.contains('is-expanded')));
    }
    button.addEventListener('click',function(){
      var expanded=list.classList.toggle('is-expanded');
      button.textContent=expanded?'إظهار أقل':'إظهار المزيد';
      button.setAttribute('aria-expanded',String(expanded));
      if(!expanded) list.scrollTop=0;
      sync();
    });
    new ResizeObserver(sync).observe(list);
    new MutationObserver(function(){sync()}).observe(list,{childList:true,subtree:true});
    sync();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind,{once:true});
  else bind();
  new MutationObserver(bind).observe(document.documentElement,{childList:true,subtree:true});
})(window,document);
