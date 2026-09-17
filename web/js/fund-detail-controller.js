/*
 * Fund Detail controller
 * Orchestrates page composition only; domain/data logic remains in FUND services/modules.
 */
(function (global) {
  'use strict';

  function has(v) { return v != null && String(v).trim() !== ''; }

  function initials(name) {
    return String(name || 'F').replace(/[()]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 2)
      .map(function (w) { return w.charAt(0); }).join('').toUpperCase() || 'F';
  }

  function logoBox(F, url, name) {
    const ini = initials(name);
    if (!has(url)) return '<div class="hero-logo-box fallback" aria-hidden="true">' + F.esc(ini) + '</div>';
    return '<div class="hero-logo-box"><img class="fund-manager-logo" src="' + F.esc(url) + '" alt="' + F.esc(name) + '" loading="lazy" decoding="async"></div>';
  }

  function navPrice(series) {
    const rows = Array.isArray(series) ? series.filter(function (r) {
      return r && r.nav != null && Number.isFinite(Number(r.nav)) && r.as_of_date;
    }) : [];
    if (!rows.length) return null;
    rows.sort(function (a, b) { return String(a.as_of_date).localeCompare(String(b.as_of_date)); });
    return rows[rows.length - 1];
  }

  function priceDate(value) {
    if (!value) return 'غير متاح';
    const d = new Date(String(value) + 'T00:00:00Z');
    if (Number.isNaN(d.getTime())) return String(value);
    return new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(d);
  }

  function seriesLatest(rows) {
    const valid = Array.isArray(rows) ? rows.filter(function (r) {
      return r && r.value != null && Number.isFinite(Number(r.value)) && r.ts_date;
    }).sort(function (a, b) { return String(a.ts_date).localeCompare(String(b.ts_date)); }) : [];
    if (!valid.length) return null;
    const last = valid[valid.length - 1];
    const prev = valid.length > 1 ? valid[valid.length - 2] : null;
    const value = Number(last.value);
    const change = prev && Number(prev.value) !== 0 ? ((value - Number(prev.value)) / Number(prev.value)) * 100 : null;
    return { value: value, date: last.ts_date, change: change };
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
    const key = String(v || '').trim().toLowerCase();
    return map[key] || v || '—';
  }

  function arQual(v) {
    const s = String(v || '').trim().toLowerCase();
    if (!s) return '—';
    if (s.indexOf('unqual') >= 0 || s === 'not qualified') return 'غير مؤهل';
    if (s.indexOf('qual') >= 0) return 'مؤهل';
    return v;
  }

  function macroCard(F, label, data) {
    if (!data) {
      return '<div class="macro-context-metric"><span>' + F.esc(label) + '</span><b>—</b><small>بيانات غير متاحة</small></div>';
    }
    const c = data.change == null ? '' : data.change >= 0 ? 'good' : 'warn';
    const ch = data.change == null ? '—' : (data.change >= 0 ? '+' : '') + data.change.toFixed(2) + '%';
    return '<div class="macro-context-metric ' + c + '"><span>' + F.esc(label) + '</span><b>' + F.esc(F.num(data.value)) + '</b><small>' + ch + ' · ' + F.esc(data.date) + '</small></div>';
  }

  async function renderMacroContext(F, fund) {
    const host = document.getElementById('fund-market-context');
    const M = global.KHATER_DATA && global.KHATER_DATA.macro;
    if (!host || !M || typeof M.getSeries !== 'function') return;
    const keys = [
      ['usd_egp_mid', 'الدولار / جنيه'],
      ['gold_egp_oz', 'الذهب / جنيه'],
      ['egx30_close', 'EGX30']
    ];
    const results = await Promise.all(keys.map(async function (x) {
      try { return { meta: x, data: seriesLatest(await M.getSeries(x[0])) }; }
      catch (e) { return { meta: x, data: null }; }
    }));
    const valid = results.map(function (x) { return x.data; }).filter(Boolean);
    const positive = valid.filter(function (x) { return x.change != null && x.change > 0; }).length;
    const negative = valid.filter(function (x) { return x.change != null && x.change < 0; }).length;
    let regime = 'سوق مختلط';
    let copy = 'البيئة العامة ليست في اتجاه واحد؛ لذلك تُقرأ نتيجة الصندوق مع فئته والمرجع الخاص به.';
    if (positive >= 2) {
      regime = 'زخم صاعد في المراجع';
      copy = 'عدة مراجع رئيسية تتحرك صعوداً. هذا لا يعني أن الصندوق أفضل، بل يرفع أهمية المقارنة بالمرجع.';
    } else if (negative >= 2) {
      regime = 'ضغط على المراجع الرئيسية';
      copy = 'عدة مراجع رئيسية تتحرك هبوطاً. الأداء السالب يحتاج فصل أثر السوق عن أثر الإدارة.';
    }
    const metrics = results.map(function (x) { return macroCard(F, x.meta[1], x.data); }).join('');
    host.innerHTML =
      '<section class="decision-card" aria-label="السياق السوقي للصندوق">' +
        '<div class="decision-kicker">سياق السوق</div>' +
        '<div class="decision-main">' +
          '<div><h2>' + F.esc(regime) + '</h2><p>' + F.esc(copy) + '</p>' +
          '<p class="decision-category-note">الفئة: <strong>' + F.esc(fund.category || 'غير محددة') + '</strong> · ليست توصية شراء أو بيع.</p></div>' +
        '</div>' +
        '<div class="decision-grid macro-context-grid">' + metrics + '</div>' +
        '<div class="decision-path"><b>الاقتصاد</b><i>←</i><b>الفئة</b><i>←</i><b>المرجع</b><i>←</i><b>الصندوق</b></div>' +
      '</section>';
  }

  const TAB_COPY = {
    performance: ['العائد الرسمي', 'السجل المنشور للعائد المتحرك حسب الأفق المختار.'],
    risk: ['المخاطر', 'درجة المخاطر والمنهج المحفوظ في التقييم، دون إعادة حساب.'],
    benchmark: ['مقارنة السوق', 'أين يقف الصندوق أمام المراجع المتاحة لنفس الفترة.'],
    smartscore: ['مكونات SmartScore', 'تفكيك الدرجة إلى أوزانها الخمسة من التقييم المحفوظ.'],
    evidence: ['الدليل والمنهج', 'المدخلات المحفوظة والتحذيرات وقابلية التحقق.'],
    profile: ['ملف الصندوق', 'الهوية التشغيلية والمستندات والروابط الرسمية.']
  };

  function render(F, app, d) {
    const f = d.fund;
    const s = d.score;
    F.performance = d.performance;
    F.officialSeriesByHorizon = d.officialSeriesByHorizon || {};
    F.navSeries = d.navSeries || [];
    F.prices = d.prices || [];
    F.evidence = d.evidence || null;
    F.fund = f;
    F.score = s;
    F.bundle = d;
    const profile = (f.metadata && f.metadata.profile) || {};
    const manager = (profile.manager_name_ar || profile.manager_name_en || f.management_company || '—');
    const score = s.final_score == null ? '—' : Number(s.final_score).toFixed(1);
    const h = new URLSearchParams(location.search).get('h') || 'last12m';
    const officialSeries = F.officialSeriesByHorizon[h] || [];
    const official = officialSeries[officialSeries.length - 1];
    const heroReturn = official ? F.pct(official.return_pct) : '—';
    const heroDate = official ? official.report_date : 'بيانات غير متاحة';
    const retClass = official && Number(official.return_pct) < 0 ? 'neg' : 'pos';
    const latestNav = navPrice(F.navSeries || F.prices);
    const navValue = latestNav ? F.num(latestNav.nav) : '—';
    const navDate = latestNav ? priceDate(latestNav.as_of_date) : 'غير متاح';
    const navCurrency = latestNav && latestNav.currency ? latestNav.currency : 'ج.م.';
    const ratingAr = arRating(s.rating);
    const confAr = arConf(s.data_confidence);
    const qualAr = arQual(s.qualification_status);

    app.innerHTML =
      '<section class="hero hero-pro dna-hero">' +
        '<div class="dna-identity">' +
          logoBox(F, profile.manager_logo_url, manager) +
          '<div class="hero-copy">' +
            '<div class="eyebrow">ملف الصندوق</div>' +
            '<h1>' + F.esc(f.canonical_name) + '</h1>' +
            '<div class="manager">' + F.esc(manager) + '</div>' +
            '<div class="tags">' +
              '<span class="tag">' + F.esc(f.category || 'فئة غير محددة') + '</span>' +
              '<span class="tag">' + F.esc(s.methodology_version || '—') + '</span>' +
              '<span class="tag">' + F.esc(s.data_tier || '—') + '</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="hero-price-panel" aria-label="سعر الوثيقة">' +
          '<div class="hero-price-label">سعر الوثيقة</div>' +
          '<div class="hero-price-value">' + navValue + ' <span>' + F.esc(navCurrency) + '</span></div>' +
          '<div class="hero-price-meta">آخر تحديث: ' + F.esc(navDate) + '</div>' +
          '<a class="hero-price-compare" href="./funds.html?compare=' + encodeURIComponent(F.id) + '">قارن</a>' +
        '</div>' +
      '</section>' +
      '<section class="pulse">' +
        '<div class="metric primary"><div class="muted">SmartScore</div><span class="metric-value">' + score + '</span><span class="pill">' + F.esc(ratingAr) + '</span></div>' +
        '<div class="metric"><div class="muted">العائد الرسمي · ' + F.esc(F.L[h] || h) + '</div><span class="metric-value ' + retClass + '">' + heroReturn + '</span><div class="note">' + F.esc(heroDate) + '</div></div>' +
        '<div class="metric"><div class="muted">ثقة البيانات</div><span class="metric-value metric-compact">' + F.esc(confAr) + '</span><div class="note">' + F.esc(s.data_quality || '') + '</div></div>' +
        '<div class="metric"><div class="muted">التأهل</div><span class="metric-value metric-qualification">' + F.esc(qualAr) + '</span><div class="note">معامل المسار · ' + (s.track_factor == null ? '—' : Number(s.track_factor).toFixed(2)) + '</div></div>' +
      '</section>' +
      '<div class="dna-read">' +
        '<div id="decision-layer"></div>' +
        '<div id="fund-market-context"></div>' +
      '</div>' +
      '<div class="tabs" role="tablist" aria-label="محاور تحليل الصندوق">' +
        '<button id="tab-performance" class="active" role="tab" aria-selected="true" aria-controls="performance-panel" data-tab="performance"><b>01</b><span>العائد</span><small>السجل الرسمي</small></button>' +
        '<button id="tab-risk" role="tab" aria-selected="false" aria-controls="risk-panel" data-tab="risk"><b>02</b><span>المخاطر</span><small>منهج التقييم</small></button>' +
        '<button id="tab-benchmark" role="tab" aria-selected="false" aria-controls="benchmark-panel" data-tab="benchmark"><b>03</b><span>المرجع</span><small>مقابل السوق</small></button>' +
        '<button id="tab-smartscore" role="tab" aria-selected="false" aria-controls="smartscore-panel" data-tab="smartscore"><b>04</b><span>التقييم</span><small>مكونات الدرجة</small></button>' +
        '<button id="tab-evidence" role="tab" aria-selected="false" aria-controls="evidence-panel" data-tab="evidence"><b>05</b><span>الدليل</span><small>المنهج والمدخلات</small></button>' +
        '<button id="tab-profile" role="tab" aria-selected="false" aria-controls="profile-panel" data-tab="profile"><b>06</b><span>الملف</span><small>بيانات الصندوق</small></button>' +
      '</div>' +
      '<div class="tab-context"><div><strong id="tab-context-title">العائد الرسمي</strong><span id="tab-context-copy">السجل المنشور للعائد المتحرك حسب الأفق المختار.</span></div><span class="tab-context-status">بيانات حية</span></div>' +
      '<section id="performance-panel" class="tab-panel active" role="tabpanel" aria-labelledby="tab-performance"><div id="performance-tab"></div></section>' +
      '<section id="risk-panel" class="tab-panel" role="tabpanel" aria-labelledby="tab-risk"><div id="risk-tab"></div></section>' +
      '<section id="benchmark-panel" class="tab-panel" role="tabpanel" aria-labelledby="tab-benchmark"><div id="benchmark-tab"></div></section>' +
      '<section id="smartscore-panel" class="tab-panel" role="tabpanel" aria-labelledby="tab-smartscore"><div id="smartscore-tab"></div></section>' +
      '<section id="evidence-panel" class="tab-panel" role="tabpanel" aria-labelledby="tab-evidence"><div id="evidence-tab"></div></section>' +
      '<section id="profile-panel" class="tab-panel" role="tabpanel" aria-labelledby="tab-profile"><div id="profile-tab"></div></section>';
  }

  async function boot() {
    const F = global.FUND;
    const app = document.getElementById('app');
    if (!F || !app) throw new Error('Fund detail runtime is not initialized');
    try {
      const d = await F.loadFund();
      render(F, app, d);
      await renderMacroContext(F, d.fund);
      const logo = app.querySelector('.fund-manager-logo');
      if (logo) logo.addEventListener('error', function () {
        const parent = logo.parentNode;
        if (!parent) return;
        parent.classList.add('fallback');
        logo.remove();
        parent.textContent = initials(d.fund && d.fund.metadata && d.fund.metadata.profile && (d.fund.metadata.profile.manager_name_ar || d.fund.metadata.profile.manager_name_en || d.fund.management_company));
      }, { once: true });
      if (global.FUND_DECISION_LAYER && typeof global.FUND_DECISION_LAYER.render === 'function') global.FUND_DECISION_LAYER.render(d);
      document.querySelectorAll('.tabs button').forEach(function (b) {
        b.addEventListener('click', async function () {
          document.querySelectorAll('.tabs button').forEach(function (x) {
            const on = x === b;
            x.classList.toggle('active', on);
            x.setAttribute('aria-selected', on ? 'true' : 'false');
          });
          document.querySelectorAll('.tab-panel').forEach(function (x) { x.classList.toggle('active', x.id === b.dataset.tab + '-panel'); });
          const info = TAB_COPY[b.dataset.tab] || [];
          document.getElementById('tab-context-title').textContent = info[0] || '';
          document.getElementById('tab-context-copy').textContent = info[1] || '';
          const target = document.getElementById(b.dataset.tab + '-tab');
          target.classList.add('is-loading');
          try {
            const fn = global.FUND_TABS[b.dataset.tab];
            if (fn) await fn();
          } catch (e) {
            target.innerHTML = '<div class="empty"><strong>تعذر تحميل هذا المحور</strong><p>' + F.esc(e.message) + '</p></div>';
          } finally {
            target.classList.remove('is-loading');
          }
        });
      });
      await global.FUND_TABS.performance();
    } catch (e) {
      app.innerHTML = '<div class="empty"><h2>تعذر تحميل ملف الصندوق</h2><p>' + F.esc(e.message) + '</p><p><a href="./funds.html">العودة إلى الصناديق</a></p></div>';
      console.error(e);
    }
  }

  global.FUND_DETAIL_CONTROLLER = { boot: boot };
})(window);
