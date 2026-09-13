(function () {
  'use strict';

  // Fund Detail tab orchestration: render each non-performance tab once per page load.
  // Performance remains intentionally uncached because its horizon selector can change.
  // Cache the in-flight Promise immediately so rapid repeated clicks cannot trigger
  // duplicate renders while the first tab load is still resolving.
  const cache = Object.create(null);
  const original = window.FUND_TABS || {};

  function wrap(name, fn) {
    if (typeof fn !== 'function' || name === 'performance') return fn;
    return function () {
      if (cache[name]) return cache[name];
      const pending = Promise.resolve().then(fn);
      cache[name] = pending.catch(function (error) {
        delete cache[name];
        throw error;
      });
      return cache[name];
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
