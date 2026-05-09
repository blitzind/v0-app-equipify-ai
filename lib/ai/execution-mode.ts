import "server-only"

import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { getOrganizationSubscription, type OrganizationSubscription } from "@/lib/billing/subscriptions"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"

export type AiExecutionMode = "mock_trial" | "live_paid" | "internal_test" | "disabled"

export type ResolveAiExecutionModeParams = {
  organizationId: string
  /** Current user email — used with {@link forceLiveAi} for platform admins only. */
  actingUserEmail?: string | null
  /** When true with a platform-admin email, forces live providers (internal testing). */
  forceLiveAi?: boolean
  /**
   * Platform-admin-only: force simulated previews even when subscription would normally use live AI.
   * Mutually exclusive with forceLiveAi — force-live wins.
   */
  forceMockAi?: boolean
}

function parseUuidAllowlist(raw: string | undefined): Set<string> {
  if (!raw?.trim()) return new Set()
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  )
}

function envExecutionOverride(): AiExecutionMode | null {
  const v = process.env.AI_EXECUTION_MODE?.trim().toLowerCase()
  if (v === "live") return "live_paid"
  if (v === "mock") return "mock_trial"
  if (v === "disabled") return "disabled"
  return null
}

/**
 * Central resolver for whether org AI runs against live providers or simulated trial output.
 *
 * - Paid Stripe `active` subscriptions → live providers.
 * - Active trials, incomplete checkout, or missing subscription rows → mock trial simulation.
 * - Restricted billing (`past_due`, `unpaid`, ...) → AI disabled for customer routes.
 * - Platform admins may force live via {@link forceLiveAi} (logged as `internal_test`).
 */
export async function resolveAiExecutionMode(
  params: ResolveAiExecutionModeParams,
): Promise<{ mode: AiExecutionMode; subscription: OrganizationSubscription | null }> {
  const env = envExecutionOverride()
  if (env === "disabled") return { mode: "disabled", subscription: null }
  if (env === "live_paid") {
    const sub = await loadSubscription(params.organizationId)
    return { mode: "live_paid", subscription: sub }
  }
  if (env === "mock_trial") {
    const sub = await loadSubscription(params.organizationId)
    return { mode: "mock_trial", subscription: sub }
  }

  const actingEmail = params.actingUserEmail?.trim() ?? ""
  const isPlatformAdmin = Boolean(actingEmail && isPlatformAdminEmail(actingEmail))

  const forceLive =
    Boolean(params.forceLiveAi) && isPlatformAdmin

  if (forceLive) {
    const sub = await loadSubscription(params.organizationId)
    return { mode: "internal_test", subscription: sub }
  }

  const forceLiveOrgIds = parseUuidAllowlist(process.env.AI_INTERNAL_LIVE_ORG_IDS)
  if (forceLiveOrgIds.has(params.organizationId.trim())) {
    const sub = await loadSubscription(params.organizationId)
    return { mode: "internal_test", subscription: sub }
  }

  const forceMockOrgIds = parseUuidAllowlist(process.env.AI_INTERNAL_MOCK_ORG_IDS)
  if (forceMockOrgIds.has(params.organizationId.trim())) {
    const sub = await loadSubscription(params.organizationId)
    return { mode: "mock_trial", subscription: sub }
  }

  const forceMockByAdmin = Boolean(params.forceMockAi) && isPlatformAdmin
  if (forceMockByAdmin) {
    const sub = await loadSubscription(params.organizationId)
    return { mode: "mock_trial", subscription: sub }
  }

  const subscription = await loadSubscription(params.organizationId)

  if (subscription) {
    const st = subscription.status
    if (st === "past_due" || st === "unpaid") {
      return { mode: "disabled", subscription }
    }
    if (st === "canceled" || st === "paused" || st === "incomplete_expired") {
      return { mode: "disabled", subscription }
    }
    if (st === "active") {
      return { mode: "live_paid", subscription }
    }
    if (st === "trialing") {
      return { mode: "mock_trial", subscription }
    }
    if (st === "incomplete") {
      return { mode: "mock_trial", subscription }
    }
  }

  if (!subscription) {
    return { mode: "mock_trial", subscription: null }
  }

  return { mode: "mock_trial", subscription }
}

async function loadSubscription(organizationId: string): Promise<OrganizationSubscription | null> {
  try {
    const supabase = createServiceRoleSupabaseClient()
    return await getOrganizationSubscription(supabase, organizationId.trim())
  } catch {
    return null
  }
}
