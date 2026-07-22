/**
 * GE-AIOS-PRE-1M-EXTERNAL-DISCOVERY-ADMISSION-REPAIR-1O — Targeted historical lead repair (dry-run default).
 *
 * Dry-run:
 *   pnpm repair:ge-aios-pre-1m-external-discovery-admission-1o
 *
 * Mutate (explicit confirmation required):
 *   CONFIRM_GE_AIOS_PRE_1M_EXTERNAL_DISCOVERY_REPAIR_1O=1 pnpm repair:ge-aios-pre-1m-external-discovery-admission-1o
 *
 * Single-lead override (requires both tokens):
 *   CONFIRM_GE_AIOS_PRE_1M_EXTERNAL_DISCOVERY_REPAIR_1O=1 \
 *   CONFIRM_GE_AIOS_PRE_1M_EXTERNAL_DISCOVERY_REPAIR_1O_LEAD_ID=<uuid> \
 *   pnpm repair:ge-aios-pre-1m-external-discovery-admission-1o
 */
import { execSync } from "node:child_process"
import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizeDomain } from "@/lib/growth/company-identification/company-identification-normalize"
import { getActiveApprovedBusinessProfile } from "@/lib/growth/business-profile/business-profile-repository"
import { fetchGrowthLeadById, updateGrowthLeadFromImportMerge } from "@/lib/growth/lead-repository"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { fetchLatestCompletedProspectResearchRun } from "@/lib/growth/research/research-repository"
import type { GrowthCompanyEvidenceBundle } from "@/lib/growth/research/company-evidence/company-evidence-types"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import {
  buildLeadAdmissionMetadata,
  evaluateGrowthLeadAdmission,
  resolveLeadAdmissionStateFromMetadata,
  type GrowthLeadAdmissionContext,
} from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import { buildGrowthLeadAdmissionIntakeFromLead } from "@/lib/growth/revenue-workflow/growth-lead-admission-lead-input"
import { reconcileExternalDiscoveryPostResearchAdmission } from "@/lib/growth/revenue-workflow/growth-operational-keyword-validation-server-1a"
import {
  buildGrowthOperationalKeywordValidationInputFromResearch,
  evaluateExternalDiscoveryIndustryGateFromEvidence,
  evaluateGrowthOperationalKeywordValidation,
} from "@/lib/growth/revenue-workflow/growth-operational-keyword-validation-1a"
import {
  GE_AIOS_PRE_1M_EXTERNAL_DISCOVERY_ADMISSION_REPAIR_1O_QA_MARKER,
  GE_AIOS_PRE_1M_EXTERNAL_DISCOVERY_REPAIR_CONFIRM_TOKEN,
  buildPre1mRepairAuditMetadata,
  classifyPre1mExternalDiscoveryRepairCandidate,
} from "@/lib/growth/revenue-workflow/growth-pre-1m-external-discovery-repair-1o"
import { isLeadInPortfolioOrganizationScope } from "@/lib/growth/portfolio-eligibility/growth-portfolio-eligibility-1a"

export {
  GE_AIOS_PRE_1M_EXTERNAL_DISCOVERY_ADMISSION_REPAIR_1O_QA_MARKER,
  GE_AIOS_PRE_1M_EXTERNAL_DISCOVERY_REPAIR_CONFIRM_TOKEN,
  classifyPre1mExternalDiscoveryRepairCandidate,
} from "@/lib/growth/revenue-workflow/growth-pre-1m-external-discovery-repair-1o"

const DEFAULT_DEPLOYED_SHA = "ba6da033315ad3ad0ddcc269bbb5347f8654f7fb"
const DEFAULT_DEPLOYMENT_CUTOFF_ISO = "2026-07-16T19:20:00.000Z"

type Pre1mRepairResearchCase =
  | "complete_with_keyword"
  | "complete_missing_keyword"
  | "missing_or_incomplete"

type OutboundCounts = {
  email: number
  sequence: number
  call: number
  sms: number
  meeting: number
  total: number
}

