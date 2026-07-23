/** AVA-GROWTH-OPERATOR-1F — Gate Human Approval Center items through canonical escalation. */

import { evaluateCanonicalEscalation } from "@/lib/growth/aios/authority/growth-canonical-escalation-authority-1c"
import type { GrowthCanonicalOpportunityAuthorityMap } from "@/lib/growth/aios/authority/growth-canonical-opportunity-authority-types-1b"
import type { GrowthHumanApprovalItem } from "@/lib/growth/aios/approvals/growth-human-approval-center-types"

export const GROWTH_HAC_ESCALATION_GATE_1F_QA_MARKER =
  "ava-growth-operator-1f-hac-escalation-gate-v1" as const

const LEAD_SCOPED_SOURCES = new Set([
  "revenue_operator",
  "meta_recommender",
  "priority_engine",
  "bounded_autonomous_outbound",
])

function resolveEscalationRequestKind(item: GrowthHumanApprovalItem): Parameters<
  typeof evaluateCanonicalEscalation
>[0]["requestKind"] {
  if (
    item.actionType === "send_email" ||
    item.actionType === "send_sms" ||
    item.actionType === "place_call" ||
    item.actionType === "approve_outreach_package"
  ) {
    return "outbound_send_ready"
  }
  if (item.actionType === "review_recommendation") {
    if (item.source === "meta_recommender") {
      return "meta_recommender_advisory"
    }
    if (item.source === "revenue_operator") {
      return "prepare_outreach"
    }
  }
  if (item.source === "revenue_operator") {
    return "generic_operator_review"
  }
  return "generic_operator_review"
}

export function filterHumanApprovalItemsThroughCanonicalEscalation(input: {
  items: GrowthHumanApprovalItem[]
  canonicalAuthorityByLeadId?: GrowthCanonicalOpportunityAuthorityMap | null
}): GrowthHumanApprovalItem[] {
  const authorityMap = input.canonicalAuthorityByLeadId ?? null
  if (!authorityMap) return input.items

  return input.items.filter((item) => {
    if (item.subjectType !== "lead" || !item.subjectId) {
      return true
    }
    if (!LEAD_SCOPED_SOURCES.has(item.source)) {
      return true
    }

    const authority = authorityMap[item.subjectId] ?? null
    const escalation = evaluateCanonicalEscalation({
      requestKind: resolveEscalationRequestKind(item),
      leadId: item.subjectId,
      opportunityAuthority: authority,
      signals: {
        sendReady:
          item.actionType === "send_email" ||
          item.actionType === "send_sms" ||
          item.actionType === "place_call" ||
          item.actionType === "approve_outreach_package",
        prepOnly: item.actionType === "review_recommendation",
      },
    })

    return escalation.interruptOperator
  })
}
