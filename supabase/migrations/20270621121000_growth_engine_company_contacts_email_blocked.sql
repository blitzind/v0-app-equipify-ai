-- Add blocked email_status for suppression / provider do-not-mail results.

alter table growth.company_contacts
  drop constraint if exists company_contacts_email_status_check;

alter table growth.company_contacts
  add constraint company_contacts_email_status_check
  check (email_status in ('unknown', 'discovered', 'verified', 'risky', 'invalid', 'blocked'));
