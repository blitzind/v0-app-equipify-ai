/**
 * GE-AIOS-CONVERSATION-INTELLIGENCE-1B — Elite human SDR communication (client-safe).
 * Extends 1A reasoning — customer-facing drafts only. No new persistence.
 */

import type { GrowthOutreachSalesStrategyBrief } from "@/lib/growth/aios/growth/growth-outreach-sales-strategy-brief"
import {
  buildConsultantQuestion,
  consultantOpeningLine,
  passesConsultantTest,
  type GrowthOutreachObservationCandidate,
} from "@/lib/growth/aios/growth/growth-outreach-elite-sdr-intelligence"

export const GROWTH_AIOS_CONVERSATION_INTELLIGENCE_1B_QA_MARKER =
  "ge-aios-conversation-intelligence-1b-elite-human-sales-communication-v1" as const

export type EliteHumanDraftContext = {
  brief: GrowthOutreachSalesStrategyBrief
  greeting: string
  sender: string
  dmFirst: string | null
  insight: string | null
  outcome: string | null
  equipment: string[]
  industry: string | null
  cta: string
  curiousPosture: boolean
  selectedObservation: GrowthOutreachObservationCandidate | null
}

/** Never expose internal reasoning or AI/automation language to prospects. */
export const ELITE_HUMAN_INTERNAL_EXPOSURE_PATTERNS = [
  /confidence score/i,
  /fit score/i,
  /research percent/i,
  /evidence rating/i,
  /\(\d+%\)/,
  /verified description/i,
  /our system found/i,
  /our research determined/i,
  /based on my research/i,
  /based on my analysis/i,
  /i analyzed your website/i,
  /our ai noticed/i,
  /using artificial intelligence/i,
  /internal workflow/i,
  /\bautomation\b/i,
  /\bAI\b/,
  /growth 5f|draft factory|pilot run/i,
]

