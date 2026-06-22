/** GS-GROWTH-WARMUP-EXECUTOR-1A — safe warmup message templates (client-safe). */

export type GrowthWarmupMessageTemplate = {
  id: string
  subject: string
  body: string
}

export const GROWTH_WARMUP_MESSAGE_TEMPLATES: GrowthWarmupMessageTemplate[] = [
  {
    id: "simple_check_in",
    subject: "Quick check-in",
    body: "Hi — just a quick note to confirm this inbox is working normally today. No action needed unless something looks off on your end.",
  },
  {
    id: "quick_note",
    subject: "Short note",
    body: "Hello — sending a brief note through our outbound systems to keep mailbox activity healthy. Hope your week is going well.",
  },
  {
    id: "internal_systems_test",
    subject: "Internal systems test",
    body: "This is a low-volume internal systems test message from our Growth Engine warmup routine. Please ignore unless you notice a delivery issue.",
  },
  {
    id: "helpful_resource",
    subject: "Sharing a helpful resource",
    body: "Hi — sharing a quick operational update from our team. We are testing deliverability on this mailbox and appreciate your patience with occasional check-in messages.",
  },
  {
    id: "light_business_update",
    subject: "Light business update",
    body: "Hello — a brief operational update from our side. This message is part of our controlled mailbox warmup process and does not require a reply.",
  },
]

export function pickWarmupMessageTemplate(input: {
  seed: string
  index?: number
}): GrowthWarmupMessageTemplate {
  const templates = GROWTH_WARMUP_MESSAGE_TEMPLATES
  if (templates.length === 0) {
    return { id: "fallback", subject: "Check-in", body: "Hello — quick mailbox check-in." }
  }
  const hash = [...input.seed].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  const idx = input.index ?? hash % templates.length
  return templates[idx % templates.length]!
}
