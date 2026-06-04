/** Phase 5.6.1 — Convert internal research/memory signals into customer-facing sales copy. Client-safe. */

export const GROWTH_SMS_CUSTOMER_FACING_QA_MARKER = "growth-sms-customer-facing-v1" as const

const RESEARCH_THEMES = [
  "dispatch_scheduling",
  "communication",
  "invoicing",
  "field_service",
  "general",
] as const

type ResearchTheme = (typeof RESEARCH_THEMES)[number]

const THEME_DETECTORS: { theme: ResearchTheme; patterns: RegExp[] }[] = [
  {
    theme: "dispatch_scheduling",
    patterns: [
      /\bdispatch/i,
      /\bschedul/i,
      /\brouting/i,
      /\btechnician/i,
      /\bmanual (dispatch|book)/i,
      /\bwork order/i,
    ],
  },
  {
    theme: "communication",
    patterns: [/\bphone.?only/i, /\bcustomer communication/i, /\bmissed call/i, /\bcallback/i],
  },
  {
    theme: "invoicing",
    patterns: [/\binvoic/i, /\bbilling/i, /\bpayment/i, /\bar\b/i],
  },
  {
    theme: "field_service",
    patterns: [/\bfield service/i, /\bhvac/i, /\bplumb/i, /\bservice team/i, /\btechnician/i],
  },
]

/** Terms that must not appear in operator-facing send copy (SMS/email/call script). */
export const BLOCKED_CUSTOMER_FACING_TERMS: RegExp[] = [
  /\bmanual dispatch process\b/i,
  /\boperational inefficiency\b/i,
  /\bworkflow bottleneck\b/i,
  /\bfit score\b/i,
  /\blead score\b/i,
  /\bengagement score\b/i,
  /\bpain point\b/i,
  /\bresearch finding\b/i,
  /\bintent classification\b/i,
  /\bnext best action\b/i,
  /\bverified research\b/i,
  /\bconfidence tier\b/i,
  /\bmomentum score\b/i,
  /\bhealth score\b/i,
  /\bcoverage score\b/i,
  /\bworkflow health\b/i,
  /\bhigh.?intent window\b/i,
  /\bmain pain point\b/i,
]

const BENEFIT_BY_THEME: Record<ResearchTheme, string> = {
  dispatch_scheduling:
    "Equipify helps service teams manage scheduling, dispatching, customer communication, and invoicing in one place.",
  communication:
    "Equipify helps service teams keep customer communication, scheduling, and follow-ups organized in one place.",
  invoicing:
    "Equipify helps service teams connect field work, customer updates, and invoicing without juggling separate tools.",
  field_service:
    "Equipify helps field service teams run scheduling, dispatch, customer communication, and invoicing from one platform.",
  general:
    "Equipify helps service teams simplify day-to-day operations — scheduling, dispatch, customer communication, and invoicing.",
}

const CALL_QUESTION_BY_THEME: Record<ResearchTheme, string> = {
  dispatch_scheduling: "Are scheduling and dispatch still taking more manual work than you'd like?",
  communication: "Is keeping customers updated across calls, texts, and jobs still harder than it should be?",
  invoicing: "Are job details, customer updates, and invoicing still living in different places?",
  field_service: "What's the biggest day-to-day ops headache for your team right now?",
  general: "What part of running the business still feels more manual than you'd like?",
}

const OBJECTION_CUSTOMER_LABELS: { pattern: RegExp; label: string }[] = [
  { pattern: /\b(budget|price|cost|expensive|afford)\b/i, label: "budget" },
  { pattern: /\b(timing|timeline|quarter|deadline|later|not now)\b/i, label: "timing" },
  { pattern: /\b(competitor|vendor|incumbent)\b/i, label: "your current setup" },
]

function normalizeWhitespace(text: string): string {
  return text.trim().replace(/\s+/g, " ")
}

export function collectVerifiedResearchSnippets(input: {
  researchPainPoints: string[]
  websiteFindings: string[]
  companySummary?: string | null
  hasWebsiteResearch: boolean
}): string[] {
  if (!input.hasWebsiteResearch) return []
  return [
    ...input.researchPainPoints,
    ...input.websiteFindings,
    ...(input.companySummary?.trim() ? [input.companySummary.trim()] : []),
  ].filter(Boolean)
}

