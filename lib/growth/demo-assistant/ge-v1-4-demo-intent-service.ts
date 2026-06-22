/** GE-v1-4 — Demo intent detection (deterministic, no LLM). */

import type { GeV14DemoIntentKind, GeV14DemoIntentResult } from "@/lib/growth/demo-assistant/ge-v1-4-types"

const PRICING_PATTERNS = [
  "price",
  "pricing",
  "cost",
  "how much",
  "subscription",
  "per user",
  "license fee",
  "budget",
]

const INTEGRATION_PATTERNS = [
  "integrate",
  "integration",
  "quickbooks",
  "quick books",
  "qbo",
  "api",
  "connect",
  "sync",
]

const IMPLEMENTATION_PATTERNS = [
  "implement",
  "implementation",
  "onboard",
  "onboarding",
  "setup",
  "migration",
  "go live",
  "timeline",
  "rollout",
]

const FEATURE_PATTERNS = [
  "feature",
  "work order",
  "schedule",
  "invoice",
  "payment",
  "mobile",
  "dispatch",
  "quote",
  "can you",
  "does equipify",
  "do you support",
]

const DEMO_PATTERNS = [
  "book demo",
  "schedule demo",
  "see a demo",
  "walkthrough",
  "talk to sales",
  "meet with",
  "set up a call",
  "demo",
]

function matchesAny(text: string, patterns: string[]): boolean {
  return patterns.some((pattern) => text.includes(pattern))
}

function detectIntentKinds(question: string): GeV14DemoIntentKind[] {
  const text = question.toLowerCase().trim()
  const intents: GeV14DemoIntentKind[] = []

  if (matchesAny(text, DEMO_PATTERNS)) intents.push("demo")
  if (matchesAny(text, PRICING_PATTERNS)) intents.push("pricing")
  if (matchesAny(text, INTEGRATION_PATTERNS)) intents.push("integration")
  if (matchesAny(text, IMPLEMENTATION_PATTERNS)) intents.push("implementation")
  if (matchesAny(text, FEATURE_PATTERNS)) intents.push("feature")

  if (intents.length === 0) intents.push("general")
  return [...new Set(intents)]
}

export function detectDemoAssistantIntent(question: string): GeV14DemoIntentResult {
  const detectedIntents = detectIntentKinds(question)
  const primaryIntent = detectedIntents[0] ?? "general"

  const suggestDemo =
    detectedIntents.includes("demo") ||
    detectedIntents.includes("pricing") ||
    detectedIntents.includes("integration") ||
    detectedIntents.includes("implementation")

  const suggestImmediateFollowUp =
    detectedIntents.includes("demo") ||
    (detectedIntents.includes("pricing") && detectedIntents.includes("implementation"))

  let confidence: GeV14DemoIntentResult["confidence"] = "low"
  if (detectedIntents.includes("demo") || detectedIntents.length >= 2) {
    confidence = "high"
  } else if (suggestDemo) {
    confidence = "medium"
  }

  const rationaleParts: string[] = []
  if (detectedIntents.includes("pricing")) {
    rationaleParts.push("Pricing questions are best answered on a live demo.")
  }
  if (detectedIntents.includes("integration")) {
    rationaleParts.push("Integration scope varies by customer setup.")
  }
  if (detectedIntents.includes("implementation")) {
    rationaleParts.push("Implementation timelines depend on rollout complexity.")
  }
  if (detectedIntents.includes("demo")) {
    rationaleParts.push("Prospect expressed demo intent.")
  }
  if (rationaleParts.length === 0) {
    rationaleParts.push("General product question — informational response.")
  }

  return {
    primaryIntent,
    detectedIntents,
    suggestDemo,
    suggestImmediateFollowUp,
    confidence,
    rationale: rationaleParts.join(" "),
  }
}

export function buildConversationOutcome(input: {
  questions: string[]
  intents: GeV14DemoIntentKind[]
  bookingOffered: boolean
  bookingStarted: boolean
  bookingCompleted: boolean
}): import("@/lib/growth/demo-assistant/ge-v1-4-types").GeV14ConversationOutcome {
  const uniqueTopics = [...new Set(input.intents.filter((i) => i !== "general"))]
  const highIntentSignals = input.intents.filter(
    (i) => i === "pricing" || i === "demo" || i === "implementation",
  ).length

  let bookingOutcome: "none" | "offered" | "started" | "completed" = "none"
  if (input.bookingCompleted) bookingOutcome = "completed"
  else if (input.bookingStarted) bookingOutcome = "started"
  else if (input.bookingOffered) bookingOutcome = "offered"

  const topicLabel =
    uniqueTopics.length > 0 ? uniqueTopics.join(", ") : "general product questions"

  return {
    summary: `Prospect asked ${input.questions.length} question(s) about ${topicLabel}.${bookingOutcome !== "none" ? ` Booking ${bookingOutcome}.` : ""}`,
    keyTopics: uniqueTopics.length > 0 ? uniqueTopics : ["general"],
    detectedIntents: [...new Set(input.intents)],
    bookingOutcome,
    confidenceIndicators: {
      questionCount: input.questions.length,
      highIntentSignals,
      demoSuggested: input.bookingOffered,
    },
  }
}
