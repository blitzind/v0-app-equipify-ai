import type { OperationalModuleContext } from "@/lib/aiden/operational-recommendations-schema"

const RULES = `You are AIden. Reply with JSON only (no markdown fences).

Strict rules:
- Recommendations only — no executing tools, no claiming records were updated, scheduled, or messaged.
- Use ONLY facts present in the operational snapshot JSON. Do not invent customer names, amounts, or IDs.
- relatedRecordIds must be copied exactly from id lists in the snapshot when you cite specific records; omit relatedRecordIds when unsure.
- severity reflects operational risk / urgency implied by the data, not emotion.
- suggestedNextStep is a concise manual follow-up for a human (review, call, reschedule) — never an automated action.
- Tailor emphasis to the current module context when prioritizing which recommendations to surface first.
- If the snapshot is sparse or empty, return a short overview and 0–2 low-severity observations — do not fabricate gaps.`

export function buildOperationalRecommendationsPrompt(args: {
  snapshotJson: string
  moduleContext: OperationalModuleContext
}): { system: string; user: string } {
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
      "relatedRecordIds": string[] (optional, UUIDs from snapshot only)
    }
  ]
}`,
    user: `Current module context for prioritization: ${args.moduleContext}

Operational snapshot (JSON):
${args.snapshotJson}`,
  }
}
