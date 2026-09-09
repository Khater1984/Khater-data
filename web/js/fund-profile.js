window.FUND_TABS=window.FUND_TABS||{};
(function(){'use strict';
const F=window.FUND;
function esc(v){return F.esc(v)}
function has(v){return v!=null&&String(v).trim()!==''}
function link(label,url,kind){
  if(!has(url))return '<span class="fp-link disabled"><span class="fp-link-kind">'+esc(kind)+'</span><b>'+esc(label)+'</b><small>غير متاح</small></span>';
  return '<a class="fp-link" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer"><span class="fp-link-kind">'+esc(kind)+'</span><b>'+esc(label)+'</b><small>فتح الرابط ↗</small></a>';
}
function value(label,v){
  return '<div class="fp-field"><span>'+esc(label)+'</span><strong class="'+(has(v)?'':'na')+'">'+(has(v)?esc(v):'غير متاح')+'</strong></div>';
}
function doc(label,url,type){
  if(!has(url))return '<span class="fp-doc disabled"><span class="fp-doc-type">'+esc(type)+'</span><b>'+esc(label)+'</b><small>غير متاح</small></span>';
  return '<a class="fp-doc" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer"><span class="fp-doc-type">'+esc(type)+'</span><b>'+esc(label)+'</b><small>فتح المستند ↗</small></a>';
}
FUND_TABS.profile=async function(){
  const host=document.getElementById('profile-tab');
  const f=F.fund||{};
  const m=(f.metadata&&f.metadata.profile)||{};
  const logo=has(m.manager_logo_url)?m.manager_logo_url:null;
  const manager=f.management_company||'غير متاح';
  const updated=f.updated_at||null;
  host.innerHTML=
  '<div class="fp-shell">'+
    '<section class="fp-identity">'+
      '<div class="fp-brand">'+
        '<div class="fp-logo-box">'+(logo?'<img class="fp-logo" src="'+esc(logo)+'" alt="'+esc(manager)+'" loading="lazy" decoding="async">':'<div class="fp-logo-empty">LOGO</div>')+'</div>'+
        '<div class="fp-identity-copy">'+
          '<div class="fp-kicker">FUND PROFILE · OFFICIAL DATA</div>'+
          '<h2>'+esc(f.canonical_name)+'</h2>'+
          '<p>'+esc(manager)+'</p>'+ 
          '<div class="fp-tags"><span>'+esc(f.category)+'</span><span>'+esc(f.currency)+'</span><span>'+esc(f.inception_date||'تاريخ التأسيس غير متاح')+'</span></div>'+ 
        '</div>'+
      '</div>'+ 
      '<div class="fp-links">'+
        link('صفحة الصندوق الرسمية',m.official_fund_profile_url,'FUND PAGE')+
        link('الموقع الرسمي لمدير الصندوق',m.official_manager_url,'MANAGER')+
        link('صفحة تحديث السعر',m.price_update_url,'NAV / PRICE')+
      '</div>'+ 
    '</section>'+ 
    '<section class="fp-section">'+
      '<div class="fp-section-head"><div><span class="fp-kicker">DOCUMENTS</span><h3>المستندات الرسمية</h3></div><span class="fp-count">'+([m.factsheet_url,m.prospectus_url].filter(has).length)+'/2 متاح</span></div>'+ 
      '<div class="fp-docs">'+
        doc('صحيفة الحقائق',''+(m.factsheet_url||''),'FACTSHEET')+
        doc('نشرة الاكتتاب',''+(m.prospectus_url||''),'PROSPECTUS')+
      '</div>'+ 
    '</section>'+ 
    '<section class="fp-section">'+
      '<div class="fp-section-head"><div><span class="fp-kicker">IDENTITY</span><h3>بيانات الصندوق</h3></div></div>'+ 
      '<div class="fp-fields">'+
        value('الاسم المعتمد',f.canonical_name)+
        value('اسم الصندوق لدى المصدر',f.eima_name_raw)+
        value('شركة الإدارة',f.management_company)+
        value('الفئة',f.category)+
        value('العملة',f.currency)+
        value('تاريخ التأسيس',f.inception_date)+
      '</div>'+ 
    '</section>'+ 
    '<footer class="fp-source">'+
      '<div><span class="fp-kicker">DATA PROVENANCE</span><strong>المعلومات معروضة كما هي محفوظة في Supabase.</strong></div>'+ 
      '<div class="fp-source-meta">'+
        value('Source ID',f.source_id)+
        value('Confidence',f.confidence)+
        value('آخر تحديث',updated)+
      '</div>'+ 
    '</footer>'+ 
    '<p class="fp-note">لا يتم إنشاء روابط أو مستندات بديلة. أي حقل غير موجود في قاعدة البيانات يظهر كـ «غير متاح».</p>'+ 
  '</div>';
};
})();
