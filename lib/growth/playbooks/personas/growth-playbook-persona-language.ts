/** GS-AI-PLAYBOOK-2E — Persona language profiles (client-safe). */

import type {
  GrowthPersonaLanguageStyle,
  GrowthPersonaMessagingFramework,
  GrowthPersonaMessageLengthPreference,
} from "@/lib/growth/playbooks/personas/growth-playbook-persona-types"

const LANGUAGE_PROFILES: Record<
  GrowthPersonaLanguageStyle,
  { tone: string; vocabulary: string[]; sentenceStyle: string }
> = {
  executive: {
    tone: "Executive — concise, outcome-first, business impact oriented.",
    vocabulary: ["margin", "ROI", "scalability", "contract performance", "cost-to-serve"],
    sentenceStyle: "Short sentences. Lead with outcomes. Avoid tactical jargon unless requested.",
  },
  technical: {
    tone: "Technical — compliance-aware, process precision, audit-ready language.",
    vocabulary: ["PM compliance", "traceability", "audit trail", "recall", "documentation", "asset register"],
    sentenceStyle: "Use precise operational terms. Reference workflows and documentation quality.",
  },
  operational: {
    tone: "Operational — workflow-focused, dispatch and technician language.",
    vocabulary: ["dispatch", "backlog", "first-time fix", "closeout", "truck roll", "utilization"],
    sentenceStyle: "Speak to daily execution. Emphasize visibility and coordination.",
  },
  strategic: {
    tone: "Strategic — systems thinking, standardization, multi-location framing.",
    vocabulary: ["standardization", "portfolio", "capacity", "cross-site visibility", "operating model"],
    sentenceStyle: "Connect tactical pain to organizational design and scale.",
  },
  tactical: {
    tone: "Tactical — coordination-first, scheduling and communication clarity.",
    vocabulary: ["schedule board", "technician status", "route", "priority queue", "reroute"],
    sentenceStyle: "Plain language. Focus on immediate coordination wins.",
  },
  consultative: {
    tone: "Consultative — discovery-oriented, respectful, non-assumptive.",
    vocabulary: ["workflow", "priorities", "current process", "tradeoffs", "readiness"],
    sentenceStyle: "Ask-oriented phrasing. Avoid prescriptive claims about their business.",
  },
}

const LENGTH_GUIDANCE: Record<GrowthPersonaMessageLengthPreference, string> = {
  concise: "Keep copy concise — 2–4 short paragraphs or equivalent; prioritize one proof and one CTA.",
  moderate: "Moderate length — enough context for persona priorities without feature dumping.",
  detailed: "Detailed allowed — include persona priorities, proof, and discovery angle when channel budget permits.",
}

export function buildPersonaLanguageBlock(framework: GrowthPersonaMessagingFramework): string {
  const profile = LANGUAGE_PROFILES[framework.languageStyle]
  return [
    `Language style: ${profile.tone}`,
    `Sentence guidance: ${profile.sentenceStyle}`,
    `Preferred vocabulary: ${profile.vocabulary.join(", ")}`,
    `Message length: ${LENGTH_GUIDANCE[framework.messageLengthPreference]}`,
    `Persona priorities to reflect: ${framework.priorities.slice(0, 4).join("; ")}`,
  ].join("\n")
}

export function buildPersonaOpeningGuidance(framework: GrowthPersonaMessagingFramework): string {
  return framework.openingStrategies.join(" ")
}
