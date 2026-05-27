/** Prompt builders for Signal Copilot — structured JSON in, constrained summaries out. */

import type { SignalCopilotCompanyEvidencePacket } from "@/lib/growth/signals/ai/signal-copilot-types"
import { buildSignalCopilotEvidencePacketJson } from "@/lib/growth/signals/ai/signal-copilot-context-builder"

export const SIGNAL_COPILOT_SYSTEM_PROMPT = `You summarize verified B2B operational signals for sales operators.

Rules:
- Use ONLY facts present in the evidence JSON.
- Do NOT invent people, funding, contracts, budgets, purchases, or buying intent.
- Do NOT recommend autonomous outreach, emails, sequences, or CRM updates.
- Keep summaries operational and probabilistic.
- Return JSON only with keys: short_summary, detailed_summary, reasoning_bullets, suggested_operator_focus, confidence.
- confidence must be one of: low, medium, high.
- reasoning_bullets must cite evidence-backed activity only.
- suggested_operator_focus must be human-review next steps (review/monitor/evaluate), never auto actions.`

export function buildSignalCopilotUserPrompt(packet: SignalCopilotCompanyEvidencePacket): string {
  const evidence = buildSignalCopilotEvidencePacketJson(packet)
  return [
    "Summarize this company's verified signal evidence for an operator dashboard.",
    "Evidence JSON:",
    JSON.stringify(evidence, null, 2),
  ].join("\n\n")
}

export const signalCopilotModelJsonSchemaHint = {
  short_summary: "string (max ~240 chars)",
  detailed_summary: "string (max ~600 chars)",
  reasoning_bullets: "string[] (evidence-backed)",
  suggested_operator_focus: "string[] (human-review actions only)",
  confidence: "low | medium | high",
} as const
