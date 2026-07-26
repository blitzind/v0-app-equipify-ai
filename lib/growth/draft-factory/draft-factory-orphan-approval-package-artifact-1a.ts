/**
 * AVA-OUTREACH-PIPELINE-RECOVERY-1A — Durable approval artifact resolution (client-safe).
 *
 * Invariant: waiting_for_approval => a resolvable approval artifact exists.
 */

import type { AiOsDraftFactoryDurableState } from "@/lib/growth/draft-factory/draft-factory-durable-types"
import { parseOutreachPrepPackageId } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-package-id"

export const GROWTH_DRAFT_FACTORY_ORPHAN_APPROVAL_ARTIFACT_1A_QA_MARKER =
  "ava-outreach-pipeline-recovery-1a-orphan-artifact-v1" as const

export type DraftFactoryApprovalArtifactKind =
  | "supervised_generation"
  | "legacy_preparation_run"
  | "approved_package"
  | "sent_package"
  | "none"

export type DraftFactoryApprovalArtifactFacts = {
  state: AiOsDraftFactoryDurableState | string
  packageId: string | null
  hasPreparationRunForPackageId: boolean
  preparationRunHasApprovalBody: boolean
  hasSupervisedGenerationForLead: boolean
  packageApproved?: boolean
  packageSent?: boolean
}

export type DraftFactoryApprovalArtifactResolution = {
  qaMarker: typeof GROWTH_DRAFT_FACTORY_ORPHAN_APPROVAL_ARTIFACT_1A_QA_MARKER
  kind: DraftFactoryApprovalArtifactKind
  resolvable: boolean
  packageId: string | null
}

const TERMINAL_APPROVAL_STATES = new Set<AiOsDraftFactoryDurableState | string>([
  "approved",
  "executed",
  "rejected",
])

export function isOutreachPrepPackageId(packageId: string | null | undefined): boolean {
  return Boolean(packageId && parseOutreachPrepPackageId(packageId))
}

export function isSupervisedGenerationPackageId(packageId: string | null | undefined): boolean {
  if (!packageId) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    packageId,
  )
}

export function evaluateDraftFactoryApprovalArtifactPresence(
  input: DraftFactoryApprovalArtifactFacts,
): DraftFactoryApprovalArtifactResolution {
  const packageId = input.packageId?.trim() || null

  if (input.packageSent || input.state === "executed") {
    return {
      qaMarker: GROWTH_DRAFT_FACTORY_ORPHAN_APPROVAL_ARTIFACT_1A_QA_MARKER,
      kind: "sent_package",
      resolvable: true,
      packageId,
    }
  }

  if (input.packageApproved || input.state === "approved") {
    return {
      qaMarker: GROWTH_DRAFT_FACTORY_ORPHAN_APPROVAL_ARTIFACT_1A_QA_MARKER,
      kind: "approved_package",
      resolvable: true,
      packageId,
    }
  }

  if (TERMINAL_APPROVAL_STATES.has(input.state) && input.state !== "waiting_for_approval") {
    return {
      qaMarker: GROWTH_DRAFT_FACTORY_ORPHAN_APPROVAL_ARTIFACT_1A_QA_MARKER,
      kind: "none",
      resolvable: true,
      packageId,
    }
  }

  if (input.hasSupervisedGenerationForLead && isSupervisedGenerationPackageId(packageId)) {
    return {
      qaMarker: GROWTH_DRAFT_FACTORY_ORPHAN_APPROVAL_ARTIFACT_1A_QA_MARKER,
      kind: "supervised_generation",
      resolvable: true,
      packageId,
    }
  }

  if (
    input.hasPreparationRunForPackageId &&
    input.preparationRunHasApprovalBody &&
    packageId &&
    isOutreachPrepPackageId(packageId)
  ) {
    return {
      qaMarker: GROWTH_DRAFT_FACTORY_ORPHAN_APPROVAL_ARTIFACT_1A_QA_MARKER,
      kind: "legacy_preparation_run",
      resolvable: true,
      packageId,
    }
  }

  return {
    qaMarker: GROWTH_DRAFT_FACTORY_ORPHAN_APPROVAL_ARTIFACT_1A_QA_MARKER,
    kind: "none",
    resolvable: false,
    packageId,
  }
}

export function isSupervisedCutoverLegacyApprovalBlocker(input: {
  state: AiOsDraftFactoryDurableState | string
  packageId: string | null
  hasSupervisedGenerationForLead: boolean
}): boolean {
  if (input.state !== "waiting_for_approval") return false
  if (!isOutreachPrepPackageId(input.packageId)) return false
  if (input.hasSupervisedGenerationForLead) return false
  return true
}

export function isOrphanWaitingForApprovalRow(input: {
  state: AiOsDraftFactoryDurableState | string
  packageId: string | null
  artifact: DraftFactoryApprovalArtifactResolution
  hasSupervisedGenerationForLead?: boolean
}): boolean {
  if (input.state !== "waiting_for_approval") return false
  if (!input.packageId?.trim()) return false
  if (input.hasSupervisedGenerationForLead) return false
  if (
    isSupervisedCutoverLegacyApprovalBlocker({
      state: input.state,
      packageId: input.packageId,
      hasSupervisedGenerationForLead: input.hasSupervisedGenerationForLead ?? false,
    })
  ) {
    return true
  }
  if (input.artifact.resolvable) return false
  return input.artifact.kind === "none"
}

export const GROWTH_DRAFT_FACTORY_WAITING_FOR_APPROVAL_INVARIANT =
  "waiting_for_approval requires a durable resolvable approval artifact (supervised generation or legacy preparation run body)." as const
