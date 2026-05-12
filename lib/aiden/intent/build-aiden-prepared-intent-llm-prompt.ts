import { AIDEN_PREPARED_WORKSPACE_ACTION_IDS } from "@/lib/aiden/actions/action-types"
import type { AidenParsedPreparedIntent } from "@/lib/aiden/intent/intent-types"

const ACTION_LIST = AIDEN_PREPARED_WORKSPACE_ACTION_IDS.map((id) => `- ${id}`).join("\n")

export function buildAidenPreparedIntentLlmPrompt(params: {
  userMessage: string
  deterministicSummary: Pick<AidenParsedPreparedIntent, "status" | "actionId" | "confidenceScore" | "missingFields">
}): { system: string; user: string } {
  const det = params.deterministicSummary
  const system = [
    "You classify a single user message into one structured JSON object for a field-service workspace assistant.",
    "Output must be JSON only, matching the caller's schema (strict fields).",
    "",
    "Hard rules:",
    `actionId must be exactly one of these ids (no other strings):\n${ACTION_LIST}`,
    "- Never invent database record UUIDs. customerReference and equipmentReference are human phrases only (names, labels), never UUIDs.",
    "- Never invent prices, totals, tax, or payment amounts.",
    "- Never claim an action completed, was sent, synced, charged, or deleted. You only propose intent; the server runs tools after validation and user confirmation.",
    "- Do not describe SQL, arbitrary tools, or unrestricted execution.",
    "- suggestedDraftCopy is optional prose for draft_customer_message style requests only; it is not executed as a side effect by itself.",
    "- confidence is your calibrated probability 0..1 that actionId matches the user's primary request given the message and deterministic hints.",
    "",
    "Use clarificationQuestion when confidence is medium or fields are ambiguous.",
  ].join("\n")

  const user = [
    "User message:",
    params.userMessage.trim().slice(0, 20_000),
    "",
    "Deterministic parser hint (may be wrong on messy language — still respect guardrails):",
    JSON.stringify(det),
  ].join("\n")

  return { system, user }
}
