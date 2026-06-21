/** GS-AI-PLAYBOOK-3B — Deterministic personalization rewriter (client-safe). */

import {
  firstNameFromContact,
  GROWTH_PERSONALIZATION_AI_PHRASES,
  GROWTH_PERSONALIZATION_FEATURE_DUMP_PATTERNS,
  GROWTH_PERSONALIZATION_GENERIC_OPENING_PATTERNS,
  GROWTH_PERSONALIZATION_HYPE_WORDS,
  GROWTH_PERSONALIZATION_WEAK_CTA_PATTERNS,
  pickVerifiedObservation,
} from "@/lib/growth/personalization/quality/growth-personalization-quality-rules"
import type {
  GrowthPersonalizationQualityChannel,
  GrowthPersonalizationQualityIssueType,
} from "@/lib/growth/personalization/quality/growth-personalization-quality-types"

function trimWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) return words.join(" ")
  return `${words.slice(0, maxWords).join(" ")}…`
}

function trimChars(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  return `${text.slice(0, Math.max(0, maxChars - 1)).trim()}…`
}

function stripAiPhrases(text: string): string {
  let result = text
  for (const phrase of GROWTH_PERSONALIZATION_AI_PHRASES) {
    const pattern = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")
    result = result.replace(pattern, "").replace(/\s{2,}/g, " ").trim()
  }
  return result
}

function softenHype(text: string): string {
  let result = text
  for (const word of GROWTH_PERSONALIZATION_HYPE_WORDS) {
    result = result.replace(new RegExp(`\\b${word}\\b`, "gi"), "")
  }
  return result.replace(/\s{2,}/g, " ").replace(/\s+([,.!?])/g, "$1").trim()
}

function rewriteGenericOpening(input: {
  body: string
  companyName?: string | null
  contactName?: string | null
  allowedFacts?: string[]
}): { body: string; applied: boolean } {
  const first = firstNameFromContact(input.contactName)
  const company = input.companyName?.trim()
  const observation = pickVerifiedObservation(input.allowedFacts ?? [], company)
  let body = input.body
  let applied = false

  for (const pattern of GROWTH_PERSONALIZATION_GENERIC_OPENING_PATTERNS) {
    if (pattern.test(body)) {
      applied = true
      if (first && company && observation) {
        const fact = observation.replace(/^(provides|supports|offers|delivers|operates|specializes)\s+/i, (match) => match)
        body = body.replace(pattern, `${first}, I noticed ${company} ${fact}`)
      } else if (first && company) {
        body = body.replace(pattern, `${first}, I noticed ${company}`)
      } else if (first) {
        body = body.replace(pattern, `Hi ${first},`)
      } else if (company) {
        body = body.replace(pattern, `Regarding ${company},`)
      } else {
        body = body.replace(pattern, "Hi,")
      }
      break
    }
  }

  if (!applied && first && /^hi\b/i.test(body) && !body.toLowerCase().includes(first.toLowerCase())) {
    body = body.replace(/^hi\b/i, `Hi ${first},`)
    applied = true
  }

  return { body: body.trim(), applied }
}

function rewriteFeatureDump(input: {
  body: string
  industryFact?: string | null
  industryLabel?: string | null
}): { body: string; applied: boolean } {
  let applied = false
  let body = input.body
  const replacement = input.industryFact
    ? input.industryFact
    : input.industryLabel
      ? `Many ${input.industryLabel.toLowerCase()} teams eventually reach a point where PM schedules, service history, and compliance activities become difficult to coordinate across technicians and locations. Equipify centralizes those workflows so teams gain visibility without adding administrative overhead.`
      : "Many field service teams eventually reach a point where PM schedules, service history, and dispatch coordination become difficult to manage across technicians and locations. Equipify centralizes those workflows so teams gain visibility without adding administrative overhead."

  for (const pattern of GROWTH_PERSONALIZATION_FEATURE_DUMP_PATTERNS) {
    if (pattern.test(body)) {
      body = body.replace(pattern, replacement)
      applied = true
      break
    }
  }
  return { body: body.trim(), applied }
}

