(() => {
  'use strict';
  const render = data => {
    try {
      if (data && window.KHATER_DATA?.macroIntelligence) {
        window.KHATER_DATA.macroIntelligence.render(data);
      }
    } catch (e) {
      const host = document.getElementById('macroIntelligence');
      if (host) host.innerHTML = '<div class="intelligence-error">تعذر بناء طبقة السياق الاقتصادي: ' + window.KHATER_DATA.escape(e.message) + '</div>';
    }
  };
  if (window.__KHATER_MACRO_DATA) render(window.__KHATER_MACRO_DATA);
  else window.addEventListener('khater:macro-data-ready', e => render(e.detail), { once: true });
})();