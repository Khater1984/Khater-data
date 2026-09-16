/* Categories screen — render only. Consumes KHATER_DATA.categories. */
(function (window, document) {
  'use strict';
  const data = window.KHATER_DATA && window.KHATER_DATA.categories;
  if (!data) throw new Error('categories-screen-v2.js requires categories-service.js');

  const HORIZON_LABELS = {
    weekly: 'أسبوعي',
    '4weeks': '4 أسابيع',
    ytd: 'منذ بداية العام',
    last12m: '12 شهرًا',
    '1y': 'سنة',
    '2y': 'سنتان',
    '3y': '3 سنوات',
    '4y': '4 سنوات',
    '5y': '5 سنوات',
    '6y': '6 سنوات'
  };

  const $ = function (id) { return document.getElementById(id); };
  const esc = window.KHATER_DATA.escape || function (value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  const pct = function (value) {
    if (value == null || !Number.isFinite(Number(value))) return '—';
    const n = Number(value);
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  };
  const num = function (value) {
    if (value == null || !Number.isFinite(Number(value))) return '—';
    return Number(value).toLocaleString('en-US', { maximumFractionDigits: 1 });
  };
  const tone = function (value) {
    if (value == null || !Number.isFinite(Number(value))) return 'flat';
    return Number(value) > 0 ? 'up' : Number(value) < 0 ? 'down' : 'flat';
  };

  let snapshot = null;
  let activeCategory = null;

  function horizonLabel(key) {
    return HORIZON_LABELS[key] || key;
  }

  function renderHorizons() {
    const host = $('cat-horizons');
    if (!host || !snapshot) return;
    host.innerHTML = (snapshot.horizons || []).map(function (key) {
      const selected = key === snapshot.horizon;
      return '<button type="button" class="cat-horizon' + (selected ? ' is-active' : '') + '" data-h="' + esc(key) + '" aria-pressed="' + selected + '">' + esc(horizonLabel(key)) + '</button>';
    }).join('') || '<span class="cat-empty">لا توجد آفاق رسمية متاحة.</span>';
  }

  function renderGrid() {
    const host = $('cat-grid');
    if (!host || !snapshot) return;
    const rows = snapshot.categories || [];
    if (!rows.length) {
      host.innerHTML = '<div class="cat-empty">لا توجد فئات متاحة في البيانات الحالية.</div>';
      return;
    }
    host.innerHTML = rows.map(function (row) {
      const selected = row.name === activeCategory;
      return '<button type="button" class="surface cat-card' + (selected ? ' is-active' : '') + '" data-cat="' + esc(row.name) + '">' +
        '<span class="cat-card-name">' + esc(row.name) + '</span>' +
        '<strong class="' + tone(row.medianReturn) + '">' + pct(row.medianReturn) + '</strong>' +
        '<small>وسيط العائد الرسمي · ' + esc(horizonLabel(snapshot.horizon)) + '</small>' +
        '<div class="cat-card-meta"><span>' + row.count + ' صندوقًا</span><span>SmartScore ' + num(row.medianScore) + '</span><span>' + row.withReturn + ' بعائد</span></div>' +
      '</button>';
    }).join('');
  }

  function renderFunds() {
    const host = $('cat-funds');
    const title = $('cat-list-title');
    const note = $('cat-list-note');
    if (!host) return;
    const row = (snapshot.categories || []).find(function (item) { return item.name === activeCategory; });
    if (!row) {
      if (title) title.textContent = 'صناديق الفئة';
      if (note) note.textContent = 'اختر فئة لعرض صناديقها مرتبة بالعائد الرسمي.';
      host.innerHTML = '<div class="cat-empty">لم تُختر فئة بعد.</div>';
      return;
    }
    if (title) title.textContent = row.name;
    if (note) note.textContent = row.count + ' صندوقًا · مرتبة بالعائد الرسمي في أفق ' + horizonLabel(snapshot.horizon) + '.';
    host.innerHTML = '<div class="cat-fund-head"><span>الصندوق</span><span>العائد الرسمي</span><span>SmartScore</span></div>' +
      row.funds.map(function (fund) {
        return '<a class="cat-fund-row" href="./fund.html?id=' + encodeURIComponent(fund.id) + '">' +
          '<span><b>' + esc(fund.name) + '</b><i>' + esc(fund.manager || 'مدير غير مذكور') + '</i></span>' +
          '<strong class="' + tone(fund.ret) + '">' + pct(fund.ret) + '</strong>' +
          '<em>' + num(fund.score) + '</em>' +
        '</a>';
      }).join('');
  }

  function renderMeta() {
    const coverage = snapshot.coverage || {};
    $('cat-coverage').textContent = (coverage.withReturn || 0) + ' / ' + (coverage.funds || 0);
    $('cat-stamp').textContent = snapshot.asOf ? ('آخر تقرير ظاهر · ' + snapshot.asOf) : 'لا يوجد تاريخ تقرير متاح';
    $('cat-map-note').textContent = snapshot.asOf
      ? ('وسيط العائد من التقرير الرسمي حتى ' + snapshot.asOf + '.')
      : 'لا تتوفر قراءة عائد رسمية كافية لهذا الأفق.';
    $('cat-foot').textContent = 'المصدر: ' + (snapshot.source || 'Supabase') + ' عبر categories-service · الأفق: ' + horizonLabel(snapshot.horizon) + ' · بلا خريطة حرارية.';
  }

  function bind() {
    document.addEventListener('click', function (event) {
      const horizon = event.target.closest('[data-h]');
      if (horizon) {
        load(horizon.getAttribute('data-h'));
        return;
      }
      const card = event.target.closest('[data-cat]');
      if (card) {
        activeCategory = card.getAttribute('data-cat');
        renderGrid();
        renderFunds();
      }
    });
  }

  async function load(horizon) {
    $('cat-grid').innerHTML = '<div class="cat-loading">جاري مزامنة الفئات…</div>';
    try {
      snapshot = await data.getUniverse(horizon);
      if (!activeCategory && snapshot.categories && snapshot.categories[0]) {
        activeCategory = snapshot.categories[0].name;
      }
      renderMeta();
      renderHorizons();
      renderGrid();
      renderFunds();
    } catch (error) {
      console.error('[categories-screen]', error);
      $('cat-coverage').textContent = '—';
      $('cat-stamp').textContent = 'تعذر التحميل';
      $('cat-grid').innerHTML = '<div class="cat-error">تعذر قراءة الفئات من طبقة البيانات. لم تُستبدل الأرقام بقيم افتراضية.</div>';
      $('cat-funds').innerHTML = '<div class="cat-empty">لا يمكن عرض الصناديق قبل توفر البيانات.</div>';
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    bind();
    load();
  });
})(window, document);
