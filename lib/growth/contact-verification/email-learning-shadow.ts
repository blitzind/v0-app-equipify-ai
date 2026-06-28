/**
 * GE-EI-IMP-4D — live shadow email learning observations.
 * Logs only when GROWTH_EMAIL_LEARNING_SHADOW_LOG=true. No runtime influence.
 * Client-safe.
 */

import {
  buildEmailLearningObservation,
  emailLearningObservationFromCompliance,
  emailLearningObservationFromOutboundSend,
  emailLearningObservationFromProviderWebhook,
  emailLearningObservationFromReplyIntelligence,
  GROWTH_EMAIL_LEARNING_QA_MARKER,
  type EmailLearningBuildResult,
  type EmailLearningObservation,
} from "@/lib/growth/contact-verification/email-learning"

export const GROWTH_EMAIL_LEARNING_SHADOW_QA_MARKER = "growth-email-learning-shadow-v1" as const

const PLAINTEXT_EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i

export type EmailLearningShadowLogEntry = {
  qa_marker: typeof GROWTH_EMAIL_LEARNING_SHADOW_QA_MARKER
  shadow: "email_learning_observation"
  source: string
  event_type: string
  domain: string | null
  observation_id: string
  email_present: boolean
  organization_id_present?: boolean
  campaign_id_present?: boolean
  sequence_id_present?: boolean
  contact_id_present?: boolean
  provider?: string | null
  context?: Record<string, unknown>
}

export function isEmailLearningShadowLoggingEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.GROWTH_EMAIL_LEARNING_SHADOW_LOG === "true"
}

function sanitizeContext(context: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!context) return undefined
  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(context)) {
    if (typeof value === "string" && PLAINTEXT_EMAIL_PATTERN.test(value)) continue
    sanitized[key] = value
  }
  return Object.keys(sanitized).length > 0 ? sanitized : undefined
}

export function emailLearningObservationToShadowLogEntry(
  observation: EmailLearningObservation,
  context?: Record<string, unknown>,
): EmailLearningShadowLogEntry {
  return {
    qa_marker: GROWTH_EMAIL_LEARNING_SHADOW_QA_MARKER,
    shadow: "email_learning_observation",
    source: observation.source,
    event_type: observation.event_type,
    domain: observation.domain,
    observation_id: observation.observation_id,
    email_present: Boolean(observation.normalized_email),
    organization_id_present: Boolean(observation.organization_id),
    campaign_id_present: Boolean(observation.campaign_id),
    sequence_id_present: Boolean(observation.sequence_id),
    contact_id_present: Boolean(observation.contact_id),
    provider: observation.provider,
    context: sanitizeContext(context),
  }
}

export function logEmailLearningObservationShadow(
  buildResult: EmailLearningBuildResult,
  context?: Record<string, unknown>,
): void {
  if (!isEmailLearningShadowLoggingEnabled()) return
  try {
    if (!buildResult.ok || !buildResult.observation) return
    console.info(
      JSON.stringify(emailLearningObservationToShadowLogEntry(buildResult.observation, context)),
    )
  } catch (error) {
    console.warn(
      JSON.stringify({
        qa_marker: GROWTH_EMAIL_LEARNING_QA_MARKER,
        shadow: "email_learning_observation_error",
        message: error instanceof Error ? error.message : "unknown",
      }),
    )
  }
}

export function logEmailLearningObservationsShadow(
  buildResults: readonly EmailLearningBuildResult[],
  context?: Record<string, unknown>,
): void {
  if (!isEmailLearningShadowLoggingEnabled()) return
  try {
    for (const buildResult of buildResults) {
      if (!buildResult.ok || !buildResult.observation) continue
      console.info(
        JSON.stringify(emailLearningObservationToShadowLogEntry(buildResult.observation, context)),
      )
    }
  } catch (error) {
    console.warn(
      JSON.stringify({
        qa_marker: GROWTH_EMAIL_LEARNING_QA_MARKER,
        shadow: "email_learning_observation_error",
        message: error instanceof Error ? error.message : "unknown",
      }),
    )
  }
}

