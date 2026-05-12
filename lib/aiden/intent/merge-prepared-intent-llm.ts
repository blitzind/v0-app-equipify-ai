import type { AidenParsedPreparedIntent, ParseAidenIntentInputOptions } from "@/lib/aiden/intent/intent-types"
import {
  AIDEN_PREPARED_WORKSPACE_ACTION_IDS,
  type AidenPreparedWorkspaceActionId,
} from "@/lib/aiden/actions/action-types"
import type { AidenPreparedWorkspaceIntentLlmOutput } from "@/lib/aiden/intent/aiden-prepared-intent-llm-schema"
import { stripUuidLikeStrings } from "@/lib/aiden/intent/aiden-prepared-intent-llm-schema"
import {
  AIDEN_PREPARED_INTENT_LLM_HIGH,
  AIDEN_PREPARED_INTENT_LLM_MEDIUM,
} from "@/lib/aiden/intent/aiden-prepared-intent-llm-thresholds"

export type AidenPreparedIntentParseMeta = {
  source: "deterministic_only" | "llm_augmented" | "llm_only"
  llmAttempted: boolean
  llmOk: boolean
  llmRejectedReason?: string
  effectiveConfidence: number
}

export type PreparedWorkspaceIntentParseResult = {
  parsedIntent: AidenParsedPreparedIntent
  parseMeta: AidenPreparedIntentParseMeta
  /** Optional copy hint from LLM for draft-style actions (not executed until resolver + confirm). */
  suggestedDraftCopy?: string | null
}

function isRegisteredPreparedActionId(id: string): id is AidenPreparedWorkspaceActionId {
  return (AIDEN_PREPARED_WORKSPACE_ACTION_IDS as readonly string[]).includes(id)
}

function base(
  partial: Omit<AidenParsedPreparedIntent, "status" | "confidenceScore" | "missingFields"> &
    Pick<AidenParsedPreparedIntent, "actionId">,
  status: AidenParsedPreparedIntent["status"],
  confidenceScore: number,
  missingFields: string[],
): AidenParsedPreparedIntent {
  return {
    status,
    actionId: partial.actionId,
    customerReference: partial.customerReference,
    equipmentReference: partial.equipmentReference,
    workOrderReference: partial.workOrderReference,
    bulkInvoiceDateRange: partial.bulkInvoiceDateRange,
    sourceContext: partial.sourceContext,
    confidenceScore,
    missingFields,
  }
}

function workOrderFromLlm(llm: AidenPreparedWorkspaceIntentLlmOutput): AidenParsedPreparedIntent["workOrderReference"] | undefined {
  const w = llm.workOrderReference
  if (w === null || w === undefined) return undefined
  if (typeof w === "string") {
    const t = w.trim()
    return t.length ? w : undefined
  }
  return w
}

function mergeReferenceFields(
  det: AidenParsedPreparedIntent,
  llm: AidenPreparedWorkspaceIntentLlmOutput,
): Pick<AidenParsedPreparedIntent, "customerReference" | "equipmentReference" | "workOrderReference" | "bulkInvoiceDateRange"> {
  const cust = det.customerReference?.trim() || stripUuidLikeStrings(llm.customerReference ?? undefined)
  const eq = det.equipmentReference?.trim() || stripUuidLikeStrings(llm.equipmentReference ?? undefined)
  const detWo = det.workOrderReference
  const hasDetWo =
    detWo !== undefined &&
    detWo !== null &&
    (typeof detWo === "string" ? detWo.trim().length > 0 : true)
  const wo = hasDetWo ? detWo : workOrderFromLlm(llm) ?? undefined
  const bulk = det.bulkInvoiceDateRange ?? llm.bulkInvoiceDateRange ?? undefined
  return {
    customerReference: cust,
    equipmentReference: eq,
    workOrderReference: wo,
    bulkInvoiceDateRange: bulk,
  }
}

function reduceMissingAfterLlm(detMissing: string[], llm: AidenPreparedWorkspaceIntentLlmOutput): string[] {
  let mf = [...detMissing]
  if (stripUuidLikeStrings(llm.customerReference ?? undefined)) mf = mf.filter((x) => x !== "customerReference")
  if (stripUuidLikeStrings(llm.equipmentReference ?? undefined)) mf = mf.filter((x) => x !== "equipmentReference")
  if (llm.workOrderReference != null && String(llm.workOrderReference).trim()) {
    mf = mf.filter((x) => x !== "workOrderReference")
  }
  if (llm.bulkInvoiceDateRange) mf = mf.filter((x) => x !== "dateRange")
  return mf
}