export function detectResearchTheme(rawSnippets: string[]): ResearchTheme {
  const haystack = rawSnippets.join(" ").toLowerCase()
  if (!haystack.trim()) return "general"

  for (const detector of THEME_DETECTORS) {
    if (detector.patterns.some((pattern) => pattern.test(haystack))) {
      return detector.theme
    }
  }

  return "general"
}

export function toCustomerFacingBenefitPhrase(input: {
  rawSnippets: string[]
  industryLabel?: string | null
  hasVerifiedResearch: boolean
}): string | null {
  if (!input.hasVerifiedResearch || input.rawSnippets.length === 0) return null

  const theme = detectResearchTheme(input.rawSnippets)
  if (theme !== "general") {
    return BENEFIT_BY_THEME[theme]
  }

  if (input.industryLabel?.trim() && /hvac|mechanical|plumb|field service/i.test(input.industryLabel)) {
    return BENEFIT_BY_THEME.field_service
  }

  return BENEFIT_BY_THEME.general
}

export function toCustomerFacingCallQuestion(rawSnippets: string[]): string {
  const theme = detectResearchTheme(rawSnippets)
  return CALL_QUESTION_BY_THEME[theme]
}

export function toCustomerFacingObjectionLabel(rawObjection: string): string {
  const haystack = rawObjection.toLowerCase()
  for (const entry of OBJECTION_CUSTOMER_LABELS) {
    if (entry.pattern.test(haystack)) return entry.label
  }
  const stripped = rawObjection.split(":")[0]?.trim() ?? rawObjection
  if (BLOCKED_CUSTOMER_FACING_TERMS.some((pattern) => pattern.test(stripped))) {
    return "that concern"
  }
  return stripped.slice(0, 40).toLowerCase()
}

export function containsBlockedCustomerFacingTerms(text: string): boolean {
  return BLOCKED_CUSTOMER_FACING_TERMS.some((pattern) => pattern.test(text))
}

export function auditCustomerFacingSuggestionCopy(text: string): string[] {
  const warnings: string[] = []
  for (const pattern of BLOCKED_CUSTOMER_FACING_TERMS) {
    const match = text.match(pattern)
    if (match) {
      warnings.push(`Internal-only phrase detected ("${match[0]}") — use customer-facing wording before sending.`)
    }
  }
  return warnings
}

/** Replace any blocked internal phrases that slipped into generated copy. */
export function normalizeCustomerFacingCopy(text: string): string {
  let result = normalizeWhitespace(text)

  const replacements: { pattern: RegExp; replacement: string }[] = [
    { pattern: /\bmanual dispatch process\b/gi, replacement: "scheduling and dispatch" },
    { pattern: /\boperational inefficiency\b/gi, replacement: "day-to-day ops friction" },
    { pattern: /\bworkflow bottleneck\b/gi, replacement: "workflow slowdown" },
    { pattern: /\bmain pain point\b/gi, replacement: "biggest ops headache" },
    { pattern: /\bverified research points?\b/gi, replacement: "a brief overview" },
    { pattern: /\bpain point\b/gi, replacement: "challenge" },
    { pattern: /\bresearch finding\b/gi, replacement: "what we discussed" },
  ]

  for (const { pattern, replacement } of replacements) {
    result = result.replace(pattern, replacement)
  }

  return normalizeWhitespace(result)
}

export function toOperatorFacingCallReason(input: {
  inboundBody: string
  nextBestActionReason?: string | null
}): string {
  const reason = input.nextBestActionReason?.trim()
  if (reason && !containsBlockedCustomerFacingTerms(reason)) {
    return reason
  }
  if (reason) {
    return "Prospect replied with interest on SMS — good moment for a personal follow-up."
  }
  const excerpt = input.inboundBody.trim().slice(0, 80)
  return excerpt
    ? `Prospect asked for more detail via SMS ("${excerpt}").`
    : "Prospect replied on SMS — follow up while the conversation is active."
}

export function toCustomerFacingEmailFollowUpSummary(kind: string, contactLabel: string): string {
  switch (kind) {
    case "send_details_by_email":
      return `${contactLabel}: follow up with a concise email that answers their question — you send manually.`
    case "send_short_overview":
      return `${contactLabel}: email a brief overview of how Equipify can help — you send manually.`
    case "send_scheduling_link":
      return `${contactLabel}: email a scheduling link or offer 2–3 times — you send manually.`
    case "send_proposal_context":
      return `${contactLabel}: email pricing or scope context that matches their question — verify details first.`
    default:
      return `${contactLabel}: follow up by email when ready — you send manually.`
  }
}
