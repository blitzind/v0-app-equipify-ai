/** GE-AI-3D-PROD-3 — Controlled calibration apply + rollback service (server-only). */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { publishGrowthAiEvent } from "@/lib/growth/aios/event-bus/growth-ai-event-bus-service"
import { validateCalibrationApplyProposal } from "@/lib/growth/aios/learning/growth-adaptive-calibration-apply-engine"
import {
  formatGrowthCalibrationApplySchemaNotReadyMessage,
  isGrowthCalibrationApplySchemaReady,
} from "@/lib/growth/aios/learning/growth-adaptive-calibration-apply-schema-health"
import {
  buildCalibrationApplyIdempotencyKey,
  buildCalibrationRollbackIdempotencyKey,
  generateCalibrationRollbackToken,
  GROWTH_CALIBRATION_APPLY_EVENT_TYPES,
  GROWTH_CALIBRATION_APPLY_QA_MARKER,
  GROWTH_CALIBRATION_APPLY_RULE,
  type GrowthCalibrationApplyReadModel,
  type GrowthCalibrationAppliedVersion,
  type GrowthCalibrationVersionAdvisory,
} from "@/lib/growth/aios/learning/growth-adaptive-calibration-apply-types"
import { getDefaultCalibrationConfig } from "@/lib/growth/aios/learning/growth-adaptive-calibration-config-registry"
import { setInMemoryCalibrationConfig } from "@/lib/growth/aios/learning/growth-adaptive-calibration-config-resolver"
import {
  fetchAdaptiveCalibrationProposalById,
  updateAdaptiveCalibrationProposalStatus,
} from "@/lib/growth/aios/learning/growth-adaptive-calibration-repository"
import {
  canTransitionAdaptiveCalibrationStatus,
  GROWTH_ADAPTIVE_CALIBRATION_QA_MARKER,
  type GrowthAdaptiveCalibrationProposal,
} from "@/lib/growth/aios/learning/growth-adaptive-calibration-types"
import {
  appendCalibrationConfigEvent,
  fetchCalibrationActiveConfig,
  fetchCalibrationVersionByIdempotencyKey,
  fetchCalibrationVersionByRollbackToken,
  getNextCalibrationVersionNumber,
  insertCalibrationVersion,
  listCalibrationActiveConfigs,
  listCalibrationVersions,
  updateCalibrationVersionStatus,
  upsertCalibrationActiveConfig,
} from "@/lib/growth/aios/learning/growth-adaptive-calibration-version-repository"
import type { GrowthRevenueDirectorReadModel } from "@/lib/growth/aios/revenue-director/growth-revenue-director-types"

export type CalibrationApplyMutationResult =
  | { ok: true; version: GrowthCalibrationAppliedVersion; proposal: GrowthAdaptiveCalibrationProposal; rollbackToken: string }
  | { ok: false; error: string; message: string }

export type CalibrationRollbackMutationResult =
  | { ok: true; version: GrowthCalibrationAppliedVersion; rollbackToken: string }
  | { ok: false; error: string; message: string }

function useInMemoryCalibrationStore(): boolean {
  return process.env.GROWTH_CALIBRATION_IN_MEMORY_STORE === "1"
}

async function publishApplyLifecycleEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    eventType: string
    version: GrowthCalibrationAppliedVersion
    occurredAt: string
    extra?: Record<string, unknown>
  },
): Promise<void> {
  try {
    await publishGrowthAiEvent(admin, {
      organizationId: input.organizationId,
      eventType: input.eventType,
      category: "learning",
      source: "growth_adaptive_calibration",
      producer: "growth_adaptive_calibration_apply_service",
      subjectType: "system",
      subjectId: input.version.id,
      payload: {
        versionId: input.version.id,
        proposalId: input.version.proposalId,
        targetSystem: input.version.targetSystem,
        rollbackToken: input.version.rollbackToken,
        versionNumber: input.version.versionNumber,
        ...input.extra,
      },
      metadata: { qaMarker: GROWTH_CALIBRATION_APPLY_QA_MARKER, configOnly: true },
      occurredAt: input.occurredAt,
    })
  } catch {
    // Non-blocking.
  }
}

