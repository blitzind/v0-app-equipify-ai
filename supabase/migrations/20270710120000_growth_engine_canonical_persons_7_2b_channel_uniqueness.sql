-- Phase 7.2B — PostgREST-compatible uniqueness on person channel tables.
-- Replaces partial unique indexes (WHERE normalized_* <> '') with table-level UNIQUE
-- so Supabase upsert onConflict targets match PostgreSQL arbiter constraints.

-- -----------------------------------------------------------------------------
-- Drop partial unique indexes (not valid for bare ON CONFLICT (column))
-- -----------------------------------------------------------------------------

drop index if exists growth.person_emails_normalized_email_unique;
drop index if exists growth.person_phones_normalized_phone_unique;
drop index if exists growth.person_profiles_normalized_key_unique;

-- -----------------------------------------------------------------------------
-- Remove empty normalized keys (repository never inserts these; they block UNIQUE)
-- -----------------------------------------------------------------------------

delete from growth.person_emails where normalized_email = '';
delete from growth.person_phones where normalized_phone = '';
delete from growth.person_profiles where normalized_profile_key = '';

-- -----------------------------------------------------------------------------
-- Dedupe non-empty keys (keep oldest row) before adding constraints
-- -----------------------------------------------------------------------------

with ranked as (
  select
    id,
    row_number() over (
      partition by normalized_email
      order by created_at asc, id asc
    ) as rn
  from growth.person_emails
  where normalized_email <> ''
)
delete from growth.person_emails e
using ranked r
where e.id = r.id
  and r.rn > 1;

with ranked as (
  select
    id,
    row_number() over (
      partition by normalized_phone
      order by created_at asc, id asc
    ) as rn
  from growth.person_phones
  where normalized_phone <> ''
)
delete from growth.person_phones e
using ranked r
where e.id = r.id
  and r.rn > 1;

with ranked as (
  select
    id,
    row_number() over (
      partition by normalized_profile_key
      order by created_at asc, id asc
    ) as rn
  from growth.person_profiles
  where normalized_profile_key <> ''
)
delete from growth.person_profiles e
using ranked r
where e.id = r.id
  and r.rn > 1;

-- -----------------------------------------------------------------------------
-- Table-level UNIQUE constraints (mirrors 7.2A company_domains pattern)
-- -----------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'person_emails_normalized_email_key'
      and conrelid = 'growth.person_emails'::regclass
  ) then
    alter table growth.person_emails
      add constraint person_emails_normalized_email_key unique (normalized_email);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'person_phones_normalized_phone_key'
      and conrelid = 'growth.person_phones'::regclass
  ) then
    alter table growth.person_phones
      add constraint person_phones_normalized_phone_key unique (normalized_phone);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'person_profiles_normalized_profile_key_key'
      and conrelid = 'growth.person_profiles'::regclass
  ) then
    alter table growth.person_profiles
      add constraint person_profiles_normalized_profile_key_key unique (normalized_profile_key);
  end if;
end;
$$;

comment on constraint person_emails_normalized_email_key on growth.person_emails is
  'Global normalized email key for PostgREST upsert onConflict=normalized_email (7.2B).';
comment on constraint person_phones_normalized_phone_key on growth.person_phones is
  'Global normalized phone key for PostgREST upsert onConflict=normalized_phone (7.2B).';
comment on constraint person_profiles_normalized_profile_key_key on growth.person_profiles is
  'Global normalized profile key for PostgREST upsert onConflict=normalized_profile_key (7.2B).';
