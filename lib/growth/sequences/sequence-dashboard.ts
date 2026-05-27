/** Sequence execution dashboard aggregation. Client-safe. */

import {
  GROWTH_SEQUENCE_EXECUTION_FOUNDATION_QA_MARKER,
  type GrowthSequenceEnrollment,
  type GrowthSequenceExecutionDashboard,
  type GrowthSequenceTemplate,
} from "@/lib/growth/sequences/sequence-types"

export function buildSequenceExecutionDashboard(input: {
  templates: GrowthSequenceTemplate[]
  enrollments: GrowthSequenceEnrollment[]
}): GrowthSequenceExecutionDashboard {
  const draft_count = input.templates.filter((template) => template.status === "draft").length
  const active_count = input.enrollments.filter((enrollment) => enrollment.status === "active").length
  const paused_count = input.enrollments.filter((enrollment) => enrollment.status === "paused").length
  const completed_count = input.enrollments.filter((enrollment) => enrollment.status === "completed").length

  const average_health_score =
    input.enrollments.length > 0
      ? Math.round(input.enrollments.reduce((sum, enrollment) => sum + enrollment.health_score, 0) / input.enrollments.length)
      : 100

  return {
    qa_marker: GROWTH_SEQUENCE_EXECUTION_FOUNDATION_QA_MARKER,
    draft_count,
    active_count,
    paused_count,
    completed_count,
    average_health_score,
  }
}
