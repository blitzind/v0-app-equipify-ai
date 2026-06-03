import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_TRANSPORT_MAX_RETRIES,
  GROWTH_TRANSPORT_RETRY_DELAYS_MS,
  type GrowthDeliveryAttempt,
  type GrowthTransportSimulationResult,
} from "@/lib/growth/providers/adapters/provider-adapter-types"
import { getTransportAdapter } from "@/lib/growth/providers/adapters/adapter-registry"
import { selectDeliveryRoute } from "@/lib/growth/providers/provider-router"
import { getSenderAccount } from "@/lib/growth/sender/sender-repository"
import { applyOutboundEmailTracking } from "@/lib/growth/tracking/tracking-links"
import { assertPreSendAllowed } from "@/lib/growth/compliance/pre-send-assertion"
import type { GrowthQaDeliverabilityBypassSnapshot } from "@/lib/growth/sequence-enrollment/qa-deliverability-bypass-types"
import { assertGrowthProductionRuntimeSafe } from "@/lib/growth/runtime/runtime-guards"
import { enforceGovernanceIfReady } from "@/lib/growth/governance/governance-enforcement"
import { checkTransportRateLimit } from "@/lib/growth/providers/transport/transport-rate-limit"
import { resolveTransportFallbackRoute, simulateTransportDelivery } from "@/lib/growth/providers/transport/transport-fallback"
import { recordTransportAuditEvent } from "@/lib/growth/providers/transport/transport-events"
import {
  createDeliveryAttempt,
  ensureProviderRateLimit,
  getDeliveryAttempt,
  incrementProviderRateLimit,
  loadRouteCandidatesForSender,
  resolveProviderAdapterCredentials,
  updateDeliveryAttempt,
} from "@/lib/growth/providers/transport/transport-repository"
import { listDeliveryRoutes } from "@/lib/growth/providers/provider-repository"
import { resolveTransportSenderWithPool } from "@/lib/growth/sender-pools/sender-pool-rotation-service"

export class TransportHumanApprovalRequiredError extends Error {
  constructor() {
    super("human_approval_required")
    this.name = "TransportHumanApprovalRequiredError"
  }
}

export type TransportSendInput = {
  sender_account_id: string
  to: string
  subject: string
  html?: string
  text?: string
  lead_id?: string | null
  sequence_enrollment_id?: string | null
  sequence_execution_job_id?: string | null
  sender_pool_id?: string | null
  allow_auto_rotation?: boolean
  manual_sender_account_id?: string | null
  human_approved: boolean
  human_approval_confirmed?: boolean
  actorUserId: string
  actorEmail: string
  is_test?: boolean
  metadata?: Record<string, unknown>
  qa_deliverability_bypass?: GrowthQaDeliverabilityBypassSnapshot | null
}

export type TransportSendResult = {
  ok: boolean
  attempt: GrowthDeliveryAttempt | null
  provider_message_id?: string
  error?: string
  used_fallback?: boolean
  requires_human_review?: boolean
  sender_rotation?: {
    selectedSenderLabel?: string | null
    reason?: string
    riskLevel?: string
    fallbackCandidates?: Array<{ senderLabel: string; reason: string; riskLevel: string }>
  }
}

function assertHumanApproval(input: TransportSendInput): void {
  if (!input.human_approved || !input.human_approval_confirmed) {
    throw new TransportHumanApprovalRequiredError()
  }
}

function retryDelayMs(retryCount: number): number {
  return GROWTH_TRANSPORT_RETRY_DELAYS_MS[Math.min(retryCount, GROWTH_TRANSPORT_RETRY_DELAYS_MS.length - 1)] ?? 0
}

