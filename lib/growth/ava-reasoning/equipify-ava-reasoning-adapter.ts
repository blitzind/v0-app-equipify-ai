/**
 * Equipify deployment adapter for Ava CI reasoning.
 *
 * Assembles:
 *   Growth Lead → owner-scoped Company Intelligence
 *   + Equipify Knowledge Base (approved Business Profile / seller truth)
 *   + Ava Growth Role
 *   + Equipify deployment objective
 *   + decision-maker evidence
 * → runAvaReasoning()
 *
 * Does not hard-code Equipify facts into the reusable reasoning service.
 * Persistence is opt-in; proof path keeps it disabled. Outbound remains unauthorized.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { loadOutreachSellerTruthBundle } from "@/lib/growth/aios/growth/growth-outreach-seller-truth-loader"
import { listGrowthLeadDecisionMakers } from "@/lib/growth/decision-maker-repository"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import {
  ensureCompanyIntelligenceForGrowthLead,
  type CompanyIntelligenceForAiEmployee,
  type FuzorCompanyIntelligenceVersionRecord,
} from "@/lib/fuzor/company-intelligence"
import { AVA_GROWTH_ROLE_KNOWLEDGE_V1 } from "@/lib/fuzor/ava-reasoning/ava-role-knowledge"
import { runAvaReasoning } from "@/lib/fuzor/ava-reasoning/ava-reasoning-service"
import type {
  AvaContactEvidence,
  AvaOrganizationKnowledge,
  RunAvaReasoningOutput,
} from "@/lib/fuzor/ava-reasoning/ava-reasoning-types"
import type { GrowthOutreachSellerTruth } from "@/lib/growth/aios/growth/growth-outreach-seller-truth"

/** Explicit deployment objective for Blitz Industries' internal Ava on Equipify. */
export const EQUIPIFY_AVA_DEPLOYMENT_OBJECTIVE =
  "Help Blitz Industries sell Equipify to qualified equipment-service and field-operation companies." as const

export const EQUIPIFY_AVA_DEPLOYMENT_ID = "equipify-internal-ava-growth-v1" as const

function uniqueStrings(values: Array<string | null | undefined>, max = 12): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const value of values) {
    const trimmed = typeof value === "string" ? value.trim() : ""
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
    if (out.length >= max) break
  }
  return out
}

/**
 * Project approved seller truth into generic organization knowledge.
 * This is the Equipify Knowledge Base for the internal Ava deployment.
 */
export function projectEquipifyKnowledgeBase(
  sellerTruth: GrowthOutreachSellerTruth,
): AvaOrganizationKnowledge {
  return {
    source: sellerTruth.source,
    versionId: sellerTruth.profileId,
    organizationName: sellerTruth.sellerCompanyName?.trim() || "Equipify",
    identitySummary:
      sellerTruth.companyIdentity?.trim() ||
      sellerTruth.elevatorPitch?.trim() ||
      sellerTruth.primaryValueProposition?.trim() ||
      null,
    productsAndCapabilities: uniqueStrings([
      ...(sellerTruth.currentCapabilities ?? []),
      ...sellerTruth.productsServices,
    ]),
    customersServed: uniqueStrings([
      ...sellerTruth.idealCustomerProfile,
      ...sellerTruth.industries,
    ]),
    problemsSolved: uniqueStrings([
      ...sellerTruth.businessOutcomes,
      ...(sellerTruth.matchedIndustryKnowledge
        ? [`Industry context: ${sellerTruth.matchedIndustryKnowledge}`]
        : []),
    ]),
    differentiators: uniqueStrings(sellerTruth.differentiators),
    positioning: uniqueStrings([
      ...sellerTruth.positioning,
      sellerTruth.primaryValueProposition,
      ...sellerTruth.messagingAngles,
    ]),
    approvedTerminologyPrefer: uniqueStrings(sellerTruth.messagingAngles, 8),
    approvedTerminologyAvoid: uniqueStrings(
      [...sellerTruth.wordsToAvoid, ...sellerTruth.neverSay],
      12,
    ),
    customerOutcomes: uniqueStrings([
      ...sellerTruth.businessOutcomes,
      ...(sellerTruth.proofPoints ?? []),
    ]),
    limitations: uniqueStrings([
      ...(sellerTruth.limitations ?? []),
      ...(sellerTruth.postponeTopics ?? []),
    ]),
    disqualifiers: uniqueStrings([
      ...sellerTruth.disqualifiers,
      ...(sellerTruth.whenNotToRecommend ?? []),
    ]),
  }
}

function mapContactability(input: {
  status: string
  email: string | null
}): AvaContactEvidence["contactabilityStatus"] {
  if (input.status === "rejected") return "rejected"
  if (input.email?.trim()) return "contactable"
  if (input.status === "confirmed" || input.status === "suspected") return "email_missing"
  return "unknown"
}