/** Banned AI / low-performing SDR openers. */
export const ELITE_HUMAN_SDR_BANNED_OPENERS = [
  /hope you(?:'|’)re doing well/i,
  /hope this finds you well/i,
  /\bi noticed\b/i,
  /i wanted to reach out/i,
  /i came across\b/i,
  /i wanted to introduce/i,
  /i thought i(?:'|’)d connect/i,
  /i would love to/i,
  /i'd love to/i,
  /i help companies/i,
  /\bwe help\b/i,
  /i wanted to see if/i,
  /wanted to reach out/i,
  /just checking in/i,
  /circle back/i,
  /touching base/i,
  /reaching out because/i,
  /following up/i,
  /\bi'd appreciate\b/i,
  /quick 15 minutes/i,
]

/** Marketing / AI fingerprint vocabulary in first-touch copy. */
export const ELITE_HUMAN_MARKETING_FINGERPRINTS = [
  /\bleverage\b/i,
  /\bstreamline\b/i,
  /\brobust\b/i,
  /\bcomprehensive\b/i,
  /\bcutting[- ]edge\b/i,
  /\bgame[- ]changer\b/i,
  /\bsynerg/i,
  /\bsolution suite\b/i,
  /\bplatform overview\b/i,
  /\bproduct tour\b/i,
  /one platform/i,
  /\bour platform\b/i,
  /work orders?,?\s*dispatch/i,
  /module|capability checklist/i,
  /the question on my mind/i,
  /service footprint stood out/i,
  /smallest next step/i,
  /worth a brief comparison/i,
]

function hashPick(seed: string, options: string[]): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return options[hash % options.length] ?? options[0]
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed.replace(/\s+/g, " ") : null
}

function conversationalOutcome(outcome: string): string {
  return outcome
    .replace(/^keep /i, "keeping ")
    .replace(/^run /i, "running ")
    .replace(/^reduce /i, "reducing ")
    .replace(/^clarify /i, "clarifying ")
    .replace(/^improve /i, "improving ")
}

export function humanizeObservation(input: {
  insight: string | null
  equipment: string[]
  companyName: string
  industry: string | null
  selectedObservation?: GrowthOutreachObservationCandidate | null
  seed?: string
}): string {
  if (input.selectedObservation) {
    return consultantOpeningLine({
      observation: input.selectedObservation,
      seed: input.seed ?? input.companyName,
    })
  }
  const lower = (input.insight ?? "").toLowerCase()
  if (/imaging|mri|ct|diagnostic/.test(lower) || /mri|ct|imaging/i.test(input.equipment.join(" "))) {
    return hashPick(input.companyName, [
      "MRI/CT depot and field work at your scale isn't common — stood out.",
      "National imaging service with depot turnaround is a specific rhythm.",
      "Refurb + field imaging ops across provider sites — that's a heavy lift.",
    ])
  }
  if (/depot|lifecycle|refurbish/.test(lower)) {
    return "Depot + field lifecycle work is a specific rhythm — not every shop runs it that way."
  }
  if (/multi.?site|nationwide|scale/.test(lower)) {
    return "Multi-site service coordination at your scale is usually where handoffs get noisy."
  }
  if (/hiring|technician/.test(lower)) {
    return "Hiring field capacity while volume shifts — that combo usually exposes workflow strain."
  }
  if (input.equipment[0]) {
    return `${input.equipment.slice(0, 2).join("/")} service work at your scale caught my eye.`
  }
  if (input.insight && !/you support|your team|your model/i.test(input.insight)) {
    return input.insight.replace(/^You /, "Looks like you ").replace(/\.$/, " — stood out.")
  }
  return `Something specific about how ${input.companyName} runs service work caught my eye.`
}

export function buildCuriousQuestion(input: {
  outcome: string | null
  equipment: string[]
  curiousPosture: boolean
  seed: string
  selectedObservation?: GrowthOutreachObservationCandidate | null
}): string {
  if (input.selectedObservation) {
    return buildConsultantQuestion({
      observation: input.selectedObservation,
      seed: input.seed,
    })
  }
  const outcome = input.outcome ? conversationalOutcome(input.outcome) : null
  if (/imaging|uptime|depot/.test(outcome ?? "") || /mri|ct/i.test(input.equipment.join(" "))) {
    return hashPick(input.seed, [
      "Curious if installed-base growth is making uptime planning harder this year — or if you've got that locked down?",
      "Are you finding depot turnaround stays predictable as volume shifts?",
      "Has coordinating field + depot work gotten harder as the fleet grows?",
    ])
  }
  if (outcome) {
    return hashPick(input.seed, [
      `Curious if ${outcome.toLowerCase()} is actually on your plate right now?`,
      `Are you finding ${outcome.toLowerCase()} harder than it should be?`,
      `Has ${outcome.toLowerCase()} become more of a focus this quarter?`,
    ])
  }
  if (input.curiousPosture) {
    return hashPick(input.seed, [
      "Worth asking — or am I off base?",
      "Curious if that's even a live issue for you.",
      "Is that something you're actively working on?",
    ])
  }
  return "Is service coordination still mostly smooth — or starting to fray at the edges?"
}

function buildHumanSubject(ctx: EliteHumanDraftContext): string {
  const company = ctx.brief.companyName
  if (ctx.equipment.some((e) => /mri|ct|imaging/i.test(e))) return `${company} — imaging service ops`
  if (ctx.equipment[0]) return `${company} — ${ctx.equipment[0]} service`
  if (ctx.industry) return `${company} — ${ctx.industry.split(" ")[0]} ops`
  return `${company}`
}

function buildHumanEmailBody(ctx: EliteHumanDraftContext): string {
  const observation = humanizeObservation({
    insight: ctx.insight,
    equipment: ctx.equipment,
    companyName: ctx.brief.companyName,
    industry: ctx.industry,
    selectedObservation: ctx.selectedObservation,
    seed: ctx.brief.leadId,
  })
  const question = buildCuriousQuestion({
    outcome: ctx.outcome,
    equipment: ctx.equipment,
    curiousPosture: ctx.curiousPosture,
    seed: ctx.brief.leadId,
    selectedObservation: ctx.selectedObservation,
  })

  const variant = hashPick(ctx.brief.leadId, ["obs_q", "obs_q_close", "obs_only"])
  const lines = [ctx.greeting, "", observation]

  if (variant === "obs_only" && ctx.curiousPosture) {
    lines.push("", question, "", `— ${ctx.sender}`)
    return lines.join("\n")
  }

  lines.push("", question)

  if (!ctx.curiousPosture && variant === "obs_q_close") {
    lines.push("", "Happy to compare notes if useful — no pitch.")
  }

  lines.push("", `— ${ctx.sender}`)
  return lines.join("\n")
}

function buildHumanLinkedIn(ctx: EliteHumanDraftContext): string {
  const observation = humanizeObservation({
    insight: ctx.insight,
    equipment: ctx.equipment,
    companyName: ctx.brief.companyName,
    industry: ctx.industry,
    selectedObservation: ctx.selectedObservation,
    seed: `${ctx.brief.leadId}:linkedin`,
  })
  const question = buildCuriousQuestion({
    outcome: ctx.outcome,
    equipment: ctx.equipment,
    curiousPosture: true,
    seed: `${ctx.brief.leadId}:linkedin`,
    selectedObservation: ctx.selectedObservation,
  })
  const opener = ctx.dmFirst ? `${ctx.dmFirst} —` : "Hi —"
  return `${opener} ${observation} ${question}`
}

function buildHumanSms(ctx: EliteHumanDraftContext): string {
  const observation = humanizeObservation({
    insight: ctx.insight,
    equipment: ctx.equipment,
    companyName: ctx.brief.companyName,
    industry: ctx.industry,
    selectedObservation: ctx.selectedObservation,
    seed: `${ctx.brief.leadId}:sms`,
  })
  const shortObs = observation.split(/[.!?]/)[0]?.trim() ?? observation
  const name = ctx.dmFirst ? `${ctx.dmFirst}, ` : ""
  let sms = `${name}quick q on ${ctx.brief.companyName}: ${shortObs.slice(0, 72)}. Reply if off base?`
  if (sms.length > 300) sms = `${sms.slice(0, 297).trim()}…`
  return sms
}

export function detectAiFingerprint(text: string): string[] {
  const failures: string[] = []

  for (const pattern of [
    ...ELITE_HUMAN_INTERNAL_EXPOSURE_PATTERNS,
    ...ELITE_HUMAN_SDR_BANNED_OPENERS,
    ...ELITE_HUMAN_MARKETING_FINGERPRINTS,
  ]) {
    if (pattern.test(text)) failures.push(`ai_fingerprint:${pattern.source}`)
  }

  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean)
  const starters = sentences.map((s) => s.split(/\s+/)[0]?.toLowerCase()).filter(Boolean)
  const starterCounts = new Map<string, number>()
  for (const s of starters) starterCounts.set(s, (starterCounts.get(s) ?? 0) + 1)
  for (const [starter, count] of starterCounts) {
    if (count >= 3) failures.push(`ai_fingerprint:repeated_starter:${starter}`)
  }

  const transitionHits = (text.match(/\b(additionally|furthermore|moreover|in conclusion|that said)\b/gi) ?? []).length
  if (transitionHits >= 2) failures.push("ai_fingerprint:transition_stacking")

  const iCount = (text.match(/\bI\b/g) ?? []).length
  const wordCount = text.split(/\s+/).filter(Boolean).length
  if (wordCount < 80 && iCount >= 3) failures.push("ai_fingerprint:i_heavy")

  if (/equipify/i.test(text.split("\n").slice(0, 3).join(" "))) {
    failures.push("ai_fingerprint:seller_first")
  }

  return failures
}

