/**
 * AVA-DIRECT-PRODUCTION-CUTOVER-1A — Supervised draft generation via website → single GPT Ava reasoning.
 * Replaces mandatory Company Intelligence → Ava sequence. Outbound send remains disabled.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizeGrowthActorUserIdForDb } from "@/lib/growth/actor-user-id"
import { getGrowthEngineAiOrgId, logGrowthEngine } from "@/lib/growth/access"
import {
  enrichOrganizationKnowledgeWithSenderIdentity,
  loadEquipifyApprovedSenderBundle,
} from "@/lib/growth/ava-reasoning/equipify-approved-sender"
import {
  AVA_DIRECT_PRODUCTION_CUTOVER_1A_QA_MARKER,
  AVA_DIRECT_PRODUCTION_PROMPT_VERSION,
  runEquipifyAvaDirectReasoning,
} from "@/lib/growth/ava-reasoning/ava-direct/equipify-ava-direct-reasoning"
import { stripAccidentalAvaSignatureFromBody } from "@/lib/growth/ava-reasoning/ava-supervised-outbound-signature-boundary-core"
import { normalizeProhibitedAvaOutboundCopy } from "@/lib/growth/ava-reasoning/ava-outbound-copy-quality-boundary-core"
import { persistAvaUnderstandingMemory } from "@/lib/growth/ava-reasoning/ava-direct/equipify-ava-understanding-memory"
import {
  retrieveWebsiteTextForAvaDirect,
  type AvaDirectWebsiteRetrievalResult,
} from "@/lib/growth/ava-reasoning/ava-direct/ava-direct-website-retrieval"
import {
  EQUIPIFY_AVA_CALIBRATED_OBJECTIVE,
  EQUIPIFY_AVA_CALIBRATED_ROLE_KNOWLEDGE,
  enrichOrganizationKnowledgeWithSalesCalibration,
} from "@/lib/growth/ava-reasoning/equipify-ava-sales-calibration"
import {
  EQUIPIFY_AVA_DEPLOYMENT_ID,
  mapDecisionMakersToContactEvidence,
  projectEquipifyKnowledgeBase,
} from "@/lib/growth/ava-reasoning/equipify-ava-reasoning-adapter"
import { preflightEquipifyExternalCompanyForIntelligence } from "@/lib/growth/ava-reasoning/equipify-external-company-preflight"
import { AVA_SUPERVISED_CUTOVER_1A_QA_MARKER } from "@/lib/growth/ava-reasoning/equipify-external-company-preflight"
import {
  persistSendableAvaSupervisedDraft,
  type SupervisedDraftPersistenceStatus,
} from "@/lib/growth/ava-reasoning/equipify-supervised-draft-persistence"
import type { DraftFactorySchedulerGenerationProvenance } from "@/lib/growth/draft-factory/draft-factory-scheduler-actor-1a"
import { loadOutreachSellerTruthBundle } from "@/lib/growth/aios/growth/growth-outreach-seller-truth-loader"
import { listGrowthLeadDecisionMakers } from "@/lib/growth/decision-maker-repository"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { AVA_REASONING_CALIBRATION_1A_QA_MARKER } from "@/lib/growth/ava-reasoning/equipify-ava-sales-calibration"
import type {
  AvaContactEvidence,
  AvaReasoningResult,
} from "@/lib/fuzor/ava-reasoning/ava-reasoning-types"

export { AVA_SUPERVISED_CUTOVER_1A_QA_MARKER }

export const AVA_SUPERVISED_CUTOVER_GENERATION_MODE = "ava_direct_production_cutover_1a" as const

export type RunEquipifySupervisedAvaOutreachInput = {
  admin: SupabaseClient
  leadId: string
  actingUserId?: string | null
  actingUserEmail: string
  organizationId?: string | null
  persist?: boolean
  /** When set, created_by is null and provenance is stored in snapshot/classification. */
  autonomousProvenance?: DraftFactorySchedulerGenerationProvenance | null
  /** When true, legacy approved-but-unsent drafts do not block fresh persistence. */
  ignoreApprovedExistingDraft?: boolean
  /** Ignored — Company Intelligence is no longer required on the critical path. */
  forceRegenerateCompanyIntelligence?: boolean
}

