/**
 * GE-AIOS-CONVERSATION-INTELLIGENCE-3A — Consultant discovery intelligence (client-safe).
 * Observation → operational → business → conversation opportunity.
 * No new persistence. Extends 1A/2A/2B inside Sales Strategy Brief pipeline.
 */

import type {
  GrowthOutreachEvidenceCitation,
  GrowthOutreachSellerTruth,
} from "@/lib/growth/aios/growth/growth-outreach-seller-truth"
import type {
  GrowthOutreachIndustryInference,
  GrowthOutreachLearningThemeWeight,
  GrowthOutreachPersonaInference,
} from "@/lib/growth/aios/growth/growth-outreach-conversation-intelligence"
import type { GrowthOutreachObservationCandidate } from "@/lib/growth/aios/growth/growth-outreach-elite-sdr-intelligence"

export const GROWTH_AIOS_CONVERSATION_INTELLIGENCE_3A_QA_MARKER =
  "ge-aios-conversation-intelligence-3a-consultant-discovery-intelligence-v1" as const

export type ConsultantReasoningLens =
  | "operational"
  | "financial"
  | "growth"
  | "customer_experience"
  | "staffing"
  | "visibility"
  | "coordination"
  | "leadership"

export type ConsultantReasoningChain = {
  observation: string
  operationalImplication: string
  businessImplication: string
  conversationOpportunity: string
}

export type BusinessPressureKey =
  | "growth_outpacing_systems"
  | "hiring"
  | "multiple_locations"
  | "inventory_complexity"
  | "aging_installed_base"
  | "customer_expectations"
  | "technician_utilization"
  | "administrative_workload"
  | "cash_flow"
  | "owner_dependency"
  | "expansion"
  | "fragmented_systems"
  | "compliance"
  | "equipment_uptime"
  | "service_profitability"
  | "recurring_revenue"

export type RankedBusinessPressure = {
  key: BusinessPressureKey
  label: string
  score: number
  evidence: string
}

export type BuyingTriggerImpact = "high" | "medium" | "low"

export type RankedBuyingTrigger = {
  key: string
  label: string
  impact: BuyingTriggerImpact
  score: number
}

export type ConversationTimingInference = {
  reason: string | null
  signals: string[]
  confidence: "high" | "medium" | "low" | "uncertain"
  internalNote: string
}

export type ConsultantDiscoveryQuestion = {
  id: string
  themeKey: string
  question: string
  revealsThinking: string
  score: number
}

export type GrowthOutreachConsultantDiscoveryIntelligence = {
  reasoningChain: ConsultantReasoningChain
  lensScores: Partial<Record<ConsultantReasoningLens, number>>
  rankedPressures: RankedBusinessPressure[]
  primaryBusinessPressure: RankedBusinessPressure | null
  operationalBottleneck: string | null
  rankedBuyingTriggers: RankedBuyingTrigger[]
  primaryBuyingTrigger: RankedBuyingTrigger | null
  conversationTiming: ConversationTimingInference
  consultantHypothesis: string
  conversationAngle: string
  rankedDiscoveryQuestions: ConsultantDiscoveryQuestion[]
  recommendedFirstQuestion: string
  reasonConfidence: number
  themeKey: string | null
}

const GENERIC_DISCOVERY_PATTERNS = [
  /^how do you (currently )?schedule/i,
  /^what software do you use/i,
  /^what takes the most time/i,
  /^how are estimates/i,
  /^how do customers pay/i,
  /^how do technicians receive/i,
  /^tell me about your (process|workflow)/i,
]

type ThemeConsultantProfile = {
  reasoningChain: Omit<ConsultantReasoningChain, "observation">
  operationalBottleneck: string
  conversationAngle: string
  consultantHypothesis: string
  lensScores: Partial<Record<ConsultantReasoningLens, number>>
  pressures: Array<{ key: BusinessPressureKey; label: string; base: number }>
  buyingTriggers: Array<{ key: string; label: string; impact: BuyingTriggerImpact; base: number }>
  discoveryQuestions: Array<{ themeKey: string; question: string; revealsThinking: string; base: number }>
}

