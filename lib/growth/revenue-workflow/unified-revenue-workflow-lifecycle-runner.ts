/**
 * GE-LAUNCH-1C — Lifecycle re-evaluation after material lead intelligence changes.
 * Debounces rapid events and re-runs the existing unified revenue workflow without
 * creating duplicate leads, contacts, queue rows, or outbound execution.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId, logGrowthEngine } from "@/lib/growth/access"
import { resolveCompanyCandidateContext } from "@/lib/growth/contact-discovery/contact-repository"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import type { GrowthLead } from "@/lib/growth/types"
import { normalizeLeadIntakeSource } from "@/lib/growth/revenue-workflow/normalize-lead-intake-source"
import {
  GROWTH_UNIFIED_REVENUE_WORKFLOW_LIFECYCLE_QA_MARKER,
  mergeMaterialLeadChangeEvents,
  type MaterialLeadChangeEvent,
} from "@/lib/growth/revenue-workflow/unified-revenue-workflow-lifecycle-types"
import type { LeadIntakeSource } from "@/lib/growth/revenue-workflow/unified-lead-intake-types"
import { isUnifiedRevenueWorkflowEnabled } from "@/lib/growth/revenue-workflow/unified-revenue-workflow-feature"
import { runUnifiedRevenueWorkflow } from "@/lib/growth/revenue-workflow/unified-revenue-workflow-orchestrator"
import type { UnifiedRevenueWorkflowResult } from "@/lib/growth/revenue-workflow/unified-lead-intake-types"

const DEFAULT_LIFECYCLE_RE_EVAL_DEBOUNCE_MS = 3000

type PendingLifecycleState = {
  timer: ReturnType<typeof setTimeout> | null
  events: Set<MaterialLeadChangeEvent>
  input: Omit<ScheduleUnifiedRevenueWorkflowLifecycleReEvaluationInput, "event" | "immediate">
}

const pendingByLeadId = new Map<string, PendingLifecycleState>()
let debounceWindowMsOverride: number | null = null

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function resolveLeadIntakeSourceFromLead(lead: GrowthLead): LeadIntakeSource {
  const detail = asString(lead.sourceDetail).toLowerCase()
  if (detail.includes("apollo")) return "apollo"
  if (detail.includes("pdl") || detail.includes("people_data_labs")) return "pdl"
  if (detail.includes("csv") || lead.sourceKind === "import") return "csv_import"
  if (detail.includes("linkedin")) return "linkedin_capture"
  if (detail.includes("saved_search")) return "saved_search"
  if (detail.includes("website")) return "website"
  if (lead.sourceKind === "browser_extension") return "browser_intake"
  if (lead.sourceKind === "acquisition") return "apollo"
  return "manual"
}

export type UnifiedRevenueWorkflowLifecycleRunResult = {
  qa_marker: typeof GROWTH_UNIFIED_REVENUE_WORKFLOW_LIFECYCLE_QA_MARKER
  workflow: UnifiedRevenueWorkflowResult | null
  skipped: boolean
  skipReason?: string
  events: MaterialLeadChangeEvent[]
  dryRun?: boolean
}

export type ScheduleUnifiedRevenueWorkflowLifecycleReEvaluationInput = {
  admin: SupabaseClient
  leadId: string
  event: MaterialLeadChangeEvent
  organizationId?: string
  actor?: { userId: string | null; email?: string | null }
  immediate?: boolean
  dryRun?: boolean
}

export type RunUnifiedRevenueWorkflowLifecycleReEvaluationInput = {
  admin: SupabaseClient
  leadId: string
  events: MaterialLeadChangeEvent[]
  organizationId?: string
  actor?: { userId: string | null; email?: string | null }
  dryRun?: boolean
}

export function getUnifiedRevenueWorkflowLifecycleDebounceWindowMs(): number {
  return debounceWindowMsOverride ?? DEFAULT_LIFECYCLE_RE_EVAL_DEBOUNCE_MS
}

export function configureUnifiedRevenueWorkflowLifecycleDebounceForTests(ms: number | null): void {
  debounceWindowMsOverride = ms
}

export function resetUnifiedRevenueWorkflowLifecycleDebounceForTests(): void {
  for (const state of pendingByLeadId.values()) {
    if (state.timer) clearTimeout(state.timer)
  }
  pendingByLeadId.clear()
  debounceWindowMsOverride = null
}

export async function resolveGrowthLeadIdForCompanyCandidate(
  admin: SupabaseClient,
  companyCandidateId: string,
): Promise<string | null> {
  const ctx = await resolveCompanyCandidateContext(admin, companyCandidateId)
  return ctx?.growth_lead_id ?? null
}

export async function resolveGrowthLeadIdForCanonicalCompany(
  admin: SupabaseClient,
  canonicalCompanyId: string,
): Promise<string | null> {
  const { data } = await admin
    .schema("growth")
    .from("person_company_roles")
    .select("growth_lead_id")
    .eq("company_id", canonicalCompanyId)
    .not("growth_lead_id", "is", null)
    .limit(1)
    .maybeSingle()

  return typeof data?.growth_lead_id === "string" ? data.growth_lead_id : null
}

export async function scheduleUnifiedRevenueWorkflowLifecycleReEvaluation(
  input: ScheduleUnifiedRevenueWorkflowLifecycleReEvaluationInput,
): Promise<{ scheduled: boolean; skipReason?: string }> {
  const leadId = asString(input.leadId)
  if (!leadId) return { scheduled: false, skipReason: "lead_id_required" }
  if (!isUnifiedRevenueWorkflowEnabled()) return { scheduled: false, skipReason: "disabled" }

  if (input.immediate) {
    await runUnifiedRevenueWorkflowLifecycleReEvaluation({
      admin: input.admin,
      leadId,
      events: [input.event],
      organizationId: input.organizationId,
      actor: input.actor,
      dryRun: input.dryRun,
    })
    return { scheduled: true }
  }

  const existing = pendingByLeadId.get(leadId)
  if (existing) {
    mergeMaterialLeadChangeEvents(existing.events, input.event)
    if (existing.timer) clearTimeout(existing.timer)
    existing.timer = setTimeout(() => {
      void flushUnifiedRevenueWorkflowLifecycleReEvaluation(leadId)
    }, getUnifiedRevenueWorkflowLifecycleDebounceWindowMs())
    return { scheduled: true }
  }

  const state: PendingLifecycleState = {
    timer: null,
    events: new Set([input.event]),
    input: {
      admin: input.admin,
      leadId,
      organizationId: input.organizationId,
      actor: input.actor,
      dryRun: input.dryRun,
    },
  }
  state.timer = setTimeout(() => {
    void flushUnifiedRevenueWorkflowLifecycleReEvaluation(leadId)
  }, getUnifiedRevenueWorkflowLifecycleDebounceWindowMs())
  pendingByLeadId.set(leadId, state)
  return { scheduled: true }
}

export async function scheduleUnifiedRevenueWorkflowLifecycleReEvaluationForCompanyCandidate(
  input: Omit<ScheduleUnifiedRevenueWorkflowLifecycleReEvaluationInput, "leadId"> & {
    companyCandidateId: string
  },
): Promise<{ scheduled: boolean; skipReason?: string }> {
  const leadId = await resolveGrowthLeadIdForCompanyCandidate(input.admin, input.companyCandidateId)
  if (!leadId) return { scheduled: false, skipReason: "lead_not_linked" }
  return scheduleUnifiedRevenueWorkflowLifecycleReEvaluation({
    ...input,
    leadId,
  })
}

export async function scheduleUnifiedRevenueWorkflowLifecycleReEvaluationForCanonicalCompany(
  input: Omit<ScheduleUnifiedRevenueWorkflowLifecycleReEvaluationInput, "leadId"> & {
    canonicalCompanyId: string
  },
): Promise<{ scheduled: boolean; skipReason?: string }> {
  const leadId = await resolveGrowthLeadIdForCanonicalCompany(input.admin, input.canonicalCompanyId)
  if (!leadId) return { scheduled: false, skipReason: "lead_not_linked" }
  return scheduleUnifiedRevenueWorkflowLifecycleReEvaluation({
    ...input,
    leadId,
  })
}

async function flushUnifiedRevenueWorkflowLifecycleReEvaluation(
  leadId: string,
): Promise<UnifiedRevenueWorkflowLifecycleRunResult | null> {
  const state = pendingByLeadId.get(leadId)
  if (!state) return null
  if (state.timer) clearTimeout(state.timer)
  pendingByLeadId.delete(leadId)

  return runUnifiedRevenueWorkflowLifecycleReEvaluation({
    admin: state.input.admin,
    leadId: state.input.leadId,
    events: [...state.events],
    organizationId: state.input.organizationId,
    actor: state.input.actor,
    dryRun: state.input.dryRun,
  })
}

export async function flushUnifiedRevenueWorkflowLifecycleReEvaluationForTests(
  leadId: string,
): Promise<UnifiedRevenueWorkflowLifecycleRunResult | null> {
  return flushUnifiedRevenueWorkflowLifecycleReEvaluation(leadId)
}

export async function runUnifiedRevenueWorkflowLifecycleReEvaluation(
  input: RunUnifiedRevenueWorkflowLifecycleReEvaluationInput,
): Promise<UnifiedRevenueWorkflowLifecycleRunResult> {
  const events = [...new Set(input.events)]
  const leadId = asString(input.leadId)

  if (!leadId) {
    return {
      qa_marker: GROWTH_UNIFIED_REVENUE_WORKFLOW_LIFECYCLE_QA_MARKER,
      workflow: null,
      skipped: true,
      skipReason: "lead_id_required",
      events,
    }
  }

  if (!isUnifiedRevenueWorkflowEnabled()) {
    return {
      qa_marker: GROWTH_UNIFIED_REVENUE_WORKFLOW_LIFECYCLE_QA_MARKER,
      workflow: null,
      skipped: true,
      skipReason: "unified_revenue_workflow_disabled",
      events,
    }
  }

  if (input.dryRun) {
    logGrowthEngine("unified_revenue_workflow_lifecycle_dry_run", { leadId, events })
    return {
      qa_marker: GROWTH_UNIFIED_REVENUE_WORKFLOW_LIFECYCLE_QA_MARKER,
      workflow: null,
      skipped: false,
      events,
      dryRun: true,
    }
  }

  const lead = await fetchGrowthLeadById(input.admin, leadId)
  if (!lead) {
    return {
      qa_marker: GROWTH_UNIFIED_REVENUE_WORKFLOW_LIFECYCLE_QA_MARKER,
      workflow: null,
      skipped: true,
      skipReason: "lead_not_found",
      events,
    }
  }

  const intake = normalizeLeadIntakeSource({
    source: resolveLeadIntakeSourceFromLead(lead),
    company: {
      name: lead.companyName,
      website: lead.website,
      companyId: lead.id,
    },
    contact: {
      name: lead.contactName,
      email: lead.contactEmail,
      phone: lead.contactPhone,
      contactId: lead.primaryDecisionMakerId,
    },
    metadata: {
      leadId: lead.id,
      externalRef: lead.externalRef,
      lifecycleReEvaluation: true,
      lifecycleEvents: events,
    },
  })

  try {
    const workflow = await runUnifiedRevenueWorkflow({
      admin: input.admin,
      organizationId: input.organizationId ?? getGrowthEngineAiOrgId(),
      actor: input.actor,
      intake,
      skipLeadPersistence: true,
    })

    logGrowthEngine("unified_revenue_workflow_lifecycle_reevaluated", {
      leadId: lead.id,
      events,
      approvalRequired: workflow.approvalRequired,
      blockers: workflow.blockers.length,
    })

    return {
      qa_marker: GROWTH_UNIFIED_REVENUE_WORKFLOW_LIFECYCLE_QA_MARKER,
      workflow,
      skipped: false,
      events,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "workflow_failed"
    logGrowthEngine("unified_revenue_workflow_lifecycle_failed", {
      leadId: lead.id,
      events,
      message,
    })
    return {
      qa_marker: GROWTH_UNIFIED_REVENUE_WORKFLOW_LIFECYCLE_QA_MARKER,
      workflow: null,
      skipped: true,
      skipReason: message,
      events,
    }
  }
}

export { mergeMaterialLeadChangeEvents } from "@/lib/growth/revenue-workflow/unified-revenue-workflow-lifecycle-types"
