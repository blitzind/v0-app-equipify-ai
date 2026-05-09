-- Phase 24 — Allow maintenance_plan as follow_up_tasks entity (maintenance reminder automation).

alter table public.follow_up_tasks drop constraint if exists follow_up_tasks_entity_type_check;

alter table public.follow_up_tasks add constraint follow_up_tasks_entity_type_check
  check (
    entity_type in (
      'prospect',
      'work_order',
      'invoice',
      'customer',
      'equipment',
      'maintenance_plan'
    )
  );
