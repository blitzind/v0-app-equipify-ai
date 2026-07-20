/**
 * GE-AIOS-NEXT-1B — Mission Interpreter (intent → existing missions/objectives only).
 * Understands operator intent and maps to existing surfaces — no planning logic.
 */

import {
  GROWTH_AIOS_NEXT_1B_AVA_INTENT_RECOMMENDATION_QA_MARKER,
  type GrowthHomeAvaMissionIntentInterpretation,
  type GrowthHomeAvaMissionIntentKind,
} from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-next-1b-types"
import { inferIndustry } from "@/lib/growth/memory/events/record-memory-event"
import { GROWTH_WORKSPACE_PROSPECT_SEARCH_DISCOVER_HREF } from "@/lib/growth/navigation/growth-prospect-search-paths"
import { buildGrowthLeadHref } from "@/lib/growth/navigation/growth-workspace-operator-links"

export const GROWTH_AIOS_NEXT_1B_MISSION_INTERPRETER_QA_MARKER =
  "ge-aios-next-1b-ava-mission-interpreter-v1" as const

const GROWTH_OBJECTIVES_WORKSPACE_HREF = "/growth/objectives" as const

const US_STATE_LABELS: Record<string, string> = {
  texas: "Texas",
  florida: "Florida",
  california: "California",
  georgia: "Georgia",
  ohio: "Ohio",
  michigan: "Michigan",
}

const INDUSTRY_PHRASES: Array<{ pattern: RegExp; label: string; industryKey: string }> = [
  { pattern: /\bhospitals?\b|\bhealthcare\b|\bmedical centers?\b/i, label: "hospitals", industryKey: "medical_equipment" },
  { pattern: /\buniversit(y|ies)\b|\bhigher ed\b|\bcolleges?\b/i, label: "universities", industryKey: "education" },
  { pattern: /\bhvac\b|\bheating\b|\bcooling\b|\bcommercial hvac\b/i, label: "HVAC companies", industryKey: "hvac" },
  { pattern: /\bmedical\b|\bbiomed\b|\blaboratory\b/i, label: "medical equipment companies", industryKey: "medical_equipment" },
]

