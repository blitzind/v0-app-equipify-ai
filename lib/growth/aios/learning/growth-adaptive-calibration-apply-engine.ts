/** GE-AI-3D-PROD-3 — Apply validation and snapshot builder (client-safe). */

import { validateAdaptiveCalibrationGuardrails } from "@/lib/growth/aios/learning/growth-adaptive-calibration-engine"
import type { GrowthAdaptiveCalibrationProposal } from "@/lib/growth/aios/learning/growth-adaptive-calibration-types"
import {
  GROWTH_ADAPTIVE_CALIBRATION_GUARDRAILS,
} from "@/lib/growth/aios/learning/growth-adaptive-calibration-types"
import {
  getDefaultCalibrationConfig,
  resolveCalibrationConfigKey,
} from "@/lib/growth/aios/learning/growth-adaptive-calibration-config-registry"
import type {
  GrowthCalibrationApplyTargetSystem,
  GrowthCalibrationConfigSnapshot,
} from "@/lib/growth/aios/learning/growth-adaptive-calibration-apply-types"
import {
  GROWTH_CALIBRATION_APPLY_ALLOWED_TARGETS,
  isCalibrationApplyTargetAllowed,
  isCalibrationProposalReadyToApply,
} from "@/lib/growth/aios/learning/growth-adaptive-calibration-apply-types"

export type CalibrationApplyValidationResult =
  | { ok: true; targetSystem: GrowthCalibrationApplyTargetSystem; snapshotAfter: GrowthCalibrationConfigSnapshot }
  | { ok: false; error: string; message: string }

export function validateCalibrationApplyProposal(input: {
  proposal: GrowthAdaptiveCalibrationProposal
  currentConfig: GrowthCalibrationConfigSnapshot
}): CalibrationApplyValidationResult {
  const { proposal } = input

  if (!isCalibrationProposalReadyToApply(proposal.status)) {
    return {
      ok: false,
      error: "proposal_not_approved",
      message: `Proposal must be approved before apply (current: ${proposal.status}).`,
    }
  }

  if (!isCalibrationApplyTargetAllowed(proposal.targetSystem)) {
    return {
      ok: false,
      error: "target_not_allowed",
      message: `Target system ${proposal.targetSystem} is not eligible for controlled apply.`,
    }
  }

  if (proposal.proposalType === "monitor_only" || proposal.proposalType === "human_review") {
    return {
      ok: false,
      error: "proposal_not_applicable",
      message: `Proposal type ${proposal.proposalType} cannot be applied to configuration.`,
    }
  }

  const guardrail = validateAdaptiveCalibrationGuardrails(proposal)
  if (!guardrail.ok) {
    return { ok: false, error: "guardrail_failed", message: guardrail.reason }
  }

  const targetSystem = proposal.targetSystem as GrowthCalibrationApplyTargetSystem
  const key = resolveCalibrationConfigKey(targetSystem, proposal.proposedChange.key)
  const snapshotAfter = buildConfigSnapshotAfter({
    targetSystem,
    currentConfig: input.currentConfig,
    proposal,
    key,
  })

  const proposed = snapshotAfter[key]
  if (typeof proposed === "number") {
    if (proposed < GROWTH_ADAPTIVE_CALIBRATION_GUARDRAILS.minWeight) {
      return { ok: false, error: "proposed_below_min", message: "Proposed value below guardrail minimum." }
    }
    if (proposed > GROWTH_ADAPTIVE_CALIBRATION_GUARDRAILS.maxWeight) {
      return { ok: false, error: "proposed_above_max", message: "Proposed value above guardrail maximum." }
    }
  }

  return { ok: true, targetSystem, snapshotAfter }
}

export function buildConfigSnapshotAfter(input: {
  targetSystem: GrowthCalibrationApplyTargetSystem
  currentConfig: GrowthCalibrationConfigSnapshot
  proposal: GrowthAdaptiveCalibrationProposal
  key: string
}): GrowthCalibrationConfigSnapshot {
  const base = { ...getDefaultCalibrationConfig(input.targetSystem), ...input.currentConfig }
  const { proposal, key } = input

  if (proposal.proposedChange.proposedValue !== undefined) {
    return { ...base, [key]: proposal.proposedChange.proposedValue }
  }

  if (typeof proposal.proposedChange.delta === "number" && typeof base[key] === "number") {
    return { ...base, [key]: (base[key] as number) + proposal.proposedChange.delta }
  }

  if (typeof proposal.proposedChange.currentValue === "number" && typeof proposal.proposedChange.delta === "number") {
    return { ...base, [key]: proposal.proposedChange.currentValue + proposal.proposedChange.delta }
  }

  return base
}

export function listCalibrationApplyAllowedTargets(): readonly GrowthCalibrationApplyTargetSystem[] {
  return GROWTH_CALIBRATION_APPLY_ALLOWED_TARGETS
}

export function configsEqual(
  left: GrowthCalibrationConfigSnapshot,
  right: GrowthCalibrationConfigSnapshot,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}
