/**
 * AVA-HOME-PROJECTION-CUTOVER-1A — Project supervised Ava drafts into Home operator attention.
 * Read-model only — does not alter reasoning, persistence, approvals, or transport.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthAiCopilotGeneration } from "@/lib/growth/ai-copilot-types"
import type { GrowthCanonicalOperatorApprovalPackagePreview } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a-types"
import type { GrowthCanonicalOperatorApprovalSnapshot } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a-types"
import { GROWTH_AIOS_OPERATOR_EXPERIENCE_1A_QA_MARKER } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a-types"
import { buildCustomerPackageReviewHref } from "@/lib/growth/workspace/ux-1a/review/growth-review-routes"
import { AVA_SUPERVISED_CUTOVER_GENERATION_MODE } from "@/lib/growth/ava-reasoning/equipify-supervised-cutover-service"
import { readAvaSupervisedOutboundSendReceipt } from "@/lib/growth/ava-reasoning/ava-supervised-outbound-1a-types"
import { readAvaSupervisedOutboundSendLifecycle } from "@/lib/growth/ava-reasoning/ava-supervised-outbound-1b-types"
import {
  AVA_HOME_PROJECTION_CUTOVER_1A_QA_MARKER,
  type GrowthSupervisedAvaHomeNeedsInformationItem,
  type GrowthSupervisedAvaHomeOperatorAttention,
  type GrowthSupervisedAvaHomeReadyItem,
} from "@/lib/growth/ava-reasoning/equipify-supervised-home-projection-1a-types"
import { isActionableHomeReviewPackagePreview } from "@/lib/growth/home/growth-home-review-queue-1b"

const SUPERVISED_PROMPT_VARIANT = "ava_direct_production_cutover_1a" as const

const GENERATION_SELECT =
  "id, lead_id, generation_type, prompt_version, prompt_variant, input_snapshot, generated_content, generated_subject, classification, status, source_reply_id, input_hash, playbook_influence_score, playbook_attribution, approved_at, approved_by, sent_at, created_by, created_at"

type LeadLookup = Map<string, string>

function classificationRecord(
  generation: GrowthAiCopilotGeneration,
): Record<string, unknown> {
  const raw = generation.classification
  if (raw && typeof raw === "object") return raw as Record<string, unknown>
  return {}
}

function contactNameFromGeneration(generation: GrowthAiCopilotGeneration): string | null {
  const classification = classificationRecord(generation)
  const recommended = classification.recommendedContact
  if (recommended && typeof recommended === "object") {
    const name = (recommended as { name?: string }).name?.trim()
    if (name) return name
  }

  const snapshot = generation.inputSnapshot ?? {}
  const contacts = Array.isArray(snapshot.contactsSupplied) ? snapshot.contactsSupplied : []
  for (const row of contacts) {
    if (!row || typeof row !== "object") continue
    const contact = row as { name?: string; email?: string; contactabilityStatus?: string }
    if (contact.contactabilityStatus === "contactable" && contact.email?.trim()) {
      return contact.name?.trim() || contact.email.trim()
    }
  }

  return null
}

function hasContactableRecipient(generation: GrowthAiCopilotGeneration): boolean {
  return contactNameFromGeneration(generation) != null
}

export function isSupervisedAvaGenerationSent(
  generation: GrowthAiCopilotGeneration,
): boolean {
  if (generation.sentAt?.trim()) return true

  const classification = classificationRecord(generation)
  const lifecycle = readAvaSupervisedOutboundSendLifecycle(classification)
  if (lifecycle?.status === "sent") return true

  const receipt = readAvaSupervisedOutboundSendReceipt(classification)
  if (receipt?.status === "sent") return true

  return false
}

export function isReviewableSupervisedAvaGeneration(
  generation: GrowthAiCopilotGeneration,
): boolean {
  if (generation.generationType !== "cold_email") return false
  if (generation.promptVariant !== SUPERVISED_PROMPT_VARIANT) return false
  if (generation.status !== "draft" && generation.status !== "approved") return false
  if (!generation.generatedSubject?.trim() || !generation.generatedContent?.trim()) return false
  if (isSupervisedAvaGenerationSent(generation)) return false

  const classification = classificationRecord(generation)
  if (classification.primary !== "pursue") return false
  if (classification.generationMode !== AVA_SUPERVISED_CUTOVER_GENERATION_MODE) return false
  if (classification.outboundSendAuthorized === true) return false
  if (!hasContactableRecipient(generation)) return false

  return true
}

export function isSupervisedNeedsInformationGeneration(
  generation: GrowthAiCopilotGeneration,
): boolean {
  if (generation.generationType !== "cold_email") return false
  if (generation.promptVariant !== SUPERVISED_PROMPT_VARIANT) return false

  const classification = classificationRecord(generation)
  if (classification.generationMode !== AVA_SUPERVISED_CUTOVER_GENERATION_MODE) return false
  if (classification.primary === "reject") return false
  if (isReviewableSupervisedAvaGeneration(generation)) return false

  if (classification.primary === "hold") return true

  if (classification.primary === "pursue") {
    return !hasContactableRecipient(generation)
  }

  return false
}

function relativePreparedLabel(preparedAt: string | null): string | null {
  if (!preparedAt) return null
  const parsed = Date.parse(preparedAt)
  if (!Number.isFinite(parsed)) return null
  const minutes = Math.max(1, Math.round((Date.now() - parsed) / 60000))
  if (minutes < 60) return `Prepared ${minutes} minute${minutes === 1 ? "" : "s"} ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `Prepared ${hours} hour${hours === 1 ? "" : "s"} ago`
  const days = Math.round(hours / 24)
  return `Prepared ${days} day${days === 1 ? "" : "s"} ago`
}

function readyItemFromGeneration(
  generation: GrowthAiCopilotGeneration,
  companyName: string,
): GrowthSupervisedAvaHomeReadyItem {
  const classification = classificationRecord(generation)
  return {
    generationId: generation.id,
    leadId: generation.leadId,
    companyName,
    contactName: contactNameFromGeneration(generation),
    subject: generation.generatedSubject!.trim(),
    rationale: typeof classification.rationale === "string" ? classification.rationale.trim() : null,
    reviewHref: buildCustomerPackageReviewHref(generation.leadId),
    preparedAt: generation.createdAt,
    outboundSendAuthorized: false,
  }
}

function needsInformationFromGeneration(
  generation: GrowthAiCopilotGeneration,
  companyName: string,
): GrowthSupervisedAvaHomeNeedsInformationItem | null {
  if (!isSupervisedNeedsInformationGeneration(generation)) return null

  const classification = classificationRecord(generation)
  const decision = classification.primary === "pursue" ? "pursue" : "hold"
  const missingInformation = Array.isArray(classification.missingInformation)
    ? classification.missingInformation
        .filter((row): row is string => typeof row === "string" && row.trim().length > 0)
        .map((row) => row.trim())
    : []

  return {
    leadId: generation.leadId,
    companyName,
    decision,
    rationale: typeof classification.rationale === "string" ? classification.rationale.trim() : null,
    missingInformation,
    reviewHref: buildCustomerPackageReviewHref(generation.leadId),
  }
}

function mapGenerationRow(row: Record<string, unknown>): GrowthAiCopilotGeneration {
  return {
    id: String(row.id),
    leadId: String(row.lead_id),
    generationType: row.generation_type as GrowthAiCopilotGeneration["generationType"],
    promptVersion: String(row.prompt_version),
    promptVariant: String(row.prompt_variant),
    inputSnapshot: (row.input_snapshot as Record<string, unknown>) ?? {},
    generatedContent: String(row.generated_content ?? ""),
    generatedSubject: (row.generated_subject as string | null) ?? null,
    classification: (row.classification as GrowthAiCopilotGeneration["classification"]) ?? {},
    status: row.status as GrowthAiCopilotGeneration["status"],
    sourceReplyId: (row.source_reply_id as string | null) ?? null,
    inputHash: (row.input_hash as string | null) ?? null,
    playbookInfluenceScore: Number(row.playbook_influence_score ?? 0),
    playbookAttribution: (row.playbook_attribution as Record<string, unknown>) ?? {},
    approvedAt: (row.approved_at as string | null) ?? null,
    approvedBy: (row.approved_by as string | null) ?? null,
    sentAt: (row.sent_at as string | null) ?? null,
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: String(row.created_at),
  }
}

export async function loadSupervisedAvaGenerationsForHome(
  admin: SupabaseClient,
  leadIds: string[],
): Promise<GrowthAiCopilotGeneration[]> {
  const scopedLeadIds = [...new Set(leadIds.map((id) => id.trim()).filter(Boolean))]
  if (scopedLeadIds.length === 0) return []

  const { data, error } = await admin
    .schema("growth")
    .from("ai_copilot_generations")
    .select(GENERATION_SELECT)
    .in("lead_id", scopedLeadIds)
    .eq("generation_type", "cold_email")
    .eq("prompt_variant", SUPERVISED_PROMPT_VARIANT)
    .in("status", ["draft", "approved", "discarded"])
    .order("created_at", { ascending: false })
    .limit(Math.min(scopedLeadIds.length * 3, 150))

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapGenerationRow(row as Record<string, unknown>))
}

export function buildSupervisedAvaHomeOperatorAttention(input: {
  generations: GrowthAiCopilotGeneration[]
  leadsById: LeadLookup
}): GrowthSupervisedAvaHomeOperatorAttention {
  const sentLeadIds = new Set<string>()
  for (const generation of input.generations) {
    if (isSupervisedAvaGenerationSent(generation)) {
      sentLeadIds.add(generation.leadId)
    }
  }

  const seenReady = new Set<string>()
  const seenNeeds = new Set<string>()
  const readyForReview: GrowthSupervisedAvaHomeReadyItem[] = []
  const needsInformation: GrowthSupervisedAvaHomeNeedsInformationItem[] = []
  let rejectedCount = 0

  for (const generation of input.generations) {
    if (sentLeadIds.has(generation.leadId)) continue

    const companyName = input.leadsById.get(generation.leadId) ?? "Account"
    const classification = classificationRecord(generation)
    if (classification.primary === "reject") {
      rejectedCount += 1
      continue
    }

    if (!seenReady.has(generation.leadId) && isReviewableSupervisedAvaGeneration(generation)) {
      readyForReview.push(readyItemFromGeneration(generation, companyName))
      seenReady.add(generation.leadId)
      continue
    }

    if (!seenNeeds.has(generation.leadId) && !seenReady.has(generation.leadId)) {
      const needs = needsInformationFromGeneration(generation, companyName)
      if (needs) {
        needsInformation.push(needs)
        seenNeeds.add(generation.leadId)
      }
    }
  }

  return {
    qaMarker: AVA_HOME_PROJECTION_CUTOVER_1A_QA_MARKER,
    readyForReview,
    needsInformation,
    sentLeadIds: [...sentLeadIds],
    rejectedCount,
  }
}

function readyItemToPackagePreview(item: GrowthSupervisedAvaHomeReadyItem): GrowthCanonicalOperatorApprovalPackagePreview {
  const detailParts = [
    item.contactName ? `Contact: ${item.contactName}` : null,
    item.subject ? `Subject: ${item.subject}` : null,
    item.rationale,
  ].filter((row): row is string => Boolean(row?.trim()))

  return {
    itemId: `supervised-draft:${item.generationId}`,
    packageId: item.generationId,
    leadId: item.leadId,
    companyName: item.companyName,
    decisionMaker: item.contactName,
    draftCount: 1,
    preparedAt: item.preparedAt,
    preparedAgoLabel: relativePreparedLabel(item.preparedAt),
    channelLabel: item.subject,
    statusLabel: "Ready for review",
    reviewHref: buildCustomerPackageReviewHref(item.leadId),
    packageSource: "supervised_ava_generation",
    operatorDetail: detailParts.join(" · "),
  }
}

function isLegacyHoldLikePackage(pkg: GrowthCanonicalOperatorApprovalPackagePreview): boolean {
  const text = `${pkg.companyName} ${pkg.decisionMaker ?? ""} ${pkg.channelLabel ?? ""} ${pkg.operatorDetail ?? ""}`
  return /hold|needs information|website unavailable|identity unresolved|decision maker|buying committee|diverse power/i.test(
    text,
  )
}

export function mergeSupervisedAvaIntoApprovalSnapshot(input: {
  base: GrowthCanonicalOperatorApprovalSnapshot
  attention: GrowthSupervisedAvaHomeOperatorAttention
}): GrowthCanonicalOperatorApprovalSnapshot {
  const supervisedReady = input.attention.readyForReview
  const sentLeadIds = new Set(input.attention.sentLeadIds ?? [])
  const hasSupervisedAttention =
    supervisedReady.length > 0 || input.attention.needsInformation.length > 0

  if (!hasSupervisedAttention && sentLeadIds.size === 0) {
    return input.base
  }

  const excludedLeadIds = new Set([
    ...supervisedReady.map((row) => row.leadId),
    ...input.attention.needsInformation.map((row) => row.leadId),
    ...sentLeadIds,
  ])

  const legacyPackages = input.base.packages.filter((pkg) => {
    if (excludedLeadIds.has(pkg.leadId)) return false
    if (supervisedReady.length > 0 && isLegacyHoldLikePackage(pkg)) return false
    return isActionableHomeReviewPackagePreview({ pkg })
  })

  const supervisedPackages = supervisedReady.map(readyItemToPackagePreview)
  const packages = [...supervisedPackages, ...legacyPackages]
  const outreachDraftCount = packages.reduce((sum, row) => sum + Math.max(row.draftCount, 0), 0)

  return {
    qaMarker: GROWTH_AIOS_OPERATOR_EXPERIENCE_1A_QA_MARKER,
    outreachPackageCount: packages.length,
    outreachDraftCount,
    pendingApprovalCount: supervisedPackages.length > 0 ? supervisedPackages.length : packages.length,
    waitingForOperator: packages.length > 0,
    packages,
    topPackage: packages[0] ?? null,
  }
}
