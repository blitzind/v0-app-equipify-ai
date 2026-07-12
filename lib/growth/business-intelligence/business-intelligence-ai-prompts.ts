/** GE-AIOS-8A-4 — Evidence-constrained BI AI prompts (server-only). */

import "server-only"

import type { BusinessIntelligenceAiContextPayload } from "@/lib/growth/business-intelligence/business-intelligence-ai-schema"
import { resolveAiTeammatePresentation } from "@/lib/workspace/ai-teammate-identity"

export function buildBusinessIntelligenceAiSystemPrompt(teammateName?: string | null): string {
  const teammate = resolveAiTeammatePresentation(teammateName)
  return [
    `You are ${teammate.name}, Equipify AI OS Business Intelligence strategist.`,
    "You produce evidence-constrained recommendations from a deterministic Business Intelligence report.",
    "You may recommend actions and strategies. You may NOT invent facts.",
    "",
    "Hard policy:",
    "- Every recommendation MUST include supporting_evidence_ids and/or related_gap_ids from the input payload.",
    "- Do NOT cite evidence IDs or gap IDs that are not provided in the input.",
    "- If evidence is missing for a topic, recommend asking the operator to confirm — use category missing_information and cite the related gap_id.",
    "- Do NOT invent pricing, industries, personas, markets, pain points, or ICP claims.",
    "- If confidence would be low, set requires_human_review to true.",
    "- For evidence conflicts, use category evidence_conflict and cite the related gap_id.",
    "- reasoning must explain which evidence or gaps support the recommendation.",
    "",
    "Return JSON matching the schema exactly.",
  ].join("\n")
}

export function buildBusinessIntelligenceAiUserPrompt(context: BusinessIntelligenceAiContextPayload): string {
  return [
    "Generate evidence-constrained recommendations from this Business Intelligence context.",
    "Use ONLY the evidence IDs and gap IDs listed below.",
    "",
    "Allowed supporting_evidence_ids:",
    JSON.stringify(context.allowed_evidence_ids, null, 2),
    "",
    "Allowed related_gap_ids:",
    JSON.stringify(context.allowed_gap_ids, null, 2),
    "",
    "Confidence summary:",
    JSON.stringify(context.confidence_summary, null, 2),
    "",
    "Evidence-backed fields:",
    JSON.stringify(context.evidence_backed_fields, null, 2),
    "",
    "Gaps:",
    JSON.stringify(context.gaps, null, 2),
    "",
    "Contradictions:",
    JSON.stringify(context.contradictions, null, 2),
    "",
    "Requirements:",
    "- Return recommendations[] only — no new facts.",
    "- For missing pricing (gap missing_pricing_evidence), recommend asking the operator to confirm pricing — do NOT invent prices.",
    "- For contradictions, recommend human review using evidence_conflict.",
    "- Each recommendation must include at least one supporting_evidence_id or related_gap_id.",
  ].join("\n")
}
