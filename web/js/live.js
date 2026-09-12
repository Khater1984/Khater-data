/* Thin compatibility adapter for map.html. Financial data access remains in macro-service.js. */
import { bucket } from "./engine.js";

export const CFG = window.KHATER || {};

async function ensureMacroDataLayer() {
  if (!window.KHATER_DATA?.supabase) await load("./data/supabase-client.js");
  if (!window.KHATER_DATA?.macro) await load("./data/macro-service.js");
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

export async function loadEngine() {
  if (!hasLive()) throw new Error("Supabase configuration is required; JSON snapshots are disabled");
  await ensureMacroDataLayer();
  const packed = await window.KHATER_DATA.macro.getAll();
  const series = {};
  Object.entries(packed.series).forEach(([key, data]) => {
    series[key] = data.rows.map(r => [r.ts_date, Number(r.value)]);
  });
  return { source: "supabase", series, conflicts: packed.conflicts || [] };
}

/* Retained only for any legacy caller outside map.html; no JSON fallback. */
export async function loadSeries(from = "2016-01-01") {
  await ensureMacroDataLayer();
  const keys = Object.keys(window.KHATER_DATA.macro.SERIES);
  const result = {};
  for (const key of keys) {
    const data = await window.KHATER_DATA.macro.getSeries(key);
    result[key] = data.rows
      .filter(r => r.ts_date >= from)
      .map(r => [r.ts_date, Number(r.value)]);
  }
  return result;
}

/* Legacy fund adapter is kept isolated until all external callers are migrated. */
export async function loadFunds() {
  if (!hasLive()) throw new Error("Supabase configuration is required; JSON snapshots are disabled");
  if (!window.KHATER_DATA?.supabase) await load("./data/supabase-client.js");
  if (!window.KHATER_DATA?.funds) await load("./data/funds-service.js");
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

export async function loadFundBook() {
  if (!hasLive()) throw new Error("Supabase configuration is required; JSON snapshots are disabled");
  return { source:"supabase", funds:await loadFunds() };
}
