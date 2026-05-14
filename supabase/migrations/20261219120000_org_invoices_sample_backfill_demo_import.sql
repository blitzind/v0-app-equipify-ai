-- Align first-signup / Settings sample invoices with is_sample (20260608100000 only backfilled pbs-seed-inv-%).

update public.org_invoices
set is_sample = true
where seed_key ilike 'demo-import-inv-%';

-- Deterministic onboarding invoice numbers from lib/demo-seeding/seed-demo-content.ts (I-DEMO-0001, …).
update public.org_invoices
set is_sample = true
where invoice_number ~* '^I-DEMO-[0-9]{4}$'
  and coalesce(is_sample, false) = false;