const THEME_PROFILES: Record<string, ThemeConsultantProfile> = {
  imaging_depot_field_rhythm: {
    reasoningChain: {
      operationalImplication: "Scheduling complexity increases when depot turnaround and field coverage compete for the same technicians.",
      businessImplication: "Response time becomes inconsistent — customers feel it before internal dashboards do.",
      conversationOpportunity:
        "Ask about balancing turnaround time without disrupting field coverage.",
    },
    operationalBottleneck: "Field-to-office coordination between depot turnaround and field dispatch",
    conversationAngle: "Depot + field rhythm — where handoffs create invisible delay",
    consultantHypothesis:
      "This operator is coordinating depot and field imaging work — the constraint is likely handoffs, not headcount.",
    lensScores: {
      operational: 0.92,
      coordination: 0.9,
      growth: 0.78,
      customer_experience: 0.78,
      leadership: 0.72,
    },
    pressures: [
      { key: "equipment_uptime", label: "Equipment uptime expectations", base: 0.9 },
      { key: "multiple_locations", label: "Multi-site service coordination", base: 0.82 },
      { key: "technician_utilization", label: "Technician utilization across depot and field", base: 0.8 },
      { key: "customer_expectations", label: "Customer response-time expectations", base: 0.76 },
    ],
    buyingTriggers: [
      { key: "field_office_coordination", label: "Field-to-office coordination", impact: "high", base: 0.92 },
      { key: "technician_scheduling", label: "Technician scheduling", impact: "medium", base: 0.72 },
      { key: "dispatch_visibility", label: "Dispatch visibility", impact: "medium", base: 0.68 },
      { key: "customer_portal", label: "Customer portal", impact: "low", base: 0.42 },
    ],
    discoveryQuestions: [
      {
        themeKey: "dispatch_vs_closeout",
        question:
          "When workload spikes, is dispatch usually the bottleneck—or is it getting completed work closed out fast enough?",
        revealsThinking: "Tests whether friction is assignment or completion handoff.",
        base: 0.94,
      },
      {
        themeKey: "depot_field_balance",
        question:
          "When depot turnaround tightens, does field coverage usually absorb the gap—or does something else slip first?",
        revealsThinking: "Surfaces trade-off decisions leadership already makes.",
        base: 0.9,
      },
      {
        themeKey: "alignment_tools",
        question:
          "Do you feel like your current tools keep everyone aligned, or do they mostly record what already happened?",
        revealsThinking: "Distinguishes proactive coordination from retrospective logging.",
        base: 0.86,
      },
    ],
  },
  refurb_oem_imaging_mix: {
    reasoningChain: {
      operationalImplication: "Mixed inventory creates different parts availability and dispatch rhythms across teams.",
      businessImplication: "Depot turnaround predictability erodes before anyone rewrites the process.",
      conversationOpportunity: "Ask whether parts alignment across field teams is the harder problem as refurbished volume grows.",
    },
    operationalBottleneck: "Parts availability aligned across mixed OEM and refurbished inventory",
    conversationAngle: "Mixed inventory — parts rhythm before process redesign",
    consultantHypothesis:
      "Refurb + OEM mix means parts and dispatch cadence diverge — coordination cost rises quietly.",
    lensScores: {
      operational: 0.88,
      financial: 0.82,
      coordination: 0.84,
    },
    pressures: [
      { key: "inventory_complexity", label: "Inventory complexity across OEM and refurb", base: 0.9 },
      { key: "equipment_uptime", label: "Equipment uptime across mixed fleet", base: 0.82 },
      { key: "service_profitability", label: "Service profitability on mixed inventory", base: 0.74 },
    ],
    buyingTriggers: [
      { key: "parts_coordination", label: "Parts coordination across teams", impact: "high", base: 0.9 },
      { key: "inventory_visibility", label: "Inventory visibility", impact: "medium", base: 0.7 },
      { key: "reporting", label: "Reporting", impact: "low", base: 0.45 },
    ],
    discoveryQuestions: [
      {
        themeKey: "parts_rhythm",
        question:
          "As refurbished volume has grown, has parts availability become harder to keep aligned across field teams?",
        revealsThinking: "Tests inventory coordination vs generic scheduling pain.",
        base: 0.92,
      },
      {
        themeKey: "dispatch_vs_closeout",
        question:
          "When workload spikes, is dispatch usually the bottleneck—or is it getting completed work closed out fast enough?",
        revealsThinking: "Separates assignment friction from completion friction.",
        base: 0.88,
      },
    ],
  },
  installed_base_growth: {
    reasoningChain: {
      operationalImplication: "Handoffs — not headcount — become the constraint as installed base grows across sites.",
      businessImplication: "Workflow consistency degrades before teams add admin capacity.",
      conversationOpportunity: "Ask when scheduling stopped being the hard part and information alignment became the constraint.",
    },
    operationalBottleneck: "Cross-site information alignment as installed base scales",
    conversationAngle: "Scale — handoffs before headcount",
    consultantHypothesis: "Multi-site growth is exposing coordination gaps that scheduling alone cannot fix.",
    lensScores: {
      growth: 0.9,
      coordination: 0.88,
      visibility: 0.85,
      leadership: 0.75,
    },
    pressures: [
      { key: "growth_outpacing_systems", label: "Growing faster than systems", base: 0.9 },
      { key: "multiple_locations", label: "Multiple locations", base: 0.86 },
      { key: "administrative_workload", label: "Administrative workload", base: 0.74 },
    ],
    buyingTriggers: [
      { key: "cross_site_visibility", label: "Cross-site visibility", impact: "high", base: 0.9 },
      { key: "workflow_consistency", label: "Workflow consistency", impact: "high", base: 0.85 },
      { key: "reporting", label: "Reporting", impact: "medium", base: 0.55 },
    ],
    discoveryQuestions: [
      {
        themeKey: "scheduling_vs_alignment",
        question:
          "At what point did scheduling stop being the hard part—and keeping everyone on the same information become the constraint?",
        revealsThinking: "Identifies maturity stage of operational complexity.",
        base: 0.93,
      },
      {
        themeKey: "alignment_tools",
        question:
          "Do you feel like your current tools keep everyone aligned, or do they mostly record what already happened?",
        revealsThinking: "Tests proactive vs retrospective tooling.",
        base: 0.87,
      },
    ],
  },
  technician_hiring_strain: {
    reasoningChain: {
      operationalImplication: "Dispatch absorbs utilization gaps while hiring catches up to volume.",
      businessImplication: "Technician utilization looks fine on paper while response time slips.",
      conversationOpportunity: "Ask whether utilization is keeping pace with hiring or dispatch is masking the gap.",
    },
    operationalBottleneck: "Dispatch absorbing utilization gaps during hiring ramp",
    conversationAngle: "Hiring ramp — dispatch masking utilization strain",
    consultantHypothesis: "Active hiring plus volume shift means dispatch is carrying hidden capacity risk.",
    lensScores: {
      staffing: 0.92,
      operational: 0.86,
      coordination: 0.8,
    },
    pressures: [
      { key: "hiring", label: "Active hiring", base: 0.9 },
      { key: "technician_utilization", label: "Technician utilization", base: 0.88 },
      { key: "growth_outpacing_systems", label: "Volume outpacing capacity", base: 0.78 },
    ],
    buyingTriggers: [
      { key: "dispatch_load", label: "Dispatch workload", impact: "high", base: 0.88 },
      { key: "technician_scheduling", label: "Technician scheduling", impact: "medium", base: 0.72 },
      { key: "capacity_planning", label: "Capacity planning", impact: "medium", base: 0.65 },
    ],
    discoveryQuestions: [
      {
        themeKey: "utilization_vs_dispatch",
        question:
          "Is technician utilization keeping pace with hiring—or is dispatch absorbing more of the gap than it should?",
        revealsThinking: "Surfaces hidden capacity assumptions.",
        base: 0.92,
      },
      {
        themeKey: "dispatch_vs_closeout",
        question:
          "When workload spikes, is dispatch usually the bottleneck—or is it getting completed work closed out fast enough?",
        revealsThinking: "Tests assignment vs completion friction under strain.",
        base: 0.86,
      },
    ],
  },
  dispatch_to_cash_friction: {
    reasoningChain: {
      operationalImplication: "Work looks smooth on the board — friction shows up between job completion and billing readiness.",
      businessImplication: "Cash flow timing drifts before margin problems show up in reports.",
      conversationOpportunity: "Ask where quiet delay still exists between field completion and billing readiness.",
    },
    operationalBottleneck: "Field completion to billing readiness handoff",
    conversationAngle: "Dispatch-to-cash — quiet delay after the visit",
    consultantHypothesis: "The board looks clean; margin leakage is in the closeout handoff.",
    lensScores: {
      financial: 0.9,
      operational: 0.86,
      visibility: 0.84,
    },
    pressures: [
      { key: "cash_flow", label: "Cash flow timing", base: 0.88 },
      { key: "administrative_workload", label: "Administrative workload", base: 0.82 },
      { key: "service_profitability", label: "Service profitability", base: 0.78 },
    ],
    buyingTriggers: [
      { key: "dispatch_to_cash", label: "Dispatch-to-cash visibility", impact: "high", base: 0.92 },
      { key: "billing_handoff", label: "Billing handoff", impact: "high", base: 0.86 },
      { key: "reporting", label: "Reporting", impact: "medium", base: 0.55 },
    ],
    discoveryQuestions: [
      {
        themeKey: "closeout_delay",
        question:
          "Where does work still create quiet delay between field completion and billing readiness?",
        revealsThinking: "Locates margin leakage without asking about software by name.",
        base: 0.94,
      },
      {
        themeKey: "alignment_tools",
        question:
          "Do you feel like your current tools keep everyone aligned, or do they mostly record what already happened?",
        revealsThinking: "Tests whether tools drive action or document history.",
        base: 0.85,
      },
    ],
  },
  customer_portal_visibility: {
    reasoningChain: {
      operationalImplication: "Customer-facing status requires internal accuracy that is hard to maintain at scale.",
      businessImplication: "Customer expectations rise before internal visibility catches up.",
      conversationOpportunity: "Ask whether customer visibility is still accurate by the time field work is done.",
    },
    operationalBottleneck: "Internal status accuracy lagging customer-facing visibility",
    conversationAngle: "Customer portal — internal accuracy under external visibility",
    consultantHypothesis: "Portal creates customer expectation pressure on internal status accuracy.",
    lensScores: {
      customer_experience: 0.92,
      visibility: 0.88,
      operational: 0.78,
    },
    pressures: [
      { key: "customer_expectations", label: "Customer expectations", base: 0.9 },
      { key: "visibility", label: "Status visibility gaps", base: 0.85 },
      { key: "administrative_workload", label: "Administrative rework", base: 0.72 },
    ],
    buyingTriggers: [
      { key: "customer_visibility", label: "Customer visibility accuracy", impact: "high", base: 0.9 },
      { key: "status_sync", label: "Status synchronization", impact: "high", base: 0.84 },
      { key: "customer_portal", label: "Customer portal", impact: "medium", base: 0.6 },
    ],
    discoveryQuestions: [
      {
        themeKey: "status_lag",
        question:
          "By the time field work is done, is customer-facing status still accurate—or does something lag internally first?",
        revealsThinking: "Tests internal vs external visibility gap.",
        base: 0.93,
      },
      {
        themeKey: "alignment_tools",
        question:
          "Do you feel like your current tools keep everyone aligned, or do they mostly record what already happened?",
        revealsThinking: "Distinguishes live coordination from retrospective logging.",
        base: 0.86,
      },
    ],
  },
  pm_compliance_pressure: {
    reasoningChain: {
      operationalImplication: "PM due dates in one system and work orders in another create drift.",
      businessImplication: "Compliance predictability erodes into last-minute fire drills.",
      conversationOpportunity: "Ask whether PM compliance is still predictable or due-date drift is driving fire drills.",
    },
    operationalBottleneck: "PM scheduling split across systems",
    conversationAngle: "PM compliance — due-date drift before fire drills",
    consultantHypothesis: "PM-heavy ops break when schedules and work orders live in separate systems.",
    lensScores: {
      operational: 0.84,
      visibility: 0.8,
      leadership: 0.72,
    },
    pressures: [
      { key: "compliance", label: "PM compliance pressure", base: 0.9 },
      { key: "administrative_workload", label: "Duplicate scheduling work", base: 0.78 },
      { key: "equipment_uptime", label: "Equipment uptime", base: 0.72 },
    ],
    buyingTriggers: [
      { key: "pm_scheduling", label: "PM scheduling integration", impact: "high", base: 0.9 },
      { key: "compliance_tracking", label: "Compliance tracking", impact: "high", base: 0.84 },
      { key: "reporting", label: "Reporting", impact: "low", base: 0.45 },
    ],
    discoveryQuestions: [
      {
        themeKey: "pm_drift",
        question:
          "Is PM compliance still predictable—or is due-date drift creating more last-minute fire drills than it should?",
        revealsThinking: "Tests schedule integrity vs reactive firefighting.",
        base: 0.92,
      },
      {
        themeKey: "alignment_tools",
        question:
          "Do you feel like your current tools keep everyone aligned, or do they mostly record what already happened?",
        revealsThinking: "Surfaces system fragmentation without naming vendors.",
        base: 0.84,
      },
    ],
  },
  first_time_fix_pressure: {
    reasoningChain: {
      operationalImplication: "Incomplete job context in the field drives callbacks more than capacity limits.",
      businessImplication: "First-time fix rate erodes service profitability before utilization metrics flag it.",
      conversationOpportunity: "Ask whether incomplete job packets are driving repeat visits more than capacity.",
    },
    operationalBottleneck: "Job context completeness before field dispatch",
    conversationAngle: "Callbacks — job context before technician skill",
    consultantHypothesis: "Repeat visits trace to incomplete job packets, not technician capacity.",
    lensScores: {
      operational: 0.88,
      financial: 0.8,
      customer_experience: 0.78,
    },
    pressures: [
      { key: "service_profitability", label: "Service profitability on repeat visits", base: 0.86 },
      { key: "technician_utilization", label: "Technician utilization", base: 0.78 },
      { key: "customer_expectations", label: "Customer expectations on first visit", base: 0.74 },
    ],
    buyingTriggers: [
      { key: "job_context", label: "Job context completeness", impact: "high", base: 0.9 },
      { key: "first_time_fix", label: "First-time fix rate", impact: "high", base: 0.86 },
      { key: "dispatch_visibility", label: "Dispatch visibility", impact: "medium", base: 0.6 },
    ],
    discoveryQuestions: [
      {
        themeKey: "callback_cause",
        question:
          "Are incomplete job packets driving repeat visits more than capacity constraints right now?",
        revealsThinking: "Separates information gaps from headcount limits.",
        base: 0.93,
      },
      {
        themeKey: "dispatch_vs_closeout",
        question:
          "When workload spikes, is dispatch usually the bottleneck—or is it getting completed work closed out fast enough?",
        revealsThinking: "Tests whether assignment or completion is the real constraint.",
        base: 0.85,
      },
    ],
  },
}

