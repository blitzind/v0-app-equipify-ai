import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { hashComplianceEmail } from "@/lib/growth/compliance/bounce-classifier"
import type { GrowthPreSendSuppressionResult, GrowthUnsubscribeScope } from "@/lib/growth/compliance/compliance-types"
import {
  recordComplaintDetectedTimelineEvent,
  recordSuppressionAppliedTimelineEvent,
  recordUnsubscribeDetectedTimelineEvent,
} from "@/lib/growth/compliance/compliance-events"
import { recordExperimentMetricFromDeliveryAttempt } from "@/lib/growth/experiments/experiment-metrics"

function suppressionsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("delivery_suppressions")
}

function unsubscribesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("unsubscribe_registry")
}

function complaintsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("email_complaints")
}

function bouncesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("email_bounces")
}

export async function isEmailUnsubscribed(
  admin: SupabaseClient,
  input: { email: string; scope?: GrowthUnsubscribeScope },
): Promise<boolean> {
  const emailHash = hashComplianceEmail(input.email)
  if (!emailHash) return false

  const { data } = await unsubscribesTable(admin)
    .select("id")
    .eq("email_hash", emailHash)
    .in("scope", input.scope ? [input.scope, "global"] : ["global", "organization", "sequence"])
    .limit(1)

  return (data ?? []).length > 0
}

export async function registerUnsubscribe(
  admin: SupabaseClient,
  input: {
    email: string
    scope?: GrowthUnsubscribeScope
    organizationId?: string | null
    reason?: string | null
    source?: string
    leadId?: string | null
    deliveryAttemptId?: string | null
    occurredAt?: string
  },
): Promise<{ ok: boolean; emailHash: string }> {
  const emailHash = hashComplianceEmail(input.email)
  if (!emailHash) return { ok: false, emailHash: "" }

  const scope = input.scope ?? "global"
  const occurredAt = input.occurredAt ?? new Date().toISOString()

  const { error } = await unsubscribesTable(admin).insert({
    email_hash: emailHash,
    scope,
    organization_id: input.organizationId ?? null,
    reason: input.reason ?? null,
    source: input.source ?? "manual",
    occurred_at: occurredAt,
  })

  if (error) throw new Error(error.message)

  await applyDeliverySuppression(admin, {
    email: input.email,
    leadId: input.leadId,
    reason: `Unsubscribe (${scope})`,
    expiresAt: null,
  })

  await recordUnsubscribeDetectedTimelineEvent(admin, {
    leadId: input.leadId,
    scope,
    source: input.source ?? "manual",
    occurredAt,
  })

  if (input.deliveryAttemptId) {
    await recordExperimentMetricFromDeliveryAttempt(admin, {
      deliveryAttemptId: input.deliveryAttemptId,
      metric: "unsubscribes",
    }).catch(() => undefined)

    const { recordPerformanceEngagementFromDeliveryAttempt } = await import(
      "@/lib/growth/revenue-intelligence/performance-snapshots"
    )
    await recordPerformanceEngagementFromDeliveryAttempt(admin, {
      deliveryAttemptId: input.deliveryAttemptId,
      metric: "unsubscribes",
    }).catch(() => undefined)
  }

  return { ok: true, emailHash }
}

export async function applyDeliverySuppression(
  admin: SupabaseClient,
  input: {
    email: string
    leadId?: string | null
    reason: string
    expiresAt?: string | null
  },
): Promise<void> {
  const emailHash = hashComplianceEmail(input.email)
  if (!emailHash) return

  const { data: existing } = await suppressionsTable(admin)
    .select("id")
    .eq("email_hash", emailHash)
    .eq("active", true)
    .eq("reason", input.reason)
    .maybeSingle()

  if (existing) return

  const { error } = await suppressionsTable(admin).insert({
    lead_id: input.leadId ?? null,
    email_hash: emailHash,
    reason: input.reason,
    active: true,
    expires_at: input.expiresAt ?? null,
  })

  if (error) throw new Error(error.message)

  await recordSuppressionAppliedTimelineEvent(admin, {
    leadId: input.leadId,
    reason: input.reason,
  })
}

