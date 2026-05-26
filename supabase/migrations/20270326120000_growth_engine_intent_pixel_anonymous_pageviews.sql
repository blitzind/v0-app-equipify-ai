-- Intent Pixel: anonymous pageviews when configured + equipify.ai allowlist (422 debug).

alter table growth.intent_pixel_sites
  add column if not exists allow_anonymous_pageviews boolean not null default false;

comment on column growth.intent_pixel_sites.allow_anonymous_pageviews is
  'When true, pageview/heartbeat/page_exit persist with consent unknown; conversions still require granted consent.';

update growth.intent_pixel_sites
set
  domain_allowlist = (
    select array_agg(distinct d)
    from unnest(
      domain_allowlist || array['equipify.ai']::text[]
    ) as d
  ),
  allow_anonymous_pageviews = true
where site_key = 'equipify-sandbox';
