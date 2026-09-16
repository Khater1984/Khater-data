/* Canonical Categories / Regions experience. Rendering only; financial data comes from categories-service.js. */
(function (window) {
  'use strict';
  const service = window.KHATER_DATA && window.KHATER_DATA.categories;
  const escape = (window.KHATER_DATA && window.KHATER_DATA.escape) || (v => String(v == null ? '' : v).replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c])));
  if (!service) throw new Error('Categories data service is required.');
  const $ = id => document.getElementById(id);
  const num = v => { const n = Number(v); return v == null || !Number.isFinite(n) ? null : n; };
  const text = (id, value) => { const el = $(id); if (el) el.textContent = value; };
  const html = (id, value) => { const el = $(id); if (el) el.innerHTML = value; };
  const state = { funds: [], scores: new Map(), filtered: [], selected: null, view: 'map', heatCategory: null };

  function scoreOf(fund) { return state.scores.get(String(fund.fund_id)) || {}; }
  function scoreValue(fund) { return num(scoreOf(fund).final_score); }

  function groups() {
    const map = new Map();
    state.filtered.forEach(f => {
      const name = f.category || 'غير مصنف';
      if (!map.has(name)) map.set(name, { name, funds: [], rated: 0, total: 0 });
      const g = map.get(name); g.funds.push(f);
      const s = scoreValue(f); if (s != null) { g.rated++; g.total += s; }
    });
    return [...map.values()].map(g => ({ ...g, avg: g.rated ? g.total / g.rated : null, coverage: g.funds.length ? g.rated / g.funds.length : 0 }));
  }

  function sortGroups(list) {
    const mode = $('sort') && $('sort').value || 'count';
    return list.slice().sort((a,b) => mode === 'score' ? ((b.avg ?? -1) - (a.avg ?? -1)) : mode === 'name' ? a.name.localeCompare(b.name, 'ar') : b.funds.length - a.funds.length || a.name.localeCompare(b.name, 'ar'));
  }

  function applyFilters() {
    const q = (($('search') && $('search').value) || '').trim().toLowerCase();
    const filter = $('score') && $('score').value || '';
    state.filtered = state.funds.filter(f => {
      const hay = [f.canonical_name, f.management_company, f.category].join(' ').toLowerCase();
      if (q && !hay.includes(q)) return false;
      const v = scoreValue(f);
      if (filter === '90') return v != null && v >= 90;
      if (filter === '75') return v != null && v >= 75 && v < 90;
      if (filter === '50') return v != null && v >= 50 && v < 75;
      if (filter === '0') return v != null && v < 50;
      return true;
    });
    state.heatCategory = null;
    render();
  }

  function renderBubbleMap(list) {
    const stage = $('mapStage'); if (!stage) return;
    stage.innerHTML = '';
    if (!list.length) { stage.innerHTML = '<div class="loading">لا توجد بيانات مطابقة للفلاتر الحالية.</div>'; return; }
    const max = Math.max(...list.map(g => g.funds.length), 1);
    list.forEach((g, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'bubble ' + (g.avg == null ? 'bad' : g.avg >= 60 ? 'good' : g.avg >= 40 ? 'warn' : 'bad');
      const cols = list.length > 12 ? 4 : list.length > 6 ? 3 : 2, row = Math.floor(i / cols), col = i % cols;
      b.style.left = (12 + (col + .5) * (76 / cols) + (row % 2 ? 2 : 0)) + '%'; b.style.top = Math.min(88, 12 + (row + .5) * (76 / Math.max(1, Math.ceil(list.length / cols)))) + '%';
      const size = 76 + Math.round(124 * Math.sqrt(g.funds.length / max)); b.style.width = size + 'px'; b.style.height = size + 'px';
      b.innerHTML = '<div><div class="b-name">' + escape(g.name) + '</div><div class="b-count">' + g.funds.length + '</div><div class="b-score">' + (g.avg == null ? 'NO SCORE' : 'AVG ' + g.avg.toFixed(1)) + '</div></div>';
      b.onclick = () => { state.selected = g.name; render(); $('detail')?.scrollIntoView({behavior:'smooth',block:'start'}); };
      stage.appendChild(b);
    });
  }

  function renderHeatmap(list) {
    const canvas = $('heatCanvas'); if (!canvas) return;
    const visible = state.heatCategory ? list.filter(g => g.name === state.heatCategory) : list;
    const funds = state.filtered, rated = funds.filter(f => scoreValue(f) != null).length, values = funds.map(scoreValue).filter(v => v != null);
    text('heatFunds', funds.length); text('heatRated', rated); text('heatCoverage', funds.length ? Math.round(rated / funds.length * 100) + '%' : '0%'); text('heatTop', values.length ? Math.max(...values).toFixed(1) : '—'); text('heatCats', list.length); text('heatMode', state.heatCategory ? 'FOCUS' : 'ATLAS');
    $('heatBack')?.classList.toggle('is-hidden', !state.heatCategory); $('heatAll')?.classList.toggle('active', !state.heatCategory);
    canvas.innerHTML = '<div class="atlas-intro"><div><b>' + (state.heatCategory ? 'استكشاف فئة واحدة' : 'Fund Atlas') + '</b><span>' + (state.heatCategory ? 'أعلى الصناديق داخل الفئة المختارة' : 'كل بطاقة تلخص حجم الفئة، جودة التغطية، وتوزيع SmartScore') + '</span></div><i>المساحة ليست مقياسًا استثماريًا</i></div>';
    visible.forEach((g, i) => {
      const card = document.createElement('article'); card.className = 'atlas-card' + (g.funds.length >= 20 ? ' atlas-large' : '') + (state.selected === g.name ? ' selected' : '');
      const top = g.funds.slice().sort((a,b) => (scoreValue(b) ?? -1) - (scoreValue(a) ?? -1)).slice(0,6);
      const dist = [0,0,0,0,0]; g.funds.map(scoreValue).filter(v => v != null).forEach(v => dist[v >= 80 ? 4 : v >= 60 ? 3 : v >= 40 ? 2 : v >= 20 ? 1 : 0]++);
      card.innerHTML = '<div class="atlas-card-head"><div><div class="atlas-kicker">CATEGORY ' + String(i+1).padStart(2,'0') + '</div><h3>' + escape(g.name) + '</h3></div><div class="atlas-count"><b>' + g.funds.length + '</b><span>صندوق</span></div></div><div class="atlas-summary"><span>تغطية ' + Math.round(g.coverage*100) + '%</span><strong>' + (g.avg == null ? '—' : g.avg.toFixed(1)) + '</strong><span>متوسط SmartScore</span></div><div class="atlas-dist"><i style="--n:' + dist[0] + '" class="weak"></i><i style="--n:' + dist[1] + '" class="low"></i><i style="--n:' + dist[2] + '" class="mid"></i><i style="--n:' + dist[3] + '" class="good"></i><i style="--n:' + dist[4] + '" class="excellent"></i></div><div class="atlas-legend"><span>ضعيف</span><span>قوي</span></div><div class="atlas-funds">' + top.map(f => { const v = scoreValue(f); return '<a href="./fund.html?id=' + encodeURIComponent(f.fund_id) + '"><span>' + escape(f.canonical_name) + '</span><b class="score-' + (v == null ? 'none' : v >= 60 ? 'good' : v >= 40 ? 'mid' : 'weak') + '">' + (v == null ? '—' : v.toFixed(1)) + '</b></a>'; }).join('') + '</div><div class="atlas-more">' + (g.funds.length > top.length ? '+' + (g.funds.length-top.length) + ' صندوق آخر · انقر للتفاصيل' : 'انقر لعرض الفئة') + '</div>';
      card.onclick = e => { if (e.target.closest('a')) return; state.selected = g.name; state.heatCategory = g.name; render(); };
      canvas.appendChild(card);
    });
  }

  function renderList(list) {
    html('categoryList', list.length ? list.map(g => '<button class="cat-row" type="button" data-name="' + escape(g.name) + '"><div><div class="cat-name">' + escape(g.name) + '</div><div class="cat-sub">' + g.rated + ' من ' + g.funds.length + ' لديها SmartScore محفوظ</div></div><div class="num">' + g.funds.length + '</div><div class="num">' + (g.avg == null ? '—' : g.avg.toFixed(1)) + '</div><div class="bar"><i style="width:' + Math.round(g.coverage*100) + '%"></i></div></button>').join('') : '<div class="loading">لا توجد فئات تطابق الفلاتر الحالية.</div>');
    document.querySelectorAll('.cat-row').forEach(row => row.onclick = () => { state.selected = row.dataset.name; state.heatCategory = row.dataset.name; setView('heat'); render(); });
  }

  function renderDetail(list) {
    const g = list.find(x => x.name === state.selected); if (!g) { html('detail','<div class="detail-empty">اختر فئة من الخريطة أو القائمة.</div>'); return; }
    const top = g.funds.slice().sort((a,b)=>(scoreValue(b)??-1)-(scoreValue(a)??-1)).slice(0,8);
    html('detail','<div class="detail-meta">SELECTED CATEGORY</div><h3>' + escape(g.name) + '</h3><div class="detail-meta">حجم الفئة · ' + g.funds.length + ' صندوق</div><div class="detail-kpis"><div class="kpi"><div class="k">عدد الصناديق</div><span class="v">' + g.funds.length + '</span></div><div class="kpi"><div class="k">متوسط SmartScore</div><span class="v">' + (g.avg == null ? '—' : g.avg.toFixed(1)) + '</span></div><div class="kpi"><div class="k">تغطية التقييم</div><span class="v">' + Math.round(g.coverage*100) + '%</span></div></div><div class="detail-headline">أعلى الصناديق داخل الفئة وفق SmartScore المخزّن</div>' + top.map(f => '<div class="fund"><div><a href="./fund.html?id=' + encodeURIComponent(f.fund_id) + '"><div class="fund-name">' + escape(f.canonical_name) + '</div></a><div class="fund-manager">' + escape(f.management_company || 'مدير غير متاح') + '</div></div><div class="fund-score">' + (scoreValue(f)==null?'—':scoreValue(f).toFixed(1)) + '</div></div>').join(''));
  }

  function renderObservatory(list) {
    const largest = list.slice().sort((a,b)=>b.funds.length-a.funds.length)[0], best = list.filter(g=>g.avg!=null).slice().sort((a,b)=>b.avg-a.avg)[0], coverage = list.slice().sort((a,b)=>b.coverage-a.coverage)[0];
    html('insights', '<div class="insight-card"><div class="k">Largest Category</div><span class="v">' + (largest ? escape(largest.name) : '—') + '</span><p>' + (largest ? largest.funds.length + ' صندوق.' : '') + '</p></div><div class="insight-card"><div class="k">Highest Average Score</div><span class="v">' + (best ? escape(best.name) + ' · ' + best.avg.toFixed(1) : '—') + '</span><p>متوسط وصفي للصناديق التي لديها SmartScore محفوظ.</p></div><div class="insight-card"><div class="k">Best Data Coverage</div><span class="v">' + (coverage ? escape(coverage.name) + ' · ' + Math.round(coverage.coverage*100) + '%' : '—') + '</span><p>نسبة الصناديق داخل الفئة التي يتوفر لها تقييم محفوظ.</p></div>');
  }

  function setView(view) {
    state.view = view; $('pane-map')?.classList.toggle('is-hidden', view !== 'map'); $('pane-heat')?.classList.toggle('is-hidden', view !== 'heat');
    $('tab-map')?.classList.toggle('active', view === 'map'); $('tab-heat')?.classList.toggle('active', view === 'heat'); $('tab-map')?.setAttribute('aria-selected', String(view === 'map')); $('tab-heat')?.setAttribute('aria-selected', String(view === 'heat'));
  }

  function render() {
    const list = sortGroups(groups());
    const rated = state.filtered.filter(f => scoreValue(f) != null).length;
    text('totalFunds', state.funds.length); text('totalCats', new Set(state.funds.map(f=>f.category)).size); text('ratedFunds', rated);
    renderBubbleMap(list); renderHeatmap(list); renderList(list); renderDetail(list); renderObservatory(list);
  }

  async function boot() {
    try {
      const universe = await service.getUniverse(); state.funds = universe.funds || []; state.scores = universe.scores || new Map(); state.filtered = state.funds.slice(); render();
    } catch (error) {
      console.error(error); html('mapStage','<div class="loading">تعذر تحميل بيانات الفئات من المصدر الرسمي.</div>'); html('categoryList','<div class="loading">تعذر تحميل بيانات الفئات من المصدر الرسمي.</div>');
    }
    $('search')?.addEventListener('input', applyFilters); $('score')?.addEventListener('change', applyFilters); $('sort')?.addEventListener('change', render);
    $('tab-map')?.addEventListener('click',()=>setView('map')); $('tab-heat')?.addEventListener('click',()=>setView('heat')); $('heatBack')?.addEventListener('click',()=>{state.heatCategory=null;render();}); $('heatAll')?.addEventListener('click',()=>{state.heatCategory=null;render();});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true}); else boot();
})(window);
