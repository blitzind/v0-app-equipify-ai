/**
 * AVA-FIRST-TOUCH-OUTBOUND-COMPLETION-1A — Canonical first-touch outbound completion authority.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthAiCopilotGeneration } from "@/lib/growth/ai-copilot-types"
import { isSupervisedAvaGenerationSent } from "@/lib/growth/ava-reasoning/equipify-supervised-home-projection-1a"
import {
  AVA_FIRST_TOUCH_OUTBOUND_COMPLETION_1A_QA_MARKER,
  readAvaFirstTouchOutboundCompletionFromLeadMetadata,
  type AvaFirstTouchOutboundCompletionEvidenceKind,
  type AvaFirstTouchOutboundCompletionRecord,
  type AvaFirstTouchOutboundCompletionResolution,
} from "@/lib/growth/ava-reasoning/ava-first-touch-outbound-completion-1a-types"

const FIRST_TOUCH_TRANSPORT_LOOKUP_CHUNK_SIZE = 50 as const

function chunkLeadIds(leadIds: string[]): string[][] {
  const chunks: string[][] = []
  for (let index = 0; index < leadIds.length; index += FIRST_TOUCH_TRANSPORT_LOOKUP_CHUNK_SIZE) {
    chunks.push(leadIds.slice(index, index + FIRST_TOUCH_TRANSPORT_LOOKUP_CHUNK_SIZE))
  }
  return chunks
}

function recipientFromAttemptMetadata(metadata: Record<string, unknown>): string | null {
  const candidates = [metadata.to, metadata.recipient_email, metadata.recipientEmail, metadata.to_email]
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim().toLowerCase()
  }
  return null
}

function buildRecord(input: {
  evidenceKind: AvaFirstTouchOutboundCompletionEvidenceKind
  completedAt: string
  recipientEmail?: string | null
  subject?: string | null
  sentAt?: string | null
  deliveryAttemptId?: string | null
  sequenceExecutionJobId?: string | null
  outboundMessageId?: string | null
  supervisedGenerationId?: string | null
  senderAccountId?: string | null
  providerMessageId?: string | null
  reconciledAt?: string | null
  reconciledBy?: string | null
  reconciliationNote?: string | null
}): AvaFirstTouchOutboundCompletionRecord {
  return {
    qaMarker: AVA_FIRST_TOUCH_OUTBOUND_COMPLETION_1A_QA_MARKER,
    complete: true,
    completedAt: input.completedAt,
    evidenceKind: input.evidenceKind,
    recipientEmail: input.recipientEmail ?? null,
    subject: input.subject ?? null,
    sentAt: input.sentAt ?? null,
    deliveryAttemptId: input.deliveryAttemptId ?? null,
    sequenceExecutionJobId: input.sequenceExecutionJobId ?? null,
    outboundMessageId: input.outboundMessageId ?? null,
    supervisedGenerationId: input.supervisedGenerationId ?? null,
    senderAccountId: input.senderAccountId ?? null,
    providerMessageId: input.providerMessageId ?? null,
    reconciledAt: input.reconciledAt ?? null,
    reconciledBy: input.reconciledBy ?? null,
    reconciliationNote: input.reconciliationNote ?? null,
  }
}

export function resolveFirstTouchOutboundCompletionFromGenerations(input: {
  leadId: string
  generations: GrowthAiCopilotGeneration[]
}): AvaFirstTouchOutboundCompletionResolution | null {
  const sent = input.generations.find((generation) => isSupervisedAvaGenerationSent(generation))
  if (!sent) return null

  const classification = sent.classification as Record<string, unknown>
  const receipt = classification.avaSupervisedOutboundSendReceipt as { recipientEmail?: string } | undefined

  return {
    qaMarker: AVA_FIRST_TOUCH_OUTBOUND_COMPLETION_1A_QA_MARKER,
    leadId: input.leadId,
    complete: true,
    evidenceKind: "supervised_generation_sent",
    transportProven: true,
    record: buildRecord({
      evidenceKind: "supervised_generation_sent",
      completedAt: sent.sentAt ?? sent.approvedAt ?? sent.createdAt,
      recipientEmail: receipt?.recipientEmail ?? null,
      subject: sent.generatedSubject,
      sentAt: sent.sentAt,
      supervisedGenerationId: sent.id,
    }),
  }
}

export async function resolveFirstTouchOutboundCompletionForLead(
  admin: SupabaseClient,
  input: {
    leadId: string
    leadMetadata?: Record<string, unknown> | null
    contactEmail?: string | null
    generations?: GrowthAiCopilotGeneration[]
  },
): Promise<AvaFirstTouchOutboundCompletionResolution> {
  const leadId = input.leadId.trim()
  const incomplete: AvaFirstTouchOutboundCompletionResolution = {
    qaMarker: AVA_FIRST_TOUCH_OUTBOUND_COMPLETION_1A_QA_MARKER,
    leadId,
    complete: false,
    evidenceKind: null,
    record: null,
    transportProven: false,
  }

  const metadataRecord = readAvaFirstTouchOutboundCompletionFromLeadMetadata(input.leadMetadata)
  if (metadataRecord) {
    return {
      qaMarker: AVA_FIRST_TOUCH_OUTBOUND_COMPLETION_1A_QA_MARKER,
      leadId,
      complete: true,
      evidenceKind: metadataRecord.evidenceKind,
      record: metadataRecord,
      transportProven: metadataRecord.evidenceKind !== "lead_metadata_reconciled",
    }
  }

  if (input.generations?.length) {
    const fromGenerations = resolveFirstTouchOutboundCompletionFromGenerations({
      leadId,
      generations: input.generations,
    })
    if (fromGenerations) return fromGenerations
  }

  const { data: deliveryAttempts, error: deliveryError } = await admin
    .schema("growth")
    .from("delivery_attempts")
    .select("id, status, sent_at, provider_message_id, sender_account_id, metadata, sequence_execution_job_id")
    .eq("lead_id", leadId)
    .eq("status", "sent")
    .order("sent_at", { ascending: false })
    .limit(5)
  if (deliveryError) throw new Error(deliveryError.message)

  const sentAttempt = (deliveryAttempts ?? []).find((row) => row.sent_at)
  if (sentAttempt) {
    const metadata = (sentAttempt.metadata ?? {}) as Record<string, unknown>
    return {
      qaMarker: AVA_FIRST_TOUCH_OUTBOUND_COMPLETION_1A_QA_MARKER,
      leadId,
      complete: true,
      evidenceKind: "delivery_attempt_sent",
      transportProven: true,
      record: buildRecord({
        evidenceKind: "delivery_attempt_sent",
        completedAt: String(sentAttempt.sent_at),
        sentAt: String(sentAttempt.sent_at),
        recipientEmail: recipientFromAttemptMetadata(metadata),
        subject: typeof metadata.subject === "string" ? metadata.subject : null,
        deliveryAttemptId: String(sentAttempt.id),
        sequenceExecutionJobId:
          typeof sentAttempt.sequence_execution_job_id === "string"
            ? sentAttempt.sequence_execution_job_id
            : typeof metadata.sequence_execution_job_id === "string"
              ? metadata.sequence_execution_job_id
              : null,
        senderAccountId:
          typeof sentAttempt.sender_account_id === "string" ? sentAttempt.sender_account_id : null,
        providerMessageId:
          typeof sentAttempt.provider_message_id === "string" ? sentAttempt.provider_message_id : null,
      }),
    }
  }

  const { data: sequenceJobs, error: jobError } = await admin
    .schema("growth")
    .from("sequence_execution_jobs")
    .select("id, status, delivery_attempt_id, updated_at")
    .eq("lead_id", leadId)
    .eq("status", "sent")
    .order("updated_at", { ascending: false })
    .limit(3)
  if (jobError) throw new Error(jobError.message)

  const sentJob = sequenceJobs?.[0]
  if (sentJob) {
    return {
      qaMarker: AVA_FIRST_TOUCH_OUTBOUND_COMPLETION_1A_QA_MARKER,
      leadId,
      complete: true,
      evidenceKind: "sequence_job_sent",
      transportProven: true,
      record: buildRecord({
        evidenceKind: "sequence_job_sent",
        completedAt: String(sentJob.updated_at ?? new Date().toISOString()),
        sequenceExecutionJobId: String(sentJob.id),
        deliveryAttemptId:
          typeof sentJob.delivery_attempt_id === "string" ? sentJob.delivery_attempt_id : null,
        recipientEmail: input.contactEmail?.trim().toLowerCase() ?? null,
      }),
    }
  }

  const { data: outboundMessages, error: messageError } = await admin
    .schema("growth")
    .from("outbound_messages")
    .select("id, status, sent_at, subject, metadata")
    .eq("lead_id", leadId)
    .in("status", ["sent", "delivered"])
    .order("sent_at", { ascending: false })
    .limit(3)
  if (messageError) throw new Error(messageError.message)

  const sentMessage = outboundMessages?.[0]
  if (sentMessage?.sent_at) {
    return {
      qaMarker: AVA_FIRST_TOUCH_OUTBOUND_COMPLETION_1A_QA_MARKER,
      leadId,
      complete: true,
      evidenceKind: "outbound_message_sent",
      transportProven: true,
      record: buildRecord({
        evidenceKind: "outbound_message_sent",
        completedAt: String(sentMessage.sent_at),
        sentAt: String(sentMessage.sent_at),
        outboundMessageId: String(sentMessage.id),
        subject: typeof sentMessage.subject === "string" ? sentMessage.subject : null,
        recipientEmail: input.contactEmail?.trim().toLowerCase() ?? null,
      }),
    }
  }

  return incomplete
}

function resolutionFromDeliveryAttemptRow(input: {
  leadId: string
  row: Record<string, unknown>
}): AvaFirstTouchOutboundCompletionResolution {
  const metadata = (input.row.metadata ?? {}) as Record<string, unknown>
  return {
    qaMarker: AVA_FIRST_TOUCH_OUTBOUND_COMPLETION_1A_QA_MARKER,
    leadId: input.leadId,
    complete: true,
    evidenceKind: "delivery_attempt_sent",
    transportProven: true,
    record: buildRecord({
      evidenceKind: "delivery_attempt_sent",
      completedAt: String(input.row.sent_at),
      sentAt: String(input.row.sent_at),
      recipientEmail: recipientFromAttemptMetadata(metadata),
      subject: typeof metadata.subject === "string" ? metadata.subject : null,
      deliveryAttemptId: String(input.row.id),
      sequenceExecutionJobId:
        typeof input.row.sequence_execution_job_id === "string"
          ? input.row.sequence_execution_job_id
          : typeof metadata.sequence_execution_job_id === "string"
            ? metadata.sequence_execution_job_id
            : null,
      senderAccountId:
        typeof input.row.sender_account_id === "string" ? input.row.sender_account_id : null,
      providerMessageId:
        typeof input.row.provider_message_id === "string" ? input.row.provider_message_id : null,
    }),
  }
}

async function batchResolveFirstTouchFromTransportTables(
  admin: SupabaseClient,
  input: {
    leadIds: string[]
    leadsById?: Map<string, { metadata?: Record<string, unknown> | null; contactEmail?: string | null }>
  },
): Promise<Map<string, AvaFirstTouchOutboundCompletionResolution>> {
  const result = new Map<string, AvaFirstTouchOutboundCompletionResolution>()
  const pending = new Set(input.leadIds)
  if (pending.size === 0) return result

  for (const chunk of chunkLeadIds([...pending])) {
    const { data: deliveryAttempts, error: deliveryError } = await admin
      .schema("growth")
      .from("delivery_attempts")
      .select("id, lead_id, status, sent_at, provider_message_id, sender_account_id, metadata, sequence_execution_job_id")
      .in("lead_id", chunk)
      .eq("status", "sent")
      .order("sent_at", { ascending: false })
    if (deliveryError) throw new Error(deliveryError.message)

    for (const row of deliveryAttempts ?? []) {
      const leadId = String(row.lead_id ?? "").trim()
      if (!leadId || !pending.has(leadId) || result.has(leadId) || !row.sent_at) continue
      result.set(leadId, resolutionFromDeliveryAttemptRow({ leadId, row: row as Record<string, unknown> }))
      pending.delete(leadId)
    }
  }

  if (pending.size === 0) return result

  for (const chunk of chunkLeadIds([...pending])) {
    const { data: sequenceJobs, error: jobError } = await admin
      .schema("growth")
      .from("sequence_execution_jobs")
      .select("id, lead_id, status, delivery_attempt_id, updated_at")
      .in("lead_id", chunk)
      .eq("status", "sent")
      .order("updated_at", { ascending: false })
    if (jobError) throw new Error(jobError.message)

    for (const row of sequenceJobs ?? []) {
      const leadId = String(row.lead_id ?? "").trim()
      if (!leadId || !pending.has(leadId) || result.has(leadId)) continue
      result.set(leadId, {
        qaMarker: AVA_FIRST_TOUCH_OUTBOUND_COMPLETION_1A_QA_MARKER,
        leadId,
        complete: true,
        evidenceKind: "sequence_job_sent",
        transportProven: true,
        record: buildRecord({
          evidenceKind: "sequence_job_sent",
          completedAt: String(row.updated_at ?? new Date().toISOString()),
          sequenceExecutionJobId: String(row.id),
          deliveryAttemptId:
            typeof row.delivery_attempt_id === "string" ? row.delivery_attempt_id : null,
          recipientEmail: input.leadsById?.get(leadId)?.contactEmail?.trim().toLowerCase() ?? null,
        }),
      })
      pending.delete(leadId)
    }
  }

  if (pending.size === 0) return result

  for (const chunk of chunkLeadIds([...pending])) {
    const { data: outboundMessages, error: messageError } = await admin
      .schema("growth")
      .from("outbound_messages")
      .select("id, lead_id, status, sent_at, subject, metadata")
      .in("lead_id", chunk)
      .in("status", ["sent", "delivered"])
      .order("sent_at", { ascending: false })
    if (messageError) throw new Error(messageError.message)

    for (const row of outboundMessages ?? []) {
      const leadId = String(row.lead_id ?? "").trim()
      if (!leadId || !pending.has(leadId) || result.has(leadId) || !row.sent_at) continue
      result.set(leadId, {
        qaMarker: AVA_FIRST_TOUCH_OUTBOUND_COMPLETION_1A_QA_MARKER,
        leadId,
        complete: true,
        evidenceKind: "outbound_message_sent",
        transportProven: true,
        record: buildRecord({
          evidenceKind: "outbound_message_sent",
          completedAt: String(row.sent_at),
          sentAt: String(row.sent_at),
          outboundMessageId: String(row.id),
          subject: typeof row.subject === "string" ? row.subject : null,
          recipientEmail: input.leadsById?.get(leadId)?.contactEmail?.trim().toLowerCase() ?? null,
        }),
      })
      pending.delete(leadId)
    }
  }

  return result
}

/** Home projection — only leads that could surface in supervised operator attention. */
export function collectHomeFirstTouchCandidateLeadIds(input: {
  supervisedGenerations: GrowthAiCopilotGeneration[]
  approvalPackageLeadIds?: readonly (string | null | undefined)[]
}): string[] {
  const ids = new Set<string>()
  for (const generation of input.supervisedGenerations) {
    if (!isSupervisedAvaGenerationSent(generation)) {
      ids.add(generation.leadId)
    }
  }
  for (const leadId of input.approvalPackageLeadIds ?? []) {
    const normalized = leadId?.trim()
    if (normalized) ids.add(normalized)
  }
  return [...ids]
}

