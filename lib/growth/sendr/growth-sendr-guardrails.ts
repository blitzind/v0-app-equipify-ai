import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_SENDR_LIMITS,
} from "@/lib/growth/sendr/growth-sendr-config"
import { consumeBudget } from "@/lib/growth/runtime-guardrails/growth-runtime-budget-service"
import type { GrowthRuntimeKillSwitchKey, GrowthRuntimeResourceType } from "@/lib/growth/runtime-guardrails/growth-runtime-guardrail-config"
import { isRuntimeKillSwitchEnabled } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { recordRuntimeHealthFailure } from "@/lib/growth/runtime-guardrails/growth-runtime-health-counter-service"

export type SendrGuardrailResult = {
  allowed: boolean
  reason: string | null
  blockedBy?: "kill_switch" | "org"
}

const KILL_SWITCH_MAP: Partial<Record<GrowthRuntimeResourceType, GrowthRuntimeKillSwitchKey>> = {
  media_assets: "media_assets_enabled",
  landing_pages: "landing_pages_enabled",
  video_events: "video_tracking_enabled",
  agent_events: "agent_tracking_enabled",
  bookings: "booking_tracking_enabled",
  page_views: "landing_pages_enabled",
  sendr_page_links: "sendr_sequence_bridge_enabled",
  sendr_url_resolutions: "sendr_sequence_bridge_enabled",
  sendr_timeline_events: "sendr_timeline_enabled",
  sendr_intelligence: "sendr_intelligence_enabled",
  sendr_recommendations: "sendr_recommendations_enabled",
  sendr_timeline_updates: "sendr_intelligence_enabled",
}

export async function checkSendrKillSwitch(
  admin: SupabaseClient,
  resourceType: GrowthRuntimeResourceType,
): Promise<SendrGuardrailResult> {
  const key = KILL_SWITCH_MAP[resourceType]
  if (!key) {
    return { allowed: true, reason: null }
  }
  const enabled = await isRuntimeKillSwitchEnabled(admin, key)
  if (!enabled) {
    return {
      allowed: false,
      reason: `${key} disabled by kill switch.`,
      blockedBy: "kill_switch",
    }
  }
  return { allowed: true, reason: null }
}

export async function consumeSendrBudget(
  admin: SupabaseClient,
  input: {
    organizationId: string
    resourceType: GrowthRuntimeResourceType
    volume?: number
  },
): Promise<SendrGuardrailResult> {
  const kill = await checkSendrKillSwitch(admin, input.resourceType)
  if (!kill.allowed) return kill

  const result = await consumeBudget(admin, {
    organizationId: input.organizationId,
    resourceType: input.resourceType,
    windowKind: "daily",
    volume: input.volume ?? 1,
  })
  if (!result.allowed) {
    return {
      allowed: false,
      reason: result.reason ?? "Org budget exceeded.",
      blockedBy: "org",
    }
  }
  return { allowed: true, reason: null }
}

export async function assertSendrOrgAssetCap(
  admin: SupabaseClient,
  organizationId: string,
): Promise<SendrGuardrailResult> {
  const { count, error } = await admin
    .schema("growth")
    .from("growth_media_assets")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
  if (error?.message?.includes("does not exist")) {
    return { allowed: true, reason: null }
  }
  if ((count ?? 0) >= GROWTH_SENDR_LIMITS.MAX_MEDIA_ASSETS_PER_ORG) {
    return {
      allowed: false,
      reason: `Org media asset cap (${GROWTH_SENDR_LIMITS.MAX_MEDIA_ASSETS_PER_ORG}) reached.`,
      blockedBy: "org",
    }
  }
  return { allowed: true, reason: null }
}

export async function recordSendrGuardrailFailure(
  admin: SupabaseClient,
  message: string,
): Promise<void> {
  try {
    await recordRuntimeHealthFailure(admin, { message })
  } catch {
    // never throw from observability path
  }
}