export type EquipifySupervisedAvaOutreachOutput = {
  qaMarker: typeof AVA_SUPERVISED_CUTOVER_1A_QA_MARKER
  directQaMarker: typeof AVA_DIRECT_PRODUCTION_CUTOVER_1A_QA_MARKER
  calibrationQaMarker: typeof AVA_REASONING_CALIBRATION_1A_QA_MARKER
  generationMode: typeof AVA_SUPERVISED_CUTOVER_GENERATION_MODE
  organizationId: string
  leadId: string
  companyName: string
  ownerOrganizationId: string
  companyUnderstanding: string | null
  websiteRetrieval: AvaDirectWebsiteRetrievalResult | null
  understandingMemoryVersionId: string | null
  companyIntelligenceVersionId: string | null
  evidenceFingerprint: string | null
  ciReused: false
  ciRegenerated: false
  companyIdentityUnresolved: boolean
  equipifyKnowledgeBaseSource: string | null
  equipifyKnowledgeBaseVersionId: string | null
  approvedSender: {
    senderAccountId: string | null
    displayName: string | null
    email: string | null
  }
  contactsSupplied: AvaContactEvidence[]
  decision: AvaReasoningResult["decision"]
  rationale: string
  strongestAngle: string | null
  recommendedContact: AvaReasoningResult["recommendedContact"]
  missingInformation: string[]
  email: AvaReasoningResult["email"]
  evidenceReferences: string[]
  model: string | null
  provider: string | null
  modelAttempts: number
  durationMs: number
  promptTokens: number | null
  completionTokens: number | null
  signatureApplied: boolean
  persistedGenerationId: string | null
  outboundSendAuthorized: false
  persistenceStatus: SupervisedDraftPersistenceStatus
}

export type RunEquipifySupervisedAvaOutreachResult =
  | { ok: true; output: EquipifySupervisedAvaOutreachOutput }
  | { ok: false; code: string; message: string }

function mapToOutput(input: {
  organizationId: string
  leadId: string
  companyName: string
  ownerOrganizationId: string
  companyUnderstanding: string | null
  websiteRetrieval: AvaDirectWebsiteRetrievalResult | null
  understandingMemoryVersionId: string | null
  companyIdentityUnresolved: boolean
  contactsSupplied: AvaContactEvidence[]
  result: AvaReasoningResult
  model: string | null
  provider: string | null
  modelAttempts: number
  durationMs: number
  promptTokens: number | null
  completionTokens: number | null
  signatureApplied: boolean
  persistedGenerationId: string | null
  persistenceStatus: EquipifySupervisedAvaOutreachOutput["persistenceStatus"]
  approvedSender: EquipifySupervisedAvaOutreachOutput["approvedSender"]
  organizationKnowledgeSource: string | null
  organizationKnowledgeVersionId: string | null
}): EquipifySupervisedAvaOutreachOutput {
  return {
    qaMarker: AVA_SUPERVISED_CUTOVER_1A_QA_MARKER,
    directQaMarker: AVA_DIRECT_PRODUCTION_CUTOVER_1A_QA_MARKER,
    calibrationQaMarker: AVA_REASONING_CALIBRATION_1A_QA_MARKER,
    generationMode: AVA_SUPERVISED_CUTOVER_GENERATION_MODE,
    organizationId: input.organizationId,
    leadId: input.leadId,
    companyName: input.companyName,
    ownerOrganizationId: input.ownerOrganizationId,
    companyUnderstanding: input.companyUnderstanding,
    websiteRetrieval: input.websiteRetrieval,
    understandingMemoryVersionId: input.understandingMemoryVersionId,
    companyIntelligenceVersionId: input.understandingMemoryVersionId,
    evidenceFingerprint: input.websiteRetrieval?.ok
      ? `ava-direct-website-${input.websiteRetrieval.charCount}`
      : null,
    ciReused: false,
    ciRegenerated: false,
    companyIdentityUnresolved: input.companyIdentityUnresolved,
    equipifyKnowledgeBaseSource: input.organizationKnowledgeSource,
    equipifyKnowledgeBaseVersionId: input.organizationKnowledgeVersionId,
    approvedSender: input.approvedSender,
    contactsSupplied: input.contactsSupplied,
    decision: input.result.decision,
    rationale: input.result.rationale,
    strongestAngle: input.result.strongestAngle,
    recommendedContact: input.result.recommendedContact,
    missingInformation: input.result.missingInformation,
    email: input.result.email,
    evidenceReferences: input.result.evidenceReferences,
    model: input.model,
    provider: input.provider,
    modelAttempts: input.modelAttempts,
    durationMs: input.durationMs,
    promptTokens: input.promptTokens,
    completionTokens: input.completionTokens,
    signatureApplied: input.signatureApplied,
    persistedGenerationId: input.persistedGenerationId,
    outboundSendAuthorized: false,
    persistenceStatus: input.persistenceStatus,
  }
}

