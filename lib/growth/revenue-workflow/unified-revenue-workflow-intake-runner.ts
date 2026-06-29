/**
 * GE-LAUNCH-1B — Shared post-intake unified revenue workflow runner.
 * Call after any surface creates or promotes a growth.leads row.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId, logGrowthEngine } from "@/lib/growth/access"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { normalizeLeadIntakeSource } from "@/lib/growth/revenue-workflow/normalize-lead-intake-source"
import {
  importRowToIntakeContact,
  resolveAcquisitionContactIntakeSource,
  resolveBrowserIntakeLeadSource,
  workflowResultNeedsReview,
} from "@/lib/growth/revenue-workflow/unified-revenue-workflow-intake-mapping"
import { isUnifiedRevenueWorkflowEnabled } from "@/lib/growth/revenue-workflow/unified-revenue-workflow-feature"
import { runUnifiedRevenueWorkflow } from "@/lib/growth/revenue-workflow/unified-revenue-workflow-orchestrator"
import type {
  LeadIntakeSource,
  UnifiedLeadIntakeCompanyInput,
  UnifiedLeadIntakeContactInput,
  UnifiedLeadIntakeMetadataInput,
  UnifiedRevenueWorkflowResult,
} from "@/lib/growth/revenue-workflow/unified-lead-intake-types"

export {
  importRowToIntakeContact,
  resolveAcquisitionContactIntakeSource,
  resolveBrowserIntakeLeadSource,
  workflowResultNeedsReview,
} from "@/lib/growth/revenue-workflow/unified-revenue-workflow-intake-mapping"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export type UnifiedRevenueWorkflowIntakeRunResult = {
  workflow: UnifiedRevenueWorkflowResult | null
  skipped: boolean
  skipReason?: string
}

export type RunUnifiedRevenueWorkflowAfterIntakeInput = {
  admin: SupabaseClient
  organizationId?: string
  actor?: { userId: string | null; email?: string | null }
  source: LeadIntakeSource
  leadId?: string | null
  company?: UnifiedLeadIntakeCompanyInput
  contact?: UnifiedLeadIntakeContactInput
  metadata?: UnifiedLeadIntakeMetadataInput
}

export async function runUnifiedRevenueWorkflowAfterIntake(
  input: RunUnifiedRevenueWorkflowAfterIntakeInput,
): Promise<UnifiedRevenueWorkflowIntakeRunResult> {
  if (!isUnifiedRevenueWorkflowEnabled()) {
    return { workflow: null, skipped: true, skipReason: "unified_revenue_workflow_disabled" }
  }

  const leadId = asString(input.leadId)
  let lead = leadId ? await fetchGrowthLeadById(input.admin, leadId) : null
  if (leadId && !lead) {
    return { workflow: null, skipped: true, skipReason: "lead_not_found" }
  }

  const intake = normalizeLeadIntakeSource({
    source: input.source,
    company: {
      name: input.company?.name ?? lead?.companyName,
      website: input.company?.website ?? lead?.website,
      domain: input.company?.domain ?? null,
      industry: input.company?.industry ?? null,
      companyId: input.company?.companyId ?? null,
    },
    contact: {
      name: input.contact?.name ?? lead?.contactName,
      firstName: input.contact?.firstName ?? null,
      lastName: input.contact?.lastName ?? null,
      title: input.contact?.title ?? null,
      email: input.contact?.email ?? lead?.contactEmail,
      phone: input.contact?.phone ?? lead?.contactPhone,
      linkedinUrl: input.contact?.linkedinUrl ?? null,
      personId: input.contact?.personId ?? null,
      contactId: input.contact?.contactId ?? null,
    },
    metadata: {
      ...(input.metadata ?? {}),
      leadId: leadId || null,
      externalRef: input.metadata?.externalRef ?? lead?.externalRef,
    },
  })

  if (!lead && intake.blockers.includes("company_name_required")) {
    return { workflow: null, skipped: true, skipReason: "company_name_required" }
  }

  try {
    const workflow = await runUnifiedRevenueWorkflow({
      admin: input.admin,
      organizationId: input.organizationId ?? getGrowthEngineAiOrgId(),
      actor: input.actor,
      intake,
    })

    logGrowthEngine("unified_revenue_workflow_intake_wired", {
      leadId: workflow.leadId ?? leadId ?? null,
      source: input.source,
      approvalRequired: workflow.approvalRequired,
      blockers: workflow.blockers.length,
    })

    return { workflow, skipped: false }
  } catch (error) {
    const message = error instanceof Error ? error.message : "workflow_failed"
    logGrowthEngine("unified_revenue_workflow_intake_failed", {
      leadId: leadId || null,
      source: input.source,
      message,
    })
    return { workflow: null, skipped: true, skipReason: message }
  }
}
