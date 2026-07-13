/**
 * GE-AIOS-CONVERSATION-INTELLIGENCE-2B — Human authenticity & operator-facing normalization.
 * Extends 1B/2A inside the Conversation Intelligence pipeline. No new persistence.
 */

export const GROWTH_AIOS_CONVERSATION_INTELLIGENCE_2B_QA_MARKER =
  "ge-aios-conversation-intelligence-2b-human-authenticity-v1" as const

/** Wording that reveals research, automation, or template discovery. */
export const HUMAN_AUTHENTICITY_RESEARCH_REVEAL_PATTERNS = [
  /\bsomething i kept coming back to\b/i,
  /\bone thing that stood out\b/i,
  /\bi noticed\b/i,
  /\bit looks like\b/i,
  /\bbased on my research\b/i,
  /\bfrom what i found\b/i,
  /\bi saw\b/i,
  /\bi've been looking\b/i,
  /\bi was reviewing\b/i,
  /\bi came across\b/i,
  /\bafter reading\b/i,
  /\bafter reviewing your website\b/i,
  /\blooking through your company\b/i,
  /\bwhile researching\b/i,
  /\baccording to your website\b/i,
  /\bgathered evidence\b/i,
  /\bprocessed data\b/i,
  /\binferred from\b/i,
  /\bgenerated observations\b/i,
  /\bcrawled pages\b/i,
  /\binspected linkedin\b/i,
  /\banalyzed your website\b/i,
  /\breviewed information\b/i,
  /\bstood out\b/i,
  /\bcaught my eye\b/i,
  /\blooks like you\b/i,
  /\bmade me wonder\b/i,
]

export const HUMAN_AUTHENTICITY_SDR_TEMPLATE_PATTERNS = [
  /hope you(?:'|’)re doing well/i,
  /checking in/i,
  /following up/i,
  /circling back/i,
  /touching base/i,
  /quick introduction/i,
  /just wanted\b/i,
  /i wanted to reach out/i,
  /wanted to reach out/i,
  /i'd love to/i,
  /i would love to/i,
]

function hashStable(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0
  return h
}

export function hashPick<T>(seed: string, options: T[]): T {
  return options[hashStable(seed) % options.length] ?? options[0]
}

export type HumanEmailVariation = "standard" | "one_line" | "fragment" | "observation_only" | "indirect" | "soft_close"

export function pickHumanEmailVariation(seed: string): HumanEmailVariation {
  return hashPick(seed, [
    "standard",
    "one_line",
    "fragment",
    "observation_only",
    "indirect",
    "soft_close",
  ])
}

export function stripResearchRevealPhrases(text: string): string {
  let out = text
  for (const pattern of HUMAN_AUTHENTICITY_RESEARCH_REVEAL_PATTERNS) {
    out = out.replace(pattern, "")
  }
  return out.replace(/\s{2,}/g, " ").replace(/^\s*[-—:]\s*/, "").trim()
}

export function passesRealSalespersonTest(text: string): boolean {
  const combined = [
    ...HUMAN_AUTHENTICITY_RESEARCH_REVEAL_PATTERNS,
    ...HUMAN_AUTHENTICITY_SDR_TEMPLATE_PATTERNS,
    /\b(we help|i help companies|our platform|product tour|book a demo|schedule a call)\b/i,
    /\b(streamline|leverage|comprehensive solution|game.?changer|cutting[- ]edge)\b/i,
  ]
  return !combined.some((pattern) => pattern.test(text))
}

export function detectHumanAuthenticityFailures(text: string): string[] {
  const failures: string[] = []
  for (const pattern of HUMAN_AUTHENTICITY_RESEARCH_REVEAL_PATTERNS) {
    if (pattern.test(text)) failures.push(`human_authenticity:research_reveal:${pattern.source}`)
  }
  for (const pattern of HUMAN_AUTHENTICITY_SDR_TEMPLATE_PATTERNS) {
    if (pattern.test(text)) failures.push(`human_authenticity:sdr_template:${pattern.source}`)
  }
  if (
    /\b(we help|i help companies|our platform|product tour|book a demo|schedule a call)\b/i.test(text)
  ) {
    failures.push("human_authenticity:pitch_first")
  }
  return failures
}
