window.FUND_TABS = window.FUND_TABS || {};
(function(){
  const F = window.FUND;
  function val(v){ return (v==null || v==="") ? null : v; }
  function row(label, value, verified){
    const empty = val(value)==null;
    const shown = empty ? "غير متاح" : F.esc(String(value));
    const badge = empty ? "" : (verified ? '<em class="src-badge">Verified</em>' : "");
    return `<div class="ops-row"><span>${F.esc(label)}</span><strong class="${empty?"na":""}">${shown}${badge}</strong></div>`;
  }
  function card(title, rows){
    return `<article class="ops-card"><h3>${F.esc(title)}</h3>${rows.join("")}</article>`;
  }
  FUND_TABS.ops = async function(){
    const f = F.fund || {};
    const p = (f.metadata && f.metadata.profile) || {};
    const s = p.subscription || {};
    const r = p.redemption || {};
    const d = p.documents || {};
    const v = p.verification || {};
    const verified = v.verification_status === "verified";
    const docs = [
      ["prospectus_url","نشرة الاكتتاب"],
      ["factsheet_url","صحيفة الحقائق"],
      ["subscription_terms_url","شروط الاكتتاب"],
      ["redemption_terms_url","شروط الاسترداد"],
      ["official_documents_url","مستندات رسمية"]
    ].map(([k,l])=>{
      const u=d[k];
      return u ? `<a class="doc-btn" href="${F.esc(u)}" target="_blank" rel="noopener">${l}</a>`
               : `<span class="doc-btn disabled">${l} · غير متاح</span>`;
    }).join("");
    document.getElementById("ops-tab").innerHTML = `
      <div class="ops-grid">
        ${card("نظرة عامة", [
          row("مدير الصندوق", p.manager_name_ar || p.manager_name_en || f.management_company, true),
          row("الفئة", p.category || f.category),
          row("العملة", p.currency || f.currency),
          row("تاريخ التأسيس", p.inception_date || f.inception_date),
          row("الحالة", p.fund_status),
          row("المؤسس", p.sponsor, verified),
          row("أمين الحفظ", p.custodian, verified),
          row("خدمات الإدارة", p.administrator, verified),
          row("مراقب الحسابات", p.auditor)
        ])}
        ${card("الاكتتاب", [
          row("الدورية", s.frequency, verified),
          row("آخر موعد", s.cutoff_time, verified),
          row("التنفيذ", s.execution_timing, verified),
          row("الحد الأدنى", s.minimum, verified),
          row("العمولة", s.fee, verified),
          row("ملاحظات", s.notes)
        ])}
        ${card("الاسترداد", [
          row("الدورية", r.frequency, verified),
          row("آخر موعد", r.cutoff_time, verified),
          row("التنفيذ", r.execution_timing, verified),
          row("الحد الأدنى", r.minimum, verified),
          row("العمولة", r.fee, verified)
        ])}
        <article class="ops-card"><h3>المستندات الرسمية</h3><div class="doc-row">${docs}</div></article>
        ${card("التحقق", [
          row("حالة البيانات", p.metadata_status),
          row("اكتمال البيانات", p.metadata_completeness_score!=null ? p.metadata_completeness_score+"%" : null),
          row("المصدر", v.source_name),
          row("تصنيف المصدر", v.source_class),
          row("رابط المصدر", v.source_url),
          row("آخر تحقق", v.verified_at)
        ])}
      </div>
      <p class="ops-note">لا تُعرض قيم تقديرية. «غير متاح» تعني أن المصدر الرسمي لم يُستخرج بعد. هذا التقييم خاص بالبيانات التعريفية وليس SmartScore.</p>`;
  };
})();
