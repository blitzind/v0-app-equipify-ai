-- Growth Engine Meeting Account Playbook Linkage (M1-B)
-- Preserve Meeting Candidate → Meeting Intelligence context for account-aware prep.

do $$
begin
  if to_regclass('growth.meetings') is null then
    raise exception 'Missing dependency: growth.meetings';
  end if;
  if to_regclass('growth.meeting_candidates') is null then
    raise exception 'Missing dependency: growth.meeting_candidates';
  end if;
end;
$$;

alter table growth.meetings
  add column if not exists meeting_candidate_id uuid references growth.meeting_candidates (id) on delete set null,
  add column if not exists account_playbook_id uuid references growth.account_playbooks (id) on delete set null,
  add column if not exists source_attribution jsonb not null default '{}'::jsonb;

create index if not exists meetings_meeting_candidate_idx
  on growth.meetings (meeting_candidate_id)
  where meeting_candidate_id is not null;

create index if not exists meetings_account_playbook_idx
  on growth.meetings (account_playbook_id)
  where account_playbook_id is not null;

comment on column growth.meetings.meeting_candidate_id is
  'Apollo Meeting Bridge candidate that promoted this proposed meeting.';

comment on column growth.meetings.account_playbook_id is
  'Account Playbook context for account-aware meeting prep.';

comment on column growth.meetings.source_attribution is
  'Full Apollo pipeline attribution chain preserved from Meeting Candidate approval.';
