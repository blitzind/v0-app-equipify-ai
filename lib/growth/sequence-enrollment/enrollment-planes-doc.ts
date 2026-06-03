/**
 * Growth Engine sequence enrollment planes (client-safe documentation).
 *
 * Recommendation: Pattern enrollments (A) are the primary system for outbound execution,
 * scheduler, bulk enroll, and standalone transport. Template enrollments (B) remain for
 * the legacy Sequence Execution foundation workspace until migrated.
 */

export const GROWTH_ENROLLMENT_PLANES_DOC = {
  recommendation: "pattern_primary" as const,
  pattern: {
    tables: ["growth.sequence_enrollments", "growth.sequence_enrollment_steps"],
    usedBy: [
      "bulk enrollment API",
      "growth-sequence-scheduler cron",
      "standalone sequence_execution_jobs",
      "lead drawer Sequence Intelligence",
      "pattern enrollment detail page",
    ],
    sidebarMetric: "activeSequences (pattern active count)",
  },
  template: {
    tables: ["growth.sequence_template_enrollments", "growth.sequence_templates"],
    usedBy: [
      "Sequence Execution foundation dashboard",
      "legacy single enroll via sequence templates",
      "template health tiles (draft/active/paused/completed)",
    ],
    sidebarMetric: "legacyTemplateActiveCount (shown on foundation section only)",
  },
} as const
