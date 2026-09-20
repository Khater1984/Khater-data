-- Zaldi source currently serves at least one fund whose management_company is not
-- canonically assigned, so do not enforce an incorrect source-manager scope.
update public.sources
set management_company_scope = null
where source_id='src_zaldi_capital';
