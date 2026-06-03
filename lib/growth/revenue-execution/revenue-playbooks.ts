/** Sprint 5 — deterministic revenue playbooks (decision support only, no automation). */

import {
  GROWTH_REVENUE_EXECUTION_QA_MARKER,
  GROWTH_REVENUE_PLAYBOOK_KEYS,
  type GrowthRevenuePlaybook,
  type GrowthRevenuePlaybookKey,
} from "@/lib/growth/revenue-execution/revenue-execution-types"

export type RevenuePlaybookResolutionInput = {
  signalTypes: string[]
  recommendationTypes: string[]
  classification?: string | null
  unresolvedObjectionCount: number
  commitmentCount: number
  engagementTrend: string | null
  relationshipStage: string | null
  hasCompetitiveSignal: boolean
  isExistingCustomer: boolean
}

const PLAYBOOKS: Record<GrowthRevenuePlaybookKey, Omit<GrowthRevenuePlaybook, "qaMarker">> = {
  meeting_requested: {
    key: "meeting_requested",
    title: "Meeting Requested",
    summary: "Prospect expressed meeting interest — coordinate human scheduling, do not auto-book.",
    recommendedActions: [
      { kind: "call", label: "Confirm agenda", description: "Human call to confirm attendees and goals." },
      { kind: "calendar", label: "Propose times", description: "Operator sends calendar options manually." },
    ],
    recommendedMessaging: [
      "Confirm who should join and what success looks like for the meeting.",
      "Offer two specific time windows rather than open-ended availability.",
    ],
    recommendedNextStep: "Schedule discovery or demo with confirmed stakeholders.",
    successCriteria: [
      "Meeting accepted on calendar",
      "Decision maker or champion confirmed",
      "Agenda documented in CRM notes",
    ],
  },
  pricing_requested: {
    key: "pricing_requested",
    title: "Pricing Requested",
    summary: "Pricing intent detected — validate scope before sharing numbers.",
    recommendedActions: [
      { kind: "discovery", label: "Qualify scope", description: "Human confirms fleet size, use case, and timeline." },
      { kind: "pricing", label: "Prepare quote", description: "Operator builds pricing with approved templates." },
    ],
    recommendedMessaging: [
      "Acknowledge pricing interest and confirm scope drivers before quoting.",
      "Reference prior commitments or objections from relationship memory.",
    ],
    recommendedNextStep: "Send pricing after scope validation — human approval required.",
    successCriteria: ["Scope documented", "Pricing sent by operator", "Next step scheduled"],
  },
  proposal_requested: {
    key: "proposal_requested",
    title: "Proposal Requested",
    summary: "Formal proposal signal — prepare human-reviewed proposal package.",
    recommendedActions: [
      { kind: "crm", label: "Review opportunity", description: "Operator creates or updates pipeline record manually." },
      { kind: "proposal", label: "Draft proposal", description: "Human prepares proposal; no auto-send." },
    ],
    recommendedMessaging: [
      "Confirm decision process, timeline, and evaluation criteria.",
      "Align proposal narrative to recorded buying signals and commitments.",
    ],
    recommendedNextStep: "Human creates opportunity and sends proposal after review.",
    successCriteria: ["Proposal delivered", "Evaluation timeline agreed", "Economic buyer identified"],
  },
  objection_recovery: {
    key: "objection_recovery",
    title: "Objection Recovery",
    summary: "Unresolved objections block advancement — address before pushing pipeline.",
    recommendedActions: [
      { kind: "research", label: "Review objection memory", description: "Operator reads recorded objections and prior responses." },
      { kind: "call", label: "Human follow-up", description: "Rep calls to address objection with evidence." },
    ],
    recommendedMessaging: [
      "Acknowledge the objection directly with evidence-backed response.",
      "Avoid repeating approaches flagged in relationship memory.",
    ],
    recommendedNextStep: "Resolve or document objection status before stage advancement.",
    successCriteria: ["Objection acknowledged", "Mitigation plan documented", "Re-engagement scheduled"],
  },
  re_engagement: {
    key: "re_engagement",
    title: "Re-Engagement",
    summary: "Engagement is cooling — human should re-open conversation with value.",
    recommendedActions: [
      { kind: "email", label: "Value-led outreach", description: "Operator sends personalized follow-up manually." },
      { kind: "call", label: "Check-in call", description: "Rep attempts call if phone available." },
    ],
    recommendedMessaging: [
      "Reference last meaningful interaction from memory.",
      "Lead with new value, not generic check-in language.",
    ],
    recommendedNextStep: "Human touch within 48 hours.",
    successCriteria: ["Reply or call connected", "Engagement trend stabilizes"],
  },
  competitive_threat: {
    key: "competitive_threat",
    title: "Competitive Threat",
    summary: "Competitive pressure detected — executive review recommended.",
    recommendedActions: [
      { kind: "review", label: "Competitive review", description: "Operator reviews differentiation and risk flags." },
      { kind: "call", label: "Strategic call", description: "Senior rep engages decision maker." },
    ],
    recommendedMessaging: [
      "Focus on differentiated outcomes, not feature comparisons alone.",
      "Document competitor mentions in CRM notes.",
    ],
    recommendedNextStep: "Human review before advancing stage or sending pricing.",
    successCriteria: ["Competitive positioning documented", "Decision criteria clarified"],
  },
  expansion_opportunity: {
    key: "expansion_opportunity",
    title: "Expansion Opportunity",
    summary: "Existing customer or strong relationship — explore expansion manually.",
    recommendedActions: [
      { kind: "research", label: "Account review", description: "Review usage, success metrics, and stakeholders." },
      { kind: "meeting", label: "QBR or expansion call", description: "Schedule human-led expansion conversation." },
    ],
    recommendedMessaging: [
      "Lead with customer outcomes and expansion use cases.",
      "Reference prior commitments and success from memory.",
    ],
    recommendedNextStep: "Human schedules expansion discussion.",
    successCriteria: ["Expansion use case identified", "Stakeholder map updated"],
  },
}

export function resolveRevenuePlaybook(input: RevenuePlaybookResolutionInput): GrowthRevenuePlaybook | null {
  const types = new Set(input.signalTypes)
  const recTypes = new Set(input.recommendationTypes)

  let key: GrowthRevenuePlaybookKey | null = null

  if (input.hasCompetitiveSignal || types.has("competitive_signal")) key = "competitive_threat"
  else if (input.unresolvedObjectionCount > 0) key = "objection_recovery"
  else if (types.has("proposal_request") || recTypes.has("create_opportunity")) key = "proposal_requested"
  else if (types.has("pricing_interest") || types.has("budget_signal") || input.classification === "budget")
    key = "pricing_requested"
  else if (types.has("meeting_interest") || input.classification === "meeting_intent") key = "meeting_requested"
  else if (input.isExistingCustomer || input.relationshipStage === "customer") key = "expansion_opportunity"
  else if (input.engagementTrend === "cooling" || input.engagementTrend === "declining")
    key = "re_engagement"

  if (!key) return null

  const template = PLAYBOOKS[key]
  return { ...template, qaMarker: GROWTH_REVENUE_EXECUTION_QA_MARKER }
}

export function listRevenuePlaybooks(): GrowthRevenuePlaybook[] {
  return GROWTH_REVENUE_PLAYBOOK_KEYS.map((key) => ({
    ...PLAYBOOKS[key],
    qaMarker: GROWTH_REVENUE_EXECUTION_QA_MARKER,
  }))
}
