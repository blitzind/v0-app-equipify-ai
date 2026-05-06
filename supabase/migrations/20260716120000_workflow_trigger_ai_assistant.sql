-- Allow workflow automations to run when an operational AI assistant finishes a digest run.

alter table public.workflow_automations drop constraint if exists workflow_automations_trigger_type_check;

alter table public.workflow_automations
  add constraint workflow_automations_trigger_type_check check (
    trigger_type in (
      'work_order_created',
      'work_order_completed',
      'work_order_status_changed',
      'maintenance_due',
      'invoice_overdue',
      'quote_accepted',
      'equipment_warranty_expiring',
      'certificate_uploaded',
      'ai_assistant_digest_ready'
    )
  );
