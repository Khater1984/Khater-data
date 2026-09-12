/* Compatibility facade for legacy pages. No JSON snapshot fallback is allowed here. */
import { bucket } from "./engine.js";

export const CFG = window.KHATER || {};

async function ensureDataLayer() {
  if (!window.KHATER_DATA?.supabase) await load("./data/supabase-client.js");
  if (!window.KHATER_DATA?.macro) await load("./data/macro-service.js");
  if (!window.KHATER_DATA?.funds) await load("./data/funds-service.js");
}

function load(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error("تعذر تحميل طبقة البيانات: " + src));
    document.head.appendChild(s);
  });
}

export function hasLive() {
  return Boolean(CFG.url && CFG.key);
}

export async function loadSeries(from = "2016-01-01") {
  await ensureDataLayer();
  const keys = [
    "egx30_close","usd_egp_mid","btc_egp","spy_egp","qqq_egp",
    "gold_egp_oz","silver_egp_oz","cpi_headline_mom_pct",
    "bank_deposit_1_3m_avg_pct","tbill_91_avg_yield_pct"
  ];
  const result = {};
  for (const key of keys) {
    const data = await window.KHATER_DATA.macro.getSeries(key);
    result[key] = data.rows
      .filter(r => r.ts_date >= from)
      .map(r => [r.ts_date, Number(r.value)]);
  }
  return result;
}

export async function loadFunds() {
  await ensureDataLayer();
  const universe = await window.KHATER_DATA.funds.getUniverse();
  return universe.list.map(f => ({
    id:f.id,
    name:f.name,
    manager:f.manager,
    category:f.cat,
    nav:f.nav,
    score:f.score,
    rating:f.rating,
    currency:null,
    nav_asof:null,
    bucket:bucket(f.cat)
  }));
}

export async function loadEngine() {
  if (!hasLive()) throw new Error("Supabase configuration is required; JSON snapshots are disabled");
  return { source:"supabase", series:await loadSeries() };
}

export async function loadFundBook() {
  if (!hasLive()) throw new Error("Supabase configuration is required; JSON snapshots are disabled");
  return { source:"supabase", funds:await loadFunds() };
}