export async function applyApprovedCalibrationProposal(
  admin: SupabaseClient,
  input: {
    organizationId: string
    proposalId: string
    operatorUserId: string
    occurredAt: string
  },
): Promise<CalibrationApplyMutationResult> {
  if (!(await isGrowthCalibrationApplySchemaReady(admin))) {
    return {
      ok: false,
      error: "schema_not_ready",
      message: formatGrowthCalibrationApplySchemaNotReadyMessage(),
    }
  }

  const proposal = await fetchAdaptiveCalibrationProposalById(admin, {
    organizationId: input.organizationId,
    proposalId: input.proposalId,
  })
  if (!proposal) {
    return { ok: false, error: "proposal_not_found", message: "Calibration proposal not found." }
  }

  const idempotencyKey = buildCalibrationApplyIdempotencyKey({
    organizationId: input.organizationId,
    proposalId: input.proposalId,
  })
  const existing = await fetchCalibrationVersionByIdempotencyKey(admin, {
    organizationId: input.organizationId,
    idempotencyKey,
  })
  if (existing) {
    return { ok: true, version: existing, proposal, rollbackToken: existing.rollbackToken }
  }

  const provisionalDefaults = getDefaultCalibrationConfig("communication_engine")
  const validation = validateCalibrationApplyProposal({
    proposal,
    currentConfig: provisionalDefaults,
  })
  if (!validation.ok) {
    await appendCalibrationConfigEvent(admin, {
      organizationId: input.organizationId,
      proposalId: proposal.id,
      eventType: GROWTH_CALIBRATION_APPLY_EVENT_TYPES.calibrationApplyFailed,
      payload: { error: validation.error, message: validation.message },
    })
    return { ok: false, error: validation.error, message: validation.message }
  }

  const active = await fetchCalibrationActiveConfig(admin, {
    organizationId: input.organizationId,
    targetSystem: validation.targetSystem,
  }).catch(() => null)

  const currentConfig = active?.config ?? getDefaultCalibrationConfig(validation.targetSystem)
  const finalValidation = validateCalibrationApplyProposal({ proposal, currentConfig })
  if (!finalValidation.ok) {
    return { ok: false, error: finalValidation.error, message: finalValidation.message }
  }

  if (!canTransitionAdaptiveCalibrationStatus(proposal.status, "applied")) {
    return {
      ok: false,
      error: "invalid_transition",
      message: `Cannot apply proposal from status ${proposal.status}.`,
    }
  }

  const rollbackToken = generateCalibrationRollbackToken({
    organizationId: input.organizationId,
    proposalId: proposal.id,
    occurredAt: input.occurredAt,
  })
  const eventCorrelationId = randomUUID()
  const versionNumber = await getNextCalibrationVersionNumber(admin, {
    organizationId: input.organizationId,
    targetSystem: finalValidation.targetSystem,
  })

  const previousVersion = await listCalibrationVersions(admin, {
    organizationId: input.organizationId,
    limit: 1,
  })
  const previousVersionId = previousVersion.find((row) => row.targetSystem === finalValidation.targetSystem)?.id ?? null

  const version = await insertCalibrationVersion(admin, {
    organizationId: input.organizationId,
    proposalId: proposal.id,
    targetSystem: finalValidation.targetSystem,
    versionNumber,
    versionKind: "apply",
    status: "applied",
    configSnapshotBefore: currentConfig,
    configSnapshotAfter: finalValidation.snapshotAfter,
    rollbackToken,
    previousVersionId,
    appliedByUserId: input.operatorUserId,
    appliedAt: input.occurredAt,
    confidence: proposal.confidence,
    impact: proposal.impact,
    idempotencyKey,
    eventCorrelationId,
  })

  await upsertCalibrationActiveConfig(admin, {
    organizationId: input.organizationId,
    targetSystem: finalValidation.targetSystem,
    config: finalValidation.snapshotAfter,
    activeVersionId: version.id,
  })

  if (useInMemoryCalibrationStore()) {
    setInMemoryCalibrationConfig({
      organizationId: input.organizationId,
      targetSystem: finalValidation.targetSystem,
      config: finalValidation.snapshotAfter,
    })
  }

  const updatedProposal = await updateAdaptiveCalibrationProposalStatus(admin, {
    organizationId: input.organizationId,
    proposalId: proposal.id,
    status: "applied",
  })

  await appendCalibrationConfigEvent(admin, {
    organizationId: input.organizationId,
    versionId: version.id,
    proposalId: proposal.id,
    eventType: GROWTH_CALIBRATION_APPLY_EVENT_TYPES.versionCreated,
    payload: { versionId: version.id, rollbackToken },
  })
  await appendCalibrationConfigEvent(admin, {
    organizationId: input.organizationId,
    versionId: version.id,
    proposalId: proposal.id,
    eventType: GROWTH_CALIBRATION_APPLY_EVENT_TYPES.calibrationApplied,
    payload: { targetSystem: finalValidation.targetSystem, operatorUserId: input.operatorUserId },
  })

  await publishApplyLifecycleEvent(admin, {
    organizationId: input.organizationId,
    eventType: GROWTH_CALIBRATION_APPLY_EVENT_TYPES.versionCreated,
    version,
    occurredAt: input.occurredAt,
  })
  await publishApplyLifecycleEvent(admin, {
    organizationId: input.organizationId,
    eventType: GROWTH_CALIBRATION_APPLY_EVENT_TYPES.calibrationApplied,
    version,
    occurredAt: input.occurredAt,
    extra: { operatorUserId: input.operatorUserId },
  })

  return {
    ok: true,
    version,
    proposal: updatedProposal,
    rollbackToken,
  }
}

