-- GS-GROWTH-SIGNATURES-BRANDED-1C — Branded sender profile fields + professional template.

do $$
begin
  if to_regclass('growth.sender_profiles') is null then
    raise exception 'Missing dependency: growth.sender_profiles';
  end if;
end;
$$;

alter table growth.sender_profiles
  add column if not exists company_name text,
  add column if not exists company_tagline text,
  add column if not exists booking_url text,
  add column if not exists booking_label text,
  add column if not exists show_email_in_signature boolean not null default false,
  add column if not exists show_phone_in_signature boolean not null default true,
  add column if not exists show_website_in_signature boolean not null default true,
  add column if not exists show_booking_cta boolean not null default true;

comment on column growth.sender_profiles.company_name is
  'Display company name in outbound signatures. website holds the hyperlink target URL.';
comment on column growth.sender_profiles.company_tagline is
  'Optional company tagline shown on professional/branded signature templates.';
comment on column growth.sender_profiles.booking_url is
  'Booking/demo URL for signature CTA links.';
comment on column growth.sender_profiles.booking_label is
  'Display label for booking CTA (default: Schedule a 15-minute demo).';
comment on column growth.sender_profiles.website is
  'Website URL used as hyperlink target — not shown as raw text by default.';

alter table growth.sender_profiles
  drop constraint if exists sender_profiles_signature_template_check;

alter table growth.sender_profiles
  add constraint sender_profiles_signature_template_check
  check (signature_template in ('simple', 'branded', 'minimal', 'professional'));
