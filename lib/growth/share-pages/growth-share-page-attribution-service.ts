/** Growth Engine SP-INT-1 — Share page sequence attribution (server-only). */

import "server-only"

import type { GrowthSharePage } from "@/lib/growth/share-pages/share-page-types"
import type { GrowthSharePageIntelligenceAnalyticsAttribution } from "@/lib/growth/share-pages/growth-share-page-intelligence-types"

export function buildGrowthSharePageAnalyticsAttribution(
  page: GrowthSharePage,
): GrowthSharePageIntelligenceAnalyticsAttribution {
  return {
    sequence_execution_id: page.sequenceExecutionJobId,
    sequence_step_id: page.sequenceStepId,
    sequence_enrollment_step_id: page.sequenceEnrollmentStepId,
    enrollment_id: page.enrollmentId,
    share_page_id: page.id,
  }
}

export function mergeGrowthSharePageAttributionMetadata(
  existing: Record<string, unknown> | null | undefined,
  attribution: GrowthSharePageIntelligenceAnalyticsAttribution,
): Record<string, unknown> {
  const current =
    existing?.analytics_attribution && typeof existing.analytics_attribution === "object"
      ? (existing.analytics_attribution as Record<string, unknown>)
      : {}

  return {
    ...(existing ?? {}),
    analytics_attribution: {
      ...current,
      ...attribution,
    },
  }
}
