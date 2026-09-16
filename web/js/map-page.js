/* Map / قيمة فلوسي — uses platform-theme for chart fonts (Cairo). */
(function () {
  'use strict';

  function themeLayout() {
    if (window.KHATER_THEME && typeof window.KHATER_THEME.chartLayout === 'function') {
      return window.KHATER_THEME.chartLayout();
    }
    return {
      background: { color: '#ffffff' },
      textColor: '#5a6f72',
      fontFamily: 'Cairo, sans-serif'
    };
  }

  function themeGrid() {
    if (window.KHATER_THEME && typeof window.KHATER_THEME.chartGrid === 'function') {
      return window.KHATER_THEME.chartGrid();
    }
    return {
      vertLines: { color: '#e4ecea' },
      horzLines: { color: '#e4ecea' }
    };
  }

  // Boot is owned by map-page load path in map.html (macro service + live boundary).
  // Chart instances must always use Cairo via themeLayout().
  window.KHATER_MAP_CHART_DEFAULTS = {
    layout: themeLayout,
    grid: themeGrid,
    fontFamily: 'Cairo, sans-serif'
  };
})();
