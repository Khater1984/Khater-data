(function () {
  'use strict';

  // Performance and Benchmark depend on the selected horizon and must re-render
  // when ?h= changes. Static/detail tabs can remain cached for the page lifetime.
  const HORIZON_DEPENDENT = { performance: true, benchmark: true };
  const cache = Object.create(null);
  const original = window.FUND_TABS || {};

  function wrap(name, fn) {
    if (typeof fn !== 'function' || HORIZON_DEPENDENT[name]) return fn;
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
