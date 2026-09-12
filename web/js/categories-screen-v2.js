/* Categories screen controller.
 * Rendering/filtering only. All financial data access belongs to categories-service.js.
 */
(function (window) {
  'use strict';
  const service = window.KHATER_DATA && window.KHATER_DATA.categories;
  const escape = (window.KHATER_DATA && window.KHATER_DATA.escape) || ((v) => String(v == null ? '' : v).replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c])));
  if (!service) throw new Error('Categories data service is required.');

  const $ = (id) => document.getElementById(id);
  const N = (v) => { const n = Number(v); return v == null || !Number.isFinite(n) ? null : n; };
  const A = (v) => Array.isArray(v) ? v : [];
  const S = (v) => v == null ? '' : String(v);
  const state = { funds: [], scores: new Map(), filtered: [], selected: null, view: 'map', heatCategory: null };
  const text = (id, v) => { const e = $(id); if (e) e.textContent = v; };
  const html = (id, v) => { const e = $(id); if (e) e.innerHTML = v; };

  function group() {
    const map = new Map();
    state.filtered.forEach((fund) => {
      const key = S(fund.category) || 'غير مصنف';
      if (!map.has(key)) map.set(key, { name: key, funds: [], rated: 0, total: 0, n: 0 });
      const g = map.get(key);
      g.funds.push(fund);
      const score = N((state.scores.get(String(fund.fund_id)) || {}).final_score);
      if (score != null) { g.rated++; g.total += score; g.n++; }
    });
    return Array.from(map.values()).map(g => ({
      ...g,
      avg: g.n ? g.total / g.n : null,
      coverage: g.funds.length ? g.rated / g.funds.length : 0
    })).sort((a, b) => b.funds.length - a.funds.length);
  }

  function apply() {
    const q = S($('search') && $('search').value).trim().toLowerCase();
    const sr = S($('score') && $('score').value);
    const cf = S($('confidence') && $('confidence').value);
    state.filtered = state.funds.filter((f) => {
      const s = state.scores.get(String(f.fund_id)) || {};
      const hay = [f.canonical_name, f.management_company, f.category].map(x => S(x).toLowerCase()).join(' ');
      if (q && !hay.includes(q)) return false;
      if (cf && S(s.data_confidence) !== cf) return false;
      const v = N(s.final_score);
      if (sr === '90' && (v == null || v < 90)) return false;
      if (sr === '75' && (v == null || v < 75 || v >= 90)) return false;
      if (sr === '50' && (v == null || v < 50 || v >= 75)) return false;
      if (sr === '0' && (v == null || v >= 50)) return false;
      return true;
    });
    state.heatCategory = null;
    render();
  }

  function quality(g) { return g && g.avg != null ? (g.avg >= 75 ? 'good' : g.avg >= 50 ? 'warn' : 'bad') : 'bad'; }

  function renderMap(groups) {
    const stage = $('mapStage'); if (!stage) return;
    stage.innerHTML = '';
    if (!groups.length) { stage.innerHTML = '<div class="loading">لا توجد بيانات مطابقة للفلاتر الحالية.</div>'; text('visibleCount', 0); return; }
    const max = Math.max(1, ...groups.map(g => g.funds.length));
    const cols = groups.length <= 4 ? 2 : groups.length <= 8 ? 3 : 4;
    const rows = Math.ceil(groups.length / cols);
    groups.forEach((g, i) => {
      const row = Math.floor(i / cols), col = i % cols;
      const b = document.createElement('button');
      b.className = 'bubble ' + quality(g);
      b.style.left = Math.min(88, 18 + (col + .5) * (64 / cols) + (row % 2 ? 3 : 0)) + '%';
      b.style.top = Math.min(86, 17 + (row + .5) * (66 / Math.max(rows, 1))) + '%';
      const size = 72 + 125 * Math.sqrt(g.funds.length / max);
      b.style.width = Math.round(size) + 'px'; b.style.height = Math.round(size) + 'px';
      b.innerHTML = '<div><div class="b-name">' + escape(g.name) + '</div><div class="b-count">' + g.funds.length + '</div><div class="b-score">' + (g.avg == null ? 'NO SCORE' : 'AVG ' + g.avg.toFixed(1)) + '</div></div>';
      b.onclick = () => { state.selected = g.name; render(); const d = $('detail'); if (d) d.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
      stage.appendChild(b);
    });
    text('visibleCount', state.filtered.length);
  }

  function scoreColor(v) { if (v == null) return '#202934'; const x = Math.max(0, Math.min(100, v)) / 100; return 'hsl(' + (8 + x * 145) + ' 54% ' + (28 + x * 9) + '%)'; }
  function scoreOf(f) { return state.scores.get(String(f && f.fund_id)) || null; }
  function scoreVal(f) { return N((scoreOf(f) || {}).final_score); }

  function renderHeatmap(groups) {
    const canvas = $('heatCanvas'); if (!canvas) return;
    groups = A(groups).filter(g => g && g.funds.length).slice().sort((a,b) => b.funds.length - a.funds.length || String(a.name).localeCompare(String(b.name), 'ar'));
    canvas.innerHTML = '';
    const funds = state.filtered;
    const rated = funds.filter(f => scoreVal(f) != null).length;
    const vals = funds.map(scoreVal).filter(v => v != null);
    text('heatFunds', funds.length); text('heatRated', rated); text('heatCoverage', funds.length ? Math.round(rated / funds.length * 100) + '%' : '0%');
    text('heatTop', vals.length ? Math.max(...vals).toFixed(1) : '—'); text('heatCats', groups.length); text('heatMode', state.heatCategory ? 'FOCUS' : 'ATLAS');
    const back = $('heatBack'), all = $('heatAll');
    if (back) { back.style.display = state.heatCategory ? 'inline-block' : 'none'; back.textContent = '← كل الفئات'; }
    if (all) { all.classList.toggle('active', !state.heatCategory); all.textContent = 'كل الفئات'; }
    if (!groups.length) { canvas.innerHTML = '<div class="loading">لا توجد بيانات مطابقة للفلاتر الحالية.</div>'; return; }
    const active = state.heatCategory ? groups.filter(g => g.name === state.heatCategory) : groups;
    const list = state.heatCategory && active[0] ? [active[0]] : groups;
    const intro = document.createElement('div'); intro.className = 'atlas-intro';
    intro.innerHTML = '<div><b>' + (state.heatCategory ? 'استكشاف فئة واحدة' : 'Fund Atlas') + '</b><span>' + (state.heatCategory ? 'أعلى الصناديق داخل الفئة المختارة' : 'كل بطاقة تلخص حجم الفئة، جودة التغطية، وتوزيع SmartScore') + '</span></div><i>المساحة ليست مقياسًا استثماريًا</i>';
    canvas.appendChild(intro);
    list.forEach((g, index) => {
      const scores = g.funds.map(scoreVal).filter(v => v != null);
      const avg = scores.length ? scores.reduce((a,v) => a + v, 0) / scores.length : null;
      const dist = [0,0,0,0,0]; scores.forEach(v => { dist[v >= 80 ? 4 : v >= 60 ? 3 : v >= 40 ? 2 : v >= 20 ? 1 : 0]++; });
      const card = document.createElement('article'); card.className = 'atlas-card' + (state.selected === g.name ? ' selected' : '') + (g.funds.length >= 20 ? ' atlas-large' : '');
      const top = g.funds.slice().sort((a,b) => (scoreVal(b) ?? -1) - (scoreVal(a) ?? -1) || String(a.canonical_name).localeCompare(String(b.canonical_name), 'ar')).slice(0,6);
      card.innerHTML = '<div class="atlas-card-head"><div><div class="atlas-kicker">CATEGORY ' + String(index + 1).padStart(2,'0') + '</div><h3>' + escape(g.name) + '</h3></div><div class="atlas-count"><b>' + g.funds.length + '</b><span>صندوق</span></div></div>' +
        '<div class="atlas-summary"><span>تغطية ' + Math.round(g.coverage * 100) + '%</span><strong>' + (avg == null ? '—' : avg.toFixed(1)) + '</strong><span>متوسط SmartScore</span></div>' +
        '<div class="atlas-dist"><i style="--n:' + dist[0] + '" class="weak"></i><i style="--n:' + dist[1] + '" class="low"></i><i style="--n:' + dist[2] + '" class="mid"></i><i style="--n:' + dist[3] + '" class="good"></i><i style="--n:' + dist[4] + '" class="excellent"></i></div><div class="atlas-legend"><span>ضعيف</span><span>قوي</span></div>' +
        '<div class="atlas-funds">' + top.map(f => { const v = scoreVal(f); return '<a href="./fund.html?id=' + encodeURIComponent(S(f.fund_id)) + '" title="' + escape(f.canonical_name) + '"><span>' + escape(f.canonical_name) + '</span><b class="score-' + (v == null ? 'none' : v >= 60 ? 'good' : v >= 40 ? 'mid' : 'weak') + '">' + (v == null ? '—' : v.toFixed(1)) + '</b></a>'; }).join('') + '</div>' +
        '<div class="atlas-more">' + (g.funds.length > top.length ? '+' + (g.funds.length - top.length) + ' صندوق آخر · انقر للتفاصيل' : 'انقر لعرض الفئة') + '</div>';
      card.addEventListener('click', e => { if (e.target.closest('a')) return; state.selected = g.name; state.heatCategory = g.name; render(); });
      canvas.appendChild(card);
    });
  }

  function renderList(groups) {
    if (!groups.length) { html('categoryList', '<div class="loading">لا توجد فئات تطابق الفلاتر الحالية.</div>'); return; }
    html('categoryList', groups.map(g => '<div class="cat-row" data-name="' + escape(g.name) + '"><div><div class="cat-name">' + escape(g.name) + '</div><div class="cat-sub">' + g.rated + ' من ' + g.funds.length + ' لديها SmartScore محفوظ</div></div><div class="num">' + g.funds.length + '</div><div class="num">' + (g.avg == null ? '—' : g.avg.toFixed(1)) + '</div><div class="bar"><i style="width:' + Math.round(g.coverage * 100) + '%"></i></div></div>').join(''));
    document.querySelectorAll('.cat-row').forEach(el => el.onclick = () => { state.selected = el.dataset.name; state.heatCategory = el.dataset.name; setView('heat'); render(); });
  }

  function renderDetail(groups) {
    const g = groups.find(x => x && x.name === state.selected);
    if (!g) { html('detail', '<div class="detail-empty">اختر فئة من الخريطة أو القائمة.</div>'); return; }
    const top = g.funds.slice().sort((a,b) => (scoreVal(b) ?? -1) - (scoreVal(a) ?? -1)).slice(0,8);
    html('detail', '<div class="detail-meta">SELECTED CATEGORY</div><h3>' + escape(g.name) + '</h3><div class="detail-meta">حجم الفئة · ' + g.funds.length + ' صندوق</div><div class="detail-kpis"><div class="kpi"><div class="k">عدد الصناديق</div><span class="v">' + g.funds.length + '</span></div><div class="kpi"><div class="k">متوسط SmartScore</div><span class="v">' + (g.avg == null ? '—' : g.avg.toFixed(1)) + '</span></div><div class="kpi"><div class="k">تغطية التقييم</div><span class="v">' + (g.coverage * 100).toFixed(0) + '%</span></div></div><div class="detail-headline">أعلى الصناديق داخل الفئة وفق SmartScore المخزّن</div><div>' + top.map(f => { const s = scoreOf(f) || {}; return '<div class="fund"><div><a href="./fund.html?id=' + encodeURIComponent(S(f.fund_id)) + '"><div class="fund-name">' + escape(f.canonical_name) + '</div></a><div class="fund-manager">' + escape(f.management_company || 'مدير غير متاح') + '</div></div><div class="fund-score">' + (s.final_score == null ? '—' : Number(s.final_score).toFixed(1)) + '</div></div>'; }).join('') + '</div>');
  }

  function renderInsights(groups) {
    if (!groups.length) { html('insights', ''); return; }
    const largest = groups[0];
    const best = groups.filter(g => g.avg != null).slice().sort((a,b) => b.avg - a.avg)[0];
    const coverage = groups.slice().sort((a,b) => b.coverage - a.coverage)[0];
    html('insights', '<div class="insight-card"><div class="k">Largest Category</div><span class="v">' + escape(largest.name) + '</span><p>' + largest.funds.length + ' صندوق.</p></div><div class="insight-card"><div class="k">Highest Average Score</div><span class="v">' + (best ? escape(best.name) + ' · ' + best.avg.toFixed(1) : '—') + '</span><p>متوسط وصفي للصناديق التي لديها SmartScore محفوظ.</p></div><div class="insight-card"><div class="k">Best Data Coverage</div><span class="v">' + (coverage ? escape(coverage.name) + ' · ' + (coverage.coverage * 100).toFixed(0) + '%' : '—') + '</span><p>نسبة الصناديق داخل الفئة التي يتوفر لها تقييم محفوظ.</p></div>');
  }

  function render() { const groups = group(); text('totalCats', groups.length); renderMap(groups); renderHeatmap(groups); renderList(groups); renderDetail(groups); renderInsights(groups); html('mapStatus', '<span class="dot"></span>' + state.filtered.length + ' صندوق ضمن النطاق الحالي'); }
  function setView(v) { state.view = v; document.querySelectorAll('.view-tab').forEach(b => b.classList.toggle('active', b.dataset.view === v)); const pm = $('pane-map'), ph = $('pane-heat'); if (pm) pm.classList.toggle('active', v === 'map'); if (ph) ph.classList.toggle('active', v === 'heat'); if (v === 'heat') setTimeout(() => renderHeatmap(group()), 0); }
  function wire() {
    const search = $('search'), score = $('score'), confidence = $('confidence'), clear = $('clear');
    if (search) search.addEventListener('input', apply); if (score) score.addEventListener('change', apply); if (confidence) confidence.addEventListener('change', apply);
    if (clear) clear.addEventListener('click', () => { if (search) search.value = ''; if (score) score.value = ''; if (confidence) confidence.value = ''; state.selected = null; state.heatCategory = null; apply(); });
    document.querySelectorAll('.view-tab').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
    const back = $('heatBack'), all = $('heatAll'); if (back) back.onclick = () => { state.heatCategory = null; renderHeatmap(group()); }; if (all) all.onclick = () => { state.heatCategory = null; renderHeatmap(group()); };
    window.addEventListener('resize', () => { if (state.view === 'heat') renderHeatmap(group()); });
  }

  async function boot() {
    try {
      const universe = await service.getUniverse();
      state.funds = universe.funds; state.scores = universe.scores; state.filtered = state.funds.slice();
      text('totalFunds', state.funds.length); text('ratedFunds', Array.from(state.scores.values()).filter(s => N(s.final_score) != null).length);
      wire(); render();
      if (new URLSearchParams(location.search).get('view') === 'heat') setView('heat');
    } catch (error) {
      const main = document.querySelector('main');
      if (main) main.innerHTML = '<div class="error"><strong>تعذر تحميل خريطة الفئات</strong>' + escape(error && error.message || error) + '</div>';
      console.error(error);
    }
  }

  boot();
})(window);
