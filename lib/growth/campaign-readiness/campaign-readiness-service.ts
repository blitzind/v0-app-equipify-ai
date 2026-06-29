/** Phase GS-2E — Campaign Readiness server service — server-only. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import {
  evaluateCampaignReadiness,
  type CampaignReadinessEngineInput,
} from "@/lib/growth/campaign-readiness/campaign-readiness-engine"
import {
  CAMPAIGN_READINESS_QA_MARKER,
  type CampaignReadinessAssessment,
  type CampaignReadinessAuditEvent,
  type CampaignReadinessSubjectType,
} from "@/lib/growth/campaign-readiness/campaign-readiness-types"
import { fetchHumanExecutionQueue } from "@/lib/growth/human-execution/human-execution-dashboard-repository"
import { listKnowledgeDocuments } from "@/lib/growth/knowledge-center/knowledge-repository"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { loadProspectExecutionPlanApproval } from "@/lib/growth/prospect-discovery/prospect-execution-certification"
import { buildProspectSearchEngineReadiness } from "@/lib/growth/prospect-search/prospect-search-engine-readiness"
import { loadProspectSearchContactIntelligenceBatch } from "@/lib/growth/prospect-search/prospect-search-contact-intelligence-loader"
import { isGrowthSignalFoundationSchemaReady } from "@/lib/growth/signals/signal-schema-health"
import type { GrowthSequencePattern } from "@/lib/growth/sequence-types"
import { isGrowthSequencePatternVoiceDropOperatorReady } from "@/lib/growth/sequences/sequence-voice-drop-pattern-readiness"

async function loadSequencePatterns(admin: SupabaseClient): Promise<GrowthSequencePattern[]> {
  const { data } = await admin
    .schema("growth")
    .from("sequence_patterns")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(50)
  return (data as GrowthSequencePattern[] | null) ?? []
}

async function loadAccountPlaybookExists(
  admin: SupabaseClient,
  leadId: string | null,
): Promise<boolean> {
  if (!leadId) return false
  try {
    const { data } = await admin
      .schema("growth")
      .from("account_playbooks")
      .select("id")
      .eq("growth_lead_id", leadId)
      .limit(1)
      .maybeSingle()
    return Boolean(data?.id)
  } catch {
    return false
  }
}

async function persistCampaignReadinessAudit(
  admin: SupabaseClient,
  input: {
    event_name: CampaignReadinessAuditEvent
    assessment: CampaignReadinessAssessment
    organization_id: string
    operator_id?: string | null
  },
): Promise<{ ok: boolean; audit_event_id?: string; error?: string }> {
  if (!(await isGrowthSignalFoundationSchemaReady(admin))) {
    return { ok: false, error: "schema_not_ready" }
  }

  const now = new Date().toISOString()
  const { data, error } = await admin
    .schema("growth")
    .from("signal_events")
    .insert({
      signal_id: null,
      organization_id: input.organization_id,
      event_type: input.event_name === "campaign_readiness_blocked" ? "routed" : "scored",
      event_payload: {
        qa_marker: CAMPAIGN_READINESS_QA_MARKER,
        event_name: input.event_name,
        campaign_readiness: true,
        assessment_id: input.assessment.assessment_id,
        lead_id: input.assessment.lead_id,
        execution_run_id: input.assessment.execution_run_id,
        readiness_score: input.assessment.readiness_score,
        readiness_status: input.assessment.readiness_status,
        blockers_count: input.assessment.blockers.length,
        recommendations_count: input.assessment.recommendations.length,
        assessment: input.assessment,
        operator_id: input.operator_id ?? null,
        occurred_at: now,
        requires_human_review: true,
        requires_human_approval: true,
        enrollment_enabled: false,
        outreach_enabled: false,
        autonomous_execution_enabled: false,
      },
      occurred_at: now,
    })
    .select("id")
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  return { ok: true, audit_event_id: data?.id as string | undefined }
}

async function loadReviewStatus(
  admin: SupabaseClient,
  assessment_id: string,
): Promise<"pending" | "reviewed"> {
  if (!(await isGrowthSignalFoundationSchemaReady(admin))) return "pending"

  const { data } = await admin
    .schema("growth")
    .from("signal_events")
    .select("id")
    .contains("event_payload", {
      qa_marker: CAMPAIGN_READINESS_QA_MARKER,
      event_name: "campaign_readiness_reviewed",
      assessment_id,
    })
    .limit(1)
    .maybeSingle()

  return data?.id ? "reviewed" : "pending"
}

async function buildEngineInput(
  admin: SupabaseClient,
  input: {
    subject_type: CampaignReadinessSubjectType
    subject_ref: string
    lead_id?: string | null
    execution_run_id?: string | null
    search_plan_id?: string | null
  },
): Promise<CampaignReadinessEngineInput> {
  const assessment_id = randomUUID()
  const lead_id = input.lead_id ?? (input.subject_type === "prospect" ? input.subject_ref : null)

  let company_name: string | null = null
  let is_suppressed = false

  if (lead_id) {
    const lead = await fetchGrowthLeadById(admin, lead_id).catch(() => null)
    company_name = lead?.companyName ?? null
    is_suppressed = Boolean((lead?.metadata as Record<string, unknown> | undefined)?.suppressed)
  }

  const contactIntelMap = lead_id
    ? await loadProspectSearchContactIntelligenceBatch(admin, [
        {
          id: lead_id,
          source_type: "growth_lead",
          growth_lead_id: lead_id,
          company_name: company_name ?? "Unknown",
          is_suppressed,
        },
      ]).catch(() => new Map())
    : new Map()

  const contactIntel = lead_id ? contactIntelMap.get(`growth_lead:${lead_id}`) ?? null : null
  const engine_readiness = contactIntel?.engine_readiness ??
    (lead_id
      ? buildProspectSearchEngineReadiness({
          company: {
            contact_intelligence: contactIntel ?? undefined,
            canonical_company_id: contactIntel?.canonical_company_id ?? null,
            is_suppressed,
          },
        })
      : null)

  const [patterns, knowledgeDocs, humanQueue, hasPlaybook, planApproval] = await Promise.all([
    loadSequencePatterns(admin).catch(() => [] as GrowthSequencePattern[]),
    listKnowledgeDocuments(admin, {
      organization_id: getGrowthEngineAiOrgId() ?? undefined,
      limit: 100,
    }).catch(() => []),
    fetchHumanExecutionQueue(admin).catch(() => ({ items: [] })),
    loadAccountPlaybookExists(admin, lead_id),
    input.search_plan_id
      ? loadProspectExecutionPlanApproval(admin, input.search_plan_id).catch(() => null)
      : Promise.resolve(null),
  ])

  const voiceDropReady = patterns.some(
    (p) => Array.isArray(p.steps) && isGrowthSequencePatternVoiceDropOperatorReady(p),
  )
  const pendingApprovals = (humanQueue.items ?? []).filter((item) => {
    const itemLeadId = "leadId" in item ? (item as { leadId?: string }).leadId : null
    return itemLeadId === lead_id || !lead_id
  }).length

  const sequence_readiness = contactIntel?.sequence_readiness ?? null

  const complianceEnabled =
    process.env.GROWTH_COMPLIANCE_ORCHESTRATION_ENABLED === "true" ||
    process.env.GROWTH_SMS_COMPLIANCE_ENABLED === "true"

  return {
    assessment_id,
    subject_type: input.subject_type,
    subject_ref: input.subject_ref,
    lead_id,
    company_name,
    execution_run_id: input.execution_run_id ?? null,
    engine_readiness,
    sequence_readiness,
    knowledge_document_count: knowledgeDocs.length,
    has_account_playbook: hasPlaybook,
    sequence_pattern_count: patterns.length,
    voice_drop_pattern_ready: voiceDropReady,
    is_suppressed,
    compliance_orchestration_enabled: complianceEnabled,
    human_approval_pending_count: pendingApprovals,
    execution_plan_approved: input.search_plan_id ? Boolean(planApproval?.approved_at) : undefined,
  }
}

export async function generateCampaignReadinessAssessment(
  admin: SupabaseClient,
  input: {
    subject_type: CampaignReadinessSubjectType
    subject_ref: string
    lead_id?: string | null
    execution_run_id?: string | null
    search_plan_id?: string | null
    persist_audit?: boolean
  },
): Promise<{ ok: boolean; assessment?: CampaignReadinessAssessment; error?: string }> {
  const organization_id = getGrowthEngineAiOrgId()
  if (!organization_id) {
    return { ok: false, error: "organization_id_required" }
  }

  try {
    const engineInput = await buildEngineInput(admin, input)
    const assessment = evaluateCampaignReadiness(engineInput)

    if (input.persist_audit !== false) {
      const eventName: CampaignReadinessAuditEvent =
        assessment.readiness_status === "not_ready"
          ? "campaign_readiness_blocked"
          : "campaign_readiness_generated"

      await persistCampaignReadinessAudit(admin, {
        event_name: eventName,
        assessment,
        organization_id,
      })
    }

    const review_status = await loadReviewStatus(admin, assessment.assessment_id)
    return {
      ok: true,
      assessment: { ...assessment, review_status },
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { ok: false, error: message }
  }
}

export async function loadCampaignReadinessAssessment(
  admin: SupabaseClient,
  input: {
    subject_type?: CampaignReadinessSubjectType
    subject_ref?: string
    lead_id?: string | null
    execution_run_id?: string | null
    search_plan_id?: string | null
  },
): Promise<{ ok: boolean; assessment?: CampaignReadinessAssessment; error?: string }> {
  const subject_type = input.subject_type ?? (input.lead_id ? "prospect" : "account")
  const subject_ref = input.subject_ref ?? input.lead_id ?? input.execution_run_id ?? "unknown"

  return generateCampaignReadinessAssessment(admin, {
    subject_type,
    subject_ref,
    lead_id: input.lead_id,
    execution_run_id: input.execution_run_id,
    search_plan_id: input.search_plan_id,
    persist_audit: false,
  })
}

export async function markCampaignReadinessReviewed(
  admin: SupabaseClient,
  input: {
    assessment_id: string
    assessment: CampaignReadinessAssessment
    operator_id?: string | null
  },
): Promise<{ ok: boolean; error?: string }> {
  const organization_id = getGrowthEngineAiOrgId()
  if (!organization_id) {
    return { ok: false, error: "organization_id_required" }
  }

  const reviewedAssessment: CampaignReadinessAssessment = {
    ...input.assessment,
    review_status: "reviewed",
  }

  const result = await persistCampaignReadinessAudit(admin, {
    event_name: "campaign_readiness_reviewed",
    assessment: reviewedAssessment,
    organization_id,
    operator_id: input.operator_id,
  })

  return result.ok ? { ok: true } : { ok: false, error: result.error }
}
