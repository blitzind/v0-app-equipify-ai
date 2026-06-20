import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { consumeBudget } from "@/lib/growth/runtime-guardrails/growth-runtime-budget-service"
import type { GrowthRuntimeResourceType } from "@/lib/growth/runtime-guardrails/growth-runtime-guardrail-config"
import { isRuntimeKillSwitchEnabled } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { consumeUserBudget } from "@/lib/growth/runtime-guardrails/growth-runtime-user-budget-service"
import { probeRuntimeTable } from "@/lib/growth/runtime-guardrails/growth-runtime-schema-probe"
import { recordRuntimeHealthFailure } from "@/lib/growth/runtime-guardrails/growth-runtime-health-counter-service"

export type AudienceGuardrailResult = {
  allowed: boolean
  reason: string | null
  blockedBy?: "kill_switch" | "org" | "user"
}

export async function checkAudienceSnapshotEnabled(
  admin: SupabaseClient,
): Promise<AudienceGuardrailResult> {
  const enabled = await isRuntimeKillSwitchEnabled(admin, "audience_snapshot_enabled")
  if (!enabled) {
    return {
      allowed: false,
      reason: "Audience snapshot generation disabled by kill switch.",
      blockedBy: "kill_switch",
    }
  }
  return { allowed: true, reason: null }
}

async function checkAndConsumeBudget(
  admin: SupabaseClient,
  input: {
    organizationId: string
    userId?: string | null
    resourceType: GrowthRuntimeResourceType
    windowKind: "hourly" | "daily"
  },
): Promise<AudienceGuardrailResult> {
  const orgResult = await consumeBudget(admin, {
    organizationId: input.organizationId,
    resourceType: input.resourceType,
    windowKind: input.windowKind,
    volume: 1,
  })
  if (!orgResult.allowed) {
    return {
      allowed: false,
      reason: orgResult.reason ?? "Org budget exceeded.",
      blockedBy: "org",
    }
  }

  if (input.userId) {
    const userTableProbe = await probeRuntimeTable(admin, "runtime_user_budgets")
    if (!userTableProbe.missing) {
      const userResult = await consumeUserBudget(admin, {
        organizationId: input.organizationId,
        userId: input.userId,
        resourceType: input.resourceType,
        windowKind: input.windowKind,
        volume: 1,
      })
      if (!userResult.allowed) {
        return {
          allowed: false,
          reason: userResult.reason ?? "User budget exceeded.",
          blockedBy: "user",
        }
      }
    }
  }

  return { allowed: true, reason: null }
}

/** Consume org + user budgets for a new snapshot generation (hourly cap). */
export async function consumeAudienceGenerationBudget(
  admin: SupabaseClient,
  input: { organizationId: string; userId?: string | null },
): Promise<AudienceGuardrailResult> {
  const killCheck = await checkAudienceSnapshotEnabled(admin)
  if (!killCheck.allowed) return killCheck

  return checkAndConsumeBudget(admin, {
    ...input,
    resourceType: "audience_generations",
    windowKind: "hourly",
  })
}

/** Consume org + user budgets for manual refresh (daily cap). */
export async function consumeAudienceRefreshBudget(
  admin: SupabaseClient,
  input: { organizationId: string; userId?: string | null },
): Promise<AudienceGuardrailResult> {
  const killCheck = await checkAudienceSnapshotEnabled(admin)
  if (!killCheck.allowed) return killCheck

  return checkAndConsumeBudget(admin, {
    ...input,
    resourceType: "audience_refreshes",
    windowKind: "daily",
  })
}

/** Consume search budget for each search page executed during snapshot batch. */
export async function consumeAudienceSearchPageBudget(
  admin: SupabaseClient,
  input: { organizationId: string; userId?: string | null },
): Promise<AudienceGuardrailResult> {
  const searchEnabled = await isRuntimeKillSwitchEnabled(admin, "search_execution_enabled")
  if (!searchEnabled) {
    return {
      allowed: false,
      reason: "Search execution disabled by kill switch.",
      blockedBy: "kill_switch",
    }
  }

  return checkAndConsumeBudget(admin, {
    ...input,
    resourceType: "searches",
    windowKind: "hourly",
  })
}