export async function rollbackCalibrationVersion(
  admin: SupabaseClient,
  input: {
    organizationId: string
    rollbackToken: string
    operatorUserId: string
    occurredAt: string
  },
): Promise<CalibrationRollbackMutationResult> {
  if (!(await isGrowthCalibrationApplySchemaReady(admin))) {
    return {
      ok: false,
      error: "schema_not_ready",
      message: formatGrowthCalibrationApplySchemaNotReadyMessage(),
    }
  }

  const sourceVersion = await fetchCalibrationVersionByRollbackToken(admin, {
    organizationId: input.organizationId,
    rollbackToken: input.rollbackToken,
  })
  if (!sourceVersion) {
    return { ok: false, error: "version_not_found", message: "Calibration version not found for rollback token." }
  }
  if (sourceVersion.status === "rolled_back") {
    return { ok: false, error: "already_rolled_back", message: "This calibration version was already rolled back." }
  }

  const idempotencyKey = buildCalibrationRollbackIdempotencyKey({
    organizationId: input.organizationId,
    rollbackToken: input.rollbackToken,
  })
  const existing = await fetchCalibrationVersionByIdempotencyKey(admin, {
    organizationId: input.organizationId,
    idempotencyKey,
  })
  if (existing) {
    return { ok: true, version: existing, rollbackToken: existing.rollbackToken }
  }

  const versionNumber = await getNextCalibrationVersionNumber(admin, {
    organizationId: input.organizationId,
    targetSystem: sourceVersion.targetSystem,
  })

  const rollbackVersion = await insertCalibrationVersion(admin, {
    organizationId: input.organizationId,
    proposalId: sourceVersion.proposalId,
    targetSystem: sourceVersion.targetSystem,
    versionNumber,
    versionKind: "rollback",
    status: "applied",
    configSnapshotBefore: sourceVersion.configSnapshotAfter,
    configSnapshotAfter: sourceVersion.configSnapshotBefore,
    rollbackToken: `rollback-restore:${sourceVersion.rollbackToken}`,
    previousVersionId: sourceVersion.id,
    appliedByUserId: input.operatorUserId,
    appliedAt: input.occurredAt,
    confidence: sourceVersion.confidence,
    impact: sourceVersion.impact,
    idempotencyKey,
    eventCorrelationId: randomUUID(),
  })

  await upsertCalibrationActiveConfig(admin, {
    organizationId: input.organizationId,
    targetSystem: sourceVersion.targetSystem,
    config: sourceVersion.configSnapshotBefore,
    activeVersionId: rollbackVersion.id,
  })

  if (useInMemoryCalibrationStore()) {
    setInMemoryCalibrationConfig({
      organizationId: input.organizationId,
      targetSystem: sourceVersion.targetSystem,
      config: sourceVersion.configSnapshotBefore,
    })
  }

  await updateCalibrationVersionStatus(admin, {
    organizationId: input.organizationId,
    versionId: sourceVersion.id,
    status: "rolled_back",
  })

  await appendCalibrationConfigEvent(admin, {
    organizationId: input.organizationId,
    versionId: rollbackVersion.id,
    proposalId: sourceVersion.proposalId,
    eventType: GROWTH_CALIBRATION_APPLY_EVENT_TYPES.calibrationRolledBack,
    payload: {
      sourceVersionId: sourceVersion.id,
      operatorUserId: input.operatorUserId,
    },
  })

  await publishApplyLifecycleEvent(admin, {
    organizationId: input.organizationId,
    eventType: GROWTH_CALIBRATION_APPLY_EVENT_TYPES.calibrationRolledBack,
    version: rollbackVersion,
    occurredAt: input.occurredAt,
    extra: { sourceVersionId: sourceVersion.id, operatorUserId: input.operatorUserId },
  })

  return { ok: true, version: rollbackVersion, rollbackToken: rollbackVersion.rollbackToken }
}

