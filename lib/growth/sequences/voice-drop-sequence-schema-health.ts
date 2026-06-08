/** Voice Drop sequence integration schema probes — VD-3. */

export const GROWTH_VOICE_DROP_SEQUENCE_VD_3_SCHEMA_MIGRATION =
  "20270809120000_growth_voice_drop_sequence_vd_3.sql" as const

export const GROWTH_VOICE_DROP_SEQUENCE_VD_2_SCHEMA_MIGRATION =
  "20270808120000_growth_voice_drop_sequence_vd_2.sql" as const

export const GROWTH_VOICE_DROP_SEQUENCE_SCHEMA_TABLES = [
  "sequence_pattern_steps",
  "sequence_enrollment_steps",
  "sequence_execution_jobs",
  "sequence_enrollment_channel_events",
  "lead_timeline_events",
  "multi_channel_activity_timeline_events",
] as const
