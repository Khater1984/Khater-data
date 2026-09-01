import { bucket } from "./engine.js";

export const CFG = window.KHATER || {};

export function hasLive() {
  return Boolean(CFG.url && CFG.key);
}

function headers() {
  return {
    apikey: CFG.key,
    Authorization: "Bearer " + CFG.key,
  };
}

export async function sb(path, params = {}) {
  const u = new URL(CFG.url.replace(/\/$/, "") + "/rest/v1/" + path);
  Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetch(u, { headers: headers() });
  if (!r.ok) throw new Error(path + " " + r.status);
  return r.json();
}

export async function loadSeries(from = "2016-01-01") {
  const keys = [
    "egx30_close","usd_egp_mid","btc_egp","spy_egp","qqq_egp",
    "gold_egp_oz","silver_egp_oz","cpi_headline_mom_pct",
    "bank_deposit_1_3m_avg_pct","tbill_91_avg_yield_pct"
  ];
  const series = {};
  for (const key of keys) {
    const rows = [];
    let offset = 0;
    while (true) {
      const chunk = await sb("macro_series", {
        select: "ts_date,value",
        series_key: "eq." + key,
        ts_date: "gte." + from,
        order: "ts_date.asc",
        offset: String(offset),
        limit: "1000",
      });
      rows.push(...chunk);
      if (chunk.length < 1000) break;
      offset += 1000;
    }
    series[key] = rows.map(r => [r.ts_date, Number(r.value)]);
  }
  return series;
}

export async function loadFunds() {
  const funds = await sb("funds", {
    select: "fund_id,canonical_name,management_company,category,currency,inception_date,metadata,price_update_url",
    limit: "1000",
  });
  const navs = await sb("nav_official", {
    select: "fund_id,nav,currency,as_of_date,source_url",
    limit: "1000",
  });
  const latest = await sb("fund_performance_history", {
    select: "report_date",
    order: "report_date.desc",
    limit: "1",
  });
  const asof = latest[0]?.report_date;
  const perf = [];
  if (asof) {
    let offset = 0;
    while (true) {
      const chunk = await sb("fund_performance_history", {
        select: "fund_id,horizon,return_pct,nav_value,rank,report_date",
        report_date: "eq." + asof,
        offset: String(offset),
        limit: "1000",
      });
      perf.push(...chunk);
      if (chunk.length < 1000) break;
      offset += 1000;
    }
  }
  const navMap = Object.fromEntries(navs.map(n => [n.fund_id, n]));
  const pMap = {};
  for (const row of perf) {
    pMap[row.fund_id] ||= { _asof: row.report_date };
    pMap[row.fund_id][row.horizon] = { ret: row.return_pct, rank: row.rank, nav: row.nav_value };
  }
  return funds.map(f => {
    const n = navMap[f.fund_id];
    const p = pMap[f.fund_id] || {};
    const meta = f.metadata || {};
    return {
      id: f.fund_id,
      name: f.canonical_name,
      manager: f.management_company,
      category: f.category,
      currency: (n && n.currency) || f.currency,
      inception: f.inception_date || meta.inception_raw,
      initial: meta.initial_value,
      nav: n ? n.nav : null,
      nav_asof: n ? n.as_of_date : null,
      url: (n && n.source_url) || f.price_update_url,
      eima: Object.fromEntries(Object.entries(p).filter(([k]) => !k.startsWith("_"))),
      eima_asof: p._asof || null,
      bucket: bucket(f.category),
    };
  });
}

export async function loadEngine() {
  if (hasLive()) {
    return { source: "supabase", series: await loadSeries() };
  }
  const snap = await (await fetch("data/engine_data.json")).json();
  return { source: "snapshot", series: snap.series };
}

export async function loadFundBook() {
  if (hasLive()) return { source: "supabase", funds: await loadFunds() };
  const snap = await (await fetch("data/funds_dna.json")).json();
  return { source: "snapshot", funds: snap.funds };
}
