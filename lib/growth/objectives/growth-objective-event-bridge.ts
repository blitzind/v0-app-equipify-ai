/** GE-AUTO-2B/2C — Best-effort objective event fan-in bridge (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { LeadSignalEvent } from "@/lib/growth/signal-intelligence/lead-signal-event-types"
import { resolveGrowthObjectiveOrganizationId } from "@/lib/growth/objectives/growth-objective-event-context"
import {
  mapLeadSignalTypeToObjectiveSourceEvent,
  type GrowthObjectiveSourceEvent,
} from "@/lib/growth/objectives/growth-objective-signal-mapper"

export async function dispatchGrowthObjectiveSourceEvent(
  admin: SupabaseClient,
  event: GrowthObjectiveSourceEvent,
): Promise<void> {
  try {
    const { routeGrowthObjectiveSourceEvent } = await import(
      "@/lib/growth/objectives/growth-objective-event-router"
    )
    await routeGrowthObjectiveSourceEvent(admin, event)
  } catch {
    // Best-effort — never fail upstream event processing.
  }
}

export async function dispatchGrowthObjectiveLeadSignalEvent(
  admin: SupabaseClient,
  event: LeadSignalEvent,
): Promise<void> {
  const organizationId =
    event.organizationId ??
    (await resolveGrowthObjectiveOrganizationId(admin, { leadId: event.leadId }))
  if (!organizationId) return

  const sourceEvent = mapLeadSignalTypeToObjectiveSourceEvent({
    organizationId,
    leadId: event.leadId,
    signalType: event.signalType,
    occurredAt: event.occurredAt,
    metadata: event.metadata,
  })
  if (!sourceEvent) return
  await dispatchGrowthObjectiveSourceEvent(admin, sourceEvent)
}

export async function dispatchGrowthObjectiveEngagementEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    signalType:
      | "email_opened"
      | "email_clicked"
      | "video_view_started"
      | "video_completed"
      | "cta_clicked"
      | "landing_page_visit"
      | "reply_received"
    resourceType?: string | null
    resourceKey?: string | null
    resourceId?: string | null
    sourceEventId?: string | null
    occurredAt?: string
    idempotencyKey?: string
  },
): Promise<void> {
  const occurredAt = input.occurredAt ?? new Date().toISOString()
  await dispatchGrowthObjectiveSourceEvent(admin, {
    organizationId: input.organizationId,
    source: "engagement",
    signalType: input.signalType,
    leadId: input.leadId,
    resourceType: input.resourceType ?? null,
    resourceKey: input.resourceKey ?? null,
    resourceId: input.resourceId ?? null,
    occurredAt,
    idempotencyKey:
      input.idempotencyKey ??
      `engagement:${input.leadId}:${input.signalType}:${input.sourceEventId ?? occurredAt}`,
  })
}

export async function dispatchGrowthObjectiveSharePageEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    sharePageId: string
    signalType:
      | "landing_page_visit"
      | "cta_clicked"
      | "video_view_started"
      | "video_completed"
      | "booking_started"
      | "booking_completed"
    sharePageViewId?: string | null
    occurredAt?: string
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  const occurredAt = input.occurredAt ?? new Date().toISOString()
  const resourceKey = input.sharePageId
  const viewKey = input.sharePageViewId ?? "anonymous"
  await dispatchGrowthObjectiveSourceEvent(admin, {
    organizationId: input.organizationId,
    source: "share_page",
    signalType: input.signalType,
    leadId: input.leadId,
    resourceType: input.signalType.includes("booking") ? "booking_page" : "landing_page",
    resourceKey,
    resourceId: input.sharePageId,
    occurredAt,
    payload: input.metadata,
    idempotencyKey: `share-page:${input.sharePageId}:${viewKey}:${input.signalType}:${occurredAt}`,
  })
}

export async function dispatchGrowthObjectiveAutomationRuntimeEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    signalType:
      | "prepared_action"
      | "approval"
      | "executed_action"
      | "rejected_action"
      | "autonomous_send"
      | "blocked_action"
      | "execution"
    channel?: string | null
    resourceType?: string | null
    resourceKey?: string | null
    resourceId?: string | null
    confidence?: number | null
    policyMetadata?: Record<string, unknown>
    sourceEventId?: string | null
    occurredAt?: string
  },
): Promise<void> {
  const occurredAt = input.occurredAt ?? new Date().toISOString()
  await dispatchGrowthObjectiveSourceEvent(admin, {
    organizationId: input.organizationId,
    source: "automation",
    signalType: input.signalType,
    leadId: input.leadId,
    resourceType: input.resourceType ?? "sequence",
    resourceKey: input.resourceKey ?? null,
    resourceId: input.resourceId ?? null,
    occurredAt,
    payload: {
      channel: input.channel ?? null,
      confidence: input.confidence ?? null,
      policy: input.policyMetadata ?? null,
    },
    idempotencyKey: `automation:${input.signalType}:${input.leadId}:${input.sourceEventId ?? occurredAt}`,
  })
}
