import type { GrowthReplyObjectionEvidence } from "@/lib/growth/reply-intelligence/reply-intent-types"

type ObjectionRule = {
  category: string
  patterns: RegExp[]
  summary: string
  suggestedResponseAngle: string
  suggestedReplyDraft: string
  confidence: number
}

const OBJECTION_RULES: ObjectionRule[] = [
  {
    category: "price",
    patterns: [/too expensive/i, /no budget/i, /can't afford/i, /price is too high/i],
    summary: "Price or budget concern raised.",
    suggestedResponseAngle: "Acknowledge budget constraints; offer scoped options or ROI framing.",
    suggestedReplyDraft: "Thanks for sharing that — budget matters. Happy to outline options that fit your scope and timeline.",
    confidence: 0.8,
  },
  {
    category: "timing",
    patterns: [/not now/i, /maybe later/i, /next quarter/i, /bad timing/i, /check back/i],
    summary: "Timing deferral or not-now objection.",
    suggestedResponseAngle: "Respect timing; propose a lightweight follow-up checkpoint.",
    suggestedReplyDraft: "Understood on timing. I can follow up when you suggest — no pressure in the meantime.",
    confidence: 0.75,
  },
  {
    category: "authority",
    patterns: [/need approval/i, /not my decision/i, /talk to my (boss|manager|director|vp)/i],
    summary: "Authority or internal approval objection.",
    suggestedResponseAngle: "Help map stakeholders; offer materials for internal champion.",
    suggestedReplyDraft: "Makes sense — happy to share a concise overview your team can review internally.",
    confidence: 0.75,
  },
  {
    category: "need",
    patterns: [/not a priority/i, /don't see the need/i, /not relevant/i, /no use case/i],
    summary: "Need or relevance objection.",
    suggestedResponseAngle: "Clarify specific pain tied to their context without overstating fit.",
    suggestedReplyDraft: "Appreciate the candor — could I ask what you're prioritizing this quarter so I don't miss the mark?",
    confidence: 0.7,
  },
  {
    category: "trust",
    patterns: [/never heard of/i, /who are you/i, /is this legit/i, /skeptical/i],
    summary: "Trust or credibility concern.",
    suggestedResponseAngle: "Provide verifiable social proof and transparent next steps.",
    suggestedReplyDraft: "Fair question — we're Equipify. Happy to share references or a brief overview so you can evaluate comfortably.",
    confidence: 0.7,
  },
  {
    category: "competitor",
    patterns: [/already use/i, /compared to/i, /versus/i, /\bvs\b/i, /competitor/i],
    summary: "Competitive or incumbent solution mentioned.",
    suggestedResponseAngle: "Acknowledge incumbent; focus on differentiated outcomes, not attacks.",
    suggestedReplyDraft: "Thanks — many teams evaluate alongside existing tools. Happy to share where customers see differentiated value.",
    confidence: 0.75,
  },
  {
    category: "integration",
    patterns: [/integrate/i, /integration/i, /connect to/i, /api/i],
    summary: "Integration feasibility concern or question.",
    suggestedResponseAngle: "Offer concrete integration path or discovery call for technical fit.",
    suggestedReplyDraft: "Good question on integration — I can outline supported paths or loop in technical details on a brief call.",
    confidence: 0.7,
  },
  {
    category: "implementation_effort",
    patterns: [/implementation/i, /rollout/i, /onboarding/i, /too much work/i, /heavy lift/i],
    summary: "Implementation effort concern.",
    suggestedResponseAngle: "Reduce perceived lift with phased rollout or supported onboarding.",
    suggestedReplyDraft: "Implementation effort is a fair concern — we typically phase rollout to minimize disruption.",
    confidence: 0.7,
  },
  {
    category: "contract_commitment",
    patterns: [/contract/i, /locked in/i, /renewal/i, /long-term commitment/i],
    summary: "Contract or commitment constraint.",
    suggestedResponseAngle: "Explore timing aligned to renewal windows without pressure.",
    suggestedReplyDraft: "Understood on contract timing — we can align evaluation to your renewal window if helpful.",
    confidence: 0.65,
  },
  {
    category: "not_a_fit",
    patterns: [/not a fit/i, /doesn't apply/i, /wrong industry/i],
    summary: "Explicit not-a-fit signal.",
    suggestedResponseAngle: "Confirm fit honestly; close loop respectfully.",
    suggestedReplyDraft: "Thanks for letting us know — we'll close the loop on our side.",
    confidence: 0.8,
  },
  {
    category: "already_have_solution",
    patterns: [/already have a solution/i, /already solved/i, /we're all set/i],
    summary: "Incumbent solution already in place.",
    suggestedResponseAngle: "Explore whether any gaps remain without dismissing current stack.",
    suggestedReplyDraft: "Glad you have something in place — if any gaps come up later, happy to compare notes.",
    confidence: 0.75,
  },
]

function excerptAroundMatch(body: string, match: RegExpMatchArray): string {
  const index = match.index ?? 0
  const start = Math.max(0, index - 25)
  const end = Math.min(body.length, index + match[0].length + 35)
  return body.slice(start, end).trim()
}

export function detectReplyObjections(bodyPreview: string | null | undefined): GrowthReplyObjectionEvidence[] {
  const body = bodyPreview?.trim() ?? ""
  if (!body) return []

  const objections: GrowthReplyObjectionEvidence[] = []

  for (const rule of OBJECTION_RULES) {
    for (const pattern of rule.patterns) {
      const match = body.match(pattern)
      if (!match) continue
      objections.push({
        category: rule.category,
        summary: rule.summary,
        excerpt: excerptAroundMatch(body, match),
        confidence: rule.confidence,
        suggestedResponseAngle: rule.suggestedResponseAngle,
        suggestedReplyDraft: rule.suggestedReplyDraft,
      })
      break
    }
  }

  return objections
}
