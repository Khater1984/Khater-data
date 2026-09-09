window.FUND_TABS=window.FUND_TABS||{};
(function(){'use strict';
const F=window.FUND;
function esc(v){return F.esc(v);}
function link(label,url){if(!url)return '<span class="profile-link disabled">'+esc(label)+' · غير متاح</span>';return '<a class="profile-link" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+'</a>';}
function item(label,value){const empty=value==null||value==='';return '<div class="profile-item"><span>'+esc(label)+'</span><strong class="'+(empty?'na':'')+'">'+(empty?'غير متاح':esc(value))+'</strong></div>';}
FUND_TABS.profile=async function(){
 const host=document.getElementById('profile-tab');
 const f=F.fund||{};const m=(f.metadata&&f.metadata.profile)||{};
 const logo=m.manager_logo_url||null;
 host.innerHTML='<div class="profile-grid">'
 +'<article class="card profile-brand">'
 +'<div class="profile-logo-wrap">'+(logo?'<img class="profile-logo" src="'+esc(logo)+'" alt="'+esc(f.management_company||f.canonical_name)+'" loading="lazy">':'<div class="profile-logo missing">LOGO</div>')+'</div>'
 +'<h3>'+esc(f.canonical_name)+'</h3><p class="note">'+esc(f.management_company)+'</p>'
 +'<div class="profile-links">'+link('صفحة الصندوق الرسمية',m.official_fund_profile_url)+link('الموقع الرسمي لمدير الصندوق',m.official_manager_url)+link('صفحة تحديث السعر',m.price_update_url)+'</div>'
 +'</article>'
 +'<article class="card"><h3>Fund Profile</h3>'
 +item('الاسم المعتمد',f.canonical_name)
 +item('اسم الصندوق لدى المصدر',f.eima_name_raw)
 +item('شركة الإدارة',f.management_company)
 +item('الفئة',f.category)
 +item('العملة',f.currency)
 +item('تاريخ التأسيس',f.inception_date)
 +'</article>'
 +'<article class="card"><h3>المستندات الرسمية</h3>'
 +'<div class="profile-links">'+link('Factsheet',m.factsheet_url)+link('نشرة الاكتتاب / Prospectus',m.prospectus_url)+'</div>'
 +'<p class="note">تظهر الروابط كما هي محفوظة في Supabase. لا يتم إنشاء روابط أو مستندات بديلة.</p>'
 +'</article>'
 +'<article class="card"><h3>مصدر بيانات الملف</h3>'
 +item('المصدر',f.source_id)
 +item('درجة الثقة',f.confidence)
 +item('آخر تحديث للبيانات',f.updated_at)
 +'</article>'
 +'</div>'
 +'<p class="profile-note">هذه الصفحة تعرض بيانات Fund Profile المحفوظة في قاعدة البيانات؛ الحقول غير الموجودة تظهر كـ «غير متاح».</p>';
};
})();
