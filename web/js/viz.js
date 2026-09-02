export const palette = {
  purchasing: "#8b95a5",
  usd_egp_mid: "#6ec3d4",
  gold_egp_oz: "#d4b06a",
  silver_egp_oz: "#c5c9d0",
  egx30_close: "#3ddc8a",
  spy_egp: "#7aa7ff",
  qqq_egp: "#b794f6",
  btc_egp: "#ef7a6e",
  deposit: "#e0c27a",
  tbill: "#8fd4a8",
};

export function svgBars(rows, {width = 640, height = 280} = {}) {
  const data = rows.filter(r => r.value != null);
  if (!data.length) return `<svg viewBox="0 0 ${width} ${height}"></svg>`;
  const max = Math.max(...data.map(r => Math.abs(r.value)), 1);
  const mid = height / 2;
  const gap = 10;
  const bw = (width - gap * (data.length + 1)) / data.length;
  const bars = data.map((r, i) => {
    const h = (Math.abs(r.value) / max) * (mid - 28);
    const x = gap + i * (bw + gap);
    const y = r.value >= 0 ? mid - h : mid;
    const fill = r.color || (r.value >= 0 ? "#3ddc8a" : "#ef7a6e");
    const label = (r.label || "").replace(/</g, "");
    const val = r.value.toLocaleString("en-US", {maximumFractionDigits: 1}) + "%";
    return `<g>
      <rect x="${x}" y="${y}" width="${bw}" height="${Math.max(h, 2)}" rx="4" fill="${fill}" opacity="0.92"/>
      <text x="${x + bw / 2}" y="${height - 8}" text-anchor="middle" fill="#8b95a5" font-size="10">${label}</text>
      <text x="${x + bw / 2}" y="${r.value >= 0 ? y - 6 : y + h + 12}" text-anchor="middle" fill="#eef2f6" font-size="11">${val}</text>
    </g>`;
  }).join("");
  return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img">
    <line x1="0" y1="${mid}" x2="${width}" y2="${mid}" stroke="#273140"/>
    ${bars}
  </svg>`;
}
