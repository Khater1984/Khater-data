/*
 * Canonical Funds Experience Entry Point
 * --------------------------------------
 * This file owns composition/order for the Funds surface.
 * Data services remain the only data boundary; the modules below are presentation
 * modules with distinct responsibilities. Pages must load this entry point rather
 * than composing the experience stack themselves.
 */
(function(window, document){
  'use strict';
  if (window.KHATER_FUNDS_EXPERIENCE?.started) return;
  window.KHATER_FUNDS_EXPERIENCE = { started: true, version: '1.0.0' };

  const modules = [
    'js/funds-screen-v2.js',
    'js/funds-terminal-polish.js',
    'js/opportunity-layer.js',
    'js/funds-responsive-ui.js'
  ];

  function load(src){
    return new Promise(function(resolve, reject){
      const existing = document.querySelector('script[data-funds-experience="'+src+'"]');
      if(existing){ resolve(); return; }
      const s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.dataset.fundsExperience = src;
      s.onload = resolve;
      s.onerror = function(){ reject(new Error('Funds experience module failed: '+src)); };
      document.body.appendChild(s);
    });
  }

  function boot(){
    modules.reduce((p, src) => p.then(() => load(src)), Promise.resolve())
      .catch(function(err){
        console.error('[funds-experience]', err);
        const rows = document.getElementById('rows');
        if(rows) rows.innerHTML = '<tr><td colspan="11" class="error-state">تعذر تشغيل شاشة الصناديق.</td></tr>';
      });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})(window, document);
