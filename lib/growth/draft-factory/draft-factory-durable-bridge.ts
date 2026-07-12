/**
 * SV1-5 — Bridge SV1-3 advances into durable Draft Factory state (non-authoritative → durable SoR).
 */

import { reconstructDraftFactoryStateFromCanonicalData } from "@/lib/growth/draft-factory/draft-factory-durable-engine"
import {
  getDurableDraftFactoryLeadState,
  upsertDurableDraftFactoryLeadState,
} from "@/lib/growth/draft-factory/draft-factory-durable-store"
import { normalizeDraftFactoryWake } from "@/lib/growth/draft-factory/draft-factory-durable-engine"
import type { AiOsDraftFactoryDurableState } from "@/lib/growth/draft-factory/draft-factory-durable-types"
import type {
  AiOsDraftFactoryAdvanceResult,
  AiOsDraftFactoryLeadRecord,
  AiOsDraftFactoryState,
  AiOsDraftFactoryWakeSource,
} from "@/lib/growth/draft-factory/draft-factory-types"

function mapSv13StateToDurable(state: AiOsDraftFactoryState): AiOsDraftFactoryDurableState {
  if (state === "waiting_for_dm") return "waiting_for_dm"
  if (state === "waiting_for_personalization") return "waiting_for_personalization"
  if (state === "waiting_for_generation") return "waiting_for_generation"
  if (state === "waiting_for_research") return "waiting_for_research"
  if (state === "research_complete") return "research_complete"
  if (state === "draft_ready") return "draft_ready"
  if (state === "waiting_for_approval") return "waiting_for_approval"
  if (state === "approved") return "approved"
  if (state === "executed") return "executed"
  if (state === "rejected") return "rejected"
  if (state === "paused") return "paused"
  return "failed"
}

function mapSv13StageToDurable(
  stage: AiOsDraftFactoryLeadRecord["earliestIncompleteStage"],
): ReturnType<typeof reconstructDraftFactoryStateFromCanonicalData>["earliestIncompleteStage"] {
  if (!stage) return "complete"
  if (stage === "admission") return "qualification"
  if (stage === "knowledge") return "research"
  if (stage === "approval_queue") return "approval"
  if (
    stage === "research" ||
    stage === "investment" ||
    stage === "portfolio" ||
    stage === "decision_maker" ||
    stage === "personalization" ||
    stage === "generation"
  ) {
    return stage
  }
  return "research"
}

export function syncSv13AdvanceIntoDurableStore(input: {
  organizationId: string
  leadId: string
  wakeSource: AiOsDraftFactoryWakeSource | string
  advance: AiOsDraftFactoryAdvanceResult
  record: AiOsDraftFactoryLeadRecord
  now: string
}): void {
  const existing = getDurableDraftFactoryLeadState(input.organizationId, input.leadId)
  const base =
    existing ??
    reconstructDraftFactoryStateFromCanonicalData({
      organizationId: input.organizationId,
      leadId: input.leadId,
      evidence: {
        admitted: true,
        researchCurrent: input.record.stageFlags.researchCurrent,
        knowledgeComplete: input.record.stageFlags.knowledgeComplete,
        stopInvestment: false,
        portfolioSelected: input.record.stageFlags.portfolioSelected,
        decisionMakerAvailable: input.record.stageFlags.decisionMakerAvailable,
        contactVerifiedForEmail: input.record.stageFlags.decisionMakerAvailable,
        personalizationReady: input.record.stageFlags.personalizationReady,
        draftValid: input.record.stageFlags.draftValid,
        packageId: input.record.package?.factoryPackageId ?? null,
        approved: input.record.stageFlags.approved,
        rejected: input.record.stageFlags.rejected,
      },
      now: input.now,
    })

  upsertDurableDraftFactoryLeadState(
    {
      ...base,
      state: mapSv13StateToDurable(input.advance.nextState),
      earliestIncompleteStage: mapSv13StageToDurable(input.record.earliestIncompleteStage),
      packageId: input.advance.package?.factoryPackageId ?? base.packageId,
      lastWakeType: normalizeDraftFactoryWake(input.wakeSource),
      lastWakeAt: input.now,
      updatedAt: input.now,
      version: base.version,
    },
    existing ? existing.version : undefined,
  )
}
