/**
 * GE-AIOS-CONVERSATION-INTELLIGENCE-1B / 2B — Elite human SDR communication (client-safe).
 * Extends 1A/2A reasoning — customer-facing drafts only. No new persistence.
 */

import type { GrowthOutreachSalesStrategyBrief } from "@/lib/growth/aios/growth/growth-outreach-sales-strategy-brief"
import {
  buildConsultantQuestion,
  consultantOpeningLine,
  passesConsultantTest,
  type GrowthOutreachObservationCandidate,
} from "@/lib/growth/aios/growth/growth-outreach-elite-sdr-intelligence"
import {
  detectHumanAuthenticityFailures,
  GROWTH_AIOS_CONVERSATION_INTELLIGENCE_2B_QA_MARKER,
  hashPick,
  HUMAN_AUTHENTICITY_RESEARCH_REVEAL_PATTERNS,
  HUMAN_AUTHENTICITY_SDR_TEMPLATE_PATTERNS,
  pickHumanEmailVariation,
  type HumanEmailVariation,
} from "@/lib/growth/aios/growth/growth-outreach-human-authenticity"

export const GROWTH_AIOS_CONVERSATION_INTELLIGENCE_1B_QA_MARKER =
  "ge-aios-conversation-intelligence-1b-elite-human-sales-communication-v1" as const

export { GROWTH_AIOS_CONVERSATION_INTELLIGENCE_2B_QA_MARKER }

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
  recommendedFirstQuestion: string | null
  safeRecallOpener: string | null
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
  ...HUMAN_AUTHENTICITY_RESEARCH_REVEAL_PATTERNS,
  ...HUMAN_AUTHENTICITY_SDR_TEMPLATE_PATTERNS,
]

function hashPickLocal(seed: string, options: string[]): string {
  return hashPick(seed, options)
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
    return hashPickLocal(input.seed ?? input.companyName, [
      "Running depot repairs alongside field imaging work isn't a workflow every shop has to coordinate.",
      "National imaging service with depot turnaround is a specific operating rhythm.",
      "Refurb plus field imaging ops across provider sites is a heavier coordination lift than OEM-only shops.",
    ])
  }
  if (/depot|lifecycle|refurbish/.test(lower)) {
    return "Keeping field work synchronized with shop work usually gets harder before anyone notices."
  }
  if (/multi.?site|nationwide|scale/.test(lower)) {
    return "Multi-site service coordination at scale is usually where handoffs get noisy."
  }
  if (/hiring|technician/.test(lower)) {
    return "Hiring field capacity while volume shifts often exposes dispatch strain before teams catch up."
  }
  if (input.equipment[0]) {
    return `${input.equipment.slice(0, 2).join("/")} service work at this scale is an uncommon operating mix.`
  }
  if (input.insight && !/you support|your team|your model/i.test(input.insight)) {
    return input.insight.replace(/^You /, "").replace(/\.$/, ".")
  }
  return `Service operations at ${input.companyName} look more complex than the average shop.`
}

export function buildCuriousQuestion(input: {
  outcome: string | null
  equipment: string[]
  curiousPosture: boolean
  seed: string
  selectedObservation?: GrowthOutreachObservationCandidate | null
  recommendedFirstQuestion?: string | null
}): string {
  if (input.recommendedFirstQuestion?.trim()) {
    const q = input.recommendedFirstQuestion.trim()
    return q.endsWith("?") ? q : `${q}?`
  }
  if (input.selectedObservation) {
    return buildConsultantQuestion({
      observation: input.selectedObservation,
      seed: input.seed,
    })
  }
  const outcome = input.outcome ? conversationalOutcome(input.outcome) : null
  if (/imaging|uptime|depot/.test(outcome ?? "") || /mri|ct/i.test(input.equipment.join(" "))) {
    return hashPickLocal(input.seed, [
      "Installed-base growth making uptime planning harder this year?",
      "Depot turnaround still predictable as volume shifts?",
      "Coordinating field and depot work getting harder as the fleet grows?",
    ])
  }
  if (outcome) {
    return hashPickLocal(input.seed, [
      `${outcome.charAt(0).toUpperCase()}${outcome.slice(1)} on your plate right now?`,
      `${outcome.charAt(0).toUpperCase()}${outcome.slice(1)} harder than it should be?`,
      `${outcome.charAt(0).toUpperCase()}${outcome.slice(1)} becoming more of a focus this quarter?`,
    ])
  }
  if (input.curiousPosture) {
    return hashPickLocal(input.seed, [
      "Off base?",
      "Live issue for you?",
      "Something you're actively working on?",
    ])
  }
  return "Is service coordination still mostly smooth, or starting to fray at the edges?"
}

