/* Category context layer: consumes canonical category + macro services only. */
(function (window) {
  'use strict';
  const DATA = window.KHATER_DATA || {};
  const service = DATA.categories;
  const escape = DATA.escape || ((v) => String(v == null ? '' : v).replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c])));
  if (!service || typeof service.getUniverse !== 'function' || typeof service.getMacroContext !== 'function') return;

  const fmt = (v, digits = 2) => v == null || !Number.isFinite(Number(v)) ? '—' : Number(v).toLocaleString('en-US', { maximumFractionDigits: digits });
  const pct = (v) => v == null || !Number.isFinite(Number(v)) ? '—' : ((Number(v) >= 0 ? '+' : '') + Number(v).toFixed(2) + '%');
  const direction = (v) => v == null ? 'flat' : Number(v) > 0.05 ? 'up' : Number(v) < -0.05 ? 'down' : 'flat';
  const labels = { usd_egp_mid: 'الدولار / جنيه', gold_egp_oz: 'الذهب بالجنيه', egx30_close: 'EGX30' };

  async function boot() {
    const host = document.getElementById('categoryContext');
    if (!host) return;
    try {
      const [universe, macro] = await Promise.all([service.getUniverse(), service.getMacroContext()]);
      const funds = universe.funds || [];
      const scores = universe.scores || new Map();
      const rated = funds.filter(f => { const s = scores.get(String(f.fund_id)); return s && s.final_score != null; }).length;
      const coverage = funds.length ? Math.round(rated / funds.length * 100) : 0;
      const series = (macro.series || []).filter(x => x.latest && !x.error);
      const risk = series.find(x => x.key === 'usd_egp_mid');
      const gold = series.find(x => x.key === 'gold_egp_oz');
      const egx = series.find(x => x.key === 'egx30_close');
      const regime = risk && risk.changePct > 0.2 ? 'ضغط على الجنيه' : egx && egx.changePct > 0.3 ? 'زخم إيجابي في الأسهم' : gold && gold.changePct > 0.3 ? 'زخم في الذهب' : 'نظام مختلط';
      const lead = regime === 'ضغط على الجنيه' ? 'ابدأ بالفئات التي تتحمل حركة العملة أو ترتبط بأصول تحوطية، ثم افحص الجودة والبيانات.' : regime === 'زخم إيجابي في الأسهم' ? 'ابدأ بفئات الأسهم المصرية، ثم اختبر العائد مقابل EGX30 بدل الاعتماد على SmartScore وحده.' : regime === 'زخم في الذهب' ? 'ابدأ بفئات الذهب، مع مقارنة الأداء بالجنيه وتكلفة التحوط والسيولة.' : 'لا توجد إشارة اتجاهية كافية لرفع فئة واحدة تلقائيًا؛ استخدم الخريطة لاكتشاف الفروق ثم افحص الصناديق المؤهلة.';
      host.innerHTML = '<div class="context-head"><div><div class="context-eyebrow">MACRO → CATEGORY CONTEXT</div><h2>قبل أن تختار فئة: ماذا يقول السوق الآن؟</h2><p>' + escape(lead) + '</p></div><div class="context-regime"><span>MARKET REGIME</span><b>' + escape(regime) + '</b><small>' + coverage + '% تغطية SmartScore · ' + rated + ' صندوقًا مقيمًا</small></div></div>' +
        '<div class="context-strip">' + series.map(x => '<div class="context-metric"><span>' + escape(labels[x.key] || x.key) + '</span><b>' + fmt(x.latest.value) + '</b><i class="' + direction(x.changePct) + '">' + pct(x.changePct) + '</i><small>' + escape(x.latest.date) + '</small></div>').join('') + '</div>' +
        '<div class="context-foot"><span>السياق لا يختار صندوقًا تلقائيًا.</span><a href="./macro.html">افهم الاقتصاد أولًا →</a><a href="./categories.html">استكشف الفئات →</a></div>';
    } catch (error) {
      host.innerHTML = '<div class="context-error">تعذر تحميل سياق السوق الآن؛ خريطة الفئات نفسها ما زالت متاحة.</div>';
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})(window);