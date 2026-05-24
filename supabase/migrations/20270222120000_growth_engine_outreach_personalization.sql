-- Growth Engine Slice 6.15B — Context-aware outreach personalization settings.

alter table growth.copilot_settings
  add column if not exists outreach_personalization_enabled boolean not null default true,
  add column if not exists outreach_personalization_max_words int not null default 120;

alter table growth.copilot_settings
  drop constraint if exists copilot_settings_outreach_personalization_max_words_check;

alter table growth.copilot_settings
  add constraint copilot_settings_outreach_personalization_max_words_check
  check (outreach_personalization_max_words between 60 and 200);
