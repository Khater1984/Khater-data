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

  async function request(path, method, body, options) {
    const opts = options || {};
    const key = opts.cacheKey || method + ' ' + path + (body == null ? '' : ' ' + JSON.stringify(body));
    if (opts.cache !== false && method === 'GET' && cache.has(key)) return cache.get(key);
    if (!config.url || !config.key) throw new Error('إعدادات Supabase غير متاحة.');
    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, opts.timeout || DEFAULT_TIMEOUT);
    try {
      const headers = {
        apikey: config.key,
        Authorization: 'Bearer ' + config.key,
        Accept: 'application/json'
      };
      if (body != null) headers['Content-Type'] = 'application/json';
      const response = await fetch(url(path), {
        method,
        headers,
        body: body == null ? undefined : JSON.stringify(body),
        signal: controller.signal
      });
      const responseBody = await response.json().catch(function () { return null; });
      if (!response.ok) {
        throw new Error((responseBody && (responseBody.message || responseBody.error_description || responseBody.error || responseBody.hint)) || ('HTTP ' + response.status));
      }
      if (opts.cache !== false && method === 'GET') cache.set(key, responseBody);
      return responseBody;
    } finally {
      clearTimeout(timer);
    }
  }

  async function get(path, options) {
    return request(path, 'GET', null, options);
  }

  async function rpc(functionName, params, options) {
    if (!functionName) throw new Error('Supabase RPC function name is required.');
    return request('/rest/v1/rpc/' + encodeURIComponent(functionName), 'POST', params || {}, options);
  }

  function clear() { cache.clear(); }
  function escape(value) { return String(value == null ? '' : value).replace(/[&<>\"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]; }); }

  window.KHATER_DATA = window.KHATER_DATA || {};
  window.KHATER_DATA.supabase = { get: get, rpc: rpc, clear: clear, config: config };
  window.KHATER_DATA.escape = escape;
})(window);
