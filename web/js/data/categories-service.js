/* Categories read model — groups the live fund universe. No heatmap. */
(function (window) {
  'use strict';
  const funds = window.KHATER_DATA && window.KHATER_DATA.funds;
  if (!funds) throw new Error('categories-service.js requires funds-service.js');

  const TABLES = {
    funds: 'funds',
    scores: 'fund_smartscore_latest',
    performance: 'fund_performance_history',
    source: 'Supabase'
  };

  function median(values) {
    const xs = (values || []).filter(function (v) { return v != null && Number.isFinite(Number(v)); }).map(Number).sort(function (a, b) { return a - b; });
    if (!xs.length) return null;
    const mid = Math.floor(xs.length / 2);
    return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
  }

  function pickHorizon(available, requested) {
    if (requested && available.indexOf(requested) !== -1) return requested;
    if (available.indexOf('last12m') !== -1) return 'last12m';
    return available[0] || null;
  }

  async function getUniverse(horizon) {
    const universe = await funds.getUniverse();
    const available = universe.horizons || [];
    const selected = pickHorizon(available, horizon);
    let snapshot = { map: {}, returnDates: {}, date: null, fundsWithReturn: 0 };

    if (selected) {
      try {
        snapshot = await funds.getPerformanceSnapshot(selected);
      } catch (error) {
        snapshot = { map: {}, returnDates: {}, date: null, fundsWithReturn: 0, error: String(error && error.message || error) };
      }
    }

    const list = (universe.list || []).map(function (fund) {
      const ret = snapshot.map[fund.id];
      return Object.assign({}, fund, {
        ret: ret == null ? null : Number(ret),
        returnDate: snapshot.returnDates[fund.id] || null
      });
    });

    const groups = Object.create(null);
    list.forEach(function (fund) {
      const key = fund.cat || 'غير مصنف';
      (groups[key] = groups[key] || []).push(fund);
    });

    const categories = Object.keys(groups).map(function (name) {
      const items = groups[name];
      const returns = items.map(function (item) { return item.ret; });
      const scores = items.map(function (item) { return item.score; });
      return {
        name: name,
        count: items.length,
        withReturn: returns.filter(function (v) { return v != null; }).length,
        withScore: scores.filter(function (v) { return v != null; }).length,
        medianReturn: median(returns),
        medianScore: median(scores),
        funds: items.slice().sort(function (a, b) {
          if (a.ret == null && b.ret == null) return String(a.name).localeCompare(String(b.name), 'ar');
          if (a.ret == null) return 1;
          if (b.ret == null) return -1;
          return b.ret - a.ret;
        })
      };
    }).sort(function (a, b) {
      if (a.medianReturn == null && b.medianReturn == null) return b.count - a.count;
      if (a.medianReturn == null) return 1;
      if (b.medianReturn == null) return -1;
      return b.medianReturn - a.medianReturn;
    });

    return {
      funds: list,
      groups: groups,
      categories: categories,
      horizons: available,
      horizon: selected,
      asOf: snapshot.date || null,
      coverage: { funds: list.length, withReturn: snapshot.fundsWithReturn || 0 },
      source: 'Supabase',
      tables: TABLES
    };
  }

  window.KHATER_DATA = window.KHATER_DATA || {};
  window.KHATER_DATA.categories = { getUniverse: getUniverse, source: 'Supabase' };
})(window);
