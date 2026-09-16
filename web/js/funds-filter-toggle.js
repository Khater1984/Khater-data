/* Funds benchmark filter disclosure — compact two rows by default, expandable on demand. */
(function(window, document){
  'use strict';
  function bind(){
    var list=document.getElementById('bench');
    var button=document.getElementById('benchMore');
    if(!list || !button || button.dataset.bound==='true') return;
    button.dataset.bound='true';

    function sync(){
      var expanded=list.classList.contains('is-expanded');
      var overflowing=list.scrollHeight>list.clientHeight+2;
      button.hidden=!expanded && !overflowing;
      button.textContent=expanded?'إظهار أقل':'إظهار المزيد';
      button.setAttribute('aria-expanded',String(expanded));
    }

    button.addEventListener('click',function(){
      list.classList.toggle('is-expanded');
      sync();
    });

    new ResizeObserver(sync).observe(list);
    new MutationObserver(function(){requestAnimationFrame(sync);}).observe(list,{childList:true,subtree:true});
    requestAnimationFrame(sync);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind,{once:true});
  else bind();
})(window,document);
