-- Allow follow_up_tasks to attach to quotes (AIden + manual operational follow-ups).

alter table public.follow_up_tasks drop constraint if exists follow_up_tasks_entity_type_check;

alter table public.follow_up_tasks
  add constraint follow_up_tasks_entity_type_check
  check (
    entity_type in (
      'prospect',
      'work_order',
      'invoice',
      'customer',
      'equipment',
      'maintenance_plan',
      'quote'
    )
  );

comment on constraint follow_up_tasks_entity_type_check on public.follow_up_tasks is
  'prospect | work_order | invoice | customer | equipment | maintenance_plan | quote';