function normalizeInstruction(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

function formatEffort(minutes: number | null | undefined): string | null {
  if (!minutes || minutes <= 0) return null
  if (minutes === 1) return "about 1 minute"
  if (minutes < 60) return `about ${minutes} minutes`
  return `about ${Math.round((minutes / 60) * 10) / 10} hours`
}

function extractGeography(instruction: string): string | null {
  const lower = instruction.toLowerCase()
  for (const [token, label] of Object.entries(US_STATE_LABELS)) {
    if (lower.includes(token)) return label
  }
  return null
}

function extractIndustryFocus(instruction: string): { label: string; industryKey: string } | null {
  for (const entry of INDUSTRY_PHRASES) {
    if (entry.pattern.test(instruction)) return { label: entry.label, industryKey: entry.industryKey }
  }
  const inferred = inferIndustry(instruction)
  if (inferred === "medical_equipment") return { label: "medical equipment companies", industryKey: inferred }
  if (inferred === "hvac") return { label: "HVAC companies", industryKey: inferred }
  return null
}

function matchCompanyName(
  instruction: string,
  candidates: Array<{ leadId: string; companyName: string }>,
): { leadId: string; companyName: string } | null {
  const normalized = instruction.toLowerCase()
  for (const candidate of candidates) {
    const company = candidate.companyName.trim()
    if (!company) continue
    const companyLower = company.toLowerCase()
    if (normalized.includes(companyLower)) return candidate
    const firstToken = companyLower.split(/\s+/)[0]
    if (firstToken && firstToken.length >= 4 && normalized.includes(firstToken)) return candidate
  }
  return null
}

function buildInterpretation(input: {
  intentKind: GrowthHomeAvaMissionIntentKind
  understoodIntent: string
  restatement: string
  objectiveShiftLabel?: string | null
  planSummary: string
  beforeBeginSteps: string[]
  estimatedEffortLabel: string | null
  expectedOutcome: string | null
  href: string | null
  requiresConfirmation?: boolean
  conflictNote?: string | null
}): GrowthHomeAvaMissionIntentInterpretation {
  return {
    qaMarker: GROWTH_AIOS_NEXT_1B_AVA_INTENT_RECOMMENDATION_QA_MARKER,
    intentKind: input.intentKind,
    understoodIntent: input.understoodIntent,
    restatement: input.restatement,
    objectiveShiftLabel: input.objectiveShiftLabel ?? null,
    planSummary: input.planSummary,
    beforeBeginSteps: input.beforeBeginSteps,
    estimatedEffortLabel: input.estimatedEffortLabel,
    expectedOutcome: input.expectedOutcome,
    href: input.href,
    requiresConfirmation: input.requiresConfirmation ?? true,
    conflictNote: input.conflictNote ?? null,
  }
}

export function interpretGrowthHomeAvaMissionIntent(input: {
  instruction: string
  companyCandidates?: Array<{ leadId: string; companyName: string }>
  activeMissionLabel?: string | null
  estimatedMinutes?: number | null
}): GrowthHomeAvaMissionIntentInterpretation | null {
  const instruction = normalizeInstruction(input.instruction)
  if (!instruction) return null

  const lower = instruction.toLowerCase()
  const effort = formatEffort(input.estimatedMinutes ?? null)
  const activeMission = input.activeMissionLabel?.trim() || null
  const industry = extractIndustryFocus(instruction)
  const geography = extractGeography(instruction)
  const companyMatch = matchCompanyName(instruction, input.companyCandidates ?? [])

  if (
    industry &&
    (/focus on|start selling|sell to|shift|should start|we should|think we should|prioritize/i.test(instruction) ||
      /ignored|neglected|too long/i.test(lower))
  ) {
    const marketLabel = geography ? `${industry.label} in ${geography}` : industry.label
    return buildInterpretation({
      intentKind: "shift_market_focus",
      understoodIntent: `Shift today's focus toward ${marketLabel}.`,
      restatement: "Understood.",
      objectiveShiftLabel: `I recommend shifting today's objective toward ${marketLabel}.`,
      planSummary:
        "I'll align discovery and research with this market focus using your existing objectives and mission queue.",
      beforeBeginSteps: [
        `verify ${industry.label} fit our ICP`,
        "identify the best buyer personas",
        "build a qualified discovery audience",
        "begin company research",
      ],
      estimatedEffortLabel: effort ?? "about 6 minutes",
      expectedOutcome: geography
        ? `A qualified ${industry.label} audience in ${geography} ready for research.`
        : `A qualified ${industry.label} audience ready for research.`,
      href: GROWTH_WORKSPACE_PROSPECT_SEARCH_DISCOVER_HREF,
      conflictNote: activeMission
        ? `Your active mission "${activeMission}" will stay running while I queue this market shift.`
        : null,
    })
  }

  if (/similar to|like .* account|accounts like|look like/i.test(lower) && companyMatch) {
    return buildInterpretation({
      intentKind: "similar_accounts",
      understoodIntent: `Find accounts similar to ${companyMatch.companyName}.`,
      restatement: `Understood — you want more companies like ${companyMatch.companyName}.`,
      objectiveShiftLabel: `I'll look for accounts with a similar profile to ${companyMatch.companyName}.`,
      planSummary:
        "I'll use your existing discovery workflow to source lookalike companies and queue them for research.",
      beforeBeginSteps: [
        `review what made ${companyMatch.companyName} a strong fit`,
        "translate that pattern into discovery criteria",
        "import matching companies",
        "begin research on the best matches",
      ],
      estimatedEffortLabel: effort ?? "about 8 minutes",
      expectedOutcome: "A short list of lookalike companies ready for research.",
      href: GROWTH_WORKSPACE_PROSPECT_SEARCH_DISCOVER_HREF,
      conflictNote: activeMission ? `Queued alongside "${activeMission}".` : null,
    })
  }

  if (/meeting|demo|book more|pipeline/i.test(lower) && /increase|more|help|boost|grow/i.test(lower)) {
    return buildInterpretation({
      intentKind: "increase_meetings",
      understoodIntent: "Increase booked meetings.",
      restatement: "Understood — you want more meetings on the calendar.",
      objectiveShiftLabel: "I recommend prioritizing accounts closest to a meeting conversation.",
      planSummary:
        "I'll use your objectives and work queue to focus on accounts with the highest meeting potential.",
      beforeBeginSteps: [
        "review accounts closest to a meeting",
        "prioritize warm follow-ups",
        "prepare meeting-ready outreach where needed",
        "surface the next accounts to advance",
      ],
      estimatedEffortLabel: effort ?? "about 5 minutes",
      expectedOutcome: "Clear next accounts to advance toward booked meetings.",
      href: GROWTH_OBJECTIVES_WORKSPACE_HREF,
      conflictNote: activeMission ? `I'll align this with "${activeMission}" rather than replace it.` : null,
    })
  }

  if (/find\s+\d+|discover\s+\d+|need more|more companies|search for/i.test(instruction) || /find .* companies/i.test(lower)) {
    const countMatch = instruction.match(/\b(\d{1,3})\b/)
    const countLabel = countMatch ? `${countMatch[1]} ` : ""
    const target = industry?.label ?? "companies"
    return buildInterpretation({
      intentKind: "find_leads",
      understoodIntent: `Find ${countLabel}${target}${geography ? ` in ${geography}` : ""}.`.replace(/\s+/g, " "),
      restatement: `Understood — you want ${countLabel}${target}${geography ? ` in ${geography}` : ""}.`,
      objectiveShiftLabel: `I'll build a discovery audience for ${target}${geography ? ` in ${geography}` : ""}.`,
      planSummary: "I'll route this through prospect discovery and your existing mission intake flow.",
      beforeBeginSteps: [
        "confirm ICP fit for this search",
        "build the discovery audience",
        "import matching companies",
        "begin research on the best matches",
      ],
      estimatedEffortLabel: effort ?? "about 10 minutes",
      expectedOutcome: `${countLabel}${target}${geography ? ` in ${geography}` : ""} queued for research.`.trim(),
      href: GROWTH_WORKSPACE_PROSPECT_SEARCH_DISCOVER_HREF,
      conflictNote: activeMission
        ? `Queued alongside "${activeMission}" without replacing it.`
        : null,
    })
  }

  if (companyMatch && /finish|continue|research|complete|resume/i.test(lower)) {
    return buildInterpretation({
      intentKind: "finish_account_work",
      understoodIntent: `Finish work on ${companyMatch.companyName}.`,
      restatement: `Understood — I'll continue with ${companyMatch.companyName}.`,
      objectiveShiftLabel: `I recommend finishing the research for ${companyMatch.companyName}.`,
      planSummary:
        "I'll resume the in-progress research workflow and prepare the account for your review when it's ready.",
      beforeBeginSteps: [
        "review what's already verified",
        "complete remaining research gaps",
        "prepare an outreach package if ready",
        "notify you when review is needed",
      ],
      estimatedEffortLabel: effort ?? "about 3 minutes",
      expectedOutcome: "1 review-ready opportunity package.",
      href: buildGrowthLeadHref(companyMatch.leadId),
      conflictNote: activeMission
        ? `${companyMatch.companyName} stays in focus while "${activeMission}" continues in the background.`
        : null,
    })
  }

  if (/reject|why.*reject|declined|disqualif/i.test(lower)) {
    return buildInterpretation({
      intentKind: "portfolio_review",
      understoodIntent: "Review rejected or disqualified accounts.",
      restatement: "Understood — you want clarity on rejected companies.",
      objectiveShiftLabel: "I'll walk through why those companies were rejected.",
      planSummary: "I'll open your portfolio with rejection context and evidence.",
      beforeBeginSteps: [
        "surface recently rejected accounts",
        "summarize disqualification reasons",
        "highlight any recoverable opportunities",
      ],
      estimatedEffortLabel: "about 2 minutes",
      expectedOutcome: "Clear rejection rationale for the accounts you asked about.",
      href: `${GROWTH_OBJECTIVES_WORKSPACE_HREF}?focus=portfolio`,
      requiresConfirmation: true,
    })
  }

  if (/yesterday|last session|where we left|continue yesterday/i.test(lower)) {
    return buildInterpretation({
      intentKind: "continue_prior_work",
      understoodIntent: "Continue where we left off.",
      restatement: "Understood — I'll pick up where we left off.",
      objectiveShiftLabel: "I recommend resuming your most recent in-progress work.",
      planSummary: "I'll use your operating rhythm and mission queue to restore the last active focus.",
      beforeBeginSteps: [
        "review what was in progress",
        "restore the last active account or mission",
        "continue the next ranked step",
      ],
      estimatedEffortLabel: effort ?? "about 3 minutes",
      expectedOutcome: "Work resumes from your last active focus.",
      href: GROWTH_OBJECTIVES_WORKSPACE_HREF,
      conflictNote: activeMission ? `Continuing from "${activeMission}".` : null,
    })
  }

  if (companyMatch) {
    return buildInterpretation({
      intentKind: "focus_account",
      understoodIntent: `Focus on ${companyMatch.companyName}.`,
      restatement: `Understood — I'll focus on ${companyMatch.companyName}.`,
      objectiveShiftLabel: `I recommend continuing with ${companyMatch.companyName}.`,
      planSummary: "I'll open that account and take the highest-priority next step already ranked for it.",
      beforeBeginSteps: [
        "review current account status",
        "take the next ranked action",
        "update you when review is needed",
      ],
      estimatedEffortLabel: effort ?? "about 3 minutes",
      expectedOutcome: "The account moves to the next ready step in your pipeline.",
      href: buildGrowthLeadHref(companyMatch.leadId),
    })
  }

  return buildInterpretation({
    intentKind: "general_assignment",
    understoodIntent: instruction,
    restatement: `Understood — you asked me to: "${instruction}".`,
    objectiveShiftLabel: "I'll route this through your existing objectives and mission queue.",
    planSummary:
      "I'll map this into the mission and work surfaces already running for your organization — I won't invent a parallel plan.",
    beforeBeginSteps: [
      "interpret the assignment against active objectives",
      "align it with the mission queue",
      "begin the highest-priority matching work",
    ],
    estimatedEffortLabel: effort ?? "about 5 minutes",
    expectedOutcome: "The assignment is tracked against your active objectives.",
    href: GROWTH_OBJECTIVES_WORKSPACE_HREF,
    conflictNote: activeMission
      ? `"${activeMission}" stays active unless you replace it from Objectives.`
      : null,
  })
}