function rewriteWeakCta(input: {
  body: string
  preferredCta?: string | null
  companyName?: string | null
}): { body: string; applied: boolean } {
  const fallback =
    input.preferredCta?.trim() ||
    (input.companyName
      ? `Would it be unreasonable to spend 15 minutes comparing how your team currently manages PM scheduling and service documentation?`
      : "Would it be unreasonable to spend 15 minutes comparing how your team currently manages scheduling and service documentation?")

  let applied = false
  let body = input.body
  for (const pattern of GROWTH_PERSONALIZATION_WEAK_CTA_PATTERNS) {
    if (pattern.test(body)) {
      const normalized = fallback.endsWith("?") ? fallback.slice(0, -1) : fallback
      body = body.replace(pattern, normalized)
      applied = true
    }
  }
  if (!applied && /\bdemo\b/i.test(body) && !/\b15 minutes\b/i.test(body)) {
    const normalized = fallback.endsWith("?") ? fallback.slice(0, -1) : fallback
    body = `${body.replace(/\s+$/, "").replace(/\?+$/, "")} ${normalized}?`
    applied = true
  }
  return { body: body.trim(), applied }
}

function dedupeSentences(text: string): string {
  const parts = text.split(/(?<=[.!?])\s+/)
  const seen = new Set<string>()
  const kept: string[] = []
  for (const part of parts) {
    const key = part.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    kept.push(part.trim())
  }
  return kept.join(" ")
}

function reorderEmailBody(body: string): string {
  const sentences = body.split(/(?<=[.!?])\s+/).map((entry) => entry.trim()).filter(Boolean)
  if (sentences.length <= 2) return body

  const opener: string[] = []
  const industry: string[] = []
  const product: string[] = []
  const cta: string[] = []

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase()
    if (/\?$/.test(sentence) || /\b(demo|walkthrough|conversation|minutes|call)\b/i.test(sentence)) {
      cta.push(sentence)
    } else if (/\bequipify\b/i.test(sentence)) {
      product.push(sentence)
    } else if (/\b(teams|companies|organizations) (in|like|often)\b/i.test(sentence)) {
      industry.push(sentence)
    } else {
      opener.push(sentence)
    }
  }

  return [...opener, ...industry, ...product, ...cta].join(" ")
}

export function rewriteGrowthPersonalizationContent(input: {
  channel: GrowthPersonalizationQualityChannel
  subject?: string | null
  body: string
  companyName?: string | null
  contactName?: string | null
  allowedFacts?: string[]
  industryLabel?: string | null
  industryFact?: string | null
  preferredCta?: string | null
  issues: GrowthPersonalizationQualityIssueType[]
  maxWords?: number
  maxChars?: number
}): { subject: string | null; body: string; rewritesApplied: string[] } {
  const rewritesApplied: string[] = []
  let body = input.body
  let subject = input.subject ?? null

  const shouldFullRewrite = input.channel === "EMAIL" || input.channel === "VOICE" || input.channel === "VIDEO"

  if (input.issues.includes("generic_opening") || (shouldFullRewrite && /^hi there\b/i.test(body))) {
    const rewritten = rewriteGenericOpening({ ...input, body })
    if (rewritten.applied) {
      body = rewritten.body
      rewritesApplied.push("generic_opening")
    }
  }

  if (input.issues.includes("ai_sounding_phrases") || shouldFullRewrite) {
    const cleaned = stripAiPhrases(body)
    if (cleaned !== body) {
      body = cleaned
      rewritesApplied.push("ai_sounding_phrases")
    }
  }

  if (input.issues.includes("too_salesy")) {
    const softened = softenHype(body)
    if (softened !== body) {
      body = softened
      rewritesApplied.push("too_salesy")
    }
  }

  if (input.issues.includes("feature_dump") || (shouldFullRewrite && GROWTH_PERSONALIZATION_FEATURE_DUMP_PATTERNS.some((p) => p.test(body)))) {
    const rewritten = rewriteFeatureDump({ ...input, body })
    if (rewritten.applied) {
      body = rewritten.body
      rewritesApplied.push("feature_dump")
    }
  }

  if (input.issues.includes("weak_cta") || input.issues.includes("too_salesy") || input.channel === "SMS") {
    const rewritten = rewriteWeakCta({ ...input, body })
    if (rewritten.applied) {
      body = rewritten.body
      rewritesApplied.push("weak_cta")
    }
  }

  if (input.issues.includes("repetitive_language")) {
    const deduped = dedupeSentences(body)
    if (deduped !== body) {
      body = deduped
      rewritesApplied.push("repetitive_language")
    }
  }

  if (input.issues.includes("poor_sequence") && input.channel === "EMAIL") {
    const reordered = reorderEmailBody(body)
    if (reordered !== body) {
      body = reordered
      rewritesApplied.push("poor_sequence")
    }
  }

  if (input.channel === "SMS") {
    body = softenHype(stripAiPhrases(body))
    body = trimChars(body, input.maxChars ?? 320)
  } else if (input.maxWords) {
    body = trimWords(body, input.maxWords)
  }

  if (subject && input.issues.includes("generic_opening")) {
    subject = subject.replace(/^quick (note|question)/i, `${input.companyName ?? "your team"} — quick question`)
    rewritesApplied.push("subject_specificity")
  }

  return { subject, body: body.trim(), rewritesApplied: [...new Set(rewritesApplied)] }
}