type LeadRow = {
  id: string
  company_name: string | null
  contact_name: string | null
  contact_email: string | null
  website: string | null
  status: string | null
  source_kind: string | null
  source_detail: string | null
  promoted_organization_id: string | null
  metadata: Record<string, unknown> | null
  latest_prospect_research_run_id: string | null
  last_prospect_researched_at: string | null
  created_at: string
  industry?: string | null
}

function readSiteKey(metadata: Record<string, unknown>): string | null {
  const raw = metadata.intake_site_key ?? metadata.intakeSiteKey
  return typeof raw === "string" && raw.trim() ? raw.trim() : null
}

function readProspectSourceType(metadata: Record<string, unknown>): string | null {
  const ps = metadata.prospect_search
  if (!ps || typeof ps !== "object") return null
  const raw = (ps as Record<string, unknown>).source_type
  return typeof raw === "string" ? raw : null
}

function hasKeywordValidation(metadata: Record<string, unknown>): boolean {
  return (
    metadata.operational_keyword_validation_evaluated_at != null ||
    metadata.operational_keyword_validation_pass != null ||
    metadata.operational_keyword_validation_qa_marker != null
  )
}

function resolveResearchCase(lead: LeadRow): Pre1mRepairResearchCase {
  if (!lead.latest_prospect_research_run_id && !lead.last_prospect_researched_at) {
    return "missing_or_incomplete"
  }
  if (hasKeywordValidation(lead.metadata ?? {})) return "complete_with_keyword"
  return "complete_missing_keyword"
}

function applyProvenanceFields(metadata: Record<string, unknown>): Record<string, unknown> {
  return {
    ...metadata,
    unified_intake_source: "datamoon",
  }
}

async function countLeadScopedRows(
  admin: SupabaseClient,
  table: string,
  leadId: string,
): Promise<number> {
  const { count, error } = await admin
    .schema("growth")
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("lead_id", leadId)
  if (error) throw new Error(`${table}:${error.message}`)
  return count ?? 0
}

async function fetchOutboundCounts(admin: SupabaseClient, leadId: string): Promise<OutboundCounts> {
  const [email, sequence, call, meeting, smsConversation] = await Promise.all([
    countLeadScopedRows(admin, "outbound_messages", leadId),
    countLeadScopedRows(admin, "sequence_enrollments", leadId),
    countLeadScopedRows(admin, "call_copilot_sessions", leadId),
    countLeadScopedRows(admin, "meeting_candidates", leadId),
    countLeadScopedRows(admin, "sms_conversations", leadId),
  ])
  const result: OutboundCounts = {
    email,
    sequence,
    call,
    sms: smsConversation,
    meeting,
    total: email + sequence + call + smsConversation + meeting,
  }
  return result
}

async function fetchApprovalPackageCount(admin: SupabaseClient, leadId: string): Promise<number> {
  const { count } = await admin
    .schema("growth")
    .from("autonomous_outreach_preparation_runs")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", leadId)
  return count ?? 0
}

function deploymentClassificationLive(sha: string): boolean {
  try {
    const src = execSync(`git show ${sha}:lib/growth/lead-inbox/lead-inbox-canonical-intake-bridge.ts`, {
      encoding: "utf8",
    })
    return src.includes('siteKey === "prospect_search_external_discovery") return "datamoon"')
  } catch {
    return false
  }
}

