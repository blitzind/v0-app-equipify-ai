/** Contact influence scoring + outreach sequencing — evidence-backed. Client-safe. */

import type { ProspectSearchRelationshipGraph } from "@/lib/growth/prospect-search/prospect-search-org-intelligence"
import type { ProspectSearchRevenuePersonaType } from "@/lib/growth/prospect-search/prospect-search-revenue-persona-intelligence"

export const GROWTH_CONTACT_INFLUENCE_QA_MARKER = "growth-contact-influence-v1" as const

export const CONTACT_INFLUENCE_TIERS = [
  "high_influence",
  "operational_authority",
  "gatekeeper",
  "moderate_influence",
  "low_influence",
  "unknown",
] as const

export type ProspectSearchContactInfluenceTier = (typeof CONTACT_INFLUENCE_TIERS)[number]

export type ProspectSearchContactInfluenceResult = {
  contact_id: string
  influence_score: number
  influence_tier: ProspectSearchContactInfluenceTier
  likely_department: string
  likely_influence_level: string
  relationship_cluster: string
  operational_authority_score: number
  communication_routing_likelihood: number
  influence_reasons: string[]
  influence_risks: string[]
  outreach_sequence_position: number | null
  sequencing_role: "first" | "follow_up" | "escalation" | "avoid" | "unlock" | null
  sequencing_note: string | null
}

export type ProspectSearchOutreachSequenceStep = {
  contact_id: string
  full_name: string | null
  persona_label: string
  sequence_order: number
  role: "first" | "follow_up" | "escalation" | "fallback" | "avoid"
  channel_hint: string | null
  reasoning: string
}

export type ProspectSearchAccountOutreachSequence = {
  qa_marker: typeof GROWTH_CONTACT_INFLUENCE_QA_MARKER
  sequence_summary: string | null
  likely_gatekeepers: string[]
  likely_approvers: string[]
  operational_influencers: string[]
  steps: ProspectSearchOutreachSequenceStep[]
}

type InfluenceContactInput = {
  contact_id: string
  full_name?: string | null
  title?: string | null
  persona_type: ProspectSearchRevenuePersonaType
  persona_label: string
  persona_icp_relevance: number
  persona_buying_influence: number
  persona_outreach_suitability: number
  operational_authority?: number
  outreach_rank_score: number
  priority_tier: string
  source_page_url?: string | null
  source_label?: string | null
  is_recommended_contact?: boolean
  in_revenue_queue?: boolean
  existing_prospect?: boolean
  relationship_strength_score?: number
  relationship_status?: string
}

function graphCentrality(contactId: string, graph: ProspectSearchRelationshipGraph | null): number {
  if (!graph) return 0
  const nodeId = `contact:${contactId}`
  const edgeCount = graph.edges.filter(
    (e) => e.from_id === nodeId || e.to_id === nodeId,
  ).length
  return Math.min(1, edgeCount / 6)
}

function sourceProminence(contact: InfluenceContactInput): number {
  const page = (contact.source_page_url ?? "").toLowerCase()
  let score = 0
  if (page.includes("leadership") || page.includes("team") || page.includes("about")) score += 0.15
  if ((contact.source_label ?? "").toLowerCase().includes("website")) score += 0.08
  return score
}

function resolveInfluenceTier(
  score: number,
  persona: ProspectSearchRevenuePersonaType,
): ProspectSearchContactInfluenceTier {
  if (persona === "dispatcher" && score >= 0.45) return "gatekeeper"
  if (score >= 0.78) return "high_influence"
  if (score >= 0.65) return "operational_authority"
  if (score >= 0.48) return "moderate_influence"
  if (score >= 0.3) return "low_influence"
  return "unknown"
}

function departmentFromPersona(persona: ProspectSearchRevenuePersonaType): string {
  if (["owner", "founder", "decision_maker", "branch_manager"].includes(persona)) return "leadership"
  if (["operations_manager", "service_manager", "dispatcher", "technician_lead"].includes(persona)) {
    return "operations"
  }
  if (persona === "administrator" || persona === "procurement") return "administration"
  if (persona === "sales_manager") return "sales"
  return "general"
}