function buildHumanSubject(ctx: EliteHumanDraftContext): string {
  const company = ctx.brief.companyName
  if (ctx.equipment.some((e) => /mri|ct|imaging/i.test(e))) return `${company} imaging service ops`
  if (ctx.equipment[0]) return `${company} ${ctx.equipment[0]} service`
  if (ctx.industry) return `${company} ${ctx.industry.split(" ")[0]} ops`
  return `${company}`
}

function buildHumanEmailBody(ctx: EliteHumanDraftContext, variationSeed?: string): string {
  const seed = variationSeed ?? ctx.brief.leadId
  const variation = pickHumanEmailVariation(seed)
  const observation = ctx.safeRecallOpener
    ? ctx.safeRecallOpener.charAt(0).toUpperCase() + ctx.safeRecallOpener.slice(1)
    : humanizeObservation({
        insight: ctx.insight,
        equipment: ctx.equipment,
        companyName: ctx.brief.companyName,
        industry: ctx.industry,
        selectedObservation: ctx.selectedObservation,
        seed,
      })
  const question = buildCuriousQuestion({
    outcome: ctx.outcome,
    equipment: ctx.equipment,
    curiousPosture: ctx.curiousPosture,
    seed,
    selectedObservation: ctx.selectedObservation,
    recommendedFirstQuestion: ctx.recommendedFirstQuestion,
  })

  return formatHumanEmailVariant({
    ctx,
    variation,
    observation,
    question,
  })
}

function formatHumanEmailVariant(input: {
  ctx: EliteHumanDraftContext
  variation: HumanEmailVariation
  observation: string
  question: string
}): string {
  const { ctx, variation, observation, question } = input
  const fragment = observation.split(/[.!?]/)[0]?.trim() ?? observation

  switch (variation) {
    case "one_line":
      return [ctx.greeting, `${observation} ${question}`].join("\n")
    case "fragment":
      return [ctx.greeting, "", fragment + ".", "", question].join("\n")
    case "observation_only":
      return [ctx.greeting, "", observation].join("\n")
    case "indirect":
      return [ctx.greeting, "", observation, "", question].join("\n")
    case "soft_close":
      return [
        ctx.greeting,
        "",
        observation,
        "",
        question,
        "",
        "Happy to compare notes if useful.",
      ].join("\n")
    default:
      return [ctx.greeting, "", observation, "", question].join("\n")
  }
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
    recommendedFirstQuestion: ctx.recommendedFirstQuestion,
  })
  const opener = ctx.dmFirst ? `${ctx.dmFirst},` : "Hi,"
  return `${opener} ${observation} ${question}`
}

function compactSmsObservation(observation: string, maxLen: number): string {
  const firstClause =
    observation
      .split(/[.!?]|\s+—\s+/)
      .map((part) => part.trim())
      .find((part) => part.length > 12) ?? observation.trim()
  if (firstClause.length <= maxLen) return firstClause
  const truncated = firstClause.slice(0, maxLen)
  const lastSpace = truncated.lastIndexOf(" ")
  const cut = lastSpace > maxLen * 0.45 ? truncated.slice(0, lastSpace) : truncated
  return cut.replace(/[—\-,;:]+$/, "").trim()
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
  const shortObs = compactSmsObservation(observation, 72)
  const name = ctx.dmFirst ? `${ctx.dmFirst}, ` : ""
  let sms = `${name}quick q on ${ctx.brief.companyName}: ${shortObs}. Reply if off base?`
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
    ...detectHumanAuthenticityFailures(text),
    ...(failsSwapTest(text, companyName) ? ["ai_fingerprint:swap_test_failed"] : []),
    ...(passesConsultantTest(text) ? [] : ["ai_fingerprint:consultant_test_failed"]),
  ]
}

export function reviewHumanAuthenticity(text: string, companyName: string): string[] {
  return reviewEliteHumanCommunication(text, companyName)
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

  const revise = (text: string, channel: "email" | "linkedin" | "sms", attempt = 0): string => {
    const failures = reviewHumanAuthenticity(text, ctx.brief.companyName)
    if (failures.length === 0) return text
    if (attempt >= 4) return text
    if (channel === "email") {
      return revise(
        buildHumanEmailBody(ctx, `${ctx.brief.leadId}:rev:${attempt + 1}`),
        channel,
        attempt + 1,
      )
    }
    if (channel === "linkedin") {
      return revise(buildHumanLinkedIn(ctx), channel, attempt + 1)
    }
    return revise(buildHumanSms(ctx), channel, attempt + 1)
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
    recommendedFirstQuestion:
      brief.consultantDiscoveryIntelligence?.recommendedFirstQuestion ?? null,
    safeRecallOpener: brief.relationshipAssessment?.safeRecall[0]?.naturalPhrase ?? null,
  }
}