export async function simulateTransportForSender(
  admin: SupabaseClient,
  input: { sender_account_id: string; volume?: number },
): Promise<GrowthTransportSimulationResult> {
  const routes = await loadRouteCandidatesForSender(admin, input.sender_account_id)
  const selection = selectDeliveryRoute({ routes, requested_volume: input.volume ?? 1 })
  const rateLimit = selection.selected_route_id
    ? await ensureProviderRateLimit(
        admin,
        routes.find((route) => route.route_id === selection.selected_route_id)?.provider_id ?? "",
      ).catch(() => null)
    : null

  return simulateTransportDelivery({
    routes,
    rate_limit: rateLimit,
    requested_volume: input.volume ?? 1,
  })
}

function isTrackingEnabledForSend(): boolean {
  return process.env.GROWTH_TRACKING_DISABLED?.trim() !== "true"
}

async function executeAttemptOnRoute(
  admin: SupabaseClient,
  input: {
    route_id: string
    provider_id: string
    provider_family: string
    sender_account_id: string
    message: { to: string; subject: string; html?: string; text?: string }
    lead_id?: string | null
    sequence_enrollment_id?: string | null
    sender_pool_id?: string | null
    actorUserId: string
    actorEmail: string
    is_test?: boolean
    retry_count?: number
    extra_metadata?: Record<string, unknown>
    qa_deliverability_bypass?: GrowthQaDeliverabilityBypassSnapshot | null
  },
): Promise<TransportSendResult> {
  const suppression = await assertPreSendAllowed(admin, {
    email: input.message.to,
    leadId: input.lead_id,
    senderAccountId: input.sender_account_id,
    senderPoolId: input.sender_pool_id,
    qaDeliverabilityBypass: input.qa_deliverability_bypass,
    actingUserEmail: input.actorEmail,
    actingUserId: input.actorUserId,
  })

  if (!suppression.allowed) {
    await recordTransportAuditEvent(admin, {
      provider_id: input.provider_id,
      event_type: "delivery_failed",
      title: "Delivery blocked by compliance",
      description: suppression.reason ?? "Pre-send suppression blocked delivery.",
      severity: "high",
      metadata: {
        block_code: suppression.blockCode,
        route_id: input.route_id,
        sender_account_id: input.sender_account_id,
        to: input.message.to,
      },
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail,
    })
    return {
      ok: false,
      attempt: null,
      error: suppression.reason ?? "Pre-send suppression blocked delivery.",
      requires_human_review: true,
    }
  }

  const rateLimitRow = await ensureProviderRateLimit(admin, input.provider_id)
  const rateCheck = checkTransportRateLimit(rateLimitRow, 1)
  if (!rateCheck.allowed) {
    await recordTransportAuditEvent(admin, {
      provider_id: input.provider_id,
      event_type: "rate_limit_hit",
      title: "Transport rate limit hit",
      description: rateCheck.reason,
      severity: "high",
      metadata: { route_id: input.route_id, sender_account_id: input.sender_account_id },
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail,
    })
    return { ok: false, attempt: null, error: rateCheck.reason, requires_human_review: true }
  }

  const attempt = await createDeliveryAttempt(admin, {
    provider_id: input.provider_id,
    sender_account_id: input.sender_account_id,
    lead_id: input.lead_id,
    sequence_enrollment_id: input.sequence_enrollment_id,
    metadata: {
      route_id: input.route_id,
      is_test: input.is_test ?? false,
      retry_count: input.retry_count ?? 0,
      human_approved: true,
      actor_user_id: input.actorUserId,
      actor_email: input.actorEmail,
      to: input.message.to,
      subject: input.message.subject,
      html: input.message.html ?? null,
      text: input.message.text ?? null,
      ...(input.extra_metadata ?? {}),
    },
  })

  await recordTransportAuditEvent(admin, {
    provider_id: input.provider_id,
    event_type: "delivery_queued",
    title: input.is_test ? "Test delivery queued" : "Delivery queued",
    description: `Queued transport to ${input.message.to}`,
    metadata: { attempt_id: attempt.id, route_id: input.route_id },
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
    attemptId: attempt.id,
  })

  const sender = await getSenderAccount(admin, input.sender_account_id)
  const credentials = await resolveProviderAdapterCredentials(admin, {
    provider_id: input.provider_id,
    sender_account_id: input.sender_account_id,
  })

  if (!credentials) {
    const failed = await updateDeliveryAttempt(admin, attempt.id, {
      status: "failed",
      failed_at: new Date().toISOString(),
      failure_reason: "Could not resolve provider credentials.",
    })
    await recordTransportAuditEvent(admin, {
      provider_id: input.provider_id,
      event_type: "delivery_failed",
      title: "Delivery failed",
      description: "Could not resolve provider credentials.",
      severity: "critical",
      attemptId: attempt.id,
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail,
    })
    return { ok: false, attempt: failed, error: "Could not resolve provider credentials.", requires_human_review: true }
  }

  const adapter = getTransportAdapter(credentials.provider_family)
  if (!adapter) {
    const failed = await updateDeliveryAttempt(admin, attempt.id, {
      status: "failed",
      failed_at: new Date().toISOString(),
      failure_reason: `Unsupported provider family: ${input.provider_family}`,
    })
    return { ok: false, attempt: failed, error: failed.failure_reason ?? undefined, requires_human_review: true }
  }

  const validation = adapter.validate(credentials)
  if (!validation.ok) {
    const failed = await updateDeliveryAttempt(admin, attempt.id, {
      status: "failed",
      failed_at: new Date().toISOString(),
      failure_reason: validation.summary,
    })
    await recordTransportAuditEvent(admin, {
      provider_id: input.provider_id,
      event_type: "delivery_failed",
      title: "Delivery failed",
      description: validation.summary,
      severity: "high",
      attemptId: attempt.id,
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail,
    })
    return { ok: false, attempt: failed, error: validation.summary, requires_human_review: true }
  }

  let outboundHtml = input.message.html
  let trackingMetadata: Record<string, unknown> | null = null
  if (isTrackingEnabledForSend() && outboundHtml) {
    const tracked = applyOutboundEmailTracking({
      html: outboundHtml,
      deliveryAttemptId: attempt.id,
    })
    outboundHtml = tracked.html
    trackingMetadata = tracked.metadata
    if (trackingMetadata) {
      await updateDeliveryAttempt(admin, attempt.id, {
        metadata: {
          ...attempt.metadata,
          tracking: trackingMetadata,
        },
      })
    }
  }

  const sendResult = await adapter.send(credentials, {
    to: input.message.to,
    subject: input.message.subject,
    html: outboundHtml,
    text: input.message.text,
    from: credentials.from_address ?? sender?.email_address ?? "noreply@equipify.local",
    fromName: sender?.display_name ?? undefined,
  })

  if (sendResult.ok) {
    await incrementProviderRateLimit(admin, input.provider_id, 1)
    const sendMetadata: Record<string, unknown> = {
      ...attempt.metadata,
      provider_message_id: sendResult.provider_message_id ?? null,
      simulated: sendResult.simulated ?? false,
    }
    if (sendResult.provider_thread_id) {
      sendMetadata.provider_thread_id = sendResult.provider_thread_id
    }
    if (sendResult.rfc_message_id) {
      sendMetadata.rfc_message_id = sendResult.rfc_message_id
    }
    const sent = await updateDeliveryAttempt(admin, attempt.id, {
      status: "sent",
      sent_at: new Date().toISOString(),
      provider_message_id: sendResult.provider_message_id ?? null,
      metadata: sendMetadata,
    })
    await recordTransportAuditEvent(admin, {
      provider_id: input.provider_id,
      event_type: "delivery_sent",
      title: input.is_test ? "Test delivery sent" : "Delivery sent",
      description: `Transport completed for ${input.message.to}`,
      metadata: {
        provider_message_id: sendResult.provider_message_id,
        provider_thread_id: sendResult.provider_thread_id ?? null,
        rfc_message_id: sendResult.rfc_message_id ?? null,
        simulated: sendResult.simulated ?? false,
      },
      attemptId: attempt.id,
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail,
    })
    return { ok: true, attempt: sent, provider_message_id: sendResult.provider_message_id }
  }

  const retryCount = input.retry_count ?? 0
  const nextRetryCount = retryCount + 1
  const canRetry = nextRetryCount <= GROWTH_TRANSPORT_MAX_RETRIES

  const failed = await updateDeliveryAttempt(admin, attempt.id, {
    status: canRetry ? "retry_scheduled" : "failed",
    failed_at: new Date().toISOString(),
    failure_reason: sendResult.error ?? "Provider send failed.",
    retry_count: nextRetryCount,
    metadata: {
      ...attempt.metadata,
      next_retry_at: canRetry ? new Date(Date.now() + retryDelayMs(nextRetryCount)).toISOString() : null,
    },
  })

  await recordTransportAuditEvent(admin, {
    provider_id: input.provider_id,
    event_type: canRetry ? "delivery_retry" : "delivery_failed",
    title: canRetry ? "Delivery scheduled for retry" : "Delivery failed",
    description: sendResult.error ?? "Provider send failed.",
    severity: canRetry ? "medium" : "high",
    metadata: { retry_count: nextRetryCount, next_retry_at: failed.metadata.next_retry_at },
    attemptId: attempt.id,
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
  })

  return {
    ok: false,
    attempt: failed,
    error: sendResult.error,
    requires_human_review: !canRetry,
  }
}