async function predictRepairOutcome(input: {
  admin: SupabaseClient
  lead: LeadRow
  admissionContext: GrowthLeadAdmissionContext
}): Promise<{
  researchCase: Pre1mRepairResearchCase
  predictedAdmissionState: string
  predictedReasons: string[]
  researchAction: string
  keywordValidationPass?: boolean
}> {
  const researchCase = resolveResearchCase(input.lead)
  const metadata = applyProvenanceFields(input.lead.metadata ?? {})
  const intake = buildGrowthLeadAdmissionIntakeFromLead({
    ...input.lead,
    metadata,
  })

  if (researchCase === "missing_or_incomplete") {
    const admission = evaluateGrowthLeadAdmission(intake, input.admissionContext, {
      prospectSearchIndustryGatePassed: metadata.prospect_search_industry_gate_passed === true,
    })
    return {
      researchCase,
      predictedAdmissionState: admission.state,
      predictedReasons: admission.reasons,
      researchAction: "await_scheduler_research",
    }
  }

  const run = await fetchLatestCompletedProspectResearchRun(input.admin, input.lead.id)
  if (!run) {
    const admission = evaluateGrowthLeadAdmission(intake, input.admissionContext)
    return {
      researchCase: "missing_or_incomplete",
      predictedAdmissionState: admission.state,
      predictedReasons: admission.reasons,
      researchAction: "await_scheduler_research",
    }
  }

  if (researchCase === "complete_with_keyword") {
    const keywordPass = metadata.operational_keyword_validation_pass === true
    const admission = evaluateGrowthLeadAdmission(intake, input.admissionContext, {
      operationalKeywordValidation: {
        pass: keywordPass,
        reason:
          typeof metadata.operational_keyword_validation_reason === "string"
            ? metadata.operational_keyword_validation_reason
            : null,
        matchedKeywords: Array.isArray(metadata.operational_keyword_validation_matched)
          ? metadata.operational_keyword_validation_matched.filter((v): v is string => typeof v === "string")
          : [],
        missingKeywords: Array.isArray(metadata.operational_keyword_validation_missing)
          ? metadata.operational_keyword_validation_missing.filter((v): v is string => typeof v === "string")
          : [],
      },
      prospectSearchIndustryGatePassed: metadata.prospect_search_industry_gate_passed === true,
    })
    return {
      researchCase,
      predictedAdmissionState: admission.state,
      predictedReasons: admission.reasons,
      researchAction: "reconcile_post_research_admission",
    }
  }

  if (researchCase === "complete_missing_keyword") {
    const evidenceBundle =
      (run?.signals?.companyEvidence_v22 as GrowthCompanyEvidenceBundle | undefined) ?? null
    const reconciliation = await predictPostResearchReconciliation({
      lead: input.lead,
      admissionContext: input.admissionContext,
      evidenceBundle,
    })
    return {
      researchCase,
      predictedAdmissionState: reconciliation.predictedAdmissionState,
      predictedReasons: reconciliation.predictedReasons,
      researchAction: "reconcile_post_research_admission",
      keywordValidationPass: reconciliation.keywordValidationPass,
    }
  }

  throw new Error(`unsupported_research_case:${researchCase}`)
}

async function predictPostResearchReconciliation(input: {
  lead: LeadRow
  admissionContext: GrowthLeadAdmissionContext
  evidenceBundle: GrowthCompanyEvidenceBundle | null
}): Promise<{
  predictedAdmissionState: string
  predictedReasons: string[]
  keywordValidationPass: boolean
}> {
  const metadata = applyProvenanceFields(input.lead.metadata ?? {})
  const intake = buildGrowthLeadAdmissionIntakeFromLead({
    ...input.lead,
    metadata,
  })
  const approvedProfile = input.admissionContext.approvedProfile
  if (!approvedProfile) {
    return { predictedAdmissionState: "review", predictedReasons: [], keywordValidationPass: false }
  }

  const datamoon =
    metadata.datamoon && typeof metadata.datamoon === "object"
      ? (metadata.datamoon as Record<string, unknown>)
      : {}
  const providerKeywords = Array.isArray(datamoon.provider_keywords)
    ? datamoon.provider_keywords.filter((value): value is string => typeof value === "string")
    : undefined
  const providerSignals = Array.isArray(datamoon.provider_signals)
    ? datamoon.provider_signals.filter((value): value is string => typeof value === "string")
    : undefined

  const validationInput = buildGrowthOperationalKeywordValidationInputFromResearch({
    companyName: input.lead.company_name,
    website: input.lead.website,
    industry: input.lead.industry ?? null,
    providerKeywords,
    providerSignals,
    websiteCrawlText: null,
    evidenceBundle: input.evidenceBundle,
    approvedProfile,
  })
  const keywordValidation = evaluateGrowthOperationalKeywordValidation(validationInput)
  const industryGatePassed =
    metadata.prospect_search_industry_gate_passed === true ||
    datamoon.prospect_search_industry_gate_passed === true ||
    evaluateExternalDiscoveryIndustryGateFromEvidence({
      companyName: input.lead.company_name,
      website: input.lead.website,
      industry: input.lead.industry ?? null,
      keywords: validationInput.providerKeywords,
      signals: validationInput.providerSignals,
      approvedProfile,
    })

  const admission = evaluateGrowthLeadAdmission(intake, input.admissionContext, {
    operationalKeywordValidation: keywordValidation,
    prospectSearchIndustryGatePassed: industryGatePassed,
  })

  return {
    predictedAdmissionState: admission.state,
    predictedReasons: admission.reasons,
    keywordValidationPass: keywordValidation.pass,
  }
}

