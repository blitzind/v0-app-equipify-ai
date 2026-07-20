/** GE-AIOS-PRE-1M-EXTERNAL-DISCOVERY-ADMISSION-REPAIR-1O — Repair classification helpers (client-safe). */

export const GE_AIOS_PRE_1M_EXTERNAL_DISCOVERY_ADMISSION_REPAIR_1O_QA_MARKER =
  "ge-aios-pre-1m-external-discovery-admission-repair-1o-v1" as const

export const GE_AIOS_PRE_1M_EXTERNAL_DISCOVERY_REPAIR_VERSION = "1" as const

export const GE_AIOS_PRE_1M_EXTERNAL_DISCOVERY_REPAIR_CONFIRM_TOKEN =
  "CONFIRM_GE_AIOS_PRE_1M_EXTERNAL_DISCOVERY_REPAIR_1O" as const

export type Pre1mRepairClassification =
  | "repair_required"
  | "already_correct"
  | "exclude_not_external_discovery"
  | "exclude_post_1m"
  | "manual_review_required_outbound_history"
  | "manual_review_required_ambiguous_provenance"

type OutboundCounts = {
  email: number
  sequence: number
  call: number
  sms: number
  meeting: number
  total: number
}

type LeadCandidate = {
  created_at: string
  metadata: Record<string, unknown> | null
}

function readSiteKey(metadata: Record<string, unknown>): string | null {
  const raw = metadata.intake_site_key ?? metadata.intakeSiteKey
  return typeof raw === "string" && raw.trim() ? raw.trim() : null
}

export function classifyPre1mExternalDiscoveryRepairCandidate(input: {
  lead: LeadCandidate
  deploymentCutoffIso: string
  outboundCounts: OutboundCounts
  alreadyRepaired: boolean
}): Pre1mRepairClassification {
  const metadata = input.lead.metadata ?? {}
  const siteKey = readSiteKey(metadata)
  const unified =
    typeof metadata.unified_intake_source === "string" ? metadata.unified_intake_source : null
  const createdBeforeCutoff = input.lead.created_at < input.deploymentCutoffIso

  if (input.alreadyRepaired && unified === "datamoon") return "already_correct"

  if (!createdBeforeCutoff) {
    if (siteKey === "prospect_search_external_discovery" && unified === "datamoon") {
      return "already_correct"
    }
    return "exclude_post_1m"
  }

  if (siteKey === "prospect_search" || siteKey === "prospect_search_operator_push") {
    return "exclude_not_external_discovery"
  }

  if (siteKey === "growth_audience") return "exclude_not_external_discovery"

  if (siteKey !== "prospect_search_external_discovery") {
    return "manual_review_required_ambiguous_provenance"
  }

  if (unified === "datamoon") return "already_correct"

  if (unified !== "saved_search") {
    return "manual_review_required_ambiguous_provenance"
  }

  if (input.outboundCounts.total > 0) {
    return "manual_review_required_outbound_history"
  }

  return "repair_required"
}

export function buildPre1mRepairAuditMetadata(input: {
  previousMetadata: Record<string, unknown>
  previousSourceKind: string | null
  actor: string
  generatedAt: string
}): Record<string, unknown> {
  return {
    repair_qa_marker: GE_AIOS_PRE_1M_EXTERNAL_DISCOVERY_ADMISSION_REPAIR_1O_QA_MARKER,
    repair_applied_at: input.generatedAt,
    repair_previous_unified_intake_source: input.previousMetadata.unified_intake_source ?? null,
    repair_previous_source_kind: input.previousSourceKind,
    repair_previous_admission_state: input.previousMetadata.admission_state ?? null,
    repair_previous_admission_reasons: input.previousMetadata.admission_reasons ?? [],
    repair_reason: "pre_1m_external_discovery_source_misclassification",
    repair_actor: input.actor,
    repair_version: GE_AIOS_PRE_1M_EXTERNAL_DISCOVERY_REPAIR_VERSION,
  }
}
