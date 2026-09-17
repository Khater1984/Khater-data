(function () {
  'use strict';
  const F = window.FUND;

  function esc(v) { return F.esc(v); }
  function pct(v) { return v == null || !Number.isFinite(Number(v)) ? 'غير متاح' : F.num(v) + '%'; }

  function arRating(v) {
    const map = {
      'below average': 'دون المتوسط',
      'above average': 'فوق المتوسط',
      average: 'متوسط',
      good: 'جيد',
      'very good': 'جيد جداً',
      excellent: 'ممتاز',
      outstanding: 'متميز',
      weak: 'ضعيف',
      poor: 'ضعيف',
      'not rated': 'غير مقيم'
    };
    const key = String(v || '').trim().toLowerCase();
    return map[key] || v || 'غير مقيم';
  }

  function render() {
    const s = F.score || {};
    const c = s.smartscore_components || {};
    const status = F.scoreMethodology || {};
    const items = [
      ['P', 'Performance', 'الأداء', c.performance, 30],
      ['R', 'Risk', 'المخاطر', c.risk, 25],
      ['B', 'Benchmark', 'تحقيق المرجع', c.benchmark, 25],
      ['I', 'Inflation', 'الحماية من التضخم', c.inflation, 10],
      ['C', 'Consistency', 'الاتساق', c.consistency, 10]
    ];
    const statusClass = status.matches ? 'ok' : 'warn';
    const statusText = status.matches ? 'متوافق مع المنهجية النشطة V3.0' : 'التقييم المحفوظ لا يحمل إصدار V3.0';
    const host = document.getElementById('smartscore-tab');
    host.innerHTML =
      '<div class="score-contract ' + statusClass + '">' +
        '<div><b>SMARTSCORE V3.0</b><span>' + esc(statusText) + '</span></div>' +
        '<small>الأوزان: أداء 30٪ · مخاطر 25٪ · مرجع 25٪ · تضخم 10٪ · اتساق 10٪</small>' +
      '</div>' +
      '<div class="score-list score-grid">' +
        items.map(function (x) {
          const value = x[3];
          const width = value == null ? 0 : Math.max(0, Math.min(100, Number(value)));
          return '<div class="card score-card ss-row">' +
            '<div class="ss-mark">' + x[0] + '</div>' +
            '<div class="ss-copy"><b>' + x[2] + '</b><small>' + x[1] + ' · وزن ' + x[4] + '٪</small>' +
              '<div class="ss-meter meter"><i style="width:' + width + '%"></i></div>' +
            '</div>' +
            '<strong class="ss-value">' + pct(value) + '</strong>' +
          '</div>';
        }).join('') +
      '</div>' +
      '<div class="score-meta">' +
        '<span class="ss-meta-item"><em>الدرجة الخام</em>' + F.num(s.raw_score) + '</span>' +
        '<span class="ss-meta-item"><em>الدرجة النهائية</em>' + F.num(s.final_score) + '</span>' +
        '<span class="ss-meta-item"><em>التصنيف</em>' + esc(arRating(s.rating)) + '</span>' +
        '<span class="ss-meta-item"><em>Track Factor</em>' + F.num(s.track_factor) + '</span>' +
        '<span class="ss-meta-item"><em>المنهجية</em>' + esc(s.methodology_version || 'غير متاح') + '</span>' +
        '<span class="ss-meta-item"><em>Data Quality ·</em>' + esc(s.data_quality || 'غير متاح') + '</span>' +
      '</div>' +
      '<div class="score-note">' + esc(status.reason || '') + '</div>';
  }

  window.FUND_TABS = window.FUND_TABS || {};
  window.FUND_TABS.smartscore = render;
})();