export function computeContactInfluenceScore(input: {
  contact: InfluenceContactInput
  relationship_graph?: ProspectSearchRelationshipGraph | null
}): ProspectSearchContactInfluenceResult {
  const { contact, relationship_graph } = input
  const influence_reasons: string[] = []
  const influence_risks: string[] = []

  let score =
    contact.persona_buying_influence * 0.28 +
    (contact.operational_authority ?? contact.persona_outreach_suitability) * 0.2 +
    contact.persona_icp_relevance * 0.15 +
    contact.outreach_rank_score * 0.15

  score += graphCentrality(contact.contact_id, relationship_graph ?? null) * 0.1
  score += sourceProminence(contact)

  if (contact.is_recommended_contact) {
    score += 0.05
    influence_reasons.push("Account primary recommended contact")
  }
  if (contact.in_revenue_queue || contact.existing_prospect) {
    score += 0.04
    influence_reasons.push("Existing relationship in CRM or inbox")
  }
  if ((contact.relationship_strength_score ?? 0) >= 50) {
    score += Math.min(0.08, contact.relationship_strength_score! * 0.0008)
    if (contact.relationship_status === "engaged" || contact.relationship_status === "active") {
      influence_reasons.push("Engaged relationship history increases operational relevance")
    }
  }
  if (contact.relationship_status === "stalled" || contact.relationship_status === "disengaged") {
    score -= 0.05
    influence_risks.push("Stalled relationship — influence may not translate to responsiveness")
  }

  if (contact.persona_type === "owner" || contact.persona_type === "founder") {
    influence_reasons.push("Owner/founder title evidence")
  }
  if (contact.persona_type === "operations_manager" || contact.persona_type === "service_manager") {
    influence_reasons.push("Operational buyer persona for field service ICP")
  }
  if (contact.persona_type === "dispatcher") {
    influence_reasons.push("Dispatcher — likely operational gatekeeper")
    score += 0.03
  }
  if (contact.priority_tier === "blocked") {
    score = 0
    influence_risks.push("Blocked by compliance — no outreach influence actionable")
  }
  if (contact.persona_type === "unknown") {
    score -= 0.12
    influence_risks.push("Persona unclear — influence uncertain")
  }

  score = Number(Math.min(1, Math.max(0, score)).toFixed(3))
  const influence_tier = resolveInfluenceTier(score, contact.persona_type)
  const likely_department = departmentFromPersona(contact.persona_type)
  const communication_routing_likelihood =
    contact.persona_type === "dispatcher"
      ? 0.85
      : contact.persona_type === "administrator"
        ? 0.55
        : likely_department === "leadership"
          ? 0.45
          : 0.35

  return {
    contact_id: contact.contact_id,
    influence_score: score,
    influence_tier,
    likely_department,
    likely_influence_level:
      influence_tier === "high_influence"
        ? "high"
        : influence_tier === "operational_authority"
          ? "operational"
          : influence_tier === "gatekeeper"
            ? "gatekeeper"
            : influence_tier === "moderate_influence"
              ? "moderate"
              : "low",
    relationship_cluster: likely_department,
    operational_authority_score:
      contact.operational_authority ?? contact.persona_outreach_suitability,
    communication_routing_likelihood,
    influence_reasons: influence_reasons.slice(0, 4),
    influence_risks: influence_risks.slice(0, 3),
    outreach_sequence_position: null,
    sequencing_role: null,
    sequencing_note: null,
  }
}