async function applyRepairMutation(input: {
  admin: SupabaseClient
  lead: LeadRow
  admissionContext: GrowthLeadAdmissionContext
  actor: string
  generatedAt: string
}): Promise<Record<string, unknown>> {
  const previousMetadata =
    input.lead.metadata && typeof input.lead.metadata === "object" ? { ...input.lead.metadata } : {}
  const repairAudit = buildPre1mRepairAuditMetadata({
    previousMetadata,
    previousSourceKind: input.lead.source_kind,
    actor: input.actor,
    generatedAt: input.generatedAt,
  })

  const provenanceMetadata = applyProvenanceFields(previousMetadata)
  const researchCase = resolveResearchCase(input.lead)

  await updateGrowthLeadFromImportMerge(input.admin, input.lead.id, {
    source_kind: "import",
    metadata: {
      ...provenanceMetadata,
      ...repairAudit,
    },
  })

  const refreshed = await fetchGrowthLeadById(input.admin, input.lead.id)
  if (!refreshed) throw new Error(`lead_not_found_after_provenance_repair:${input.lead.id}`)

  if (researchCase === "missing_or_incomplete") {
    const intake = buildGrowthLeadAdmissionIntakeFromLead({
      id: refreshed.id,
      company_name: refreshed.companyName,
      contact_name: refreshed.contactName,
      contact_email: refreshed.contactEmail,
      website: refreshed.website,
      status: refreshed.status,
      metadata: refreshed.metadata ?? {},
      industry: refreshed.industry,
    })
    const admission = evaluateGrowthLeadAdmission(intake, input.admissionContext, {
      prospectSearchIndustryGatePassed:
        (refreshed.metadata?.prospect_search_industry_gate_passed as boolean | undefined) === true,
    })
    await updateGrowthLeadFromImportMerge(input.admin, input.lead.id, {
      metadata: {
        ...(refreshed.metadata ?? {}),
        ...buildLeadAdmissionMetadata(admission, input.generatedAt),
        admission_allow_auto_research: admission.allowAutoResearch,
      },
      status: admission.leadStatus,
    })
    const finalLead = await fetchGrowthLeadById(input.admin, input.lead.id)
    return {
      action: "provenance_and_admission_review",
      researchCase,
      finalAdmissionState: resolveLeadAdmissionStateFromMetadata(finalLead?.metadata),
      finalReasons: finalLead?.metadata?.admission_reasons ?? [],
      allowAutoResearch: admission.allowAutoResearch,
    }
  }

  const run = await fetchLatestCompletedProspectResearchRun(input.admin, input.lead.id)
  const evidenceBundle =
    (run?.signals?.companyEvidence_v22 as GrowthCompanyEvidenceBundle | undefined) ?? null

  const reconciliation = await reconcileExternalDiscoveryPostResearchAdmission({
    admin: input.admin,
    lead: refreshed,
    admissionContext: input.admissionContext,
    evidenceBundle,
    generatedAt: input.generatedAt,
  })

  const finalLead = await fetchGrowthLeadById(input.admin, input.lead.id)
  return {
    action: "provenance_and_post_research_reconciliation",
    researchCase,
    reconciliation,
    finalAdmissionState: resolveLeadAdmissionStateFromMetadata(finalLead?.metadata),
    finalReasons: finalLead?.metadata?.admission_reasons ?? [],
    keywordValidationPass: finalLead?.metadata?.operational_keyword_validation_pass ?? null,
  }
}