export async function executeTransportSend(
  admin: SupabaseClient,
  input: TransportSendInput,
): Promise<TransportSendResult> {
  assertHumanApproval(input)
  assertGrowthProductionRuntimeSafe("transport.send")

  await enforceGovernanceIfReady(admin, {
    action: input.is_test ? "provider_test_send" : "provider_send",
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
    sourceRoute: input.is_test ? "provider.test_send" : "provider.send",
    entityType: "delivery_attempt",
    recipientEmail: input.to,
    humanApprovalConfirmed: input.human_approval_confirmed,
    recordAudit: !input.metadata?.governance_audit_recorded,
    approvalReason: input.is_test ? "Human confirmed provider test send." : "Human confirmed provider send.",
  })

  let senderAccountId = input.sender_account_id
  let rotationMeta: TransportSendResult["sender_rotation"]

  if (input.sender_pool_id) {
    const resolved = await resolveTransportSenderWithPool(admin, {
      senderAccountId: input.sender_account_id,
      senderPoolId: input.sender_pool_id,
      allowAutoRotation: input.allow_auto_rotation,
      manualSenderAccountId: input.manual_sender_account_id,
      sequenceExecutionJobId: input.sequence_execution_job_id,
    })
    if (!resolved?.senderAccountId) {
      return {
        ok: false,
        attempt: null,
        error: "No eligible sender in pool.",
        requires_human_review: true,
      }
    }
    senderAccountId = resolved.senderAccountId
    const sender = await getSenderAccount(admin, senderAccountId)
    rotationMeta = {
      selectedSenderLabel: sender?.display_name || sender?.email_address || null,
      reason: "health_score",
      riskLevel: "low",
      fallbackCandidates: [],
    }
  }

  const routes = await loadRouteCandidatesForSender(admin, senderAccountId)
  const selection = selectDeliveryRoute({ routes, requested_volume: 1 })

  if (!selection.selected_route_id) {
    return { ok: false, attempt: null, error: selection.reason, requires_human_review: true }
  }

  const primaryRoute = routes.find((route) => route.route_id === selection.selected_route_id)!
  const primaryResult = await executeAttemptOnRoute(admin, {
    route_id: primaryRoute.route_id,
    provider_id: primaryRoute.provider_id,
    provider_family: primaryRoute.provider_family,
    sender_account_id: senderAccountId,
    message: { to: input.to, subject: input.subject, html: input.html, text: input.text },
    lead_id: input.lead_id,
    sequence_enrollment_id: input.sequence_enrollment_id,
    sender_pool_id: input.sender_pool_id,
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
    is_test: input.is_test,
    extra_metadata: input.metadata,
    qa_deliverability_bypass: input.qa_deliverability_bypass,
  })

  if (primaryResult.ok) {
    return rotationMeta ? { ...primaryResult, sender_rotation: rotationMeta } : primaryResult
  }

  const fallback = resolveTransportFallbackRoute({
    routes,
    requested_volume: 1,
    exclude_route_id: primaryRoute.route_id,
  })

  if (!fallback.route_id) {
    return { ...primaryResult, requires_human_review: true }
  }

  const fallbackRoute = routes.find((route) => route.route_id === fallback.route_id)!
  const fallbackResult = await executeAttemptOnRoute(admin, {
    route_id: fallbackRoute.route_id,
    provider_id: fallbackRoute.provider_id,
    provider_family: fallbackRoute.provider_family,
    sender_account_id: senderAccountId,
    message: { to: input.to, subject: input.subject, html: input.html, text: input.text },
    lead_id: input.lead_id,
    sequence_enrollment_id: input.sequence_enrollment_id,
    sender_pool_id: input.sender_pool_id,
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
    is_test: input.is_test,
    retry_count: 0,
    extra_metadata: input.metadata,
    qa_deliverability_bypass: input.qa_deliverability_bypass,
  })

  await recordTransportAuditEvent(admin, {
    provider_id: fallbackRoute.provider_id,
    event_type: "delivery_retry",
    title: "Fallback route attempted",
    description: fallback.reason,
    metadata: { primary_route_id: primaryRoute.route_id, fallback_route_id: fallbackRoute.route_id },
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
    attemptId: fallbackResult.attempt?.id,
  })

  return { ...fallbackResult, used_fallback: true }
}

