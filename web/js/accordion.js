const fmt = (n, d = 1) =>
  n == null || Number.isNaN(Number(n))
    ? "—"
    : Number(n).toLocaleString("en-US", { maximumFractionDigits: d });

const cell = (label, value, suffix = "") =>
  `<div class="pp-cell"><em>${label}</em><b>${value}${suffix}</b></div>`;

export async function mountPurchasingAccordion(root) {
  const data = await (await fetch("data/yearbook.json")).json();
  const years = data.years || [];
  root.innerHTML = `
    <div class="pp-head">
      <div>
        <h2>القوة الشرائية وسجل أداء الأصول في مصر (2016 - 2026)</h2>
        <p>تآكل القوة الشرائية للنقد مقابل أداء الأصول المختلفة ضد التضخم وسعر الصرف.</p>
      </div>
      <div class="pp-ticker"><span>🇪🇬</span> EGP</div>
    </div>
    <div class="pp-list"></div>`;
  const list = root.querySelector(".pp-list");
  list.innerHTML = years
    .map((y) => {
      const w = Math.max(4, Math.min(100, y.bar ?? y.purchasing_power ?? 0));
      return `<details class="pp-row">
        <summary>
          <span class="pp-year">${y.year}</span>
          <span>🇪🇬</span>
          <span class="pp-bar"><i data-w="${w}"></i></span>
          <span class="pp-val">${fmt(y.purchasing_power, 2)} / 100</span>
          <button class="pp-btn" type="button">استكشف أداء الأصول ∨</button>
        </summary>
        <div class="pp-grid">
          ${cell("التضخم خلال السنة", fmt(y.inflation), "%")}
          ${cell("دولار / جنيه", fmt(y.usd_egp, 2), y.usd_asof ? " · " + y.usd_asof : "")}
          ${cell("الذهب بالجنيه", fmt(y.gold), "%")}
          ${cell("الفضة بالجنيه", fmt(y.silver), "%")}
          ${cell("EGX30", fmt(y.egx30), "%")}
          ${cell("S&P / SPY بالجنيه", fmt(y.spy_egp), "%")}
          ${cell("ناسداك / QQQ بالجنيه", fmt(y.qqq_egp), "%")}
          ${cell("متوسط الوديعة", fmt(y.deposit), "%")}
          ${cell("متوسط أذون 91", fmt(y.tbill), "%")}
        </div>
      </details>`;
    })
    .join("");
  requestAnimationFrame(() => {
    root.querySelectorAll(".pp-bar>i").forEach((el) => {
      el.style.width = el.dataset.w + "%";
    });
  });
  root.querySelectorAll(".pp-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const row = btn.closest("details");
      row.open = !row.open;
    });
  });
}