function complianceBounceOutcome(bounceType: string): "bounce_hard" | "bounce_soft" {
  const normalized = bounceType.trim().toLowerCase()
  if (normalized === "soft" || normalized === "transient") return "bounce_soft"
  return "bounce_hard"
}

export function shadowLogOutboundSend(input: {
  email: string
  provider?: string | null
  campaignId?: string | null
  sequenceId?: string | null
  contactId?: string | null
  organizationId?: string | null
  sentAt?: string | null
  deliveryAttemptId?: string | null
  context?: Record<string, unknown>
}): void {
  logEmailLearningObservationShadow(
    emailLearningObservationFromOutboundSend({
      email: input.email,
      provider: input.provider,
      campaignId: input.campaignId,
      sequenceId: input.sequenceId,
      contactId: input.contactId,
      organizationId: input.organizationId,
      sentAt: input.sentAt,
      deliveryAttemptId: input.deliveryAttemptId,
    }),
    input.context,
  )
}

export function shadowLogProviderWebhook(input: {
  email: string
  normalizedEventType: string
  provider?: string | null
  campaignId?: string | null
  contactId?: string | null
  occurredAt?: string | null
  providerEventId?: string | null
  context?: Record<string, unknown>
}): void {
  logEmailLearningObservationShadow(
    emailLearningObservationFromProviderWebhook({
      email: input.email,
      normalizedEventType: input.normalizedEventType,
      provider: input.provider,
      campaignId: input.campaignId,
      contactId: input.contactId,
      occurredAt: input.occurredAt,
      providerEventId: input.providerEventId,
    }),
    input.context,
  )
}

export function shadowLogReplyIntelligence(input: {
  email: string
  intent?: string | null
  classification?: string | null
  contactId?: string | null
  campaignId?: string | null
  receivedAt?: string | null
  replyId?: string | null
  context?: Record<string, unknown>
}): void {
  logEmailLearningObservationShadow(
    emailLearningObservationFromReplyIntelligence({
      email: input.email,
      intent: input.intent,
      classification: input.classification,
      contactId: input.contactId,
      campaignId: input.campaignId,
      receivedAt: input.receivedAt,
      replyId: input.replyId,
    }),
    input.context,
  )
}

export function shadowLogComplianceBounce(input: {
  email: string
  bounceType: string
  occurredAt?: string | null
  leadId?: string | null
  context?: Record<string, unknown>
}): void {
  logEmailLearningObservationShadow(
    buildEmailLearningObservation({
      email: input.email,
      contactId: input.leadId,
      outcome: complianceBounceOutcome(input.bounceType),
      eventTimestamp: input.occurredAt,
      source: "compliance",
      dedupeKey: input.leadId
        ? `compliance:${input.leadId}:${complianceBounceOutcome(input.bounceType)}:${input.occurredAt ?? ""}`
        : null,
    }),
    input.context,
  )
}

export function shadowLogComplianceComplaint(input: {
  email: string
  occurredAt?: string | null
  leadId?: string | null
  context?: Record<string, unknown>
}): void {
  logEmailLearningObservationShadow(
    emailLearningObservationFromCompliance({
      email: input.email,
      reason: "complaint",
      occurredAt: input.occurredAt,
      leadId: input.leadId,
    }),
    input.context,
  )
}

export function shadowLogComplianceUnsubscribe(input: {
  email: string
  occurredAt?: string | null
  leadId?: string | null
  context?: Record<string, unknown>
}): void {
  logEmailLearningObservationShadow(
    emailLearningObservationFromCompliance({
      email: input.email,
      reason: "unsubscribe",
      occurredAt: input.occurredAt,
      leadId: input.leadId,
    }),
    input.context,
  )
}

export function assertEmailLearningShadowLogHasNoPlaintextEmails(output: unknown): boolean {
  const text = JSON.stringify(output)
  return !PLAINTEXT_EMAIL_PATTERN.test(text)
}
