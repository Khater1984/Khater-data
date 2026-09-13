(function () {
  'use strict';

  // Fund Detail tab orchestration: render each non-performance tab once per page load.
  // Performance remains intentionally uncached because its horizon selector can change.
  const cache = Object.create(null);
  const original = window.FUND_TABS || {};

  function wrap(name, fn) {
    if (typeof fn !== 'function' || name === 'performance') return fn;
    return async function () {
      if (cache[name]) return cache[name];
      const result = await fn();
      cache[name] = true;
      return result;
    };
  }

  Object.keys(original).forEach(function (name) {
    original[name] = wrap(name, original[name]);
  });

  window.FUND_TABS = original;
  window.FUND_TABS_CACHE = {
    clear: function (name) {
      if (name) delete cache[name];
      else Object.keys(cache).forEach(function (key) { delete cache[key]; });
    }
  };
})();
