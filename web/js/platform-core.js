/* Shared platform foundation: one public Supabase client and consistent UI states. */
(function (window, document) {
  'use strict';

  const config = window.KHATER || {};
  const cache = new Map();
  const DEFAULT_TIMEOUT = 15000;

  function joinUrl(path) {
    const base = String(config.url || '').replace(/\/$/, '');
    return base + (String(path).startsWith('/') ? path : '/' + path);
  }

  function errorMessage(error) {
    if (!error) return 'حدث خطأ غير معروف.';
    if (error.name === 'AbortError') return 'انتهت مهلة الاتصال بقاعدة البيانات.';
    return String(error.message || error);
  }

  async function get(path, options) {
    if (!config.url || !config.key) {
      throw new Error('إعدادات Supabase غير متاحة في config.js');
    }
    const opts = options || {};
    const key = opts.cacheKey || path;
    if (opts.cache !== false && cache.has(key)) return cache.get(key);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeout || DEFAULT_TIMEOUT);
    try {
      const response = await fetch(joinUrl(path), {
        method: 'GET',
        headers: {
          apikey: config.key,
          Authorization: 'Bearer ' + config.key,
          Accept: 'application/json'
        },
        signal: controller.signal
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const message = body && (body.message || body.error_description || body.error);
        throw new Error(message || ('HTTP ' + response.status));
      }
      if (opts.cache !== false) cache.set(key, body);
      return body;
    } finally {
      clearTimeout(timer);
    }
  }

  function clearCache() { cache.clear(); }

  function escape(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return {'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char];
    });
  }

  function loading(message) {
    return '<div class="platform-state platform-loading" role="status" aria-live="polite"><span class="platform-spinner" aria-hidden="true"></span><span>' + escape(message || 'جاري تحميل البيانات…') + '</span></div>';
  }

  function empty(message) {
    return '<div class="platform-state platform-empty" role="status">' + escape(message || 'لا توجد بيانات متاحة للعرض حاليًا.') + '</div>';
  }

  function failure(error, retryLabel) {
    return '<div class="platform-state platform-error" role="alert"><strong>تعذر تحميل البيانات</strong><span>' + escape(errorMessage(error)) + '</span><button type="button" data-platform-retry>' + escape(retryLabel || 'إعادة المحاولة') + '</button></div>';
  }

  function setState(element, state, options) {
    if (!element) return;
    const opts = options || {};
    if (state === 'loading') element.innerHTML = loading(opts.message);
    else if (state === 'empty') element.innerHTML = empty(opts.message);
    else if (state === 'error') {
      element.innerHTML = failure(opts.error, opts.retryLabel);
      const retry = element.querySelector('[data-platform-retry]');
      if (retry && typeof opts.onRetry === 'function') retry.addEventListener('click', opts.onRetry);
    }
  }

  window.Platform = window.Platform || {};
  window.Platform.api = { get, clearCache, config };
  window.Platform.ui = { escape, loading, empty, failure, setState, errorMessage };
})(window, document);
