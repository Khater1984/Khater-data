/* Fund domain facade. UI modules depend on this contract, not on Supabase directly. */
(function () {
  'use strict';
  const q = new URLSearchParams(location.search);
  const id = q.get('id') || q.get('fund_id');
  const C = window.KHATER || {};
  const HS = ['weekly','4weeks','ytd','last12m','1y','2y','3y','4y','5y','6y','max'];
  const L = { weekly:'أسبوعي','4weeks':'4 أسابيع',ytd:'منذ بداية العام',last12m:'12 شهراً','1y':'سنة','2y':'سنتان','3y':'3 سنوات','4y':'4 سنوات','5y':'5 سنوات','6y':'6 سنوات',max:'الأقصى' };

  function esc(x) { return String(x == null ? '—' : x).replace(/[&<>\"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]; }); }
  function num(x) { return x == null || !Number.isFinite(Number(x)) ? '—' : Number(x).toLocaleString('en-US',{maximumFractionDigits:2}); }
  function pct(x) { return x == null || !Number.isFinite(Number(x)) ? '—' : (Number(x) >= 0 ? '+' : '') + num(x) + '%'; }
  function warnings(w) {
    if (w == null) return [];
    if (Array.isArray(w)) return w.map(function (x) { return typeof x === 'string' ? x : (x && x.message) || JSON.stringify(x); });
    if (typeof w === 'object') return Object.entries(w).map(function (e) { return e[0] + ': ' + JSON.stringify(e[1]); });
    return [String(w)];
  }
  function finiteNav(v) { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; }
  function finiteReturn(v) { if (v == null || String(v).trim() === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; }
  function currentOrPast(date) { return !!date && String(date).slice(0,10) <= new Date().toISOString().slice(0,10); }

  function buildOfficialSeries(rows) {
    const byHorizon = Object.create(null);
    (rows || []).forEach(function (row) {
      if (!row || !row.horizon || !currentOrPast(row.report_date) || finiteReturn(row.return_pct) == null) return;
      const h = String(row.horizon), d = String(row.report_date);
      (byHorizon[h] = byHorizon[h] || []).push(Object.assign({}, row, { return_pct: finiteReturn(row.return_pct) }));
    });
    Object.keys(byHorizon).forEach(function (h) {
      const seen = Object.create(null);
      byHorizon[h] = byHorizon[h].filter(function (row) {
        const d = String(row.report_date);
        if (seen[d]) return false;
        seen[d] = true;
        return true;
      }).sort(function (a,b) { return String(a.report_date).localeCompare(String(b.report_date)); });
    });
    return byHorizon;
  }

  function buildNavSeries(perfRows, priceRows) {
    const byDate = Object.create(null);
    (priceRows || []).forEach(function (row) {
      if (!row || !currentOrPast(row.as_of_date)) return;
      const nav = finiteNav(row.nav); if (nav == null) return;
      byDate[row.as_of_date] = { date: row.as_of_date, nav: nav, source: row.source_id || 'fund_price_history' };
    });
    if (!Object.keys(byDate).length) {
      (perfRows || []).forEach(function (row) {
        if (!row || !currentOrPast(row.report_date)) return;
        const nav = finiteNav(row.nav_value); if (nav == null || byDate[row.report_date]) return;
        byDate[row.report_date] = { date: row.report_date, nav: nav, source: row.source_id || 'fund_performance_history', fallback: true };
      });
    }
    return Object.keys(byDate).sort().map(function (d) { return byDate[d]; });
  }

  function windowStart(horizon, endDate) {
    const end = endDate ? new Date(endDate + 'T00:00:00') : new Date();
    if (Number.isNaN(end.getTime()) || horizon === 'max' || !horizon) return null;
    if (horizon === 'ytd') return end.getFullYear() + '-01-01';
    const days = {weekly:7,'4weeks':28,last12m:365,'1y':365,'2y':730,'3y':1095,'4y':1460,'5y':1825,'6y':2190}[horizon];
    if (!days) return null;
    end.setDate(end.getDate() - days);
    return end.toISOString().slice(0,10);
  }
  function sliceNav(series,horizon,endDate) {
    const all = series || []; if (!all.length) return [];
    const end = endDate || all[all.length-1].date, start = windowStart(horizon,end);
    return all.filter(function (p) { return currentOrPast(p.date) && p.date <= end && (!start || p.date >= start); });
  }
  function seriesReturn(points) {
    if (!points || points.length < 2) return null;
    const first = points[0].nav, last = points[points.length-1].nav;
    return first ? ((last / first) - 1) * 100 : null;
  }

  function loadScript(src) {
    return new Promise(function (resolve,reject) {
      const s = document.createElement('script'); s.src = src; s.async = false;
      s.onload = resolve; s.onerror = function () { reject(new Error('تعذر تحميل طبقة البيانات: ' + src)); };
      document.head.appendChild(s);
    });
  }
  async function ensureDataLayer() {
    if (!window.KHATER_DATA || !window.KHATER_DATA.supabase) await loadScript('js/data/supabase-client.js');
    if (!window.KHATER_DATA || !window.KHATER_DATA.fund) await loadScript('js/data/fund-service.js');
  }
  async function loadFund() {
    if (!id) throw Error('معرّف الصندوق غير موجود في الرابط');
    if (!C.url || !C.key) throw Error('config.js غير متاح أو مفاتيح Supabase غير موجودة');
    await ensureDataLayer();
    const d = await window.KHATER_DATA.fund.getFundBundle(id);
    if (!d.fund) throw Error('الصندوق غير موجود: ' + id);
    return d;
  }

  window.FUND = { id:id,C:C,L:L,HS:HS,esc:esc,num:num,pct:pct,warnings:warnings,loadFund:loadFund,buildNavSeries:buildNavSeries,buildOfficialSeries:buildOfficialSeries,windowStart:windowStart,sliceNav:sliceNav,seriesReturn:seriesReturn };
})();
