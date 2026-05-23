-- Fix missing service_role grants on Growth import tables (4B.1).
-- Without these, service-role API calls fail with "permission denied for table lead_import_batches".

do $$
begin
  if to_regclass('growth.lead_import_batches') is null then
    raise exception 'Missing dependency: growth.lead_import_batches';
  end if;
end;
$$;

revoke all on table growth.lead_import_batches from public, anon, authenticated;
revoke all on table growth.lead_import_batch_rows from public, anon, authenticated;
revoke all on table growth.lead_import_batch_events from public, anon, authenticated;
revoke all on table growth.lead_import_mapping_profiles from public, anon, authenticated;

grant select, insert, update, delete on table growth.lead_import_batches to service_role;
grant select, insert, update, delete on table growth.lead_import_batch_rows to service_role;
grant select, insert, update, delete on table growth.lead_import_batch_events to service_role;
grant select, insert, update, delete on table growth.lead_import_mapping_profiles to service_role;