export function rewriteSharePageContent(input: {
  headline: string
  heroMessage: string
  whyReachingOut: string
  ctaLabel: string
  companyName?: string | null
  allowedFacts?: string[]
}): {
  headline: string
  heroMessage: string
  whyReachingOut: string
  ctaLabel: string
  rewritesApplied: string[]
} {
  const observation = pickVerifiedObservation(input.allowedFacts ?? [], input.companyName)
  const rewritesApplied: string[] = []
  let headline = input.headline
  let heroMessage = input.heroMessage
  let whyReachingOut = input.whyReachingOut
  let ctaLabel = input.ctaLabel

  if (/^welcome to\b/i.test(headline)) {
    headline = input.companyName ? `${input.companyName} — field service visibility` : "Field service visibility"
    rewritesApplied.push("share_headline")
  }

  if (GROWTH_PERSONALIZATION_FEATURE_DUMP_PATTERNS.some((pattern) => pattern.test(heroMessage))) {
    heroMessage = observation
      ? `Teams like ${input.companyName ?? "yours"} often ${observation.replace(/^provides\s+/i, "provide ")}`
      : "Teams in this space often need clearer PM, dispatch, and service history visibility."
    rewritesApplied.push("share_hero")
  }

  if (GROWTH_PERSONALIZATION_WEAK_CTA_PATTERNS.some((pattern) => pattern.test(ctaLabel))) {
    ctaLabel = "Compare your workflow"
    rewritesApplied.push("share_cta")
  }

  whyReachingOut = stripAiPhrases(whyReachingOut)
  return { headline, heroMessage, whyReachingOut, ctaLabel, rewritesApplied }
}

export function rewriteVideoScript(input: {
  script: string
  companyName?: string | null
  allowedFacts?: string[]
}): { script: string; rewritesApplied: string[] } {
  const issues = detectIssuesForVideo(input.script)
  const result = rewriteGrowthPersonalizationContent({
    channel: "VIDEO",
    body: input.script,
    companyName: input.companyName,
    allowedFacts: input.allowedFacts,
    issues,
    maxWords: 180,
  })
  return { script: result.body, rewritesApplied: result.rewritesApplied }
}

function detectIssuesForVideo(text: string): GrowthPersonalizationQualityIssueType[] {
  const issues: GrowthPersonalizationQualityIssueType[] = []
  if (GROWTH_PERSONALIZATION_AI_PHRASES.some((phrase) => text.toLowerCase().includes(phrase))) {
    issues.push("ai_sounding_phrases")
  }
  if (GROWTH_PERSONALIZATION_FEATURE_DUMP_PATTERNS.some((pattern) => pattern.test(text))) {
    issues.push("feature_dump")
  }
  if (GROWTH_PERSONALIZATION_WEAK_CTA_PATTERNS.some((pattern) => pattern.test(text))) {
    issues.push("weak_cta")
  }
  return issues
}
