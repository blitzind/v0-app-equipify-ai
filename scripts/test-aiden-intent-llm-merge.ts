/**
 * Validates merge + confidence tiers for optional LLM intent parsing (no network).
 * Run: pnpm test:aiden-intent-llm-merge
 */
import { parseAidenPreparedWorkspaceIntent } from "../lib/aiden/intent/parse-aiden-intent"
import { mergeDeterministicAndLlmPreparedIntent } from "../lib/aiden/intent/merge-prepared-intent-llm"
import type { AidenPreparedWorkspaceIntentLlmOutput } from "../lib/aiden/intent/aiden-prepared-intent-llm-schema"

function mockLlm(partial: Partial<AidenPreparedWorkspaceIntentLlmOutput> & Pick<AidenPreparedWorkspaceIntentLlmOutput, "actionId" | "confidence">): AidenPreparedWorkspaceIntentLlmOutput {
  return {
    actionId: partial.actionId,
    confidence: partial.confidence,
    customerReference: partial.customerReference ?? null,
    equipmentReference: partial.equipmentReference ?? null,
    workOrderReference: partial.workOrderReference ?? null,
    bulkInvoiceDateRange: partial.bulkInvoiceDateRange ?? null,
    suggestedDraftCopy: partial.suggestedDraftCopy ?? null,
    clarificationQuestion: partial.clarificationQuestion ?? null,
    rationale: partial.rationale ?? null,
  }
}

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg)
}

function main() {
  const det = parseAidenPreparedWorkspaceIntent("What is the weather in Chicago?", {})
  assert(det.status === "unsupported", "det should be unsupported")

  const high = mergeDeterministicAndLlmPreparedIntent(
    det,
    mockLlm({ actionId: "create_invoice_from_work_order", confidence: 0.85, workOrderReference: "latest" }),
    {},
  )
  assert(high.parsedIntent.status === "prepared", "high LLM conf should allow prepared when merged")
  assert(high.parsedIntent.actionId === "create_invoice_from_work_order", "action from LLM")
  assert(high.parseMeta.source === "llm_only", "source llm_only")

  const medium = mergeDeterministicAndLlmPreparedIntent(
    det,
    mockLlm({ actionId: "draft_customer_message", confidence: 0.55 }),
    {},
  )
  assert(medium.parsedIntent.status === "needs_clarification", "medium → clarification")
  assert(medium.parsedIntent.missingFields.includes("intentConfidence"), "medium adds intentConfidence")

  const low = mergeDeterministicAndLlmPreparedIntent(
    det,
    mockLlm({ actionId: "summarize_customer_history", confidence: 0.25 }),
    {},
  )
  assert(low.parsedIntent.status === "needs_clarification", "low with action stays clarification path")
  assert(low.parsedIntent.missingFields.includes("intentConfidence"), "low adds intentConfidence")

  const conflict = mergeDeterministicAndLlmPreparedIntent(
    parseAidenPreparedWorkspaceIntent("Make an invoice for Acme from last job", {
      sourceContext: { customerId: "00000000-0000-4000-8000-000000000001", workOrderId: "00000000-0000-4000-8000-000000000002" },
    }),
    mockLlm({ actionId: "create_quote_from_work_order", confidence: 0.9 }),
    {
      sourceContext: { customerId: "00000000-0000-4000-8000-000000000001", workOrderId: "00000000-0000-4000-8000-000000000002" },
    },
  )
  assert(conflict.parsedIntent.missingFields.includes("actionIntent"), "conflicting actions → actionIntent")
  assert(conflict.parseMeta.llmRejectedReason === "action_id_conflict", "meta reason")

  const attemptedNoOutput = mergeDeterministicAndLlmPreparedIntent(det, null, {}, { llmAttempted: true })
  assert(attemptedNoOutput.parseMeta.llmAttempted === true, "attempted flag")
  assert(attemptedNoOutput.parseMeta.llmOk === false, "not ok")
  assert(attemptedNoOutput.parseMeta.llmRejectedReason === "llm_no_valid_output", "reason")

  console.log("aiden intent LLM merge checks: ok")
}

main()
