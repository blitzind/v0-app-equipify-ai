-- Apollo Full Pipeline Certification — materializable sequence patterns (pending approval only).

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
values
  (
    'certification_minimal_email',
    'Certification Minimal Email',
    'Apollo full pipeline certification only — single email draft placeholder, pending approval, no send.',
    'catalog',
    1,
    false,
    1,
    jsonb_build_object(
      'certification_only', true,
      'apollo_full_pipeline_certification', true,
      'operator_selection_disabled', true,
      'pending_approval_only', true
    )
  ),
  (
    'certification_minimal_email_voice_drop',
    'Certification Minimal Email → Voice Drop',
    'Apollo full pipeline certification only — email and voice drop draft placeholders, pending approval, no send.',
    'catalog',
    1,
    false,
    2,
    jsonb_build_object(
      'certification_only', true,
      'apollo_full_pipeline_certification', true,
      'operator_selection_disabled', true,
      'pending_approval_only', true
    )
  ),
  (
    'certification_minimal_call',
    'Certification Minimal Call',
    'Apollo full pipeline certification only — call step placeholder, pending approval, no dial/send.',
    'catalog',
    1,
    false,
    1,
    jsonb_build_object(
      'certification_only', true,
      'apollo_full_pipeline_certification', true,
      'operator_selection_disabled', true,
      'pending_approval_only', true
    )
  )
on conflict (key) do update set
  label = excluded.label,
  description = excluded.description,
  is_active = excluded.is_active,
  min_touches = excluded.min_touches,
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
  required_human_approval
)
select
  p.id,
  s.step_order,
  s.channel,
  s.delay_days_min,
  s.delay_days_max,
  s.generation_type,
  s.expected_signal,
  true
from growth.sequence_patterns p
join (
  values
    ('certification_minimal_email', 1, 'email', 0, 0, 'follow_up_email', 'reply'),
    ('certification_minimal_email_voice_drop', 1, 'email', 0, 0, 'follow_up_email', 'reply'),
    ('certification_minimal_email_voice_drop', 2, 'voice_drop', 3, 3, null, 'no_signal'),
    ('certification_minimal_call', 1, 'call', 0, 0, null, 'call_connected')
) as s(pattern_key, step_order, channel, delay_days_min, delay_days_max, generation_type, expected_signal)
  on p.key = s.pattern_key
on conflict (pattern_id, step_order) do update set
  channel = excluded.channel,
  delay_days_min = excluded.delay_days_min,
  delay_days_max = excluded.delay_days_max,
  generation_type = excluded.generation_type,
  expected_signal = excluded.expected_signal,
  required_human_approval = excluded.required_human_approval;

update growth.sequence_patterns
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
  'apollo_materialization_allowed', true,
  'pending_approval_only', true
)
where key = 'multichannel_with_voice_drop';
