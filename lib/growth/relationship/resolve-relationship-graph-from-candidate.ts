/** GE-AIOS-15B — Project decision candidates into canonical relationship graph context. */

import type { GrowthRelationshipStage } from "@/lib/growth/lead-memory/memory-types"
import type { DecisionCandidate } from "@/lib/growth/decision-engine/types"
import {
  parseConversationThreadIdFromHref,
  parseLeadIdFromHref,
  parseLeadIdFromSourceId,
  parseOpportunityIdFromHref,
  parsePersonIdFromHref,
} from "@/lib/growth/relationship/parse-relationship-graph-refs"
import { enrichRelationshipGraphWithSnapshot } from "@/lib/growth/relationship/project-relationship-graph-enrichment"
import type { RelationshipLeadSnapshot } from "@/lib/growth/relationship/relationship-lead-snapshot-types"
import {
  buildRelationshipGraphContext,
  type AvaRelationshipGraphContext,
} from "@/lib/growth/relationship/relationship-graph-types"

function inferRelationshipStage(candidate: DecisionCandidate): GrowthRelationshipStage | null {
  if (candidate.readyForOutreach) return "evaluating"
  if (candidate.qualificationComplete) return "engaged"
  if (candidate.hotCompany) return "engaged"
  if (candidate.kind === "review_reply") return "engaged"
  if (candidate.kind === "meeting_prep") return "evaluating"
  if (candidate.kind === "research_company") return "aware"
  if (candidate.kind === "continue_qualification") return "aware"
  return null
}

function inferCommitteeRole(candidate: DecisionCandidate): string | null {
  const blob = `${candidate.title} ${candidate.detail ?? ""}`.toLowerCase()
  if (/economic buyer|cfo|procurement/.test(blob)) return "economic_buyer"
  if (/technical buyer|cto|engineer/.test(blob)) return "technical_buyer"
  if (/champion/.test(blob)) return "champion"
  if (/decision maker|decision-maker/.test(blob)) return "decision_maker"
  if (/influencer|stakeholder/.test(blob)) return "influencer"
  return null
}

export function resolveRelationshipGraphFromCandidate(
  candidate: DecisionCandidate,
  options: {
    organization_id?: string | null
    canonical_company_id?: string | null
    company_id?: string | null
    person_id?: string | null
    relationship_stage?: GrowthRelationshipStage | null
    memory_context_available?: boolean
    business_intelligence_context_available?: boolean
    decision_score?: number | null
    snapshot?: RelationshipLeadSnapshot | null
  } = {},
): AvaRelationshipGraphContext {
  const lead_id =
    parseLeadIdFromSourceId(candidate.id) ??
    parseLeadIdFromHref(candidate.href) ??
    options.snapshot?.lead_id ??
    null
  const person_id = options.person_id ?? parsePersonIdFromHref(candidate.href)
  const conversation_thread_id =
    options.snapshot?.latest_conversation_thread_id ??
    parseConversationThreadIdFromHref(candidate.href)
  const opportunity_id = parseOpportunityIdFromHref(candidate.href)

  const base = buildRelationshipGraphContext({
    organization_id: options.organization_id ?? null,
    lead_id,
    canonical_company_id: options.canonical_company_id ?? options.snapshot?.canonical_company_id ?? null,
    company_id: options.company_id ?? null,
    person_id,
    committee_role: inferCommitteeRole(candidate),
    relationship_stage: options.relationship_stage ?? options.snapshot?.relationship_stage ?? inferRelationshipStage(candidate),
    conversation_thread_id,
    latest_conversation_thread_id: conversation_thread_id,
    opportunity_id,
    next_best_action_id: candidate.id,
    next_best_action: options.snapshot?.next_best_action ?? null,
    next_best_action_reason: options.snapshot?.next_best_action_reason ?? null,
    decision_score: options.decision_score ?? null,
    memory_context_available:
      options.memory_context_available ?? options.snapshot?.memory_context_available ?? false,
    business_intelligence_context_available:
      options.business_intelligence_context_available ??
      Boolean(options.snapshot?.canonical_company_id),
    blocked_reason: candidate.blocked ? (candidate.blockedBy?.[0] ?? "blocked") : options.snapshot?.blocked_reason ?? null,
    waiting_on_operator:
      options.snapshot?.waiting_on_operator ??
      (candidate.requiresHumanApproval === true || candidate.blocked === true),
    waiting_on_customer: options.snapshot?.waiting_on_customer ?? false,
  })

  return enrichRelationshipGraphWithSnapshot(base, options.snapshot)
}

export function attachRelationshipGraphToCandidate(
  candidate: DecisionCandidate,
  options?: { snapshot?: RelationshipLeadSnapshot | null },
): DecisionCandidate {
  return {
    ...candidate,
    relationship_graph: resolveRelationshipGraphFromCandidate(candidate, options),
  }
}
