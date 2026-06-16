-- S3-A — SR-3 runtime trigger extensions (media, booking handoff, high intent).
-- Extends condition DSL source/event allowlists without changing execution semantics.

alter table growth.sequence_pattern_step_conditions
  drop constraint if exists sequence_pattern_step_conditions_source_check;

alter table growth.sequence_pattern_step_conditions
  drop constraint if exists sequence_pattern_step_conditions_event_check;

alter table growth.sequence_pattern_step_conditions
  drop constraint if exists sequence_pattern_step_conditions_source_event_match;

alter table growth.sequence_pattern_step_conditions
  add constraint sequence_pattern_step_conditions_source_check
  check (source in (
    'email', 'share_page', 'sms', 'voice_drop', 'cadence', 'lead', 'engagement',
    'media', 'booking_handoff', 'high_intent'
  ));

alter table growth.sequence_pattern_step_conditions
  add constraint sequence_pattern_step_conditions_event_check
  check (event in (
    'email.opened', 'email.clicked', 'email.replied', 'email.bounced',
    'share_page.viewed', 'share_page.engaged', 'share_page.cta_clicked',
    'share_page.booking_started', 'share_page.booking_completed',
    'sms.delivered', 'sms.replied', 'sms.failed',
    'voice_drop.delivered', 'voice_drop.failed',
    'call_task.completed',
    'lead.status', 'lead.hot_tier', 'lead.next_best_action',
    'engagement.score_threshold', 'engagement.tier',
    'media.viewed', 'media.play_started', 'media.completed', 'media.cta_clicked',
    'booking_handoff.ready',
    'high_intent.detected'
  ));

alter table growth.sequence_pattern_step_conditions
  add constraint sequence_pattern_step_conditions_source_event_match check (
    (source = 'email' and event like 'email.%')
    or (source = 'share_page' and event like 'share_page.%')
    or (source = 'sms' and event like 'sms.%')
    or (source = 'voice_drop' and event like 'voice_drop.%')
    or (source = 'cadence' and event like 'call_task.%')
    or (source = 'lead' and event like 'lead.%')
    or (source = 'engagement' and event like 'engagement.%')
    or (source = 'media' and event like 'media.%')
    or (source = 'booking_handoff' and event like 'booking_handoff.%')
    or (source = 'high_intent' and event like 'high_intent.%')
  );

alter table growth.sequence_enrollment_step_waits
  drop constraint if exists sequence_enrollment_step_waits_waited_for_source_check;

alter table growth.sequence_enrollment_step_waits
  drop constraint if exists sequence_enrollment_step_waits_waited_for_event_check;

alter table growth.sequence_enrollment_step_waits
  add constraint sequence_enrollment_step_waits_waited_for_source_check
  check (waited_for_source in (
    'email', 'share_page', 'sms', 'voice_drop', 'cadence', 'lead', 'engagement',
    'media', 'booking_handoff', 'high_intent'
  ));

alter table growth.sequence_enrollment_step_waits
  add constraint sequence_enrollment_step_waits_waited_for_event_check
  check (waited_for_event in (
    'email.opened', 'email.clicked', 'email.replied', 'email.bounced',
    'share_page.viewed', 'share_page.engaged', 'share_page.cta_clicked',
    'share_page.booking_started', 'share_page.booking_completed',
    'sms.delivered', 'sms.replied', 'sms.failed',
    'voice_drop.delivered', 'voice_drop.failed',
    'call_task.completed',
    'lead.status', 'lead.hot_tier', 'lead.next_best_action',
    'engagement.score_threshold', 'engagement.tier',
    'media.viewed', 'media.play_started', 'media.completed', 'media.cta_clicked',
    'booking_handoff.ready',
    'high_intent.detected'
  ));

alter table growth.sequence_branch_decisions
  drop constraint if exists sequence_branch_decisions_source_check;

alter table growth.sequence_branch_decisions
  drop constraint if exists sequence_branch_decisions_event_check;

alter table growth.sequence_branch_decisions
  add constraint sequence_branch_decisions_source_check
  check (source in (
    'email', 'share_page', 'sms', 'voice_drop', 'cadence', 'lead', 'engagement',
    'media', 'booking_handoff', 'high_intent'
  ));

alter table growth.sequence_branch_decisions
  add constraint sequence_branch_decisions_event_check
  check (event in (
    'email.opened', 'email.clicked', 'email.replied', 'email.bounced',
    'share_page.viewed', 'share_page.engaged', 'share_page.cta_clicked',
    'share_page.booking_started', 'share_page.booking_completed',
    'sms.delivered', 'sms.replied', 'sms.failed',
    'voice_drop.delivered', 'voice_drop.failed',
    'call_task.completed',
    'lead.status', 'lead.hot_tier', 'lead.next_best_action',
    'engagement.score_threshold', 'engagement.tier',
    'media.viewed', 'media.play_started', 'media.completed', 'media.cta_clicked',
    'booking_handoff.ready',
    'high_intent.detected'
  ));
