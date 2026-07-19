-- GE-AIOS-END-TO-END-1C — Supervised transport authority snapshot fields on execution jobs.

alter table growth.sequence_execution_jobs
  add column if not exists outreach_package_id text,
  add column if not exists approved_sender_account_id uuid references growth.sender_accounts (id) on delete set null,
  add column if not exists transport_snapshot jsonb,
  add column if not exists transport_content_hash text,
  add column if not exists package_fingerprint text;

create index if not exists idx_growth_sequence_execution_jobs_outreach_package
  on growth.sequence_execution_jobs (outreach_package_id)
  where outreach_package_id is not null;

comment on column growth.sequence_execution_jobs.outreach_package_id is
  'GE-AIOS-END-TO-END-1C — Operator-approved outreach package bound to this supervised job.';

comment on column growth.sequence_execution_jobs.transport_snapshot is
  'GE-AIOS-END-TO-END-1C — Immutable transport contract (subject/body/sender) for supervised sends.';
