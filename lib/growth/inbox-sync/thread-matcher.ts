import {
  GROWTH_INBOX_THREAD_MATCH_CONFIDENCE,
  type GrowthInboxThreadMatchResult,
} from "@/lib/growth/inbox-sync/inbox-sync-types"
import { subjectSimilarityScore } from "@/lib/growth/inbox-sync/provider-message-normalizer"

export type GrowthInboxThreadMatchContext = {
  providerThreadMap: Map<string, string>
  providerMessageMap: Map<string, string>
  deliveryAttemptByReference: Map<string, { attemptId: string; leadId: string | null; enrollmentId: string | null }>
  deliveryAttemptByThreadId: Map<string, { attemptId: string; leadId: string | null; enrollmentId: string | null }>
  leadIdByEmailHash: Map<string, string>
  threadSubjectById: Map<string, string>
  threadLeadById: Map<string, string>
  activeEnrollmentByLeadId: Map<string, string>
}

const MIN_CREATE_CONFIDENCE = 40

export function resolveThreadMatchFromContext(
  input: {
    providerThreadId: string | null
    providerMessageId: string
    inReplyTo: string | null
    references: string[]
    fromEmail: string
    fromEmailHash: string
    subject: string
  },
  context: GrowthInboxThreadMatchContext,
): GrowthInboxThreadMatchResult {
  if (input.providerThreadId) {
    const threadId = context.providerThreadMap.get(input.providerThreadId)
    if (threadId) {
      return buildMatch(threadId, "provider_thread_id", GROWTH_INBOX_THREAD_MATCH_CONFIDENCE.provider_thread, context, null)
    }

    const outboundAttempt = context.deliveryAttemptByThreadId.get(input.providerThreadId)
    if (outboundAttempt) {
      const threadId = findThreadForLead(context, outboundAttempt.leadId)
      return {
        inboxThreadId: threadId,
        leadId: outboundAttempt.leadId,
        deliveryAttemptId: outboundAttempt.attemptId,
        sequenceEnrollmentId:
          outboundAttempt.enrollmentId ??
          (outboundAttempt.leadId ? context.activeEnrollmentByLeadId.get(outboundAttempt.leadId) ?? null : null),
        matchedBy: "delivery_thread_id",
        confidence: GROWTH_INBOX_THREAD_MATCH_CONFIDENCE.delivery_attempt,
        createNew: !threadId,
      }
    }
  }

  const messageThreadId = context.providerMessageMap.get(input.providerMessageId)
  if (messageThreadId) {
    return buildMatch(messageThreadId, "provider_message_id", GROWTH_INBOX_THREAD_MATCH_CONFIDENCE.provider_message, context, null)
  }

  const referenceIds = [input.inReplyTo, ...input.references].filter(Boolean) as string[]
  for (const referenceId of referenceIds) {
    const attempt = context.deliveryAttemptByReference.get(referenceId)
    if (attempt) {
      const threadId = findThreadForLead(context, attempt.leadId)
      return {
        inboxThreadId: threadId,
        leadId: attempt.leadId,
        deliveryAttemptId: attempt.attemptId,
        sequenceEnrollmentId: attempt.enrollmentId ?? (attempt.leadId ? context.activeEnrollmentByLeadId.get(attempt.leadId) ?? null : null),
        matchedBy: "message_reference",
        confidence: GROWTH_INBOX_THREAD_MATCH_CONFIDENCE.message_reference,
        createNew: !threadId,
      }
    }
  }

  const leadId = context.leadIdByEmailHash.get(input.fromEmailHash) ?? null

  if (leadId) {
    const threadId = findThreadForLead(context, leadId)
    return {
      inboxThreadId: threadId,
      leadId,
      deliveryAttemptId: null,
      sequenceEnrollmentId: context.activeEnrollmentByLeadId.get(leadId) ?? null,
      matchedBy: "email_hash",
      confidence: GROWTH_INBOX_THREAD_MATCH_CONFIDENCE.email_hash,
      createNew: !threadId,
    }
  }

  let bestThreadId: string | null = null
  let bestScore = 0
  for (const [threadId, threadSubject] of context.threadSubjectById.entries()) {
    const score = subjectSimilarityScore(input.subject, threadSubject)
    if (score > bestScore) {
      bestScore = score
      bestThreadId = threadId
    }
  }
  if (bestThreadId && bestScore >= 0.8) {
    const resolvedLeadId = context.threadLeadById.get(bestThreadId) ?? null
    return buildMatch(
      bestThreadId,
      "subject_similarity",
      GROWTH_INBOX_THREAD_MATCH_CONFIDENCE.subject_similarity,
      context,
      resolvedLeadId,
    )
  }

  return {
    inboxThreadId: null,
    leadId,
    deliveryAttemptId: null,
    sequenceEnrollmentId: leadId ? context.activeEnrollmentByLeadId.get(leadId) ?? null : null,
    matchedBy: "unknown",
    confidence: GROWTH_INBOX_THREAD_MATCH_CONFIDENCE.unknown,
    createNew: true,
  }
}

export function shouldCreateNewInboxThread(match: GrowthInboxThreadMatchResult): boolean {
  if (match.inboxThreadId) return false
  if (!match.leadId && match.confidence < MIN_CREATE_CONFIDENCE) return false
  return match.createNew
}

function buildMatch(
  threadId: string,
  matchedBy: string,
  confidence: number,
  context: GrowthInboxThreadMatchContext,
  leadId: string | null,
): GrowthInboxThreadMatchResult {
  const resolvedLeadId = leadId ?? context.threadLeadById.get(threadId) ?? null
  return {
    inboxThreadId: threadId,
    leadId: resolvedLeadId,
    deliveryAttemptId: null,
    sequenceEnrollmentId: resolvedLeadId ? context.activeEnrollmentByLeadId.get(resolvedLeadId) ?? null : null,
    matchedBy,
    confidence,
    createNew: false,
  }
}

function findThreadForLead(context: GrowthInboxThreadMatchContext, leadId: string | null): string | null {
  if (!leadId) return null
  for (const [threadId, threadLeadId] of context.threadLeadById.entries()) {
    if (threadLeadId === leadId) return threadId
  }
  return null
}

export function resolveThreadMatchOrder(): readonly string[] {
  return [
    "provider_thread_id",
    "delivery_thread_id",
    "provider_message_id",
    "message_reference",
    "email_hash",
    "subject_similarity",
    "unknown",
  ] as const
}