export function mapDecisionMakersToContactEvidence(input: {
  decisionMakers: Array<{
    id: string
    fullName: string
    title: string | null
    email: string | null
    linkedinUrl: string | null
    source: string
    evidenceExcerpt: string | null
    status: string
    isPrimary: boolean
  }>
  companyName: string
  leadContactFallback?: {
    name: string | null
    email: string | null
    title?: string | null
  } | null
}): AvaContactEvidence[] {
  const contacts: AvaContactEvidence[] = input.decisionMakers
    .filter((dm) => dm.status !== "rejected")
    .map((dm) => ({
      contactId: dm.id,
      name: dm.fullName,
      title: dm.title,
      role: dm.title,
      email: dm.email,
      linkedinUrl: dm.linkedinUrl,
      companyAssociation: input.companyName,
      professionalSummary: dm.evidenceExcerpt,
      contactabilityStatus: mapContactability({ status: dm.status, email: dm.email }),
      evidenceSource: dm.source,
      evidenceExcerpt: dm.evidenceExcerpt,
    }))

  if (
    contacts.length === 0 &&
    (input.leadContactFallback?.name || input.leadContactFallback?.email)
  ) {
    contacts.push({
      contactId: "lead-contact-fallback",
      name: input.leadContactFallback.name?.trim() || "Unknown contact",
      title: input.leadContactFallback.title ?? null,
      role: input.leadContactFallback.title ?? null,
      email: input.leadContactFallback.email,
      linkedinUrl: null,
      companyAssociation: input.companyName,
      professionalSummary: null,
      contactabilityStatus: mapContactability({
        status: "suspected",
        email: input.leadContactFallback.email,
      }),
      evidenceSource: "lead_contact",
      evidenceExcerpt: null,
    })
  }

  return contacts
}

function toAiEmployeeView(
  record: FuzorCompanyIntelligenceVersionRecord,
): CompanyIntelligenceForAiEmployee {
  return {
    ownerOrganizationId: record.ownerOrganizationId,
    aiDeploymentId: record.aiDeploymentId,
    companyId: record.companyId,
    externalCompanyId: record.companyId,
    leadId: record.leadId,
    companyName: record.companyName,
    website: record.website,
    companyIntelligenceVersionId: record.id,
    companyIntelligenceVersion: record.companyIntelligenceVersion,
    evidenceFingerprint: record.evidenceFingerprint,
    createdAt: record.createdAt,
    understanding: record.understanding,
    evidenceRefs: record.evidenceRefs,
  }
}

export type RunEquipifyAvaReasoningInput = {
  admin: SupabaseClient
  leadId: string
  actingUserEmail: string
  ownerOrganizationId?: string | null
  /** Default false for proof safety. */
  persist?: boolean
  forceRegenerateCompanyIntelligence?: boolean
}

export type RunEquipifyAvaReasoningResult =
  | {
      ok: true
      ciReused: boolean
      ciRegenerated: boolean
      companyIntelligenceVersionId: string
      evidenceFingerprint: string
      organizationKnowledge: AvaOrganizationKnowledge
      output: RunAvaReasoningOutput
    }
  | {
      ok: false
      code: string
      message: string
    }

/**
 * Equipify internal Ava deployment path (isolated from live operator surfaces).
 */
export async function runEquipifyAvaReasoning(
  input: RunEquipifyAvaReasoningInput,
): Promise<RunEquipifyAvaReasoningResult> {
  const ownerOrganizationId =
    input.ownerOrganizationId?.trim() || getGrowthEngineAiOrgId()
  if (!ownerOrganizationId) {
    return {
      ok: false,
      code: "organization_unavailable",
      message: "GROWTH_ENGINE_AI_ORG_ID is not configured.",
    }
  }

  const lead = await fetchGrowthLeadById(input.admin, input.leadId)
  if (!lead) {
    return { ok: false, code: "lead_not_found", message: "Lead not found." }
  }

  const ensured = await ensureCompanyIntelligenceForGrowthLead({
    admin: input.admin,
    leadId: input.leadId,
    organizationId: ownerOrganizationId,
    actingUserEmail: input.actingUserEmail,
    forceRegenerate: input.forceRegenerateCompanyIntelligence,
    aiDeploymentId: EQUIPIFY_AVA_DEPLOYMENT_ID,
  })
  if (!ensured.ok) {
    return { ok: false, code: ensured.code, message: ensured.message }
  }

  const companyIntelligence = toAiEmployeeView(ensured.record)

  const [decisionMakers, sellerBundle] = await Promise.all([
    listGrowthLeadDecisionMakers(input.admin, input.leadId),
    loadOutreachSellerTruthBundle(input.admin, {
      organizationId: ownerOrganizationId,
      preparedAt: new Date().toISOString(),
      prospectCompanyName: lead.companyName,
      leadId: lead.id,
    }),
  ])

  const organizationKnowledge = projectEquipifyKnowledgeBase(sellerBundle.sellerTruth)
  const contacts = mapDecisionMakersToContactEvidence({
    decisionMakers,
    companyName: lead.companyName,
    leadContactFallback: {
      name: lead.contactName,
      email: lead.contactEmail,
      title: null,
    },
  })

  const reasoned = await runAvaReasoning({
    ownerOrganizationId,
    aiDeploymentId: EQUIPIFY_AVA_DEPLOYMENT_ID,
    companyIntelligence,
    organizationKnowledge,
    roleKnowledge: AVA_GROWTH_ROLE_KNOWLEDGE_V1,
    objective: EQUIPIFY_AVA_DEPLOYMENT_OBJECTIVE,
    contacts,
    hardRuleState: {
      outboundSendAuthorized: false,
      draftGenerationAllowed: true,
      optOutBlocked: false,
      suppressed: false,
      persistenceEnabled: input.persist === true,
    },
    actingUserEmail: input.actingUserEmail,
  })

  if (!reasoned.ok) {
    return { ok: false, code: reasoned.code, message: reasoned.message }
  }

  // Persistence intentionally not wired in this milestone (proof path; no live operator change).
  void input.persist

  return {
    ok: true,
    ciReused: ensured.reused,
    ciRegenerated: ensured.regenerated,
    companyIntelligenceVersionId: ensured.record.id,
    evidenceFingerprint: ensured.record.evidenceFingerprint,
    organizationKnowledge,
    output: reasoned.output,
  }
}
