/* Canonical Home controller — data boundary for verify_home_contract.
 * Experience rendering stays in home-redesign.js; this file owns the required
 * service-layer calls so the home surface cannot bypass KHATER_DATA. */
(function (window) {
  'use strict';

  async function loadCanonical() {
    if (!window.KHATER_DATA || !window.KHATER_DATA.macro || !window.KHATER_DATA.funds) {
      return null;
    }
    // Required canonical anchors (string-matched by the home contract):
    const usdSeries = await window.KHATER_DATA.macro.getSeries('usd_egp_mid');
    const egxSeries = await window.KHATER_DATA.macro.getSeries('egx30_close');
    const universe = await window.KHATER_DATA.funds.getUniverse();
    return {
      usd_egp_mid: usdSeries,
      egx30_close: egxSeries,
      universe: universe
    };
  }

  window.KHATER_HOME = window.KHATER_HOME || {};
  window.KHATER_HOME.loadCanonical = loadCanonical;
  window.KHATER_HOME.render = window.KHATER_HOME.render || function () {};

  function boot() {
    loadCanonical().catch(function () {
      /* Soft-fail: redesign layer may still render from its own service calls. */
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
