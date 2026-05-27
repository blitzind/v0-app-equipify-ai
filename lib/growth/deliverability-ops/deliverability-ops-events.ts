import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

export async function appendDeliverabilityOpsTimelineEvent(
  admin: SupabaseClient,
  input: {
    eventType:
      | "deliverability_ops_snapshot_recorded"
      | "deliverability_risk_detected"
      | "deliverability_recommendation_created"
      | "deliverability_recommendation_acknowledged"
      | "deliverability_recommendation_completed"
      | "deliverability_recommendation_dismissed"
      | "deliverability_remediation_task_created"
    title: string
    summary: string
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  try {
    await admin.schema("growth").from("platform_timeline_events").insert({
      event_type: input.eventType,
      title: input.title.slice(0, 200),
      summary: input.summary.slice(0, 1000),
      metadata: input.metadata ?? {},
    })
  } catch {
    /* best-effort */
  }
}

export async function acknowledgeDeliverabilityRecommendationWithTimeline(
  admin: SupabaseClient,
  input: { recommendationId: string; actorUserId: string; title: string },
): Promise<void> {
  await appendDeliverabilityOpsTimelineEvent(admin, {
    eventType: "deliverability_recommendation_acknowledged",
    title: "Deliverability recommendation acknowledged",
    summary: input.title,
    metadata: { acknowledged_by: input.actorUserId },
  })
}

export async function completeDeliverabilityRecommendationWithTimeline(
  admin: SupabaseClient,
  input: { recommendationId: string; actorUserId: string; title: string; note?: string },
): Promise<void> {
  await appendDeliverabilityOpsTimelineEvent(admin, {
    eventType: "deliverability_recommendation_completed",
    title: "Deliverability recommendation completed",
    summary: input.title,
    metadata: { completed_by: input.actorUserId, note: input.note ?? null },
  })
}

export async function dismissDeliverabilityRecommendationWithTimeline(
  admin: SupabaseClient,
  input: { recommendationId: string; actorUserId: string; title: string; reason?: string },
): Promise<void> {
  await appendDeliverabilityOpsTimelineEvent(admin, {
    eventType: "deliverability_recommendation_dismissed",
    title: "Deliverability recommendation dismissed",
    summary: input.title,
    metadata: { dismissed_by: input.actorUserId, reason: input.reason ?? null },
  })
}
