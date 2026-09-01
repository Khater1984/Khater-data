export const PATHS = {
  purchasing: { name: "التضخم / القوة الشرائية", color: "#8fa198" },
  usd_egp_mid: { name: "الدولار", color: "#6ec3d4" },
  gold_egp_oz: { name: "الذهب", color: "#c9a45c" },
  silver_egp_oz: { name: "الفضة", color: "#c8c8c8" },
  egx30_close: { name: "EGX30", color: "#4ecf86" },
  spy_egp: { name: "SPY بالجنيه", color: "#7aa7ff" },
  qqq_egp: { name: "ناسداك QQQ", color: "#c792ea" },
  btc_egp: { name: "بيتكوين", color: "#e07a6e" },
  deposit: { name: "وديعة قصيرة", color: "#e0c27a" },
  tbill: { name: "أذون 91 يوماً", color: "#8fd4a8" }
};

export const bucket = (c="") => {
  c = c.toLowerCase();
  if (c.includes("gold")) return "ذهب";
  if (c.includes("equity") || c.includes("index") || c.includes("thematic") || c.includes("sector")) return "أسهم";
  if (c.includes("money market")) return "نقدي";
  if (c.includes("fixed income")) return "دخل ثابت";
  if (c.includes("balanced") || c.includes("mixed") || c.includes("allocator")) return "متوازن";
  if (c.includes("etf") || c.includes("traded")) return "متداول";
  if (c.includes("protected") || c.includes("guaranteed")) return "محمي";
  if (c.includes("charitable")) return "خيري";
  return "أخرى";
};

export const fmt = (n, d=2) => n == null || Number.isNaN(n) ? "—" : Number(n).toLocaleString("ar-EG", { maximumFractionDigits: d });
export const en = (n, d=2) => n == null || Number.isNaN(n) ? "—" : Number(n).toLocaleString("en-US", { maximumFractionDigits: d });

export function nearest(pts, d) {
  if (!pts?.length) return null;
  let b = pts[0];
  for (const p of pts) { if (p[0] <= d) b = p; else break; }
  return b;
}
const days = (a,b) => (Date.parse(b) - Date.parse(a)) / 86400000;

function growYield(pts, start, amount) {
  const s = (pts || []).filter(p => p[0] >= start);
  if (!s.length) return [];
  let v = amount, out = [{ time: s[0][0], value: v }];
  for (let i = 0; i < s.length; i++) {
    const [d, ann] = s[i];
    const nxt = i + 1 < s.length ? s[i+1][0] : d;
    const dt = Math.max(days(d, nxt), 0);
    if (dt > 0) {
      v *= Math.pow(1 + ann / 100, dt / 365);
      out.push({ time: nxt, value: v });
    }
  }
  return out;
}

export function toLine(series, start, amount, key) {
  if (key === "purchasing") {
    let v = 1, out = [];
    for (const [d, m] of (series.cpi_headline_mom_pct || [])) {
      if (d < start) continue;
      v *= (1 + m / 100);
      out.push({ time: d, value: amount / v });
    }
    return out;
  }
  if (key === "deposit") return growYield(series.bank_deposit_1_3m_avg_pct, start, amount);
  if (key === "tbill") return growYield(series.tbill_91_avg_yield_pct, start, amount);
  const pts = series[key];
  const a = nearest(pts, start);
  if (!a || !a[1]) return [];
  return pts.filter(p => p[0] >= a[0]).map(([t, v]) => ({ time: t, value: amount * (v / a[1]) }));
}

export function rebase(line) {
  if (!line.length) return line;
  const b = line[0].value || 1;
  return line.map(p => ({ time: p.time, value: 100 * p.value / b }));
}
