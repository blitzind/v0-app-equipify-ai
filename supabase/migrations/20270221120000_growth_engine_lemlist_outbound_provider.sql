-- Growth Engine Slice 6.15A — Lemlist live outbound provider family.

alter table growth.email_provider_connections
  drop constraint if exists email_provider_connections_provider_family_check;

alter table growth.email_provider_connections
  add constraint email_provider_connections_provider_family_check
  check (provider_family in ('emailbison', 'smartlead', 'instantly', 'lemlist', 'custom'));
