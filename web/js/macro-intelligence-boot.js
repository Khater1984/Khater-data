(() => {
  'use strict';
  const run = async () => {
    try {
      const data = window.__KHATER_MACRO_DATA || await window.KHATER_DATA.macro.getAll();
      window.KHATER_DATA.macroIntelligence.render(data);
      window.__KHATER_MACRO_DATA = data;
    } catch (e) {
      const host = document.getElementById('macroIntelligence');
      if (host) host.innerHTML = '<div class="intelligence-error">تعذر بناء طبقة السياق الاقتصادي: ' + window.KHATER_DATA.escape(e.message) + '</div>';
    }
  };
  if (window.KHATER_DATA?.macro && window.KHATER_DATA?.macroIntelligence) run();
  else window.addEventListener('khater:macro-ready', run, { once: true });
})();
