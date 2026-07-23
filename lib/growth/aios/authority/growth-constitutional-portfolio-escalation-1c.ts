/**
 * AVA-GROWTH-OPERATOR-1C — Client-safe constitutional escalation from portfolio lead metadata.
 * Used when full server hydration is unavailable — never escalates terminal rejects.
 */

import type { GrowthCanonicalOpportunityAuthorityMap } from "@/lib/growth/aios/authority/growth-canonical-opportunity-authority-types-1b"
import {
  evaluateCanonicalEscalation,
  isAutonomousTerminalRejectReason,
  type GrowthCanonicalEscalationDecision,
} from "@/lib/growth/aios/authority/growth-canonical-escalation-authority-1c"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import type { GrowthLead } from "@/lib/growth/types"

export const GROWTH_CONSTITUTIONAL_PORTFOLIO_ESCALATION_1C_QA_MARKER =
  "ava-growth-operator-1c-constitutional-portfolio-escalation-v1" as const

export type GrowthConstitutionalPortfolioEscalationMap = Record<string, GrowthCanonicalEscalationDecision>

function admissionReasonsFromLead(lead: GrowthLead): string[] {
  const metadata = lead.metadata
  if (!metadata || typeof metadata !== "object") return []
  const reasons = (metadata as { admission_reasons?: unknown }).admission_reasons
  if (!Array.isArray(reasons)) return []
  return reasons.filter((row): row is string => typeof row === "string")
}

export function buildConstitutionalEscalationMapFromPortfolioLeads(
  leads: GrowthLead[] | null | undefined,
): GrowthConstitutionalPortfolioEscalationMap {
  const map: GrowthConstitutionalPortfolioEscalationMap = {}
  for (const lead of leads ?? []) {
    if (!lead.id) continue
    const admissionState = resolveLeadAdmissionStateFromMetadata(lead.metadata)
    const terminalReasons = admissionReasonsFromLead(lead)
    const status = lead.status?.trim().toLowerCase() ?? ""

    map[lead.id] = evaluateCanonicalEscalation({
      requestKind:
        admissionState === "rejected" || status === "disqualified"
          ? "admission_terminal_reject"
          : "generic_operator_review",
      leadId: lead.id,
      signals: {
        admissionState,
        leadStatus: status,
        terminalRejectReasons: terminalReasons,
      },
    })
  }
  return map
}

export function shouldSuppressOperatorInterruptForLead(input: {
  leadId: string | null | undefined
  constitutionalMap: GrowthConstitutionalPortfolioEscalationMap
  authorityByLeadId?: GrowthCanonicalOpportunityAuthorityMap | null
}): boolean {
  if (!input.leadId) return false
  const authority = input.authorityByLeadId?.[input.leadId]
  if (authority?.executionState === "terminal" || authority?.nextAction === "disqualify") {
    return true
  }
  const constitutional = input.constitutionalMap[input.leadId]
  return constitutional?.interruptOperator === false && constitutional?.suppressionApplied === true
}

export function extractTerminalRejectReasonsFromLead(lead: GrowthLead): string[] {
  return admissionReasonsFromLead(lead).filter(isAutonomousTerminalRejectReason)
}
