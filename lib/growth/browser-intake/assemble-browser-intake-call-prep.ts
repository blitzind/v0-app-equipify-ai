/** Deterministic call prep assembly from existing Growth Engine data — client-safe. */

import type { GrowthLeadEngineAccountBriefOutput } from "@/lib/growth/lead-engine/account-brief-types"
import type { GrowthLeadEngineCompanyDiscoveryOutput } from "@/lib/growth/lead-engine/company-discovery-types"
import type { GrowthLeadEngineDecisionMakerHypothesisOutput } from "@/lib/growth/lead-engine/decision-maker-hypothesis-types"
import type { GrowthLeadEngineVerificationTriageOutput } from "@/lib/growth/lead-engine/verification-triage-types"
import { GROWTH_NEXT_BEST_ACTION_LABELS } from "@/lib/growth/nba-types"
import type { GrowthNextBestAction } from "@/lib/growth/nba-types"
import type { GrowthResearchRunPublicView } from "@/lib/growth/research/research-types"
import type { GrowthBrowserIntakeCallPrepArtifact } from "@/lib/growth/browser-intake/browser-intake-call-prep-types"

export type BrowserIntakeCallPrepAssemblyInput = {
  lead: {
    id: string
    companyName: string
    contactName: string | null
    title: string | null
    website: string | null
    city: string | null
    state: string | null
    status: string
    score: number | null
    notes: string | null
    nextBestAction: string | null
    nextBestActionReason: string | null
  }
  researchRun: GrowthResearchRunPublicView | null
  accountBrief: GrowthLeadEngineAccountBriefOutput | null
  companyDiscovery: GrowthLeadEngineCompanyDiscoveryOutput | null
  decisionMakerHypothesis: GrowthLeadEngineDecisionMakerHypothesisOutput | null
  verificationTriage: GrowthLeadEngineVerificationTriageOutput | null
  decisionMakers: Array<{ name: string; title: string | null; role: string | null }>
  timelineSummaries: string[]
}

function uniqueStrings(values: Array<string | null | undefined>, limit = 8): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const trimmed = (value ?? "").trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
    if (out.length >= limit) break
  }
  return out
}

function buildWhoTheyAre(input: BrowserIntakeCallPrepAssemblyInput): string {
  const parts: string[] = []
  const contact = input.lead.contactName?.trim()
  const title = input.lead.title?.trim()
  const company = input.lead.companyName.trim()

  if (contact && title) {
    parts.push(`${contact} (${title}) at ${company}.`)
  } else if (contact) {
    parts.push(`${contact} at ${company}.`)
  } else if (title) {
    parts.push(`${title} at ${company}.`)
  } else {
    parts.push(`${company} — primary contact not captured yet.`)
  }

  const dm = input.decisionMakers[0]
  if (dm && dm.name !== contact) {
    parts.push(`Known stakeholder: ${dm.name}${dm.title ? ` (${dm.title})` : ""}.`)
  }

  const location = [input.lead.city, input.lead.state].filter(Boolean).join(", ")
  if (location) parts.push(`Location: ${location}.`)

  if (input.lead.score != null) {
    parts.push(`Lead score ${input.lead.score}.`)
  }

  return parts.join(" ")
}

function buildCompanyOverview(input: BrowserIntakeCallPrepAssemblyInput): string {
  if (input.accountBrief?.company_summary?.trim()) {
    return input.accountBrief.company_summary.trim()
  }
  if (input.researchRun?.researchSummary?.trim()) {
    return input.researchRun.researchSummary.trim()
  }
  if (input.companyDiscovery?.company_profile) {
    const profile = input.companyDiscovery.company_profile
    const industry = profile.industry?.trim()
    const model = profile.business_model?.trim()
    const hq = profile.headquarters?.trim()
    const parts = [`${input.lead.companyName}`]
    if (industry) parts.push(`operates in ${industry}`)
    if (model) parts.push(`(${model})`)
    if (hq) parts.push(`headquartered in ${hq}`)
    return `${parts.join(" ")}.`.replace(/\s+/g, " ")
  }
  const website = input.lead.website?.trim()
  return website
    ? `${input.lead.companyName} — website ${website}. Run research for a richer overview.`
    : `${input.lead.companyName} — limited company context on file.`
}

function buildSuggestedOpener(input: BrowserIntakeCallPrepAssemblyInput): string {
  if (input.researchRun?.suggestedCallOpening?.trim()) {
    return input.researchRun.suggestedCallOpening.trim()
  }
  if (input.accountBrief?.recommended_angle?.trim()) {
    return input.accountBrief.recommended_angle.trim()
  }
  if (input.researchRun?.suggestedPitchAngle?.trim()) {
    return input.researchRun.suggestedPitchAngle.trim()
  }
  const contact = input.lead.contactName?.trim() || "there"
  return `Hi ${contact} — I noticed ${input.lead.companyName} and wanted to learn how you're handling equipment operations and customer workflows today.`
}

function buildDiscoveryQuestions(input: BrowserIntakeCallPrepAssemblyInput): string[] {
  const questions: string[] = []

  for (const pain of input.accountBrief?.pain_points ?? []) {
    if (pain.claim?.trim()) {
      questions.push(`How are you handling ${pain.claim.trim().toLowerCase()} today?`)
    }
  }

  for (const trigger of input.companyDiscovery?.signals.buying_triggers ?? []) {
    if (trigger.trim()) {
      questions.push(`What's driving interest in ${trigger.trim().toLowerCase()} right now?`)
    }
  }

  for (const role of input.decisionMakerHypothesis?.buying_committee.primary_targets ?? []) {
    if (role.role?.trim()) {
      questions.push(`Who owns ${role.role.trim()} decisions on your team?`)
    }
  }

  if (input.researchRun?.industryGuess) {
    questions.push(
      `For ${input.researchRun.industryGuess} operators like yours, what slows down service scheduling or customer follow-up?`,
    )
  }

  questions.push(
    "What tools are you using today for scheduling, dispatch, or customer communication?",
    "If you could fix one operational bottleneck this quarter, what would it be?",
  )

  return uniqueStrings(questions, 6)
}