export function buildProspectSearchAccountOutreachSequence(input: {
  contacts: Array<InfluenceContactInput & { influence: ProspectSearchContactInfluenceResult }>
  blocked_contact_ids?: string[]
}): ProspectSearchAccountOutreachSequence {
  const eligible = input.contacts
    .filter(
      (c) => c.priority_tier !== "blocked" && !input.blocked_contact_ids?.includes(c.contact_id),
    )
    .sort((a, b) => b.influence.influence_score - a.influence.influence_score)

  const steps: ProspectSearchOutreachSequenceStep[] = []
  const likely_gatekeepers: string[] = []
  const likely_approvers: string[] = []
  const operational_influencers: string[] = []

  for (const c of input.contacts) {
    if (c.influence.influence_tier === "gatekeeper") {
      likely_gatekeepers.push(c.full_name ?? c.persona_label)
    }
    if (
      c.persona_type === "owner" ||
      c.persona_type === "founder" ||
      c.persona_type === "decision_maker"
    ) {
      likely_approvers.push(c.full_name ?? c.persona_label)
    }
    if (
      c.influence.influence_tier === "operational_authority" ||
      c.influence.influence_tier === "high_influence"
    ) {
      if (departmentFromPersona(c.persona_type) === "operations") {
        operational_influencers.push(c.full_name ?? c.persona_label)
      }
    }
  }

  const first = eligible.find((c) => c.influence.influence_tier !== "gatekeeper") ?? eligible[0]
  const escalation = eligible.find(
    (c) =>
      c.contact_id !== first?.contact_id &&
      (c.persona_type === "owner" || c.persona_type === "founder"),
  )

  if (first) {
    steps.push({
      contact_id: first.contact_id,
      full_name: first.full_name ?? null,
      persona_label: first.persona_label,
      sequence_order: 1,
      role: "first",
      channel_hint: first.is_recommended_contact ? "Use account recommended channel" : null,
      reasoning: `Start with ${first.persona_label} — ${first.influence.influence_reasons[0] ?? "highest influence score"}`,
    })
  }

  const followUp = eligible.find(
    (c) => c.contact_id !== first?.contact_id && c.influence.influence_tier !== "gatekeeper",
  )
  if (followUp) {
    steps.push({
      contact_id: followUp.contact_id,
      full_name: followUp.full_name ?? null,
      persona_label: followUp.persona_label,
      sequence_order: 2,
      role: "follow_up",
      channel_hint: null,
      reasoning: `Follow with ${followUp.persona_label} as backup outreach path`,
    })
  }

  if (escalation) {
    steps.push({
      contact_id: escalation.contact_id,
      full_name: escalation.full_name ?? null,
      persona_label: escalation.persona_label,
      sequence_order: 3,
      role: "escalation",
      channel_hint: null,
      reasoning: `Escalate to ${escalation.persona_label} if operational contact unresponsive`,
    })
  }

  for (const blockedId of input.blocked_contact_ids ?? []) {
    const blocked = input.contacts.find((c) => c.contact_id === blockedId)
    if (blocked) {
      steps.push({
        contact_id: blocked.contact_id,
        full_name: blocked.full_name ?? null,
        persona_label: blocked.persona_label,
        sequence_order: 99,
        role: "avoid",
        channel_hint: null,
        reasoning: blocked.influence.influence_risks[0] ?? "Compliance blocked — do not outreach",
      })
    }
  }

  let sequence_summary: string | null = null
  if (first && escalation) {
    sequence_summary = `Start with ${first.persona_label}, escalate to ${escalation.persona_label}`
  } else if (first) {
    sequence_summary = `Start with ${first.full_name ?? first.persona_label} (${first.persona_label})`
  }
  if (likely_gatekeepers.length > 0) {
    sequence_summary = `${sequence_summary ?? "Outreach sequence"} · ${likely_gatekeepers[0]} likely gatekeeper`
  }

  return {
    qa_marker: GROWTH_CONTACT_INFLUENCE_QA_MARKER,
    sequence_summary,
    likely_gatekeepers: likely_gatekeepers.slice(0, 3),
    likely_approvers: likely_approvers.slice(0, 3),
    operational_influencers: operational_influencers.slice(0, 3),
    steps,
  }
}

export function applyInfluenceSequencingToContacts<
  T extends ProspectSearchContactInfluenceResult,
>(contacts: T[]): T[] {
  const sorted = [...contacts].sort((a, b) => b.influence_score - a.influence_score)
  return contacts.map((contact) => {
    const order = sorted.findIndex((c) => c.contact_id === contact.contact_id)
    const rank = order >= 0 ? order + 1 : null
    let sequencing_role = contact.sequencing_role
    let sequencing_note = contact.sequencing_note
    if (contact.influence_tier === "gatekeeper") {
      sequencing_role = "unlock"
      sequencing_note = "May gatekeep operational access — not always first outreach target"
    } else if (rank === 1) {
      sequencing_role = "first"
      sequencing_note = "Highest influence score in account"
    } else if (rank === 2) {
      sequencing_role = "follow_up"
      sequencing_note = "Secondary outreach sequence position"
    } else if (contact.influence_tier === "high_influence" && (rank ?? 99) <= 3) {
      sequencing_role = "escalation"
      sequencing_note = "Escalation path if primary contact unresponsive"
    }
    return {
      ...contact,
      outreach_sequence_position: rank,
      sequencing_role,
      sequencing_note,
    }
  })
}
