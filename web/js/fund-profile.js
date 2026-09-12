window.FUND_TABS = window.FUND_TABS || {};
(function () {
  'use strict';
  const F = window.FUND;

  function esc(v) { return F.esc(v); }
  function has(v) { return v != null && String(v).trim() !== ''; }

  function initials(name) {
    return String(name || 'F')
      .replace(/[()]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(function (w) { return w.charAt(0); })
      .join('')
      .toUpperCase() || 'F';
  }

  function logoBox(url, name, extraClass) {
    const ini = initials(name);
    if (!has(url)) {
      return '<div class="' + extraClass + ' fallback">' + esc(ini) + '</div>';
    }
    return '<div class="' + extraClass + '">' +
      '<img src="' + esc(url) + '" alt="' + esc(name) + '" loading="lazy" decoding="async" ' +
      'onerror="var p=this.parentNode;this.remove();if(p){p.classList.add(\'fallback\');p.textContent=\'' + esc(ini) + '\'}">' +
      '</div>';
  }

  function action(kind, label, url) {
    if (!has(url)) {
      return '<span class="fp-link disabled"><span class="fp-link-kind">' + esc(kind) + '</span><b>' + esc(label) + '</b><small>غير متاح</small></span>';
    }
    return '<a class="fp-link" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' +
      '<span class="fp-link-kind">' + esc(kind) + '</span><b>' + esc(label) + '</b><small>فتح الرابط ↗</small></a>';
  }

  function doc(type, label, url) {
    if (!has(url)) {
      return '<span class="fp-doc disabled"><span class="fp-doc-type">' + esc(type) + '</span><b>' + esc(label) + '</b><small>غير متاح</small></span>';
    }
    return '<a class="fp-doc" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' +
      '<span class="fp-doc-type">' + esc(type) + '</span><b>' + esc(label) + '</b><small>فتح المستند ↗</small></a>';
  }

  function field(label, v) {
    return '<div class="fp-field"><span>' + esc(label) + '</span><strong class="' + (has(v) ? '' : 'na') + '">' +
      (has(v) ? esc(v) : 'غير متاح') + '</strong></div>';
  }

  FUND_TABS.profile = async function () {
    const host = document.getElementById('profile-tab');
    const f = F.fund || {};
    const m = (f.metadata && f.metadata.profile) || {};
    const manager = f.management_company || m.manager_name_en || m.manager_name_ar || 'غير متاح';
    const logo = m.manager_logo_url;
    const fundPage = m.official_fund_profile_url;
    const managerUrl = m.official_manager_url;
    const factsheet = m.factsheet_url;
    const prospectus = m.prospectus_url;
    const priceUrl = f.price_update_url || m.price_update_url;
    const core = [logo, managerUrl, fundPage, factsheet, prospectus];
    const filled = core.filter(has).length;

    host.innerHTML =
      '<div class="fp-shell">' +
        '<section class="fp-identity">' +
          '<div class="fp-brand">' +
            logoBox(logo, manager, 'fp-logo-box') +
            '<div class="fp-identity-copy">' +
              '<div class="fp-kicker">FUND PROFILE · OFFICIAL DATA</div>' +
              '<h2>' + esc(f.canonical_name) + '</h2>' +
              '<p>' + esc(manager) + '</p>' +
              '<div class="fp-tags">' +
                '<span>' + esc(f.category || 'فئة غير متاحة') + '</span>' +
                '<span>' + esc(f.currency || 'عملة غير متاحة') + '</span>' +
                '<span>' + esc(f.inception_date || 'تاريخ التأسيس غير متاح') + '</span>' +
              '</div>' +
            '</div>' +
            '<div class="fp-coverage"><b>' + filled + '/5</b><small>اكتمال البيانات الرسمية</small></div>' +
          '</div>' +
          '<div class="fp-actions">' +
            action('FUND PAGE', 'صفحة الصندوق الرسمية', fundPage) +
            action('MANAGER', 'الموقع الرسمي للمدير', managerUrl) +
            action('NAV / PRICE', 'صفحة تحديث السعر', priceUrl) +
            action('FACTSHEET', 'صحيفة الحقائق', factsheet) +
            action('PROSPECTUS', 'نشرة الاكتتاب', prospectus) +
          '</div>' +
        '</section>' +
        '<section class="fp-section">' +
          '<div class="fp-section-head"><div><span class="fp-kicker">DOCUMENTS</span><h3>المستندات الرسمية</h3></div>' +
          '<span class="fp-count">' + [factsheet, prospectus].filter(has).length + '/2 متاح</span></div>' +
          '<div class="fp-docs">' +
            doc('FACTSHEET', 'صحيفة الحقائق', factsheet) +
            doc('PROSPECTUS', 'نشرة الاكتتاب', prospectus) +
          '</div>' +
        '</section>' +
        '<section class="fp-section">' +
          '<div class="fp-section-head"><div><span class="fp-kicker">IDENTITY</span><h3>بيانات الصندوق</h3></div></div>' +
          '<div class="fp-fields">' +
            field('الاسم المعتمد', f.canonical_name) +
            field('شركة الإدارة', manager) +
            field('الفئة', f.category) +
            field('العملة', f.currency) +
            field('تاريخ التأسيس', f.inception_date) +
            field('معرّف الصندوق', f.fund_id || F.id) +
          '</div>' +
        '</section>' +
        '<footer class="fp-source">' +
          '<div><span class="fp-kicker">DATA PROVENANCE</span><strong>المعلومات معروضة كما هي محفوظة في Supabase.</strong></div>' +
        '</footer>' +
        '<p class="fp-note">لا يتم إنشاء روابط أو مستندات بديلة. أي حقل غير موجود في قاعدة البيانات يظهر كـ «غير متاح».</p>' +
      '</div>';
  };
})();
