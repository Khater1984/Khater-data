/* Decision layer: connects existing Fund DNA evidence to a concise investor reading. */
(function (window) {
  'use strict';

  function esc(v) {
    return window.FUND && FUND.esc ? FUND.esc(v) : String(v ?? '').replace(/[&<>\"']/g, function (c) {
      return { '&': '&', '<': '<', '>': '>', '"': '"', "'": '&#39;' }[c];
    });
  }

  function scoreClass(v) {
    v = Number(v);
    return v >= 75 ? 'good' : v >= 50 ? 'mid' : v > 0 ? 'weak' : 'none';
  }

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

  function arConf(v) {
    const map = { high: 'مرتفعة', medium: 'متوسطة', moderate: 'متوسطة', low: 'منخفضة' };
    return map[String(v || '').trim().toLowerCase()] || v || '—';
  }

  function arQual(v) {
    const s = String(v || '').trim().toLowerCase();
    if (!s) return '—';
    if (s.indexOf('unqual') >= 0 || s === 'not qualified') return 'غير مؤهل';
    if (s.indexOf('qual') >= 0) return 'مؤهل';
    return v;
  }

  function render(d) {
    const host = document.getElementById('decision-layer');
    if (!host) return;
    const f = d.fund || {};
    const s = d.score || {};
    const score = Number(s.final_score);
    const h = new URLSearchParams(location.search).get('h') || 'last12m';
    const rows = (d.officialSeriesByHorizon && d.officialSeriesByHorizon[h]) || [];
    const last = rows[rows.length - 1] || {};
    const ret = Number(last.return_pct);
    const rating = arRating(s.rating);
    let verdict = 'يحتاج قراءة متأنية';
    let tone = 'neutral';
    if (Number.isFinite(score) && score >= 75 && Number.isFinite(ret) && ret > 0) {
      verdict = 'مرشح قوي ضمن سياقه';
      tone = 'good';
    } else if (Number.isFinite(score) && score < 50) {
      verdict = 'إشارة حذر';
      tone = 'warn';
    } else if (Number.isFinite(ret) && ret < 0) {
      verdict = 'العائد الحالي يحتاج تفسيراً';
      tone = 'warn';
    }
    host.innerHTML =
      '<section class="decision-card ' + tone + '">' +
        '<div class="decision-kicker">قراءة الصندوق</div>' +
        '<div class="decision-main">' +
          '<div><h2>' + esc(verdict) + '</h2><p>قراءة تجميعية من البيانات المحفوظة للصندوق، وليست توصية شراء أو بيع.</p></div>' +
          '<div class="decision-score ' + scoreClass(score) + '"><span>SmartScore</span><b>' + (Number.isFinite(score) ? score.toFixed(1) : '—') + '</b><small>' + esc(rating) + '</small></div>' +
        '</div>' +
        '<div class="decision-grid">' +
          '<div><span>الفئة</span><b>' + esc(f.category || '—') + '</b><small>السياق المسجّل</small></div>' +
          '<div><span>العائد</span><b>' + (Number.isFinite(ret) ? (ret >= 0 ? '+' : '') + ret.toFixed(2) + '%' : '—') + '</b><small>' + esc((window.FUND && FUND.L && FUND.L[h]) || h) + '</small></div>' +
          '<div><span>الثقة</span><b>' + esc(arConf(s.data_confidence)) + '</b><small>' + esc(s.data_quality || '') + '</small></div>' +
        '</div>' +
        '<div class="decision-path"><b>العائد</b><i>←</i><b>المرجع</b><i>←</i><b>الجودة</b><i>←</i><b>الموثوقية</b></div>' +
      '</section>';
  }

  window.FUND_DECISION_LAYER = { render: render };
})(window);