const DEFAULT_PROFILE: ThemeConsultantProfile = {
  reasoningChain: {
    operationalImplication: "Handoffs between field work and back-office usually create quiet delay before teams notice.",
    businessImplication: "Service consistency erodes before margin shows up in reports.",
    conversationOpportunity: "Ask where coordination still creates delay between field completion and customer visibility.",
  },
  operationalBottleneck: "Field-to-office handoff visibility",
  conversationAngle: "Service operations — handoff friction before scale problems",
  consultantHypothesis: "Coordination handoffs are the likely constraint — not headcount alone.",
  lensScores: {
    operational: 0.75,
    coordination: 0.72,
    visibility: 0.68,
  },
  pressures: [
    { key: "administrative_workload", label: "Administrative workload", base: 0.72 },
    { key: "fragmented_systems", label: "Fragmented systems", base: 0.68 },
    { key: "technician_utilization", label: "Technician utilization", base: 0.65 },
  ],
  buyingTriggers: [
    { key: "field_office_coordination", label: "Field-to-office coordination", impact: "high", base: 0.78 },
    { key: "technician_scheduling", label: "Technician scheduling", impact: "medium", base: 0.62 },
    { key: "reporting", label: "Reporting", impact: "low", base: 0.4 },
  ],
  discoveryQuestions: [
    {
      themeKey: "dispatch_vs_closeout",
      question:
        "When workload spikes, is dispatch usually the bottleneck—or is it getting completed work closed out fast enough?",
      revealsThinking: "Tests assignment vs completion friction.",
      base: 0.88,
    },
    {
      themeKey: "alignment_tools",
      question:
        "Do you feel like your current tools keep everyone aligned, or do they mostly record what already happened?",
      revealsThinking: "Distinguishes proactive coordination from retrospective logging.",
      base: 0.84,
    },
  ],
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

function hashStable(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0
  return h
}

function corpusFromInput(input: {
  evidence: GrowthOutreachEvidenceCitation[]
  equipment: string[]
  companyName?: string | null
}): string {
  return [
    input.companyName ?? "",
    ...input.evidence.map((e) => e.detail),
    ...input.equipment,
  ]
    .join(" ")
    .toLowerCase()
}

function inferPressuresFromCorpus(corpus: string): Partial<Record<BusinessPressureKey, number>> {
  const boosts: Partial<Record<BusinessPressureKey, number>> = {}
  const add = (key: BusinessPressureKey, amount: number) => {
    boosts[key] = clamp01((boosts[key] ?? 0) + amount)
  }

  if (/hiring|career|job opening|technician|biomedical engineer/.test(corpus)) add("hiring", 0.18)
  if (/nationwide|multi.?site|global|location|expansion|new office/.test(corpus)) {
    add("multiple_locations", 0.16)
    add("expansion", 0.14)
  }
  if (/refurb|oem|inventory|parts|mixed/.test(corpus)) add("inventory_complexity", 0.16)
  if (/aging|replacement|lifecycle|installed base|uptime/.test(corpus)) add("aging_installed_base", 0.14)
  if (/customer portal|service request|ticket|status/.test(corpus)) add("customer_expectations", 0.14)
  if (/dispatch|utilization|technician/.test(corpus)) add("technician_utilization", 0.12)
  if (/billing|invoice|quote|admin|paperwork/.test(corpus)) add("administrative_workload", 0.12)
  if (/cash|margin|profit|revenue/.test(corpus)) add("cash_flow", 0.1)
  if (/president|owner|founder|ceo/.test(corpus)) add("owner_dependency", 0.08)
  if (/compliance|calibration|pm schedule|preventive/.test(corpus)) add("compliance", 0.14)
  if (/mri|ct|imaging|depot|field service/.test(corpus)) add("equipment_uptime", 0.14)
  if (/scale|growth|expand|fleet/.test(corpus)) add("growth_outpacing_systems", 0.14)
  if (/fragmented|spreadsheet|multiple system|homegrown/.test(corpus)) add("fragmented_systems", 0.12)
  if (/recurring|contract|maintenance plan/.test(corpus)) add("recurring_revenue", 0.1)

  return boosts
}

function inferConversationTiming(corpus: string, pressures: RankedBusinessPressure[]): ConversationTimingInference {
  const signals: string[] = []
  let reason: string | null = null
  let confidence: ConversationTimingInference["confidence"] = "uncertain"

  if (/hiring|career|job opening/.test(corpus)) {
    signals.push("Active hiring")
    reason = "Hiring signals suggest capacity strain is live."
    confidence = "medium"
  }
  if (/expansion|new location|acquisition|nationwide/.test(corpus)) {
    signals.push("Expansion")
    reason = reason ?? "Expansion signals increase coordination complexity now."
    confidence = confidence === "uncertain" ? "medium" : confidence
  }
  if (/growth|scale|installed base/.test(corpus)) {
    signals.push("Growth")
    reason = reason ?? "Growth is making existing workflows harder."
    confidence = confidence === "uncertain" ? "medium" : confidence
  }
  if (pressures[0]?.key === "equipment_uptime" && /imaging|mri|ct|depot/.test(corpus)) {
    signals.push("Operational complexity")
    reason = reason ?? "Depot + field imaging ops add coordination pressure as volume shifts."
    confidence = "high"
  }
  if (/aging|replacement|lifecycle/.test(corpus)) {
    signals.push("Equipment lifecycle")
    reason = reason ?? "Aging installed base increases service intensity."
    confidence = confidence === "uncertain" ? "medium" : confidence
  }

  if (!reason) {
    return {
      reason: null,
      signals: [],
      confidence: "uncertain",
      internalNote: "Timing cannot be inferred confidently — do not invent urgency.",
    }
  }

  return {
    reason,
    signals: uniqueSignals(signals),
    confidence,
    internalNote:
      confidence === "uncertain"
        ? "Timing cannot be inferred confidently — do not invent urgency."
        : `Timing inference: ${reason}`,
  }
}

function uniqueSignals(lines: string[]): string[] {
  const seen = new Set<string>()
  return lines.filter((line) => {
    const key = line.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function buildLearningBoostMap(
  weights: GrowthOutreachLearningThemeWeight[] | null | undefined,
): Map<string, number> {
  const map = new Map<string, number>()
  for (const row of weights ?? []) {
    if (row.sends >= 3 && row.replyRatePct != null) {
      map.set(row.themeKey, clamp01(row.replyRatePct / 100))
    }
  }
  return map
}

export function isGenericDiscoveryQuestion(question: string): boolean {
  return GENERIC_DISCOVERY_PATTERNS.some((pattern) => pattern.test(question.trim()))
}

export function isAnsweredDiscoveryTheme(question: string, answeredThemes: string[] | null | undefined): boolean {
  if (!answeredThemes?.length) return false
  const normalized = question.toLowerCase()
  return answeredThemes.some((theme) => {
    const words = theme.split(/\s+/).filter((word) => word.length > 4)
    return words.some((word) => normalized.includes(word))
  })
}

export function passesConsultantDiscoveryTest(input: {
  recommendedFirstQuestion: string
  consultantHypothesis: string
  reasoningChain: ConsultantReasoningChain
}): boolean {
  if (isGenericDiscoveryQuestion(input.recommendedFirstQuestion)) return false
  if (input.recommendedFirstQuestion.split(/\s+/).length < 8) return false
  if (!/\?/.test(input.recommendedFirstQuestion)) return false
  if (!input.consultantHypothesis || input.consultantHypothesis.length < 24) return false
  if (!input.reasoningChain.conversationOpportunity) return false
  return true
}

export function reviewConsultantDiscoveryQuality(input: {
  discovery: GrowthOutreachConsultantDiscoveryIntelligence
  prospectFacingQuestion: string
}): string[] {
  const failures: string[] = []
  if (!passesConsultantDiscoveryTest(input.discovery)) {
    failures.push("consultant_discovery:consultant_test_failed")
  }
  if (isGenericDiscoveryQuestion(input.prospectFacingQuestion)) {
    failures.push("consultant_discovery:generic_question_in_draft")
  }
  if (!input.discovery.primaryBusinessPressure) {
    failures.push("consultant_discovery:no_primary_pressure")
  }
  if (!input.discovery.primaryBuyingTrigger) {
    failures.push("consultant_discovery:no_primary_trigger")
  }
  if (input.discovery.reasonConfidence < 0.45) {
    failures.push("consultant_discovery:low_reason_confidence")
  }
  return failures
}

export function buildConsultantDiscoveryIntelligence(input: {
  selectedObservation: GrowthOutreachObservationCandidate | null
  evidence: GrowthOutreachEvidenceCitation[]
  equipment: string[]
  companyName: string
  leadId: string
  sellerTruth?: GrowthOutreachSellerTruth | null
  persona?: GrowthOutreachPersonaInference | null
  industry?: GrowthOutreachIndustryInference | null
  learningWeights?: GrowthOutreachLearningThemeWeight[] | null
  posture?: "curious" | "balanced" | "confident"
  answeredThemes?: string[] | null
  relationshipConfidence?: string | null
}): GrowthOutreachConsultantDiscoveryIntelligence | null {
  if (!input.selectedObservation) return null

  const themeKey = input.selectedObservation.themeKey
  const profile = THEME_PROFILES[themeKey] ?? DEFAULT_PROFILE
  const corpus = corpusFromInput(input)
  const corpusBoosts = inferPressuresFromCorpus(corpus)
  const learningMap = buildLearningBoostMap(input.learningWeights)

  const observation = input.selectedObservation.consultantObservation.trim()

  const reasoningChain: ConsultantReasoningChain = {
    observation,
    ...profile.reasoningChain,
  }

  const rankedPressures: RankedBusinessPressure[] = profile.pressures
    .map((row) => ({
      key: row.key,
      label: row.label,
      score: clamp01(row.base + (corpusBoosts[row.key] ?? 0) + (learningMap.get(row.key) ?? 0) * 0.08),
      evidence: corpusBoosts[row.key] ? "Corpus signals support this pressure." : "Inferred from observation theme.",
    }))
    .sort((a, b) => b.score - a.score)

  const primaryBusinessPressure = rankedPressures[0] ?? null

  const sellerTriggerBoost = (label: string): number => {
    const sellerTriggers = input.sellerTruth?.businessOutcomes ?? []
    const match = sellerTriggers.some((t) =>
      label.toLowerCase().split(/\s+/).some((word) => word.length > 4 && t.toLowerCase().includes(word)),
    )
    return match ? 0.08 : 0
  }

  const rankedBuyingTriggers: RankedBuyingTrigger[] = profile.buyingTriggers
    .map((row) => ({
      key: row.key,
      label: row.label,
      impact: row.impact,
      score: clamp01(row.base + sellerTriggerBoost(row.label) + (learningMap.get(row.key) ?? 0) * 0.06),
    }))
    .sort((a, b) => b.score - a.score)

  const primaryBuyingTrigger = rankedBuyingTriggers[0] ?? null

  const personaBoost =
    input.persona?.normalizedRole === "Executive decision maker" ? 0.04 : 0
  const posturePenalty = input.posture === "curious" ? 0.06 : 0

  const rankedDiscoveryQuestions: ConsultantDiscoveryQuestion[] = profile.discoveryQuestions
    .map((row, index) => ({
      id: `dq:${themeKey}:${row.themeKey}:${index}`,
      themeKey: row.themeKey,
      question: row.question,
      revealsThinking: row.revealsThinking,
      score: clamp01(
        row.base +
          (learningMap.get(row.themeKey) ?? 0) * 0.1 +
          personaBoost -
          posturePenalty +
          (row.themeKey === profile.discoveryQuestions[0]?.themeKey ? 0.02 : 0),
      ),
    }))
    .filter(
      (row) =>
        !isGenericDiscoveryQuestion(row.question) &&
        !isAnsweredDiscoveryTheme(row.question, input.answeredThemes),
    )
    .sort((a, b) => b.score - a.score)

  const seed = `${input.leadId}:${themeKey}:dq`
  const recommendedFirstQuestion =
    rankedDiscoveryQuestions[0]?.question ??
    profile.discoveryQuestions[hashStable(seed) % profile.discoveryQuestions.length]?.question ??
    "When workload spikes, is dispatch usually the bottleneck—or is it getting completed work closed out fast enough?"

  const conversationTiming = inferConversationTiming(corpus, rankedPressures)

  const evidenceStrength = input.selectedObservation.scores.evidenceStrength
  const businessImportance = input.selectedObservation.scores.businessImportance
  const timingConfidence =
    conversationTiming.confidence === "high"
      ? 0.12
      : conversationTiming.confidence === "medium"
        ? 0.06
        : conversationTiming.confidence === "low"
          ? 0.03
          : 0
  const reasonConfidence = clamp01(
    evidenceStrength * 0.35 +
      businessImportance * 0.3 +
      (primaryBusinessPressure?.score ?? 0.5) * 0.2 +
      (primaryBuyingTrigger?.score ?? 0.5) * 0.1 +
      timingConfidence,
  )

  return {
    reasoningChain,
    lensScores: profile.lensScores,
    rankedPressures,
    primaryBusinessPressure,
    operationalBottleneck: profile.operationalBottleneck,
    rankedBuyingTriggers,
    primaryBuyingTrigger,
    conversationTiming,
    consultantHypothesis: profile.consultantHypothesis,
    conversationAngle: profile.conversationAngle,
    rankedDiscoveryQuestions,
    recommendedFirstQuestion,
    reasonConfidence,
    themeKey,
  }
}