function buildLikelyObjections(input: BrowserIntakeCallPrepAssemblyInput): string[] {
  const objections: string[] = []

  if (input.accountBrief?.risk_summary?.trim()) {
    objections.push(input.accountBrief.risk_summary.trim())
  }

  for (const item of input.accountBrief?.competitive_context ?? []) {
    if (item.claim?.trim()) objections.push(item.claim.trim())
  }

  for (const code of input.verificationTriage?.verification_reason_codes ?? []) {
    if (code.includes("RISK") || code.includes("CONFLICT") || code.includes("STALE")) {
      objections.push(code.replace(/_/g, " ").toLowerCase())
    }
  }

  for (const disqualifier of input.companyDiscovery?.fit_assessment.disqualifiers ?? []) {
    if (disqualifier.trim()) objections.push(disqualifier.trim())
  }

  objections.push(
    "Not the right time / no budget this quarter",
    "Already using a field service or CRM stack",
    "Need to loop in another decision maker",
  )

  return uniqueStrings(objections, 5)
}

function buildRelevantSignals(input: BrowserIntakeCallPrepAssemblyInput): string[] {
  const signals: string[] = []

  for (const item of input.accountBrief?.growth_signals ?? []) {
    if (item.claim?.trim()) signals.push(item.claim.trim())
  }
  for (const item of input.accountBrief?.buying_signals ?? []) {
    if (item.claim?.trim()) signals.push(item.claim.trim())
  }

  for (const signal of input.companyDiscovery?.signals.growth_signals ?? []) {
    if (signal.trim()) signals.push(signal.trim())
  }
  for (const signal of input.companyDiscovery?.signals.positive_fit_signals ?? []) {
    if (signal.trim()) signals.push(signal.trim())
  }

  for (const pain of input.researchRun?.signals.painSignals ?? []) {
    signals.push(pain.replace(/_/g, " "))
  }

  for (const tech of input.researchRun?.detectedTechnologies ?? []) {
    if (tech.trim()) signals.push(`Technology: ${tech.trim()}`)
  }

  for (const summary of input.timelineSummaries) {
    if (summary.trim()) signals.push(summary.trim())
  }

  if (input.lead.nextBestActionReason?.trim()) {
    signals.push(input.lead.nextBestActionReason.trim())
  }

  return uniqueStrings(signals, 8)
}

function buildRecommendedNextStep(input: BrowserIntakeCallPrepAssemblyInput): string {
  if (input.lead.nextBestAction) {
    const label =
      GROWTH_NEXT_BEST_ACTION_LABELS[input.lead.nextBestAction as GrowthNextBestAction] ??
      input.lead.nextBestAction.replace(/_/g, " ")
    const reason = input.lead.nextBestActionReason?.trim()
    return reason ? `${label} — ${reason}` : label
  }
  if (input.researchRun?.recommendedNextAction?.trim()) {
    return input.researchRun.recommendedNextAction.trim()
  }
  if (input.accountBrief?.recommended_cta?.trim()) {
    return input.accountBrief.recommended_cta.trim()
  }
  if (input.companyDiscovery?.recommended_next_step.action?.trim()) {
    return input.companyDiscovery.recommended_next_step.action.trim()
  }
  return "Confirm fit, validate decision maker, and schedule a discovery follow-up."
}

function resolveDataCompleteness(input: BrowserIntakeCallPrepAssemblyInput): GrowthBrowserIntakeCallPrepArtifact["data_completeness"] {
  const sourceCount =
    (input.researchRun?.status === "completed" ? 1 : 0) +
    (input.accountBrief ? 1 : 0) +
    (input.companyDiscovery ? 1 : 0)
  if (sourceCount >= 2) return "full"
  if (sourceCount === 1) return "partial"
  return "minimal"
}

function resolveSourcesUsed(input: BrowserIntakeCallPrepAssemblyInput): string[] {
  const sources: string[] = ["lead_record"]
  if (input.researchRun?.status === "completed") sources.push("prospect_research")
  if (input.accountBrief) sources.push("account_brief")
  if (input.companyDiscovery) sources.push("company_discovery")
  if (input.decisionMakerHypothesis) sources.push("decision_maker_hypothesis")
  if (input.verificationTriage) sources.push("verification_triage")
  if (input.decisionMakers.length > 0) sources.push("decision_makers")
  if (input.timelineSummaries.length > 0) sources.push("timeline")
  return sources
}

export function assembleBrowserIntakeCallPrep(
  input: BrowserIntakeCallPrepAssemblyInput,
): GrowthBrowserIntakeCallPrepArtifact {
  return {
    lead_id: input.lead.id,
    company_name: input.lead.companyName,
    contact_name: input.lead.contactName,
    who_they_are: buildWhoTheyAre(input),
    company_overview: buildCompanyOverview(input),
    suggested_opener: buildSuggestedOpener(input),
    discovery_questions: buildDiscoveryQuestions(input),
    likely_objections: buildLikelyObjections(input),
    relevant_signals: buildRelevantSignals(input),
    recommended_next_step: buildRecommendedNextStep(input),
    generated_at: new Date().toISOString(),
    sources_used: resolveSourcesUsed(input),
    data_completeness: resolveDataCompleteness(input),
  }
}