function leadInOrganizationScope(row: LeadRow, organizationId: string): boolean {
  return isLeadInPortfolioOrganizationScope(
    {
      promotedOrganizationId: row.promoted_organization_id,
      metadata: row.metadata ?? {},
      status: row.status ?? "new",
    },
    organizationId,
  )
}

export async function discoverPre1mExternalDiscoveryRepairCandidates(input: {
  admin: SupabaseClient
  organizationId: string
  deploymentCutoffIso: string
  leadIdOverride?: string | null
}): Promise<LeadRow[]> {
  if (input.leadIdOverride) {
    const { data, error } = await input.admin
      .schema("growth")
      .from("leads")
      .select(
        "id, company_name, contact_name, contact_email, website, status, source_kind, source_detail, promoted_organization_id, metadata, latest_prospect_research_run_id, last_prospect_researched_at, created_at",
      )
      .eq("id", input.leadIdOverride)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return []
    const row = data as LeadRow
    if (!leadInOrganizationScope(row, input.organizationId)) return []
    return [row]
  }

  const { data, error } = await input.admin
    .schema("growth")
    .from("leads")
    .select(
      "id, company_name, contact_name, contact_email, website, status, source_kind, source_detail, promoted_organization_id, metadata, latest_prospect_research_run_id, last_prospect_researched_at, created_at",
    )
    .lt("created_at", input.deploymentCutoffIso)
    .contains("metadata", { intake_site_key: "prospect_search_external_discovery" })
    .contains("metadata", { unified_intake_source: "saved_search" })
    .order("created_at", { ascending: true })

  if (error) throw new Error(error.message)

  return ((data ?? []) as LeadRow[]).filter((row) => {
    if (!leadInOrganizationScope(row, input.organizationId)) return false
    const metadata = row.metadata ?? {}
    const siteKey = readSiteKey(metadata)
    const unified =
      typeof metadata.unified_intake_source === "string" ? metadata.unified_intake_source : null
    return siteKey === "prospect_search_external_discovery" && unified === "saved_search"
  })
}