export async function loadFirstTouchOutboundCompletionByLeadId(
  admin: SupabaseClient,
  input: {
    leadIds: string[]
    leadsById?: Map<string, { metadata?: Record<string, unknown> | null; contactEmail?: string | null }>
    generationsByLeadId?: Map<string, GrowthAiCopilotGeneration[]>
  },
): Promise<Map<string, AvaFirstTouchOutboundCompletionResolution>> {
  const result = new Map<string, AvaFirstTouchOutboundCompletionResolution>()
  const leadIds = [...new Set(input.leadIds.map((id) => id.trim()).filter(Boolean))]
  if (leadIds.length === 0) return result

  const needsTransportLookup: string[] = []

  for (const leadId of leadIds) {
    const lead = input.leadsById?.get(leadId)
    const metadataRecord = readAvaFirstTouchOutboundCompletionFromLeadMetadata(lead?.metadata)
    if (metadataRecord) {
      result.set(leadId, {
        qaMarker: AVA_FIRST_TOUCH_OUTBOUND_COMPLETION_1A_QA_MARKER,
        leadId,
        complete: true,
        evidenceKind: metadataRecord.evidenceKind,
        record: metadataRecord,
        transportProven: metadataRecord.evidenceKind !== "lead_metadata_reconciled",
      })
      continue
    }

    const generations = input.generationsByLeadId?.get(leadId) ?? []
    const fromGenerations = generations.length
      ? resolveFirstTouchOutboundCompletionFromGenerations({ leadId, generations })
      : null
    if (fromGenerations) {
      result.set(leadId, fromGenerations)
      continue
    }

    needsTransportLookup.push(leadId)
  }

  if (needsTransportLookup.length === 0) return result

  const fromTransport = await batchResolveFirstTouchFromTransportTables(admin, {
    leadIds: needsTransportLookup,
    leadsById: input.leadsById,
  })
  for (const [leadId, resolution] of fromTransport) {
    result.set(leadId, resolution)
  }

  return result
}

export function isFirstTouchOutboundCompleteForLead(
  resolution: AvaFirstTouchOutboundCompletionResolution | null | undefined,
): boolean {
  return resolution?.complete === true
}