export async function fetchGrowthCalibrationApplyReadModel(
  admin: SupabaseClient | null,
  input: { organizationId: string; generatedAt: string; readyToApplyCount?: number },
): Promise<GrowthCalibrationApplyReadModel> {
  const empty: GrowthCalibrationApplyReadModel = {
    readOnly: true,
    qaMarker: GROWTH_CALIBRATION_APPLY_QA_MARKER,
    generatedAt: input.generatedAt,
    rule: GROWTH_CALIBRATION_APPLY_RULE,
    schemaReady: false,
    activeVersions: [],
    recentVersions: [],
    summary: {
      activeCalibrationCount: 0,
      readyToApplyCount: input.readyToApplyCount ?? 0,
      rollbackAvailableCount: 0,
      lastAppliedAt: null,
      lastAppliedByUserId: null,
      lastAppliedTargetSystem: null,
      lastAppliedConfidence: null,
    },
  }

  if (!admin) return empty

  let schemaReady = false
  try {
    schemaReady = await isGrowthCalibrationApplySchemaReady(admin)
  } catch {
    return empty
  }
  if (!schemaReady) return { ...empty, schemaReady: false }

  try {
    const [activeVersions, recentVersions] = await Promise.all([
      listCalibrationActiveConfigs(admin, { organizationId: input.organizationId }),
      listCalibrationVersions(admin, { organizationId: input.organizationId, limit: 20 }),
    ])

    const rollbackAvailableCount = recentVersions.filter(
      (row) => row.versionKind === "apply" && row.status === "applied",
    ).length
    const lastApplied = recentVersions.find((row) => row.versionKind === "apply") ?? null

    return {
      readOnly: true,
      qaMarker: GROWTH_CALIBRATION_APPLY_QA_MARKER,
      generatedAt: input.generatedAt,
      rule: GROWTH_CALIBRATION_APPLY_RULE,
      schemaReady: true,
      activeVersions,
      recentVersions,
      summary: {
        activeCalibrationCount: activeVersions.length,
        readyToApplyCount: input.readyToApplyCount ?? 0,
        rollbackAvailableCount,
        lastAppliedAt: lastApplied?.appliedAt ?? null,
        lastAppliedByUserId: lastApplied?.appliedByUserId ?? null,
        lastAppliedTargetSystem: lastApplied?.targetSystem ?? null,
        lastAppliedConfidence: lastApplied?.confidence ?? null,
      },
    }
  } catch {
    return empty
  }
}

export function buildCalibrationVersionAdvisory(input: {
  applyReadModel: GrowthCalibrationApplyReadModel
  readyToApplyProposalIds: string[]
}): GrowthCalibrationVersionAdvisory {
  const lastApplied =
    input.applyReadModel.recentVersions.find((row) => row.versionKind === "apply" && row.status === "applied") ??
    null
  const activeVersion = lastApplied

  return {
    activeVersion,
    pendingApplyProposalIds: input.readyToApplyProposalIds,
    rollbackAvailable: input.applyReadModel.summary.rollbackAvailableCount > 0,
    lastApplied,
    lastOperatorUserId: lastApplied?.appliedByUserId ?? null,
    lastConfidence: lastApplied?.confidence ?? null,
  }
}

export function enrichRevenueDirectorWithCalibrationApply(input: {
  revenueDirector: GrowthRevenueDirectorReadModel
  applyReadModel: GrowthCalibrationApplyReadModel
  readyToApplyProposalIds: string[]
}): GrowthRevenueDirectorReadModel {
  const versionAdvisory = buildCalibrationVersionAdvisory({
    applyReadModel: input.applyReadModel,
    readyToApplyProposalIds: input.readyToApplyProposalIds,
  })

  return {
    ...input.revenueDirector,
    calibrationVersionAdvisory: versionAdvisory,
    recommendations: versionAdvisory.pendingApplyProposalIds.length
      ? [
          {
            id: `calibration-ready-${versionAdvisory.pendingApplyProposalIds[0]}`,
            title: "Approved calibration ready to apply",
            summary: `${versionAdvisory.pendingApplyProposalIds.length} approved proposal(s) await explicit apply — approval does not mutate configuration.`,
            source: "adaptive_calibration_apply",
          },
          ...input.revenueDirector.recommendations,
        ].slice(0, 8)
      : input.revenueDirector.recommendations,
  }
}

export const GROWTH_CALIBRATION_APPLY_SERVICE_MARKER = GROWTH_ADAPTIVE_CALIBRATION_QA_MARKER
