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
    if (!has(url)) return '<div class="hero-logo-box fallback">' + F.esc(ini) + '</div>';
    return '<div class="hero-logo-box"><img src="' + F.esc(url) + '" alt="' + F.esc(name) + '" loading="lazy" decoding="async" onerror="var p=this.parentNode;this.remove();if(p){p.classList.add(\'fallback\');p.textContent=\'' + F.esc(ini) + '\'}"></div>';
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

  function macroCard(F, key, label, data, suffix) {
    if (!data) return '<div class="decision-grid"><div><span>' + F.esc(label) + '</span><b>—</b><small>بيانات غير متاحة</small></div></div>';
    const c = data.change == null ? '' : data.change >= 0 ? 'good' : 'warn';
    const ch = data.change == null ? '—' : (data.change >= 0 ? '+' : '') + data.change.toFixed(2) + '%';
    return '<div class="macro-context-metric ' + c + '"><span>' + F.esc(label) + '</span><b>' + F.esc(F.num(data.value)) + (suffix || '') + '</b><small>' + ch + ' · ' + F.esc(data.date) + '</small></div>';
  }

  async function renderMacroContext(F, fund) {
    const host = document.getElementById('fund-market-context');
    const M = global.KHATER_DATA && global.KHATER_DATA.macro;
    if (!host || !M || typeof M.getSeries !== 'function') return;
    const keys = [
      ['usd_egp_mid', 'الدولار / جنيه', ''],
      ['gold_egp_oz', 'الذهب / جنيه', ''],
      ['egx30_close', 'EGX30', '']
    ];
    const results = await Promise.all(keys.map(async function (x) {
      try { return { meta: x, data: seriesLatest(await M.getSeries(x[0])) }; }
      catch (e) { return { meta: x, data: null }; }
    }));
    const valid = results.map(function (x) { return x.data; }).filter(Boolean);
    const positive = valid.filter(function (x) { return x.change != null && x.change > 0; }).length;
    const negative = valid.filter(function (x) { return x.change != null && x.change < 0; }).length;
    let regime = 'سوق مختلط';
    let copy = 'البيئة العامة ليست في اتجاه واحد؛ لذلك يجب قراءة أداء الصندوق مع فئته والمرجع الخاص به.';
    if (positive >= 2) { regime = 'زخم صاعد في المراجع الرئيسية'; copy = 'عدة مراجع رئيسية تتحرك صعودًا في آخر مشاهدة؛ لا يعني ذلك أن الصندوق أفضل، بل يرفع أهمية المقارنة بالـBenchmark.'; }
    else if (negative >= 2) { regime = 'ضغط واسع على المراجع الرئيسية'; copy = 'عدة مراجع رئيسية تتحرك هبوطًا؛ الأداء السالب للصندوق يحتاج فصل أثر السوق عن أثر إدارة الصندوق.'; }
    const metrics = results.map(function (x) { return macroCard(F, x.meta[0], x.meta[1], x.data, ''); }).join('');
    host.innerHTML = '<section class="decision-card" aria-label="السياق السوقي للصندوق"><div class="decision-kicker">MARKET CONTEXT · FUND DNA</div><div class="decision-main"><div><h2>' + F.esc(regime) + '</h2><p>' + F.esc(copy) + '</p><p style="margin-top:6px">الفئة: <strong>' + F.esc(fund.category || 'غير محددة') + '</strong> · لا توجد توصية شراء أو بيع.</p></div><div class="decision-score mid"><span>CONTEXT</span><b>LIVE</b><small>Macro + Fund</small></div></div><div class="decision-grid macro-context-grid">' + metrics + '</div><div class="decision-path"><b>Macro</b><i>→</i><b>Category</b><i>→</i><b>Benchmark</b><i>→</i><b>Fund</b></div></section>';
  }

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
    const navCurrency = latestNav && latestNav.currency ? latestNav.currency : 'ج.م.‏';

    app.innerHTML = '<section class="hero hero-pro"><div class="hero-price-panel" aria-label="سعر الوثيقة"><div class="hero-price-label">سعر الوثيقة</div><div class="hero-price-value">' + navValue + ' <span>' + F.esc(navCurrency) + '</span></div><div class="hero-price-meta">آخر تحديث: ' + F.esc(navDate) + '</div><a class="hero-price-compare" href="./funds.html?compare=' + encodeURIComponent(F.id) + '">قارن</a></div>' + logoBox(F, profile.manager_logo_url, manager) + '<div class="hero-copy"><div class="eyebrow">FUND DNA · INSTITUTIONAL PROFILE</div><h1>' + F.esc(f.canonical_name) + '</h1><div class="manager">' + F.esc(manager) + '</div><div class="tags"><span class="tag">' + F.esc(f.category) + '</span><span class="tag">' + F.esc(s.data_tier || '—') + '</span><span class="tag">' + F.esc(s.methodology_version || '—') + '</span></div></div></section>' +
      '<section class="pulse"><div class="metric primary"><div class="muted">SMART SCORE</div><span class="metric-value">' + score + '</span><span class="pill">' + F.esc(s.rating || 'NOT RATED') + '</span></div><div class="metric"><div class="muted">RETURN · ' + F.esc(F.L[h] || h) + '</div><span class="metric-value ' + retClass + '">' + heroReturn + '</span><div class="note">' + F.esc(heroDate) + '</div></div><div class="metric"><div class="muted">DATA CONFIDENCE</div><span class="metric-value" style="font-size:24px">' + F.esc(s.data_confidence || '—') + '</span><div class="note">' + F.esc(s.data_quality || '') + '</div></div><div class="metric"><div class="muted">QUALIFICATION</div><span class="metric-value" style="font-size:22px">' + F.esc(s.qualification_status || '—') + '</span><div class="note">Track Factor · ' + (s.track_factor == null ? '—' : Number(s.track_factor).toFixed(2)) + '</div></div></section>' +
      '<div id="fund-market-context"></div><div id="decision-layer"></div>' +
      '<div class="tabs" role="tablist" aria-label="Fund DNA analytical sections"><button class="active" role="tab" aria-selected="true" data-tab="performance"><b>01</b><span>PERFORMANCE</span><small>العائد والحركة</small></button><button role="tab" aria-selected="false" data-tab="risk"><b>02</b><span>RISK</span><small>مؤشر المخاطر</small></button><button role="tab" aria-selected="false" data-tab="benchmark"><b>03</b><span>BENCHMARK</span><small>مقارنة السوق</small></button><button role="tab" aria-selected="false" data-tab="smartscore"><b>04</b><span>SMARTSCORE</span><small>مكونات التقييم</small></button><button role="tab" aria-selected="false" data-tab="evidence"><b>05</b><span>EVIDENCE</span><small>الدليل والمنهج</small></button><button role="tab" aria-selected="false" data-tab="profile"><b>06</b><span>FUND PROFILE</span><small>بيانات الصندوق</small></button></div>' +
      '<div class="tab-context"><div><strong id="tab-context-title">Performance Intelligence</strong><span id="tab-context-copy">تحليل العائد وسجل الأداء المتاح فعليًا.</span></div><span class="tab-context-status">LIVE DATA</span></div>' +
      '<section id="performance-panel" class="tab-panel active"><div id="performance-tab"></div></section><section id="risk-panel" class="tab-panel"><div id="risk-tab"></div></section><section id="benchmark-panel" class="tab-panel"><div id="benchmark-tab"></div></section><section id="smartscore-panel" class="tab-panel"><div id="smartscore-tab"></div></section><section id="evidence-panel" class="tab-panel"><div id="evidence-tab"></div></section><section id="profile-panel" class="tab-panel"><div id="profile-tab"></div></section>';
  }

  async function boot() {
    const F = global.FUND;
    const app = document.getElementById('app');
    if (!F || !app) throw new Error('Fund detail runtime is not initialized');
    try {
      const d = await F.loadFund();
      render(F, app, d);
      await renderMacroContext(F, d.fund);
      if (global.FUND_DECISION_LAYER && typeof global.FUND_DECISION_LAYER.render === 'function') global.FUND_DECISION_LAYER.render(d);
      document.querySelectorAll('.tabs button').forEach(function (b) {
        b.addEventListener('click', async function () {
          document.querySelectorAll('.tabs button').forEach(function (x) {
            const on = x === b;
            x.classList.toggle('active', on);
            x.setAttribute('aria-selected', on ? 'true' : 'false');
          });
          document.querySelectorAll('.tab-panel').forEach(function (x) { x.classList.toggle('active', x.id === b.dataset.tab + '-panel'); });
          const info = { performance:['Performance Intelligence','تحليل العائد وسجل الأداء المتاح فعليًا.'], risk:['Risk Intelligence','قراءة مركزة للمخاطر والعوامل المؤثرة.'], benchmark:['Market Context','مقارنة الصندوق بالمؤشرات والبدائل.'], smartscore:['SmartScore Architecture','تفكيك الدرجة إلى مكوناتها الأساسية.'], evidence:['Evidence & Method','مصادر البيانات والمنهجية وقابلية التحقق.'], profile:['Fund Profile','الهوية التشغيلية والمستندات والبيانات الرسمية.'] }[b.dataset.tab] || [];
          document.getElementById('tab-context-title').textContent = info[0] || '';
          document.getElementById('tab-context-copy').textContent = info[1] || '';
          const target = document.getElementById(b.dataset.tab + '-tab');
          target.classList.add('is-loading');
          try { const fn = global.FUND_TABS[b.dataset.tab]; if (fn) await fn(); }
          catch (e) { target.innerHTML = '<div class="empty"><strong>تعذر تحميل هذا المحور</strong><p>' + F.esc(e.message) + '</p></div>'; }
          finally { target.classList.remove('is-loading'); }
        });
      });
      await global.FUND_TABS.performance();
    } catch (e) {
      app.innerHTML = '<div class="empty"><h2>تعذر تحميل FUND DNA</h2><p>' + F.esc(e.message) + '</p><p><a href="./funds.html">العودة إلى الصناديق</a></p></div>';
      console.error(e);
    }
  }

  global.FUND_DETAIL_CONTROLLER = { boot: boot };
})(window);