export async function retryScheduledDeliveryAttempt(
  admin: SupabaseClient,
  attemptId: string,
  actor: { actorUserId: string; actorEmail: string; human_approved: boolean; human_approval_confirmed: boolean },
): Promise<TransportSendResult> {
  if (!actor.human_approved || !actor.human_approval_confirmed) {
    throw new TransportHumanApprovalRequiredError()
  }

  const attempt = await getDeliveryAttempt(admin, attemptId)
  if (!attempt) return { ok: false, attempt: null, error: "delivery_attempt_not_found" }
  if (attempt.status !== "retry_scheduled") {
    return { ok: false, attempt, error: "attempt_not_retry_scheduled" }
  }

  const nextRetryAt = attempt.metadata.next_retry_at
  if (typeof nextRetryAt === "string" && new Date(nextRetryAt).getTime() > Date.now()) {
    return { ok: false, attempt, error: "retry_not_due", requires_human_review: true }
  }

  const allRoutes = await listDeliveryRoutes(admin)
  const route = allRoutes.find(
    (row) => row.provider_id === attempt.provider_id && row.sender_account_id === attempt.sender_account_id,
  )
  if (!route) return { ok: false, attempt, error: "route_not_found", requires_human_review: true }

  return executeAttemptOnRoute(admin, {
    route_id: route.id,
    provider_id: route.provider_id,
    provider_family: route.provider_family,
    sender_account_id: attempt.sender_account_id,
    message: {
      to: asString(attempt.metadata.to) || "",
      subject: asString(attempt.metadata.subject) || "Retry delivery",
      html: asString(attempt.metadata.html) || undefined,
      text: asString(attempt.metadata.text) || undefined,
    },
    lead_id: attempt.lead_id,
    sequence_enrollment_id: attempt.sequence_enrollment_id,
    actorUserId: actor.actorUserId,
    actorEmail: actor.actorEmail,
    retry_count: attempt.retry_count,
  })
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}
