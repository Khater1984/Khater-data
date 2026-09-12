const fmt = (n, d = 1) => n == null || Number.isNaN(Number(n)) ? "—" : Number(n).toLocaleString("en-US", { maximumFractionDigits: d });

const FLAG = `<svg class="pp-flag" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="9" fill="#CE1126"/><rect x="0" y="6" width="18" height="6" fill="#fff"/><rect x="0" y="12" width="18" height="6" fill="#000"/></svg>`;

function tag(ret, inflation) {
  if (ret == null || inflation == null) return "";
  return Number(ret) > Number(inflation) ? `<span class="tag win">هزم التضخم</span>` : `<span class="tag lose">خسر أمام التضخم</span>`;
}
function metric(label, value, suffix, inflation, withTag) {
  return `<div class="pp-cell"><em>${label}</em><div class="line"><b>${value}${suffix}</b>${withTag ? tag(parseFloat(String(value).replace(/,/g, "")), inflation) : ""}</div></div>`;
}
function latestByYear(rows, year) {
  const r = (rows || []).filter(x => String(x.ts_date).slice(0, 4) === String(year));
  return r.length ? r[r.length - 1] : null;
}
function previousBefore(rows, date) {
  const r = (rows || []).filter(x => x.ts_date < date);
  return r.length ? r[r.length - 1] : null;
}
function yoy(rows, year) {
  const cur = latestByYear(rows, year);
  if (!cur) return null;
  const prev = previousBefore(rows, String(year) + "-01-01");
  if (!prev || !Number(prev.value)) return null;
  return (Number(cur.value) / Number(prev.value) - 1) * 100;
}
function averageYear(rows, year) {
  const r = (rows || []).filter(x => String(x.ts_date).slice(0, 4) === String(year)).map(x => Number(x.value)).filter(Number.isFinite);
  return r.length ? r.reduce((a, b) => a + b, 0) / r.length : null;
}
function annualInflation(rows, year) {
  const r = (rows || []).filter(x => String(x.ts_date).slice(0, 4) === String(year)).map(x => Number(x.value)).filter(Number.isFinite);
  if (!r.length) return null;
  return (r.reduce((acc, m) => acc * (1 + m / 100), 1) - 1) * 100;
}
function purchasingPower(rows, year) {
  const r = (rows || []).filter(x => String(x.ts_date).slice(0, 4) <= String(year)).map(x => Number(x.value)).filter(Number.isFinite);
  if (!r.length) return null;
  const index = r.reduce((acc, m) => acc * (1 + m / 100), 1);
  return 100 / index;
}

export async function mountPurchasingAccordion(root) {
  if (!window.KHATER_DATA?.macro) throw new Error("macro-service.js is required");
  const svc = window.KHATER_DATA.macro;
  const keys = ["usd_egp_mid", "gold_egp_oz", "silver_egp_oz", "spy_egp", "qqq_egp", "egx30_close", "cpi_headline_mom_pct", "bank_deposit_1_3m_avg_pct", "tbill_91_avg_yield_pct"];
  const loaded = await Promise.all(keys.map(k => svc.getSeries(k)));
  const S = Object.create(null);
  keys.forEach((k, i) => { S[k] = loaded[i].rows; });
  const years = Array.from(new Set(S.cpi_headline_mom_pct.map(x => String(x.ts_date).slice(0, 4)).filter(y => y >= "2016"))).sort();

  root.innerHTML = `<div class="pp-head"><h2>القوة الشرائية وسجل أداء الأصول في مصر (2016 - 2026)</h2><p>تآكل القوة الشرائية للنقد مقابل أداء الأصول المختلفة، محسوب من السلاسل الفعلية في Supabase.</p></div><div class="pp-list"></div>`;
  root.querySelector(".pp-list").innerHTML = years.map(year => {
    const inflation = annualInflation(S.cpi_headline_mom_pct, year);
    const remain = purchasingPower(S.cpi_headline_mom_pct, year);
    const loss = remain == null ? null : 100 - remain;
    const w = Math.max(3, Math.min(100, remain ?? 0));
    const usd = latestByYear(S.usd_egp_mid, year)?.value;
    const gold = yoy(S.gold_egp_oz, year), silver = yoy(S.silver_egp_oz, year), spy = yoy(S.spy_egp, year), qqq = yoy(S.qqq_egp, year), egx = yoy(S.egx30_close, year);
    const deposit = averageYear(S.bank_deposit_1_3m_avg_pct, year), tbill = averageYear(S.tbill_91_avg_yield_pct, year);
    return `<details class="pp-row"><summary><div class="pp-yearbox">${year}${FLAG}</div><div class="pp-bar"><i data-w="${w}"></i></div><div class="pp-metric">قيمة الـ 100 ج.م = <b>${fmt(remain, 1)} ج.م</b><span class="pp-badge">${loss == null ? "" : "(خسارة " + fmt(loss, 1) + "%)"}</span></div><div class="pp-chevron">∨</div></summary><div class="pp-grid">
      ${metric("سعر الدولار مقابل الجنيه", fmt(usd, 2), " ج.م / $", inflation, false)}
      ${metric("التضخم السنوي المركب", fmt(inflation), "%", inflation, false)}
      ${metric("الذهب", fmt(gold), "%", inflation, true)}
      ${metric("الفضة", fmt(silver), "%", inflation, true)}
      ${metric("الأسهم الأمريكية (S&P 500)", fmt(spy), "%", inflation, true)}
      ${metric("أسهم التكنولوجيا (ناسداك)", fmt(qqq), "%", inflation, true)}
      ${metric("البورصة المصرية (EGX30)", fmt(egx), "%", inflation, true)}
      ${metric("ودائع البنوك", fmt(deposit), "%", inflation, true)}
      ${metric("أذون الخزانة", fmt(tbill), "%", inflation, true)}
    </div></details>`;
  }).join("");
  requestAnimationFrame(() => root.querySelectorAll(".pp-bar>i").forEach(el => { el.style.width = el.dataset.w + "%"; }));
}
