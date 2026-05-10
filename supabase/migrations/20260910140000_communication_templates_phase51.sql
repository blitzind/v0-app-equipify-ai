-- Phase 51 — Communication templates: lifecycle fields + expanded categories (no send path changes).

alter table public.communication_templates
  add column if not exists enabled boolean not null default true;

alter table public.communication_templates
  add column if not exists updated_by uuid references auth.users (id) on delete set null;

comment on column public.communication_templates.enabled is
  'When false, template is hidden from default picks; Phase 51 does not send messages.';

comment on column public.communication_templates.updated_by is
  'Last staff user who edited this template (API-populated).';

alter table public.communication_templates drop constraint if exists communication_templates_category_check;

alter table public.communication_templates
  add constraint communication_templates_category_check check (
    category in (
      'quote_follow_up',
      'invoice_reminder',
      'maintenance_reminder',
      'thank_you',
      'review_request',
      'service_request',
      'work_order',
      'quote',
      'invoice',
      'portal',
      'general',
      'customer',
      'sms_reminder'
    )
  );
