/**
 * AVA-PERSISTED-OPERATOR-VALIDATION-1A — Sendable draft persistence for supervised Ava direct path.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  insertGrowthAiCopilotGeneration,
  listGrowthAiCopilotGenerationsForLead,
  type GrowthAiCopilotGeneration,
} from "@/lib/growth/ai-copilot-repository"
import {
  AVA_DIRECT_PRODUCTION_CUTOVER_1A_QA_MARKER,
  AVA_DIRECT_PRODUCTION_PROMPT_VERSION,
} from "@/lib/growth/ava-reasoning/ava-direct/equipify-ava-direct-reasoning"
import { stripAccidentalAvaSignatureFromBody } from "@/lib/growth/ava-reasoning/ava-supervised-outbound-signature-boundary-core"
import { assertAvaOutboundCopyQualityForPersistence } from "@/lib/growth/ava-reasoning/ava-outbound-copy-quality-boundary-core"
import { AVA_SUPERVISED_CUTOVER_1A_QA_MARKER } from "@/lib/growth/ava-reasoning/equipify-external-company-preflight"

const AVA_SUPERVISED_DRAFT_PROMPT_VARIANT = "ava_direct_production_cutover_1a" as const
import type { AvaContactEvidence, AvaReasoningResult } from "@/lib/fuzor/ava-reasoning/ava-reasoning-types"

export type SupervisedDraftPersistenceStatus =
  | "disabled"
  | "persisted"
  | "skipped"
  | "duplicate_reused"

export function isSendableAvaSupervisedDraft(input: {
  decision: AvaReasoningResult["decision"]
  email: AvaReasoningResult["email"]
  recommendedContact: AvaReasoningResult["recommendedContact"]
  contactsSupplied: AvaContactEvidence[]
}): boolean {
  if (input.decision !== "pursue") return false
  if (!input.email?.subject?.trim() || !input.email?.body?.trim()) return false

  const recommendedId = input.recommendedContact?.contactId?.trim() || null
  if (recommendedId) {
    const match = input.contactsSupplied.find((c) => c.contactId === recommendedId)
    if (match?.contactabilityStatus === "contactable" && match.email?.trim()) return true
  }

  return input.contactsSupplied.some(
    (c) => c.contactabilityStatus === "contactable" && Boolean(c.email?.trim()),
  )
}

export async function findExistingAvaSupervisedSendableDraft(
  admin: SupabaseClient,
  leadId: string,
  options?: { includeApproved?: boolean },
): Promise<GrowthAiCopilotGeneration | null> {
  const includeApproved = options?.includeApproved !== false
  const generations = await listGrowthAiCopilotGenerationsForLead(admin, leadId, 50)
  return (
    generations.find(
      (g) =>
        g.generationType === "cold_email" &&
        g.promptVariant === AVA_SUPERVISED_DRAFT_PROMPT_VARIANT &&
        (g.status === "draft" || (includeApproved && g.status === "approved")) &&
        (g.status === "draft" || !g.sentAt) &&
        Boolean(g.generatedSubject?.trim()) &&
        Boolean(g.generatedContent?.trim()),
    ) ?? null
  )
}

export async function persistSendableAvaSupervisedDraft(input: {
  admin: SupabaseClient
  leadId: string
  actingUserId: string
  decision: AvaReasoningResult["decision"]
  email: AvaReasoningResult["email"]
  recommendedContact: AvaReasoningResult["recommendedContact"]
  contactsSupplied: AvaContactEvidence[]
  companyUnderstanding: string | null
  websiteRetrieval: unknown
  understandingMemoryVersionId: string | null
  companyIdentityUnresolved: boolean
  organizationKnowledge: unknown
  approvedSender: unknown
  classification: Record<string, unknown>
  /** When false, legacy approved-but-unsent rows do not block fresh draft persistence. */
  includeApprovedExisting?: boolean
}): Promise<{ id: string | null; status: SupervisedDraftPersistenceStatus }> {
  if (!isSendableAvaSupervisedDraft(input)) {
    return { id: null, status: "skipped" }
  }

  const existing = await findExistingAvaSupervisedSendableDraft(input.admin, input.leadId, {
    includeApproved: input.includeApprovedExisting ?? true,
  })
  if (existing) {
    return { id: existing.id, status: "duplicate_reused" }
  }

  const unsignedBody = stripAccidentalAvaSignatureFromBody(input.email!.body.trim())
  const copyQuality = assertAvaOutboundCopyQualityForPersistence({
    subject: input.email!.subject,
    body: unsignedBody,
  })
  if (!copyQuality.ok) {
    return { id: null, status: "skipped" }
  }

  const generation = await insertGrowthAiCopilotGeneration(input.admin, {
    leadId: input.leadId,
    generationType: "cold_email",
    promptVersion: AVA_DIRECT_PRODUCTION_PROMPT_VERSION,
    promptVariant: AVA_SUPERVISED_DRAFT_PROMPT_VARIANT,
    inputSnapshot: {
      generationMode: AVA_SUPERVISED_DRAFT_PROMPT_VARIANT,
      qaMarker: AVA_SUPERVISED_CUTOVER_1A_QA_MARKER,
      directQaMarker: AVA_DIRECT_PRODUCTION_CUTOVER_1A_QA_MARKER,
      companyUnderstanding: input.companyUnderstanding,
      websiteRetrieval: input.websiteRetrieval,
      understandingMemoryVersionId: input.understandingMemoryVersionId,
      companyIdentityUnresolved: input.companyIdentityUnresolved,
      organizationKnowledge: input.organizationKnowledge,
      approvedSender: input.approvedSender,
      contactsSupplied: input.contactsSupplied,
    },
    generatedContent: copyQuality.body,
    generatedSubject: copyQuality.subject,
    classification: input.classification,
    createdBy: input.actingUserId,
  })

  return { id: generation.id, status: "persisted" }
}
