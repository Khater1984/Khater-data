/* Shared browser data transport. Pages must use this layer instead of creating ad-hoc Supabase fetch clients. */
(function (window) {
  'use strict';
  const config = window.KHATER || {};
  const cache = new Map();
  const DEFAULT_TIMEOUT = 15000;

  function url(path) {
    const base = String(config.url || '').replace(/\/$/, '');
    return base + (String(path).startsWith('/') ? path : '/' + path);
  }

  async function get(path, options) {
    const opts = options || {};
    const key = opts.cacheKey || path;
    if (opts.cache !== false && cache.has(key)) return cache.get(key);
    if (!config.url || !config.key) throw new Error('إعدادات Supabase غير متاحة.');
    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, opts.timeout || DEFAULT_TIMEOUT);
    try {
      const response = await fetch(url(path), {
        method: 'GET',
        headers: { apikey: config.key, Authorization: 'Bearer ' + config.key, Accept: 'application/json' },
        signal: controller.signal
      });
      const body = await response.json().catch(function () { return null; });
      if (!response.ok) throw new Error((body && (body.message || body.error_description || body.error)) || ('HTTP ' + response.status));
      if (opts.cache !== false) cache.set(key, body);
      return body;
    } finally {
      clearTimeout(timer);
    }
  }

  function clear() { cache.clear(); }
  function escape(value) { return String(value == null ? '' : value).replace(/[&<>\"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]; }); }

  window.KHATER_DATA = window.KHATER_DATA || {};
  window.KHATER_DATA.supabase = { get: get, clear: clear, config: config };
  window.KHATER_DATA.escape = escape;
})(window);
