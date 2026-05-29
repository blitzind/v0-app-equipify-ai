-- Growth Engine — register website_public_extract contact discovery provider.

alter table growth.contact_candidates
  drop constraint if exists contact_candidates_provider_type_check;

alter table growth.contact_candidates
  add constraint contact_candidates_provider_type_check
  check (provider_type in (
    'manual_fixture',
    'internal_growth',
    'website_public_extract',
    'future_apollo',
    'future_seamless',
    'future_people_data_labs',
    'future_clay',
    'future_provider'
  ));