async function persistSupervisedDraftIfSendable(input: {
  admin: SupabaseClient
  leadId: string
  actingUserId: string | null
  autonomousProvenance?: DraftFactorySchedulerGenerationProvenance | null
  output: EquipifySupervisedAvaOutreachOutput
  organizationKnowledge: unknown
  includeApprovedExisting?: boolean
}): Promise<{ id: string | null; status: SupervisedDraftPersistenceStatus }> {
  return persistSendableAvaSupervisedDraft({
    admin: input.admin,
    leadId: input.leadId,
    actingUserId: input.actingUserId,
    autonomousProvenance: input.autonomousProvenance,
    decision: input.output.decision,
    email: input.output.email,
    recommendedContact: input.output.recommendedContact,
    contactsSupplied: input.output.contactsSupplied,
    companyUnderstanding: input.output.companyUnderstanding,
    websiteRetrieval: input.output.websiteRetrieval,
    understandingMemoryVersionId: input.output.understandingMemoryVersionId,
    companyIdentityUnresolved: input.output.companyIdentityUnresolved,
    organizationKnowledge: input.organizationKnowledge,
    approvedSender: input.output.approvedSender,
    classification: {
      primary: input.output.decision,
      generationMode: AVA_SUPERVISED_CUTOVER_GENERATION_MODE,
      companyUnderstanding: input.output.companyUnderstanding,
      rationale: input.output.rationale,
      strongestAngle: input.output.strongestAngle,
      recommendedContact: input.output.recommendedContact,
      missingInformation: input.output.missingInformation,
      evidenceReferences: input.output.evidenceReferences,
      signatureApplied: input.output.signatureApplied,
      outboundSendAuthorized: false,
      model: input.output.model,
      provider: input.output.provider,
      promptVersion: AVA_DIRECT_PRODUCTION_PROMPT_VERSION,
    },
    includeApprovedExisting: input.includeApprovedExisting,
  })
}

/**
 * Supervised internal cutover entry — website content → single GPT Ava reasoning.
 */
