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
      return { '&': '&', '<': '<', '>': '>', '"': '"', "'": '&#39;' }[c];
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
  const text = function (id, value) {
    const node = $(id);
    if (node) node.textContent = value;
  };

  let snapshot = null;
  let activeCategory = null;

  function horizonLabel(key) {
    if (!key) return '—';
    return HORIZON_LABELS[key] || String(key);
  }

  function leader() {
    const rows = (snapshot && snapshot.categories) || [];
    return rows.find(function (row) { return row.medianReturn != null; }) || rows[0] || null;
  }

  function renderHorizons() {
    const host = $('cat-horizons');
    if (!host || !snapshot) return;
    const keys = snapshot.horizons || [];
    if (!keys.length) {
      host.innerHTML = '<span class="cat-empty">لا يوجد أفق رسمي في هذه اللقطة.</span>';
      return;
    }
    host.innerHTML = keys.map(function (key) {
      const selected = key === snapshot.horizon;
      return '<button type="button" class="cat-horizon' + (selected ? ' active' : '') + '" data-h="' + esc(key) + '" role="tab" aria-selected="' + selected + '">' + esc(horizonLabel(key)) + '</button>';
    }).join('');
  }

  function renderJudgement() {
    const top = leader();
    const horizon = horizonLabel(snapshot && snapshot.horizon);
    if (!top) {
      text('cat-lead-name', 'لا توجد فئات في هذه اللقطة');
      text('cat-lead-return', '—');
      $('cat-lead-return').className = 'flat';
      text('cat-lead-note', 'لم تُستبدل البيانات الناقصة بأرقام افتراضية.');
      return;
    }
    text('cat-lead-name', top.name);
    text('cat-lead-return', pct(top.medianReturn));
    $('cat-lead-return').className = tone(top.medianReturn);
    text('cat-lead-note', top.medianReturn == null
      ? ('الفئة الأكبر حجمًا · ' + top.count + ' صندوقًا · بلا عائد رسمي كافٍ في ' + horizon)
      : ('أعلى وسيط عائد رسمي في أفق ' + horizon + ' · ' + top.count + ' صندوقًا'));
  }

  function renderMeta() {
    const coverage = (snapshot && snapshot.coverage) || {};
    const funds = coverage.funds || 0;
    const withReturn = coverage.withReturn || 0;
    const cats = ((snapshot && snapshot.categories) || []).length;
    text('cat-kpi-cats', cats ? String(cats) : '—');
    text('cat-kpi-funds', funds ? String(funds) : '—');
    text('cat-kpi-returns', funds ? String(withReturn) : '—');
    text('cat-kpi-horizon', horizonLabel(snapshot && snapshot.horizon));
    text('cat-stamp', snapshot && snapshot.asOf
      ? ('آخر تقرير ظاهر · ' + snapshot.asOf)
      : (funds ? 'لا يوجد تاريخ تقرير متاح' : 'اللقطة فارغة حتى تتوفر البيانات الرسمية'));
    text('cat-map-note', snapshot && snapshot.asOf
      ? ('مرتب بوسيط العائد الرسمي حتى ' + snapshot.asOf + '.')
      : 'إذا غاب العائد الرسمي تُعرض الفئة بالحجم فقط، دون رقم مخترع.');
    const source = (snapshot && snapshot.source) || 'Supabase';
    text('cat-foot', 'المصدر: ' + source + ' عبر categories-service · الأفق: ' + horizonLabel(snapshot && snapshot.horizon) + ' · لا أرقام بديلة.');
  }

  function renderGrid() {
    const host = $('cat-grid');
    if (!host || !snapshot) return;
    const rows = snapshot.categories || [];
    if (!rows.length) {
      host.innerHTML = '<div class="cat-empty">لا توجد فئات في اللقطة الحالية. يمكن متابعة الكون من شاشة الصناديق.</div>';
      return;
    }
    const topName = (leader() || {}).name;
    host.innerHTML = rows.map(function (row, index) {
      const selected = row.name === activeCategory;
      const isLeader = row.name === topName;
      return '<button type="button" class="surface cat-card' + (selected ? ' active' : '') + (isLeader && !selected ? ' leader' : '') + '" data-cat="' + esc(row.name) + '">' +
        '<div class="cat-card-top"><span class="cat-card-name">' + esc(row.name) + '</span><span class="cat-card-rank">#' + (index + 1) + '</span></div>' +
        '<strong class="' + tone(row.medianReturn) + '">' + pct(row.medianReturn) + '</strong>' +
        '<small>وسيط العائد الرسمي · ' + esc(horizonLabel(snapshot.horizon)) + '</small>' +
        '<div class="cat-card-meta"><span>' + row.count + ' صندوقًا</span><span>SmartScore ' + num(row.medianScore) + '</span><span>' + row.withReturn + ' بعائد</span></div>' +
      '</button>';
    }).join('');
  }

  function renderFunds() {
    const host = $('cat-funds');
    if (!host) return;
    const row = ((snapshot && snapshot.categories) || []).find(function (item) { return item.name === activeCategory; });
    if (!row) {
      text('cat-list-title', 'صناديق الفئة');
      text('cat-list-note', 'اختر فئة لعرض صناديقها مرتبة بالعائد الرسمي.');
      host.innerHTML = '<div class="cat-empty">اختر فئة أعلاه لفتح صناديقها، ثم انتقل إلى ملف الصندوق.</div>';
      return;
    }
    text('cat-list-title', row.name);
    text('cat-list-note', row.count + ' صندوقًا · مرتبة بالعائد الرسمي في أفق ' + horizonLabel(snapshot.horizon) + '.');
    host.innerHTML = '<div class="cat-fund-head"><span>الصندوق</span><span>العائد الرسمي</span><span>SmartScore</span><span>تاريخ التقرير</span></div>' +
      row.funds.map(function (fund) {
        return '<a class="cat-fund-row" href="./fund.html?id=' + encodeURIComponent(fund.id) + '">' +
          '<span><b>' + esc(fund.name) + '</b><i>' + esc(fund.manager || 'مدير غير مذكور') + '</i></span>' +
          '<strong class="' + tone(fund.ret) + '">' + pct(fund.ret) + '</strong>' +
          '<em>' + num(fund.score) + '</em>' +
          '<time>' + esc(fund.returnDate || '—') + '</time>' +
        '</a>';
      }).join('');
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
    text('cat-lead-name', 'جاري المزامنة…');
    $('cat-grid').innerHTML = '<div class="cat-loading">جاري مزامنة الفئات من العائد الرسمي…</div>';
    try {
      snapshot = await data.getUniverse(horizon);
      const top = leader();
      if (!activeCategory || !((snapshot.categories || []).some(function (row) { return row.name === activeCategory; }))) {
        activeCategory = top ? top.name : null;
      }
      renderJudgement();
      renderMeta();
      renderHorizons();
      renderGrid();
      renderFunds();
    } catch (error) {
      snapshot = null;
      activeCategory = null;
      text('cat-lead-name', 'تعذر قراءة الفئات');
      text('cat-lead-return', '—');
      $('cat-lead-return').className = 'flat';
      text('cat-lead-note', 'لم تُستبدل الأرقام بقيم افتراضية.');
      text('cat-kpi-cats', '—');
      text('cat-kpi-funds', '—');
      text('cat-kpi-returns', '—');
      text('cat-kpi-horizon', '—');
      text('cat-stamp', 'تعذر التحميل');
      text('cat-foot', 'المصدر: طبقة البيانات · تعذر بناء اللقطة.');
      $('cat-grid').innerHTML = '<div class="cat-error">تعذر قراءة الفئات من طبقة البيانات. لم تُستبدل الأرقام بقيم افتراضية.</div>';
      $('cat-funds').innerHTML = '<div class="cat-empty">لا يمكن عرض الصناديق قبل توفر البيانات.</div>';
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    bind();
    load();
  });
})(window, document);
