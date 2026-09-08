-- Fund Metadata Layer (additive, no drops)
-- Run in Supabase SQL editor. Does not touch NAV, SmartScore, or performance tables.

create table if not exists public.management_companies (
  company_id text primary key,
  name_en text not null,
  name_ar text,
  website text,
  logo_url text,
  created_at timestamptz default now()
);

create table if not exists public.fund_profiles (
  fund_id text primary key references public.funds(fund_id),
  company_id text references public.management_companies(company_id),
  official_fund_url text,
  fund_type text,
  category text,
  currency text,
  inception_date date,
  fund_status text,
  sponsor text,
  custodian text,
  administrator text,
  auditor text,
  subscription jsonb,
  redemption jsonb,
  documents jsonb,
  source_url text,
  source_name text,
  source_class text,
  verified_at timestamptz,
  verification_status text,
  updated_at timestamptz default now()
);

alter table public.management_companies enable row level security;
alter table public.fund_profiles enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='management_companies' and policyname='read_mgmt') then
    create policy read_mgmt on public.management_companies for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='fund_profiles' and policyname='read_profiles') then
    create policy read_profiles on public.fund_profiles for select using (true);
  end if;
end $$;

comment on table public.fund_profiles is 'Operational metadata only. Performance and SmartScore remain in existing tables.';
