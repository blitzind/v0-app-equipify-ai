-- Prospect website + structured address (mobile contact dock, web create/edit/convert).

alter table public.prospects
  add column if not exists website text,
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists postal_code text,
  add column if not exists country text;

comment on column public.prospects.website is 'Optional company website URL.';
comment on column public.prospects.address_line1 is 'Optional street address line 1.';
comment on column public.prospects.address_line2 is 'Optional street address line 2.';
comment on column public.prospects.city is 'Optional city.';
comment on column public.prospects.state is 'Optional state or province.';
comment on column public.prospects.postal_code is 'Optional postal or ZIP code.';
comment on column public.prospects.country is 'Optional country.';