export async function runEquipifySupervisedAvaOutreach(
  input: RunEquipifySupervisedAvaOutreachInput,
): Promise<RunEquipifySupervisedAvaOutreachResult> {
  const organizationId = input.organizationId?.trim() || getGrowthEngineAiOrgId()
  if (!organizationId) {
    return {
      ok: false,
      code: "organization_unavailable",
      message: "GROWTH_ENGINE_AI_ORG_ID is not configured.",
    }
  }

  const autonomousProvenance = input.autonomousProvenance ?? null
  const actingUserId = autonomousProvenance
    ? null
    : normalizeGrowthActorUserIdForDb(input.actingUserId)
  if (!autonomousProvenance && !actingUserId) {
    return {
      ok: false,
      code: "actor_invalid",
      message: "Acting user id is required for supervised draft generation.",
    }
  }

  const lead = await fetchGrowthLeadById(input.admin, input.leadId)
  if (!lead) {
    return { ok: false, code: "lead_not_found", message: "Lead not found." }
  }

  const [preflight, senderBundle, decisionMakers, sellerBundle] = await Promise.all([
    preflightEquipifyExternalCompanyForIntelligence(input.admin, input.leadId),
    loadEquipifyApprovedSenderBundle(input.admin, organizationId),
    listGrowthLeadDecisionMakers(input.admin, input.leadId),
    loadOutreachSellerTruthBundle(input.admin, {
      organizationId,
      preparedAt: new Date().toISOString(),
      prospectCompanyName: lead.companyName,
      leadId: lead.id,
    }),
  ])

  const baseKnowledge = projectEquipifyKnowledgeBase(sellerBundle.sellerTruth)
  const organizationKnowledge = enrichOrganizationKnowledgeWithSalesCalibration(
    enrichOrganizationKnowledgeWithSenderIdentity(baseKnowledge, senderBundle.identity),
  )
  const contacts = mapDecisionMakersToContactEvidence({
    decisionMakers,
    companyName: lead.companyName,
    leadContactFallback: {
      name: lead.contactName,
      email: lead.contactEmail,
      title: null,
    },
  })

  const approvedSender = {
    senderAccountId: senderBundle.senderAccountId,
    displayName: senderBundle.identity?.displayName ?? null,
    email: senderBundle.identity?.email ?? null,
  }

  const buildHold = async (inputHold: {
    rationale: string
    missingInformation: string[]
    evidenceReferences: string[]
    companyIdentityUnresolved: boolean
    websiteRetrieval: AvaDirectWebsiteRetrievalResult | null
  }): Promise<RunEquipifySupervisedAvaOutreachResult> => {
    const output = mapToOutput({
      organizationId,
      leadId: input.leadId,
      companyName: lead.companyName,
      ownerOrganizationId: organizationId,
      companyUnderstanding: null,
      websiteRetrieval: inputHold.websiteRetrieval,
      understandingMemoryVersionId: null,
      companyIdentityUnresolved: inputHold.companyIdentityUnresolved,
      contactsSupplied: contacts,
      result: {
        decision: "hold",
        rationale: inputHold.rationale,
        strongestAngle: null,
        recommendedContact: null,
        missingInformation: inputHold.missingInformation,
        email: null,
        evidenceReferences: inputHold.evidenceReferences,
      },
      model: null,
      provider: null,
      modelAttempts: 0,
      durationMs: 0,
      promptTokens: null,
      completionTokens: null,
      signatureApplied: false,
      persistedGenerationId: null,
      persistenceStatus: input.persist === false ? "disabled" : "skipped",
      approvedSender,
      organizationKnowledgeSource: organizationKnowledge.source,
      organizationKnowledgeVersionId: organizationKnowledge.versionId,
    })

    if (input.persist !== false) {
      const persisted = await persistSupervisedDraftIfSendable({
        admin: input.admin,
        leadId: input.leadId,
        actingUserId,
        autonomousProvenance,
        output,
        organizationKnowledge,
        includeApprovedExisting: !input.ignoreApprovedExistingDraft,
      })
      output.persistedGenerationId = persisted.id
      output.persistenceStatus = persisted.status
    }

    return { ok: true, output }
  }

  if (!preflight.canEnsure && !lead.website?.trim()) {
    logGrowthEngine("ava_direct_cutover_company_identity_hold", {
      leadId: input.leadId,
      reason: preflight.reason,
    })
    return buildHold({
      rationale: preflight.reason,
      missingInformation: [
        "Resolvable company identity or website URL",
        "Usable public website content",
      ],
      evidenceReferences: [preflight.reason],
      companyIdentityUnresolved: true,
      websiteRetrieval: null,
    })
  }

  const websiteRetrieval = await retrieveWebsiteTextForAvaDirect(lead.website)
  if (!websiteRetrieval.ok) {
    logGrowthEngine("ava_direct_cutover_website_retrieval_failed", {
      leadId: input.leadId,
      code: websiteRetrieval.code,
      message: websiteRetrieval.message,
    })
    return buildHold({
      rationale: `Website retrieval failed: ${websiteRetrieval.message}`,
      missingInformation: [
        "Usable public website content",
        websiteRetrieval.message,
      ],
      evidenceReferences: [
        websiteRetrieval.normalizedUrl ?? lead.website ?? "unknown",
        websiteRetrieval.message,
      ],
      companyIdentityUnresolved: false,
      websiteRetrieval,
    })
  }

  const reasoned = await runEquipifyAvaDirectReasoning({
    companyName: lead.companyName,
    website: websiteRetrieval.normalizedUrl,
    websiteText: websiteRetrieval.text,
    websiteSourceUrls: websiteRetrieval.sourceUrls,
    organizationId,
    actingUserEmail: input.actingUserEmail,
    roleKnowledge: EQUIPIFY_AVA_CALIBRATED_ROLE_KNOWLEDGE,
    objective: EQUIPIFY_AVA_CALIBRATED_OBJECTIVE,
    organizationKnowledge,
    contacts,
  })

  if (!reasoned.ok) {
    logGrowthEngine("ava_direct_cutover_reasoning_failed", {
      leadId: input.leadId,
      message: reasoned.message,
      durationMs: reasoned.durationMs,
    })
    return {
      ok: false,
      code: "model_failed",
      message: reasoned.message,
    }
  }

  let email = reasoned.result.email
  if (email?.body) {
    email = {
      ...email,
      subject: email.subject ? normalizeProhibitedAvaOutboundCopy(email.subject) : email.subject,
      body: normalizeProhibitedAvaOutboundCopy(
        stripAccidentalAvaSignatureFromBody(email.body),
      ),
    }
  }
  const signatureApplied = false

  const { companyUnderstanding, ...reasoningFields } = reasoned.result
  const result: AvaReasoningResult = {
    ...reasoningFields,
    email,
  }

  let understandingMemoryVersionId: string | null = null
  if (input.persist !== false && companyUnderstanding?.trim()) {
    const memory = await persistAvaUnderstandingMemory({
      admin: input.admin,
      ownerOrganizationId: organizationId,
      leadId: input.leadId,
      companyId: preflight.canEnsure ? preflight.externalCompanyId : null,
      companyName: lead.companyName,
      website: websiteRetrieval.normalizedUrl,
      companyUnderstanding,
      websiteSourceUrls: websiteRetrieval.sourceUrls,
      model: reasoned.model,
      promptVersion: AVA_DIRECT_PRODUCTION_PROMPT_VERSION,
      aiDeploymentId: EQUIPIFY_AVA_DEPLOYMENT_ID,
    })
    if (memory.ok) understandingMemoryVersionId = memory.versionId
  }

  const output = mapToOutput({
    organizationId,
    leadId: input.leadId,
    companyName: lead.companyName,
    ownerOrganizationId: organizationId,
    companyUnderstanding: companyUnderstanding,
    websiteRetrieval,
    understandingMemoryVersionId,
    companyIdentityUnresolved: false,
    contactsSupplied: contacts,
    result,
    model: reasoned.model,
    provider: reasoned.provider,
    modelAttempts: 1,
    durationMs: reasoned.durationMs,
    promptTokens: reasoned.promptTokens,
    completionTokens: reasoned.completionTokens,
    signatureApplied,
    persistedGenerationId: null,
    persistenceStatus: input.persist === false ? "disabled" : "skipped",
    approvedSender,
    organizationKnowledgeSource: organizationKnowledge.source,
    organizationKnowledgeVersionId: organizationKnowledge.versionId,
  })

  if (input.persist !== false) {
    const persisted = await persistSupervisedDraftIfSendable({
      admin: input.admin,
      leadId: input.leadId,
      actingUserId,
      autonomousProvenance,
      output,
      organizationKnowledge,
    })
    output.persistedGenerationId = persisted.id
    output.persistenceStatus = persisted.status
  }

  logGrowthEngine("ava_direct_cutover_completed", {
    leadId: input.leadId,
    decision: output.decision,
    persistedGenerationId: output.persistedGenerationId,
    signatureApplied: output.signatureApplied,
    websiteChars: websiteRetrieval.charCount,
    durationMs: output.durationMs,
  })

  return { ok: true, output }
}
