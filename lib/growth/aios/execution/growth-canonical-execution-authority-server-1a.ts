/**
 * GE-AIOS-EXECUTION-AUTHORITY-CLOSURE-1A — Server-side execution authority resolution.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveGrowthCanonicalDecisionForLeadCached } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1c-cache"
import {
  evaluateCanonicalExecutionAuthority,
  type GrowthCanonicalExecutionAuthorityResult,
  type GrowthCanonicalLeadLifecycleSnapshot,
} from "@/lib/growth/aios/execution/growth-canonical-execution-authority-1a"
import type { GrowthCanonicalExecutionActionKind } from "@/lib/growth/aios/execution/growth-canonical-execution-authority-action-policy-1a"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { fetchGrowthOpportunityByLeadId } from "@/lib/growth/opportunity-pipeline/pipeline-repository"
import { evaluateCanonicalRecipientSuppression } from "@/lib/growth/compliance/growth-canonical-suppression-read"
import type { GrowthLead } from "@/lib/growth/types"

export async function buildLeadLifecycleSnapshotForAuthority(
  admin: SupabaseClient,
  lead: GrowthLead,
): Promise<GrowthCanonicalLeadLifecycleSnapshot> {
  const opportunity = await fetchGrowthOpportunityByLeadId(admin, lead.id).catch(() => null)
  let suppressed = false
  let suppressionReason: string | null = null

  if (lead.contactEmail?.trim()) {
    const suppression = await evaluateCanonicalRecipientSuppression(admin, {
      email: lead.contactEmail,
      leadId: lead.id,
    }).catch(() => null)
    if (suppression?.suppressed) {
      suppressed = true
      suppressionReason = suppression.reason
    }
  }

  return {
    status: lead.status,
    archivedAt: (lead as { archivedAt?: string | null }).archivedAt ?? null,
    admissionState: (lead.metadata?.admission_state as string | undefined) ?? null,
    suppressed,
    suppressionReason,
    opportunityStage: opportunity?.stageKey ?? null,
    expansionWorkflowActive: Boolean(lead.metadata?.expansion_workflow_active),
  }
}

export async function evaluateCanonicalExecutionAuthorityForLead(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    actionKind: GrowthCanonicalExecutionActionKind
    explicitOperatorRequest?: boolean
    generatedAt?: string
    lead?: GrowthLead | null
    lifecycle?: GrowthCanonicalLeadLifecycleSnapshot
    bypassDecisionCache?: boolean
  },
): Promise<GrowthCanonicalExecutionAuthorityResult> {
  const generatedAt = input.generatedAt ?? new Date().toISOString()
  const lead = input.lead ?? (await fetchGrowthLeadById(admin, input.leadId))
  if (!lead) {
    return evaluateCanonicalExecutionAuthority({
      actionKind: input.actionKind,
      resolution: null,
      leadLifecycle: { status: "invalid", admissionState: "invalid" },
      explicitOperatorRequest: input.explicitOperatorRequest,
      generatedAt,
    })
  }

  const lifecycle = input.lifecycle ?? (await buildLeadLifecycleSnapshotForAuthority(admin, lead))
  const resolution = await resolveGrowthCanonicalDecisionForLeadCached(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    generatedAt,
    bypassCache: input.bypassDecisionCache === true,
  }).catch(() => null)

  return evaluateCanonicalExecutionAuthority({
    actionKind: input.actionKind,
    resolution,
    leadLifecycle: lifecycle,
    explicitOperatorRequest: input.explicitOperatorRequest,
    generatedAt,
  })
}

export async function recheckCanonicalExecutionAuthorityForLead(
  admin: SupabaseClient,
  input: Parameters<typeof evaluateCanonicalExecutionAuthorityForLead>[1],
): Promise<GrowthCanonicalExecutionAuthorityResult> {
  return evaluateCanonicalExecutionAuthorityForLead(admin, {
    ...input,
    bypassDecisionCache: true,
  })
}
