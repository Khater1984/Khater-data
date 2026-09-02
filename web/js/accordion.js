
const fmt = (n, d = 1) =>
  n == null || Number.isNaN(Number(n))
    ? "—"
    : Number(n).toLocaleString("en-US", { maximumFractionDigits: d });

const FLAG = `<svg class="pp-flag" viewBox="0 0 18 18" aria-hidden="true">
  <circle cx="9" cy="9" r="9" fill="#CE1126"/>
  <rect x="0" y="6" width="18" height="6" fill="#fff"/>
  <rect x="0" y="12" width="18" height="6" fill="#000"/>
</svg>`;

function tag(ret, inflation) {
  if (ret == null || inflation == null) return "";
  return Number(ret) > Number(inflation)
    ? `<span class="tag win">هزم التضخم</span>`
    : `<span class="tag lose">خسر أمام التضخم</span>`;
}

function metric(label, value, suffix, inflation, withTag) {
  return `<div class="pp-cell"><em>${label}</em>
    <div class="line"><b>${value}${suffix}</b>${withTag ? tag(parseFloat(String(value).replace(/,/g, "")), inflation) : ""}</div>
  </div>`;
}

export async function mountPurchasingAccordion(root) {
  const data = await (await fetch("data/yearbook.json")).json();
  const years = data.years || [];
  root.innerHTML = `
    <div class="pp-head">
      <h2>القوة الشرائية وسجل أداء الأصول في مصر (2016 - 2026)</h2>
      <p>تآكل القوة الشرائية للنقد مقابل أداء الأصول المختلفة ضد التضخم وسعر الصرف.</p>
    </div>
    <div class="pp-list"></div>`;
  root.querySelector(".pp-list").innerHTML = years.map((y) => {
    const remain = y.purchasing_power;
    const loss = remain == null ? null : 100 - remain;
    const w = Math.max(3, Math.min(100, remain ?? 0));
    return `<details class="pp-row">
      <summary>
        <div class="pp-yearbox">${y.year}${FLAG}</div>
        <div class="pp-bar"><i data-w="${w}"></i></div>
        <div class="pp-metric">قيمة الـ 100 ج.م = <b>${fmt(remain, 1)} ج.م</b>
          <span class="pp-badge">${loss == null ? "" : "(خسارة " + fmt(loss, 1) + "%)"}</span>
        </div>
        <div class="pp-chevron">∨</div>
      </summary>
      <div class="pp-grid">
        ${metric("سعر الدولار مقابل الجنيه", fmt(y.usd_egp, 2), " ج.م / $", y.inflation, false)}
        ${metric("التضخم السنوي", fmt(y.inflation), "%", y.inflation, false)}
        ${metric("الذهب", fmt(y.gold), "%", y.inflation, true)}
        ${metric("الفضة", fmt(y.silver), "%", y.inflation, true)}
        ${metric("الأسهم الأمريكية (S&P 500)", fmt(y.spy_egp), "%", y.inflation, true)}
        ${metric("أسهم التكنولوجيا (ناسداك)", fmt(y.qqq_egp), "%", y.inflation, true)}
        ${metric("البورصة المصرية (EGX30)", fmt(y.egx30), "%", y.inflation, true)}
        ${metric("ودائع البنوك", fmt(y.deposit), "%", y.inflation, true)}
        ${metric("أذون الخزانة", fmt(y.tbill), "%", y.inflation, true)}
      </div>
    </details>`;
  }).join("");
  requestAnimationFrame(() => {
    root.querySelectorAll(".pp-bar>i").forEach((el) => { el.style.width = el.dataset.w + "%"; });
  });
}
