-- Growth Engine Phase VD-3 — Voice Drop operator-ready sequence pattern template.

insert into growth.sequence_patterns (
  key,
  label,
  description,
  pattern_kind,
  sequence_version,
  is_active,
  min_touches,
  metadata
)
values (
  'multichannel_with_voice_drop',
  'Multichannel with Voice Drop (template)',
  'Email → Voice Drop → SMS → Manual Call → Email. Requires operator to link an approved Voice Drop campaign before activation.',
  'catalog',
  1,
  false,
  5,
  jsonb_build_object(
    'voice_drop_vd_3_template', true,
    'requires_voice_drop_campaign_selection', true,
    'operator_activation_required', true
  )
)
on conflict (key) do update set
  label = excluded.label,
  description = excluded.description,
  is_active = excluded.is_active,
  metadata = excluded.metadata,
  updated_at = now();

insert into growth.sequence_pattern_steps (
  pattern_id,
  step_order,
  channel,
  delay_days_min,
  delay_days_max,
  generation_type,
  expected_signal,
  voice_drop_campaign_id
)
select
  p.id,
  s.step_order,
  s.channel,
  s.delay_days_min,
  s.delay_days_max,
  s.generation_type,
  s.expected_signal,
  null
from growth.sequence_patterns p
join (
  values
    (1, 'email', 0, 0, 'cold_email', 'reply'),
    (2, 'voice_drop', 3, 3, null, 'no_signal'),
    (3, 'sms', 2, 2, null, 'reply'),
    (4, 'manual_call', 3, 3, null, 'call_connected'),
    (5, 'email', 4, 4, 'follow_up_email', 'positive_reply')
) as s(step_order, channel, delay_days_min, delay_days_max, generation_type, expected_signal)
  on true
where p.key = 'multichannel_with_voice_drop'
on conflict (pattern_id, step_order) do update set
  channel = excluded.channel,
  delay_days_min = excluded.delay_days_min,
  delay_days_max = excluded.delay_days_max,
  generation_type = excluded.generation_type,
  expected_signal = excluded.expected_signal;
