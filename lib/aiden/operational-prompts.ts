import type { OperationalModuleContext } from "@/lib/aiden/operational-recommendations-schema"

const RULES = `You are AIden. Reply with JSON only (no markdown fences).

Strict rules:
- Recommendations only — no executing tools, no claiming records were updated, scheduled, or messaged.
- Use ONLY facts present in the operational snapshot JSON. Do not invent customer names, amounts, or IDs.
- relatedRecordIds must be copied exactly from id lists in the snapshot when you cite specific records; omit relatedRecordIds when unsure.
- severity reflects operational risk / urgency implied by the data, not emotion.
- suggestedNextStep is a concise manual follow-up for a human (review, call, reschedule) — never an automated action.
- insightTheme (optional) must be one of the canonical Phase 27 themes when it fits the observation (revenue_opportunity, collections_risk, dispatch_backlog, capacity_risk, repeat_repair, maintenance_upsell, warranty_window, inventory_risk, follow_up_risk, communications_risk, automation_health, certificate_release, customer_retention_risk).
- sourceSignals (optional) lists short factual cues from the snapshot (counts, thresholds) — no customer names.
- Tailor emphasis to the current module context when prioritizing which recommendations to surface first.
- The snapshot JSON may include \`operationalHealthScores\` with deterministic 0–100 category scores, overall band, contributing factors, and methodology notes — descriptive indices only, not predictions. If referenced, do not contradict those numbers.
- The snapshot JSON may include \`industryOperational\` with deterministicInsights (each includes severity, confidence, category, urgency, thresholdsUsed, supportingMetrics) plus dashboard/maintenance operational summary rows. Those items are pre-computed from the same workspace data — if you reference them, keep counts identical and do not contradict them.
- If the snapshot is sparse or empty, return a short overview and 0–2 low-severity observations — do not fabricate gaps.`

export function buildOperationalRecommendationsPrompt(args: {
  snapshotJson: string
  moduleContext: OperationalModuleContext
  /** Optional workspace-vertical framing (tone only; facts still from snapshot). */
  sectorFraming?: string | null
}): { system: string; user: string } {
  const framing = (args.sectorFraming ?? "").trim()
  const framingBlock =
    framing.length > 0
      ? `

Workspace vertical guidance (tone only — all factual claims must still come from the snapshot JSON):
${framing}`
      : ""

  return {
    system: `${RULES}

Return JSON:
{
  "overview": string (optional, one short paragraph),
  "recommendations": [
    {
      "title": string,
      "severity": "low" | "medium" | "high",
      "category": string,
      "explanation": string,
      "suggestedNextStep": string,
      "relatedModule": "${args.moduleContext}" | other module keys from the schema,
      "insightTheme": string (optional, canonical theme id),
      "sourceSignals": string[] (optional),
      "relatedRecordIds": string[] (optional, UUIDs from snapshot only)
    }
  ]
}`,
    user: `Current module context for prioritization: ${args.moduleContext}
${framingBlock}

Operational snapshot (JSON):
${args.snapshotJson}`,
  }
}