async function main() {
  const confirm = process.env[GE_AIOS_PRE_1M_EXTERNAL_DISCOVERY_REPAIR_CONFIRM_TOKEN] === "1"
  const leadIdOverride = process.env.CONFIRM_GE_AIOS_PRE_1M_EXTERNAL_DISCOVERY_REPAIR_1O_LEAD_ID?.trim() || null
  if (leadIdOverride && !confirm) {
    throw new Error("lead_id_override_requires_confirm_token")
  }

  const deployedSha = process.env.GE_AIOS_1M_DEPLOYED_SHA?.trim() || DEFAULT_DEPLOYED_SHA
  const deploymentCutoffIso =
    process.env.GE_AIOS_1M_DEPLOYMENT_CUTOFF_ISO?.trim() || DEFAULT_DEPLOYMENT_CUTOFF_ISO
  const organizationId = process.env.GE_AIOS_REPAIR_ORGANIZATION_ID?.trim() || EQUIPIFY_PRODUCTION_ORG_ID
  const actor = process.env.GE_AIOS_REPAIR_ACTOR?.trim() || "repair-ge-aios-pre-1m-external-discovery-admission-1o"
  const generatedAt = new Date().toISOString()

  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) throw new Error("bootstrap_failed")
  const admin = boot.admin

  const classificationLive = deploymentClassificationLive(deployedSha)
  const killSwitches = await getRuntimeKillSwitchStates(admin)
  if (!classificationLive) {
    console.log(
      JSON.stringify(
        {
          qaMarker: GE_AIOS_PRE_1M_EXTERNAL_DISCOVERY_ADMISSION_REPAIR_1O_QA_MARKER,
          verdict: "FAIL",
          blocker: "1m_classification_not_live_on_deployed_sha",
          deployedSha,
        },
        null,
        2,
      ),
    )
    process.exit(2)
  }

  if (killSwitches.autonomy_outbound_enabled) {
    console.log(
      JSON.stringify(
        {
          qaMarker: GE_AIOS_PRE_1M_EXTERNAL_DISCOVERY_ADMISSION_REPAIR_1O_QA_MARKER,
          verdict: "FAIL",
          blocker: "autonomy_outbound_enabled",
        },
        null,
        2,
      ),
    )
    process.exit(2)
  }

  const approved = await getActiveApprovedBusinessProfile(admin, organizationId)
  if (!approved?.profile) throw new Error("no_approved_profile")

  const admissionContext: GrowthLeadAdmissionContext = {
    approvedProfile: approved.profile,
    activeMissionTitle: null,
  }

  const candidates = await discoverPre1mExternalDiscoveryRepairCandidates({
    admin,
    organizationId,
    deploymentCutoffIso,
    leadIdOverride,
  })

  const inventory = []
  const actions = []

  for (const lead of candidates) {
    const metadata = lead.metadata ?? {}
    const alreadyRepaired =
      metadata.repair_qa_marker === GE_AIOS_PRE_1M_EXTERNAL_DISCOVERY_ADMISSION_REPAIR_1O_QA_MARKER
    const outboundCounts = await fetchOutboundCounts(admin, lead.id)
    const approvalPackages = await fetchApprovalPackageCount(admin, lead.id)
    const classification = classifyPre1mExternalDiscoveryRepairCandidate({
      lead,
      deploymentCutoffIso,
      outboundCounts,
      alreadyRepaired,
    })

    const researchCase = resolveResearchCase(lead)
    const prediction =
      classification === "repair_required"
        ? await predictRepairOutcome({ admin, lead, admissionContext })
        : null

    inventory.push({
      leadId: lead.id,
      companyName: lead.company_name,
      canonicalDomain: normalizeDomain(lead.website),
      createdAt: lead.created_at,
      sourceDetail: lead.source_detail,
      intakeSiteKey: readSiteKey(metadata),
      prospectSourceType: readProspectSourceType(metadata),
      unifiedIntakeSource: metadata.unified_intake_source ?? null,
      sourceKind: lead.source_kind,
      admissionState: resolveLeadAdmissionStateFromMetadata(metadata),
      admissionReasons: metadata.admission_reasons ?? [],
      latestResearchRunId: lead.latest_prospect_research_run_id,
      researchCase,
      keywordValidationPass: metadata.operational_keyword_validation_pass ?? null,
      outboundCounts,
      approvalPackages,
      classification,
      prediction,
    })

    if (classification !== "repair_required") {
      actions.push({ leadId: lead.id, action: "skip", classification })
      continue
    }

    if (alreadyRepaired && metadata.unified_intake_source === "datamoon") {
      actions.push({ leadId: lead.id, action: "skip", reason: "already_repaired_idempotent" })
      continue
    }

    if (!confirm) {
      actions.push({ leadId: lead.id, action: "would_repair", predicted: prediction })
      continue
    }

    const mutation = await applyRepairMutation({
      admin,
      lead,
      admissionContext,
      actor,
      generatedAt,
    })
    actions.push({ leadId: lead.id, action: "repaired", mutation })
  }

  console.log(
    JSON.stringify(
      {
        qaMarker: GE_AIOS_PRE_1M_EXTERNAL_DISCOVERY_ADMISSION_REPAIR_1O_QA_MARKER,
        mode: confirm ? "mutate" : "dry_run",
        deployment: {
          sha: deployedSha,
          cutoffIso: deploymentCutoffIso,
          classificationLive,
          productionUrl: "https://app.equipify.ai",
        },
        organizationId,
        outboundSafety: {
          autonomy_outbound_enabled: killSwitches.autonomy_outbound_enabled,
        },
        summary: {
          candidateCount: inventory.length,
          repairRequiredCount: inventory.filter((row) => row.classification === "repair_required").length,
          manualReviewCount: inventory.filter(
            (row) =>
              row.classification === "manual_review_required_outbound_history" ||
              row.classification === "manual_review_required_ambiguous_provenance",
          ).length,
        },
        inventory,
        actions,
      },
      null,
      2,
    ),
  )
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
