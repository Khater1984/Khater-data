export const BENCH_META = [
  ["egx30", "EGX 30"],
  ["gold", "Gold/EGP"],
  ["silver", "Silver/EGP"],
  ["usd", "USD/EGP"],
  ["spy", "S&P/EGP"],
  ["qqq", "Nasdaq/EGP"],
  ["btc", "Bitcoin/EGP"],
  ["tbill", "T-Bill"],
  ["cpi", "Inflation"],
  ["deposit", "Deposit"]
];

export function ret(fund, h) {
  const v = fund?.eima?.[h]?.ret;
  return v == null ? null : Number(v);
}

export function rating(score) {
  if (score == null) return "—";
  if (score >= 90) return "AAA";
  if (score >= 82) return "AA";
  if (score >= 75) return "AA-";
  if (score >= 68) return "A";
  if (score >= 60) return "BBB";
  if (score >= 50) return "BB";
  return "B";
}

export function conf(fund) {
  const e = Object.keys(fund.eima || {}).length > 0;
  const n = fund.nav != null;
  if (e && n) return "S1";
  if (e || n) return "S2";
  return "S3";
}

export function tier(fund) {
  const n = Object.keys(fund.eima || {}).length;
  if (n >= 8) return 3;
  if (n >= 4) return 2;
  return 1;
}

export function parts(fund, horizon, benches, peerRets) {
  const r = ret(fund, horizon);
  const perf = r == null || !peerRets.length
    ? null
    : 100 * peerRets.filter(x => x <= r).length / peerRets.length;
  const beaten = benches.map(k => {
    const b = benches._vals?.[k];
    return r != null && b != null && r >= b;
  });
  const bench = benches.length
    ? 100 * beaten.filter(Boolean).length / benches.length
    : null;
  const infB = benches._vals?.cpi;
  const inflation = r == null || infB == null ? null : (r >= infB ? 100 : 0);
  const hs = ["weekly","4weeks","ytd","last12m","2y","3y","4y","5y","6y"];
  const avail = hs.map(k => ret(fund, k)).filter(v => v != null);
  const consistency = avail.length
    ? 100 * avail.filter(v => v >= 0).length / avail.length
    : null;
  const evidence = (fund.nav != null ? 50 : 0) + (avail.length ? 50 : 0);
  const used = [
    ["performance", perf, 0.30],
    ["benchmark", bench, 0.25],
    ["inflation", inflation, 0.15],
    ["consistency", consistency, 0.15],
    ["evidence", evidence, 0.15]
  ].filter(x => x[1] != null);
  const w = used.reduce((s, x) => s + x[2], 0) || 1;
  const score = used.reduce((s, x) => s + x[1] * x[2], 0) / w;
  return {
    r,
    perf,
    bench,
    inflation,
    consistency,
    evidence,
    score,
    beaten: Object.fromEntries(benches.map((k, i) => [k, beaten[i]]))
  };
}

export function label(v) {
  if (v == null) return "—";
  if (v >= 75) return "Strong";
  if (v >= 50) return "Mixed";
  return "Weak";
}
