-- Allow service_role (Growth Engine / bulk acquisition) to persist contact discovery runs and candidates.

grant select, insert, update, delete on table growth.contact_discovery_runs to service_role;
grant select, insert, update, delete on table growth.contact_candidates to service_role;
grant select, insert, update, delete on table growth.buying_committees to service_role;
grant select, insert, update, delete on table growth.buying_committee_members to service_role;