export async function hasActiveSuppression(
  admin: SupabaseClient,
  input: { email: string; leadId?: string | null },
): Promise<{ blocked: boolean; reason: string | null }> {
  const emailHash = hashComplianceEmail(input.email)
  if (!emailHash) return { blocked: false, reason: null }

  const now = new Date().toISOString()
  const { data } = await suppressionsTable(admin)
    .select("reason, expires_at")
    .eq("email_hash", emailHash)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(5)

  for (const row of data ?? []) {
    const expiresAt = row.expires_at as string | null
    if (expiresAt && expiresAt <= now) continue
    return { blocked: true, reason: row.reason as string }
  }

  if (input.leadId) {
    const { data: leadRows } = await suppressionsTable(admin)
      .select("reason, expires_at")
      .eq("lead_id", input.leadId)
      .eq("active", true)
      .limit(5)
    for (const row of leadRows ?? []) {
      const expiresAt = row.expires_at as string | null
      if (expiresAt && expiresAt <= now) continue
      return { blocked: true, reason: row.reason as string }
    }
  }

  return { blocked: false, reason: null }
}

export async function hasRecentComplaint(
  admin: SupabaseClient,
  input: { email: string; leadId?: string | null },
): Promise<boolean> {
  if (input.leadId) {
    const { count } = await complaintsTable(admin)
      .select("id", { count: "exact", head: true })
      .eq("lead_id", input.leadId)
    if ((count ?? 0) > 0) return true
  }

  const emailHash = hashComplianceEmail(input.email)
  if (!emailHash) return false

  const { data: suppressions } = await suppressionsTable(admin)
    .select("id")
    .eq("email_hash", emailHash)
    .eq("active", true)
    .ilike("reason", "%complaint%")
    .limit(1)

  return (suppressions ?? []).length > 0
}

export async function hasHardBounceSuppression(
  admin: SupabaseClient,
  input: { email: string; leadId?: string | null },
): Promise<boolean> {
  if (input.leadId) {
    const { count } = await bouncesTable(admin)
      .select("id", { count: "exact", head: true })
      .eq("lead_id", input.leadId)
      .in("bounce_type", ["hard", "blocked", "spam"])
    if ((count ?? 0) > 0) return true
  }

  const emailHash = hashComplianceEmail(input.email)
  if (!emailHash) return false

  const { data } = await suppressionsTable(admin)
    .select("id")
    .eq("email_hash", emailHash)
    .eq("active", true)
    .or("reason.ilike.%hard bounce%,reason.ilike.%spam%,reason.ilike.%blocked%")
    .limit(1)

  return (data ?? []).length > 0
}

export async function evaluatePreSendSuppression(
  admin: SupabaseClient,
  input: {
    email: string
    leadId?: string | null
    senderAccountId?: string
  },
): Promise<GrowthPreSendSuppressionResult> {
  if (await isEmailUnsubscribed(admin, { email: input.email })) {
    return {
      allowed: false,
      reason: "Recipient is unsubscribed.",
      blockCode: "unsubscribe",
    }
  }

  const suppression = await hasActiveSuppression(admin, { email: input.email, leadId: input.leadId })
  if (suppression.blocked) {
    return {
      allowed: false,
      reason: suppression.reason ?? "Recipient is suppressed.",
      blockCode: "suppression",
    }
  }

  if (await hasRecentComplaint(admin, { email: input.email, leadId: input.leadId })) {
    return {
      allowed: false,
      reason: "Recipient has a complaint on file.",
      blockCode: "complaint",
    }
  }

  if (await hasHardBounceSuppression(admin, { email: input.email, leadId: input.leadId })) {
    return {
      allowed: false,
      reason: "Recipient blocked due to hard bounce history.",
      blockCode: "hard_bounce",
    }
  }

  return { allowed: true, reason: null, blockCode: null }
}

/** Pre-send gate — delegates to unified assertPreSendAllowed. No bypass. */
export async function assertPreSendSuppressionAllowed(
  admin: SupabaseClient,
  input: {
    email: string
    leadId?: string | null
    senderAccountId: string
  },
): Promise<GrowthPreSendSuppressionResult> {
  const { assertPreSendAllowed } = await import("@/lib/growth/compliance/pre-send-assertion")
  const result = await assertPreSendAllowed(admin, input)
  return {
    allowed: result.allowed,
    reason: result.reason,
    blockCode: result.blockCode,
  }
}
