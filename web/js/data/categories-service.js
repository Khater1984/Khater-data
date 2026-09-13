/* Canonical data service for the Categories / Fund Atlas screen.
 * UI code must not know Supabase table names or construct API requests.
 */
(function (window) {
  'use strict';
  const DATA = window.KHATER_DATA || {};
  const supabase = DATA.supabase;
  if (!supabase || typeof supabase.get !== 'function') throw new Error('Supabase data transport must load before categories-service.js');

  function mountPageStyles() {
    if (document.querySelector('link[data-khater-page="categories"]')) return;
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = 'css/page-categories.css'; link.dataset.khaterPage = 'categories'; document.head.appendChild(link);
    document.querySelectorAll('head > style').forEach((style) => { if (style.textContent && style.textContent.includes('.heat-canvas') && style.textContent.includes('.atlas-card')) style.remove(); });
  }
  mountPageStyles();
  const clean = (value) => value == null ? '' : String(value).trim();
  const number = (value) => { if (value == null || value === '') return null; const n = Number(value); return Number.isFinite(n) ? n : null; };

  async function getUniverse() {
    const [funds, scores] = await Promise.all([
      supabase.get('/rest/v1/funds?select=fund_id,canonical_name,management_company,category&limit=1000', { cacheKey: 'categories:funds' }),
      supabase.get('/rest/v1/fund_smartscore_latest?select=fund_id,final_score,rating,data_confidence,data_tier,qualification_status,methodology_version&limit=1000', { cacheKey: 'categories:smartscore' })
    ]);
    const scoreMap = new Map();
    (Array.isArray(scores) ? scores : []).forEach((row) => {
      if (!row || row.fund_id == null) return;
      scoreMap.set(String(row.fund_id), { fund_id: String(row.fund_id), final_score: number(row.final_score), rating: clean(row.rating), data_confidence: clean(row.data_confidence), data_tier: clean(row.data_tier), qualification_status: clean(row.qualification_status), methodology_version: clean(row.methodology_version) });
    });
    const normalizedFunds = (Array.isArray(funds) ? funds : []).filter((row) => row && row.fund_id != null).map((row) => ({ fund_id: String(row.fund_id), canonical_name: clean(row.canonical_name) || 'صندوق بلا اسم', management_company: clean(row.management_company), category: clean(row.category) || 'غير مصنف' }));
    return Object.freeze({ funds: normalizedFunds, scores: scoreMap, source: 'Supabase', generatedAt: new Date().toISOString() });
  }

  async function getMacroContext() {
    const macro = window.KHATER_DATA && window.KHATER_DATA.macro;
    if (!macro || typeof macro.getSeries !== 'function') return { available: false, series: [] };
    const keys = ['usd_egp_mid', 'gold_egp_oz', 'egx30_close'];
    const results = await Promise.all(keys.map(async (key) => {
      try {
        const data = await macro.getSeries(key); const rows = Array.isArray(data.rows) ? data.rows : [];
        if (!rows.length) return { key, meta: data.meta, latest: null, changePct: null };
        const latest = rows[rows.length - 1], previous = rows.length > 1 ? rows[rows.length - 2] : null;
        const changePct = previous && Number(previous.value) !== 0 ? ((Number(latest.value) - Number(previous.value)) / Number(previous.value)) * 100 : null;
        return { key, meta: data.meta, latest: { date: latest.ts_date, value: Number(latest.value) }, changePct };
      } catch (error) { return { key, error: String(error && error.message || error) }; }
    }));
    return { available: true, series: results, generatedAt: new Date().toISOString() };
  }

  window.KHATER_DATA.categories = { getUniverse, getMacroContext };
})(window);