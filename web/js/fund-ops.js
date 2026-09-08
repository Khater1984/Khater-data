window.FUND_TABS = window.FUND_TABS || {};
(function(){
  const F = window.FUND;
  function row(label, value){
    const v = value==null || value==="" ? "غير متاح" : F.esc(String(value));
    const cls = (value==null || value==="") ? "na" : "";
    return `<div class="ops-row"><span>${F.esc(label)}</span><strong class="${cls}">${v}</strong></div>`;
  }
  function block(title, obj, map){
    const body = map.map(([k,l])=>row(l, obj && obj[k])).join("");
    return `<article class="ops-card"><h3>${F.esc(title)}</h3>${body}</article>`;
  }
  function docs(d){
    const items = [
      ["prospectus_url","نشرة الاكتتاب"],
      ["factsheet_url","صحيفة الحقائق"],
      ["subscription_terms_url","شروط الاكتتاب"],
      ["redemption_terms_url","شروط الاسترداد"],
      ["official_documents_url","مستندات رسمية"]
    ];
    const buttons = items.map(([k,l])=>{
      const u = d && d[k];
      if(!u) return `<span class="doc-btn disabled">${l} · غير متاح</span>`;
      return `<a class="doc-btn" href="${F.esc(u)}" target="_blank" rel="noopener">${l}</a>`;
    }).join("");
    return `<article class="ops-card"><h3>المستندات</h3><div class="doc-row">${buttons}</div>${row("تاريخ المستند", d && d.document_date)}${row("الإصدار", d && d.version)}</article>`;
  }
  async function renderOps(){
    const f = F.fund || {};
    const p = (f.metadata && f.metadata.profile) || {};
    const host = document.getElementById("ops-tab");
    if(!host) return;
    host.innerHTML = `
      <div class="ops-grid">
        ${block("الاكتتاب", p.subscription, [
          ["frequency","دورية الاكتتاب"],
          ["cutoff_time","آخر موعد"],
          ["execution_timing","تنفيذ الأمر"],
          ["minimum","الحد الأدنى"],
          ["fee","عمولة الاكتتاب"],
          ["notes","ملاحظات"]
        ])}
        ${block("الاسترداد", p.redemption, [
          ["frequency","دورية الاسترداد"],
          ["cutoff_time","آخر موعد"],
          ["execution_timing","تنفيذ الأمر"],
          ["minimum","الحد الأدنى"],
          ["fee","عمولة الاسترداد"],
          ["notes","ملاحظات"]
        ])}
        ${docs(p.documents)}
        ${block("المصدر والتحقق", p.verification, [
          ["source_name","المصدر"],
          ["source_class","تصنيف المصدر"],
          ["source_url","رابط المصدر"],
          ["verification_status","حالة التحقق"],
          ["verified_at","وقت التحقق"]
        ])}
      </div>
      <p class="ops-note">الحقول الفارغة تعني أن المصدر الرسمي غير متوفر بعد. لا تُعرض قيم تقديرية.</p>`;
  }
  FUND_TABS.ops = renderOps;
})();
