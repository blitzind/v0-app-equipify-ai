/** AI refinement prompts for outreach personalization (slice 6.15B). */

import type { OutreachPersonalizationDraft } from "@/lib/growth/outreach/personalization/personalization-types"
import type { SelectedMessageBlock } from "@/lib/growth/outreach/personalization/personalization-types"

export function buildOutreachRefinementSystemPrompt(maxWords: number): string {
  return [
    "You refine pre-written B2B outreach copy for Equipify Growth Engine.",
    "You may ONLY smooth wording, improve flow, improve readability, reduce spam language, and vary phrasing.",
    "You must NOT invent research, website findings, pain points, company facts, metrics, or personalization.",
    "Do NOT add compliments, urgency, hype, or claims not present in the deterministic draft or allowed facts list.",
    "Do NOT add URLs, product features, or customer stories not in the source material.",
    `Keep the email body at or below ${maxWords} words.`,
    "Return JSON: { subject: string|null, content: string }.",
  ].join("\n")
}

export function buildOutreachRefinementUserPrompt(input: {
  draft: OutreachPersonalizationDraft
  blocks: SelectedMessageBlock[]
  allowedFacts: string[]
  maxWords: number
}): string {
  return JSON.stringify(
    {
      task: "refine_outreach_copy",
      rules: {
        allowed: ["smooth wording", "improve flow", "improve readability", "reduce spam language", "vary phrasing"],
        forbidden: [
          "invent research",
          "invent website findings",
          "invent pain points",
          "invent company facts",
          "invent personalization",
          "fake urgency",
          "hype language",
        ],
        maxWords: input.maxWords,
      },
      deterministicDraft: {
        subject: input.draft.subject,
        body: input.draft.body,
        wordCount: input.draft.wordCount,
      },
      selectedBlocks: input.blocks.map((block) => ({
        key: block.key,
        label: block.label,
        text: block.text,
      })),
      allowedFacts: input.allowedFacts,
    },
    null,
    2,
  )
}