/** Consume enrollment budget for audience enroll action. */
export async function consumeAudienceEnrollmentBudget(
  admin: SupabaseClient,
  input: { organizationId: string; userId?: string | null; volume: number },
): Promise<AudienceGuardrailResult> {
  const killCheck = await checkAudienceSnapshotEnabled(admin)
  if (!killCheck.allowed) return killCheck

  const orgResult = await consumeBudget(admin, {
    organizationId: input.organizationId,
    resourceType: "audience_enrollments",
    windowKind: "daily",
    volume: input.volume,
  })
  if (!orgResult.allowed) {
    return {
      allowed: false,
      reason: orgResult.reason ?? "Daily audience enrollment budget exceeded.",
      blockedBy: "org",
    }
  }

  if (input.userId) {
    const userTableProbe = await probeRuntimeTable(admin, "runtime_user_budgets")
    if (!userTableProbe.missing) {
      const userResult = await consumeUserBudget(admin, {
        organizationId: input.organizationId,
        userId: input.userId,
        resourceType: "audience_enrollments",
        windowKind: "daily",
        volume: input.volume,
      })
      if (!userResult.allowed) {
        return {
          allowed: false,
          reason: userResult.reason ?? "Daily user enrollment budget exceeded.",
          blockedBy: "user",
        }
      }
    }
  }

  return { allowed: true, reason: null }
}

export async function checkAudienceDiffEnabled(
  admin: SupabaseClient,
): Promise<AudienceGuardrailResult> {
  const enabled = await isRuntimeKillSwitchEnabled(admin, "audience_diff_enabled")
  if (!enabled) {
    return {
      allowed: false,
      reason: "Audience diff generation disabled by kill switch.",
      blockedBy: "kill_switch",
    }
  }
  return { allowed: true, reason: null }
}

export async function checkAudienceLeadCreationEnabled(
  admin: SupabaseClient,
): Promise<AudienceGuardrailResult> {
  const enabled = await isRuntimeKillSwitchEnabled(admin, "audience_lead_creation_enabled")
  if (!enabled) {
    return {
      allowed: false,
      reason: "Audience lead creation disabled by kill switch.",
      blockedBy: "kill_switch",
    }
  }
  return { allowed: true, reason: null }
}

/** Consume org budget for snapshot diff generation (daily cap). */
export async function consumeAudienceDiffBudget(
  admin: SupabaseClient,
  input: { organizationId: string; userId?: string | null },
): Promise<AudienceGuardrailResult> {
  const killCheck = await checkAudienceDiffEnabled(admin)
  if (!killCheck.allowed) return killCheck

  return checkAndConsumeBudget(admin, {
    ...input,
    resourceType: "audience_diffs",
    windowKind: "daily",
  })
}

/** Consume org + user budgets for inbox bridge lead creation (daily cap). */
export async function consumeAudienceLeadCreationBudget(
  admin: SupabaseClient,
  input: { organizationId: string; userId?: string | null; volume: number },
): Promise<AudienceGuardrailResult> {
  const killCheck = await checkAudienceLeadCreationEnabled(admin)
  if (!killCheck.allowed) return killCheck

  const orgResult = await consumeBudget(admin, {
    organizationId: input.organizationId,
    resourceType: "audience_lead_creations",
    windowKind: "daily",
    volume: input.volume,
  })
  if (!orgResult.allowed) {
    return {
      allowed: false,
      reason: orgResult.reason ?? "Daily audience lead creation budget exceeded.",
      blockedBy: "org",
    }
  }

  if (input.userId) {
    const userTableProbe = await probeRuntimeTable(admin, "runtime_user_budgets")
    if (!userTableProbe.missing) {
      const userResult = await consumeUserBudget(admin, {
        organizationId: input.organizationId,
        userId: input.userId,
        resourceType: "audience_lead_creations",
        windowKind: "daily",
        volume: input.volume,
      })
      if (!userResult.allowed) {
        return {
          allowed: false,
          reason: userResult.reason ?? "Daily user lead creation budget exceeded.",
          blockedBy: "user",
        }
      }
    }
  }

  return { allowed: true, reason: null }
}

export async function recordAudienceGuardrailFailure(
  admin: SupabaseClient,
  message: string,
): Promise<void> {
  try {
    await recordRuntimeHealthFailure(admin, message)
  } catch {
    // Never fail caller on observability write.
  }
}