export function failsSwapTest(text: string, companyName: string): boolean {
  const stripped = text
    .replace(new RegExp(companyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "ACME")
    .replace(/ACME/gi, "")
  const specificSignals =
    /mri|ct|imaging|depot|refurb|hvac|biomedical|technician|installed.?base|uptime|dispatch|field service/i
  const genericOnly =
    /service operations|workflow|coordination|operations this quarter|your team/i.test(stripped) &&
    !specificSignals.test(stripped)
  return genericOnly
}

export function reviewEliteHumanCommunication(text: string, companyName: string): string[] {
  return [
    ...detectAiFingerprint(text),
    ...(failsSwapTest(text, companyName) ? ["ai_fingerprint:swap_test_failed"] : []),
    ...(passesConsultantTest(text) ? [] : ["ai_fingerprint:consultant_test_failed"]),
  ]
}

export function buildEliteHumanProspectDrafts(ctx: EliteHumanDraftContext): {
  emailBody: string
  linkedIn: string
  sms: string
  subject: string
  preview: string
} {
  let emailBody = buildHumanEmailBody(ctx)
  let linkedIn = buildHumanLinkedIn(ctx)
  let sms = buildHumanSms(ctx)
  const subject = buildHumanSubject(ctx)
  const preview = emailBody.split("\n").find((line) => line.length > 24 && !line.startsWith("Hi"))?.slice(0, 90) ?? subject

  const revise = (text: string, channel: "email" | "linkedin" | "sms") => {
    const failures = reviewEliteHumanCommunication(text, ctx.brief.companyName)
    if (failures.length === 0) return text
    if (channel === "email") return buildHumanEmailBody({ ...ctx, curiousPosture: true })
    if (channel === "linkedin") return buildHumanLinkedIn({ ...ctx, curiousPosture: true })
    return buildHumanSms(ctx)
  }

  emailBody = revise(emailBody, "email")
  linkedIn = revise(linkedIn, "linkedin")
  sms = revise(sms, "sms")

  return { emailBody, linkedIn, sms, subject, preview }
}

export function extractEliteHumanDraftContext(input: {
  brief: GrowthOutreachSalesStrategyBrief
  senderName?: string | null
}): EliteHumanDraftContext {
  const brief = input.brief
  const dmFirst = brief.decisionMakerAnalysis.name?.trim().split(/\s+/)[0] ?? null
  const greeting = dmFirst ? `Hi ${dmFirst},` : "Hi,"
  const insight =
    clean(brief.evidenceIntelligence?.selectedObservation?.consultantObservation) ??
    clean(brief.conversationStrategy?.primaryInsight) ??
    clean(brief.evidenceIntelligence?.primaryInsight) ??
    clean(brief.operatorReasoning?.primaryInsight)
  const selectedObservation = brief.evidenceIntelligence?.selectedObservation ?? null
  const rawOutcome =
    brief.operatorReasoning?.businessOutcome ??
    brief.conversationStrategy?.businessOutcomeThatMatters ??
    brief.businessProblems[0]?.replace(/\.$/, "") ??
    null
  const equipment = [
    ...(brief.prospectTruth?.evidence ?? [])
      .filter((row) => /equipment/i.test(row.source))
      .map((row) => row.detail),
    ...brief.evidence.filter((row) => /equipment/i.test(row.source)).map((row) => row.detail),
  ].filter(Boolean).slice(0, 3)
  if (!equipment.length) {
    const fromProblems = brief.businessProblems.join(" ")
    const match = fromProblems.match(/\b(MRI|CT|HVAC|imaging|depot)\b/gi)
    if (match) equipment.push(...match)
  }

  return {
    brief,
    greeting,
    sender: input.senderName?.trim() || "Ava",
    dmFirst,
    insight,
    outcome: rawOutcome ? conversationalOutcome(rawOutcome) : null,
    equipment,
    industry: brief.sellerTruth?.matchedIndustryKnowledge ?? null,
    cta: brief.recommendedCta,
    curiousPosture: brief.conversationRisk?.posture === "curious",
    selectedObservation,
  }
}