function finalizeIntent(params: {
  merged: AidenParsedPreparedIntent
  deterministic: AidenParsedPreparedIntent
  llm: AidenPreparedWorkspaceIntentLlmOutput
  hadActionConflict: boolean
}): AidenParsedPreparedIntent {
  const { merged, deterministic: det, llm, hadActionConflict } = params
  if (hadActionConflict) return merged

  if (merged.missingFields.includes("actionIntent")) return merged

  const lc = llm.confidence
  const dc = det.confidenceScore
  const sameAction = Boolean(det.actionId) && det.actionId === merged.actionId

  if (sameAction && det.status === "prepared" && dc >= AIDEN_PREPARED_INTENT_LLM_HIGH && merged.missingFields.length === 0) {
    return {
      ...merged,
      status: "prepared",
      confidenceScore: Math.max(dc, lc),
      missingFields: [],
    }
  }

  const confForTier = !det.actionId && det.status === "unsupported" ? lc : Math.max(dc, lc)

  if (merged.missingFields.length > 0) {
    return {
      ...merged,
      status: "needs_clarification",
      confidenceScore: confForTier,
    }
  }

  if (confForTier >= AIDEN_PREPARED_INTENT_LLM_HIGH) {
    return { ...merged, status: "prepared", missingFields: [], confidenceScore: confForTier }
  }

  if (confForTier >= AIDEN_PREPARED_INTENT_LLM_MEDIUM) {
    const mf = merged.missingFields.includes("intentConfidence") ? merged.missingFields : [...merged.missingFields, "intentConfidence"]
    return {
      ...merged,
      status: "needs_clarification",
      missingFields: mf,
      confidenceScore: confForTier,
    }
  }

  if (!merged.actionId) {
    return base({ actionId: "", sourceContext: merged.sourceContext }, "unsupported", confForTier, [])
  }

  const mf = merged.missingFields.includes("intentConfidence") ? merged.missingFields : [...merged.missingFields, "intentConfidence"]
  return {
    ...merged,
    status: "needs_clarification",
    missingFields: mf,
    confidenceScore: confForTier,
  }
}

/**
 * Combines deterministic intent with a validated LLM proposal. Server resolvers remain authoritative;
 * reject unknown `actionId` before calling. This function does not call the network.
 */
export function mergeDeterministicAndLlmPreparedIntent(
  deterministic: AidenParsedPreparedIntent,
  llm: AidenPreparedWorkspaceIntentLlmOutput | null,
  options: ParseAidenIntentInputOptions,
  mergeOpts?: { llmAttempted?: boolean },
): PreparedWorkspaceIntentParseResult {
  const ctx = options.sourceContext
  const llmWasAttempted = mergeOpts?.llmAttempted ?? Boolean(llm)

  if (!llm) {
    return {
      parsedIntent: deterministic,
      parseMeta: {
        source: "deterministic_only",
        llmAttempted: llmWasAttempted,
        llmOk: false,
        ...(llmWasAttempted ? { llmRejectedReason: "llm_no_valid_output" } : {}),
        effectiveConfidence: deterministic.confidenceScore,
      },
      suggestedDraftCopy: null,
    }
  }

  if (!isRegisteredPreparedActionId(llm.actionId)) {
    return {
      parsedIntent: deterministic,
      parseMeta: {
        source: "deterministic_only",
        llmAttempted: true,
        llmOk: false,
        llmRejectedReason: "unknown_action_id",
        effectiveConfidence: deterministic.confidenceScore,
      },
      suggestedDraftCopy: null,
    }
  }

  const hadActionConflict = Boolean(
    deterministic.actionId && llm.actionId && deterministic.actionId !== llm.actionId,
  )

  const actionId = hadActionConflict ? "" : deterministic.actionId || llm.actionId

  if (hadActionConflict) {
    const merged = base(
      { actionId: "", sourceContext: deterministic.sourceContext },
      "needs_clarification",
      Math.min(deterministic.confidenceScore, llm.confidence),
      ["actionIntent"],
    )
    return {
      parsedIntent: merged,
      parseMeta: {
        source: "llm_augmented",
        llmAttempted: true,
        llmOk: true,
        llmRejectedReason: "action_id_conflict",
        effectiveConfidence: merged.confidenceScore,
      },
      suggestedDraftCopy: null,
    }
  }

  const refs = mergeReferenceFields(deterministic, llm)
  const missingFields = reduceMissingAfterLlm(deterministic.missingFields, llm)

  const mergedBase: AidenParsedPreparedIntent = {
    status: deterministic.status,
    actionId,
    ...refs,
    sourceContext: ctx,
    confidenceScore: Math.max(deterministic.confidenceScore, llm.confidence),
    missingFields,
  }

  let source: AidenPreparedIntentParseMeta["source"] = "llm_augmented"
  if (!deterministic.actionId && deterministic.status === "unsupported") {
    source = "llm_only"
  }

  const finalized = finalizeIntent({
    merged: mergedBase,
    deterministic,
    llm,
    hadActionConflict: false,
  })

  return {
    parsedIntent: finalized,
    parseMeta: {
      source,
      llmAttempted: true,
      llmOk: true,
      effectiveConfidence: finalized.confidenceScore,
    },
    suggestedDraftCopy: llm.suggestedDraftCopy ?? null,
  }
}
