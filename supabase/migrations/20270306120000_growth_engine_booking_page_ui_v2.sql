-- Growth Engine — Booking page UI v2 branding fields (additive).

do $$
begin
  if to_regclass('growth.booking_pages') is null then
    raise exception 'Missing dependency: growth.booking_pages';
  end if;
end;
$$;

alter table growth.booking_pages
  add column if not exists page_title text,
  add column if not exists accent_color text,
  add column if not exists footer_note text,
  add column if not exists brand_name text,
  add column if not exists hero_image_url text;
