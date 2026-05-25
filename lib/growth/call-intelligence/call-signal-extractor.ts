import type {
  CallIntelligenceExtractedSignals,
  CallIntelligenceSignalLabel,
} from "@/lib/growth/call-intelligence/call-intelligence-types"
import type {
  GrowthRealtimeDiscoveryArea,
  GrowthRealtimeLiveSnapshot,
  GrowthRealtimeObjectionKey,
} from "@/lib/growth/realtime/realtime-call-types"

const OBJECTION_KEY_MAP: Record<string, CallIntelligenceSignalLabel> = {
  pricing_objection: { key: "price", label: "Price objection" },
  budget_concern: { key: "budget", label: "Budget concern" },
  timing_objection: { key: "timing", label: "Timing objection" },
  competitor_mention: { key: "competitor", label: "Competitor objection" },
  authority_objection: { key: "authority", label: "Authority objection" },
  feature_gap: { key: "need", label: "Need / feature gap" },
  already_using_solution: { key: "status_quo", label: "Status quo" },
  priority_objection: { key: "timing", label: "Priority / timing" },
}

const BUYING_SIGNAL_MAP: Record<string, CallIntelligenceSignalLabel> = {
  pricing_interest: { key: "asked_pricing", label: "Asked about pricing" },
  timeline_urgency: { key: "asked_timeline", label: "Asked about timeline" },
  implementation_signal: { key: "asked_integration", label: "Asked about integration" },
  commitment_language: { key: "requested_followup", label: "Requested follow-up" },
  decision_maker_confirmed: { key: "mentioned_team_need", label: "Team need mentioned" },
  buying_signal: { key: "requested_followup", label: "Buying signal detected" },
}

const DISCOVERY_GAP_MAP: Record<GrowthRealtimeDiscoveryArea, CallIntelligenceSignalLabel> = {
  timeline_asked: { key: "no_timeline_confirmed", label: "Timeline not confirmed" },
  budget_asked: { key: "no_budget_confirmed", label: "Budget not confirmed" },
  implementation_asked: { key: "no_current_system", label: "Current system unclear" },
  decision_maker_confirmed: { key: "no_decision_process", label: "Decision process unclear" },
  current_solution_identified: { key: "no_pain_confirmed", label: "Pain not confirmed" },
}

const COMPETITOR_NAME_MAP: Record<string, CallIntelligenceSignalLabel> = {
  servicetitan: { key: "servicetitan", label: "ServiceTitan mentioned" },
  "housecall pro": { key: "housecall_pro", label: "Housecall Pro mentioned" },
  housecallpro: { key: "housecall_pro", label: "Housecall Pro mentioned" },
  fieldpulse: { key: "fieldpulse", label: "FieldPulse mentioned" },
  "field edge": { key: "other", label: "FieldEdge mentioned" },
  jobber: { key: "jobber", label: "Jobber mentioned" },
  quickbooks: { key: "quickbooks", label: "QuickBooks mentioned" },
  salesforce: { key: "other", label: "Salesforce mentioned" },
  hubspot: { key: "other", label: "HubSpot mentioned" },
}

function dedupeLabels(items: CallIntelligenceSignalLabel[]): CallIntelligenceSignalLabel[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.key)) return false
    seen.add(item.key)
    return true
  })
}

export function extractCallIntelligenceSignals(input: {
  snapshot: GrowthRealtimeLiveSnapshot
  nextStepSecured: boolean
  meetingOutcomeMissing?: boolean
  meetingNoShow?: boolean
}): CallIntelligenceExtractedSignals {
  const detectedObjections = dedupeLabels(
    input.snapshot.objections.map((objection) => {
      const mapped = OBJECTION_KEY_MAP[objection.key as GrowthRealtimeObjectionKey]
      return mapped ?? { key: "need", label: objection.label }
    }),
  )

  const buyingSignals = dedupeLabels(
    input.snapshot.buyingSignals.map((signal) => {
      const mapped = BUYING_SIGNAL_MAP[signal.key]
      return mapped ?? { key: "requested_followup", label: signal.label }
    }),
  )

  const competitorMentions = dedupeLabels(
    (input.snapshot.competitorGuidance ?? []).map((entry) => {
      const normalized = entry.competitor.toLowerCase()
      for (const [needle, label] of Object.entries(COMPETITOR_NAME_MAP)) {
        if (normalized.includes(needle)) return label
      }
      return { key: "other", label: `${entry.competitor} mentioned` }
    }),
  )

  if (
    input.snapshot.objections.some((objection) => objection.key === "competitor_mention") &&
    !competitorMentions.length
  ) {
    competitorMentions.push({ key: "other", label: "Competitor mentioned" })
  }

  const discoveryGaps = dedupeLabels(
    input.snapshot.discovery.missing.map((area) => DISCOVERY_GAP_MAP[area]),
  )

  const nextStepCommitments: CallIntelligenceSignalLabel[] = input.nextStepSecured
    ? [{ key: "next_step_committed", label: "Next step commitment detected" }]
    : [{ key: "no_next_step", label: "No next step commitment" }]

  const coachingOpportunities: CallIntelligenceSignalLabel[] = []
  if ((input.snapshot.riskFlags ?? []).includes("talking_too_much")) {
    coachingOpportunities.push({ key: "talk_listen_balance", label: "Improve talk/listen balance" })
  }
  if ((input.snapshot.riskFlags ?? []).includes("low_discovery") || discoveryGaps.length >= 2) {
    coachingOpportunities.push({ key: "discovery_depth", label: "Deepen discovery" })
  }
  if (detectedObjections.length >= 2) {
    coachingOpportunities.push({ key: "objection_handling", label: "Address unresolved objections" })
  }
  if (!input.nextStepSecured) {
    coachingOpportunities.push({ key: "next_step_close", label: "Secure explicit next step" })
  }
  if (input.meetingOutcomeMissing) {
    coachingOpportunities.push({ key: "record_outcome", label: "Record meeting outcome" })
  }
  if (input.meetingNoShow) {
    coachingOpportunities.push({ key: "no_show_recovery", label: "Recover from no-show" })
  }
  if (competitorMentions.length > 0) {
    coachingOpportunities.push({ key: "competitive_positioning", label: "Competitive positioning needed" })
  }

  return {
    detectedObjections,
    buyingSignals,
    competitorMentions,
    discoveryGaps,
    nextStepCommitments,
    coachingOpportunities: dedupeLabels(coachingOpportunities).slice(0, 6),
  }
}
