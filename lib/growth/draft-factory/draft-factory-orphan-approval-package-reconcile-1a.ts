/**
 * AVA-OUTREACH-PIPELINE-RECOVERY-1A — Orphan waiting_for_approval reconcile planner (client-safe).
 *
 * Safety amendment: clearing an orphan package does NOT imply generation readiness.
 * Recovery state is derived from current canonical evidence via the existing SV1-5 engine.
 */

import {
  projectDurableStateFromStage,
  resolveEarliestIncompleteDurableStage,
} from "@/lib/growth/draft-factory/draft-factory-durable-engine"
import type {
  AiOsDraftFactoryCanonicalEvidence,
  AiOsDraftFactoryDurableLeadState,
  AiOsDraftFactoryDurableStage,
  AiOsDraftFactoryDurableState,
} from "@/lib/growth/draft-factory/draft-factory-durable-types"
import {
  evaluateDraftFactoryApprovalArtifactPresence,
  GROWTH_DRAFT_FACTORY_ORPHAN_APPROVAL_ARTIFACT_1A_QA_MARKER,
  GROWTH_DRAFT_FACTORY_WAITING_FOR_APPROVAL_INVARIANT,
  isOrphanWaitingForApprovalRow,
  type DraftFactoryApprovalArtifactFacts,
  type DraftFactoryApprovalArtifactResolution,
} from "@/lib/growth/draft-factory/draft-factory-orphan-approval-package-artifact-1a"

export const GROWTH_DRAFT_FACTORY_ORPHAN_APPROVAL_RECONCILE_1A_QA_MARKER =
  "ava-outreach-pipeline-recovery-1a-orphan-reconcile-v1" as const

export type OrphanApprovalPackageRecoveryReadiness = {
  admitted: boolean
  researchCurrent: boolean
  researchSufficientForPackage: boolean
  investmentState: string | null
  stopInvestment: boolean
  spendAuthorized: boolean | null
  portfolioSelected: boolean
  decisionMakerAvailable: boolean
  contactVerifiedForEmail: boolean
  personalizationReady: boolean
  generationEligible: boolean
}

export type OrphanApprovalPackageRecoveryPlan = {
  qaMarker: typeof GROWTH_DRAFT_FACTORY_ORPHAN_APPROVAL_RECONCILE_1A_QA_MARKER
  nextState: AiOsDraftFactoryDurableState
  nextEarliestIncompleteStage: AiOsDraftFactoryDurableStage | null
  nextPackageId: null
  pausedReason: string | null
  stageGate: AiOsDraftFactoryDurableStage
  reason: string
  readiness: OrphanApprovalPackageRecoveryReadiness
}

export type OrphanApprovalPackageReconcileCandidate = {
  leadId: string
  previousState: AiOsDraftFactoryDurableLeadState
  packageId: string
  artifact: DraftFactoryApprovalArtifactResolution
  orphanReason: string
  recovery: OrphanApprovalPackageRecoveryPlan
}

export type OrphanApprovalPackageReconcilePlan = {
  qaMarker: typeof GROWTH_DRAFT_FACTORY_ORPHAN_APPROVAL_RECONCILE_1A_QA_MARKER
  invariant: typeof GROWTH_DRAFT_FACTORY_WAITING_FOR_APPROVAL_INVARIANT
  candidatesFound: number
  skippedAlreadyCorrect: number
  candidates: OrphanApprovalPackageReconcileCandidate[]
}

export type OrphanApprovalPackageReconcileMutation = {
  leadId: string
  previousState: string
  previousPackageId: string
  nextState: AiOsDraftFactoryDurableState
  nextPackageId: null
  nextEarliestIncompleteStage: AiOsDraftFactoryDurableStage | null
  pausedReason: string | null
  orphanReason: string
  reason: string
  readiness: OrphanApprovalPackageRecoveryReadiness
  stageGate: AiOsDraftFactoryDurableStage
}

export function clearOrphanApprovalPackageFromEvidence(
  evidence: AiOsDraftFactoryCanonicalEvidence,
): AiOsDraftFactoryCanonicalEvidence {
  return {
    ...evidence,
    draftValid: false,
    packageId: null,
    approved: false,
  }
}

function summarizeReadiness(
  evidence: AiOsDraftFactoryCanonicalEvidence,
  stageGate: AiOsDraftFactoryDurableStage,
): OrphanApprovalPackageRecoveryReadiness {
  return {
    admitted: evidence.admitted,
    researchCurrent: evidence.researchCurrent,
    researchSufficientForPackage: evidence.researchSufficientForPackage === true,
    investmentState: evidence.investmentState ?? null,
    stopInvestment: evidence.stopInvestment,
    spendAuthorized: evidence.spendAuthorized ?? null,
    portfolioSelected: evidence.portfolioSelected,
    decisionMakerAvailable: evidence.decisionMakerAvailable,
    contactVerifiedForEmail: evidence.contactVerifiedForEmail,
    personalizationReady: evidence.personalizationReady,
    generationEligible: stageGate === "generation",
  }
}

function buildRecoveryReason(input: {
  stageGate: AiOsDraftFactoryDurableStage
  nextState: AiOsDraftFactoryDurableState
  readiness: OrphanApprovalPackageRecoveryReadiness
}): string {
  const { stageGate, nextState, readiness } = input

  if (nextState === "paused" && readiness.stopInvestment) {
    return "Cleared orphan approval package; current resource allocation is stop_investment."
  }
  if (nextState === "paused") {
    return "Cleared orphan approval package; lead is not currently portfolio-eligible for advancement."
  }
  if (stageGate === "research" || stageGate === "qualification") {
    return "Cleared orphan approval package; research or admission gate is incomplete for current readiness."
  }
  if (stageGate === "decision_maker") {
    return "Cleared orphan approval package; decision maker discovery is the current canonical gate."
  }
  if (stageGate === "contact_verification") {
    return "Cleared orphan approval package; verified contact path is required before generation."
  }
  if (stageGate === "personalization") {
    return "Cleared orphan approval package; personalization gate is incomplete."
  }
  if (stageGate === "investment" || stageGate === "portfolio") {
    return "Cleared orphan approval package; investment or portfolio gate blocks generation."
  }
  if (stageGate === "generation" && nextState === "waiting_for_generation") {
    return "Cleared orphan approval package; current readiness satisfies the generation gate."
  }
  return `Cleared orphan approval package; re-projected to canonical state ${nextState}.`
}

export function resolveOrphanApprovalPackageRecoveryFromEvidence(
  evidence: AiOsDraftFactoryCanonicalEvidence,
): OrphanApprovalPackageRecoveryPlan {
  const cleared = clearOrphanApprovalPackageFromEvidence(evidence)
  const stageGate = resolveEarliestIncompleteDurableStage(cleared)
  const nextState = projectDurableStateFromStage(stageGate, cleared)
  const nextEarliestIncompleteStage: AiOsDraftFactoryDurableStage | null =
    stageGate === "complete" ? "generation" : stageGate

  const readiness = summarizeReadiness(cleared, stageGate)
  const pausedReason =
    nextState === "paused" && cleared.stopInvestment ? "stop_investment" : nextState === "paused" ? "portfolio_deferred" : null

  const reason = buildRecoveryReason({ stageGate, nextState, readiness })

  return {
    qaMarker: GROWTH_DRAFT_FACTORY_ORPHAN_APPROVAL_RECONCILE_1A_QA_MARKER,
    nextState,
    nextEarliestIncompleteStage,
    nextPackageId: null,
    pausedReason,
    stageGate,
    reason,
    readiness,
  }
}

function resolveOrphanReason(artifact: DraftFactoryApprovalArtifactResolution): string {
  if (artifact.kind === "none" && !artifact.resolvable) {
    return "package_id has no resolvable approval artifact"
  }
  return "legacy outreach-prep package blocks supervised generation without durable artifact"
}

export function planOrphanApprovalPackageReconcile(input: {
  rows: Array<{
    leadId: string
    state: string
    packageId: string | null
    artifactFacts: DraftFactoryApprovalArtifactFacts
    recoveryEvidence: AiOsDraftFactoryCanonicalEvidence
  }>
}): OrphanApprovalPackageReconcilePlan {
  const candidates: OrphanApprovalPackageReconcileCandidate[] = []
  let skippedAlreadyCorrect = 0

  for (const row of input.rows) {
    const artifact = evaluateDraftFactoryApprovalArtifactPresence(row.artifactFacts)
    if (
      !isOrphanWaitingForApprovalRow({
        state: row.state,
        packageId: row.packageId,
        artifact,
        hasSupervisedGenerationForLead: row.artifactFacts.hasSupervisedGenerationForLead,
      })
    ) {
      skippedAlreadyCorrect += 1
      continue
    }

    const recovery = resolveOrphanApprovalPackageRecoveryFromEvidence(row.recoveryEvidence)

    candidates.push({
      leadId: row.leadId,
      previousState: {
        organizationId: "",
        leadId: row.leadId,
        state: row.state as never,
        earliestIncompleteStage: "approval",
        version: 0,
        packageId: row.packageId,
        researchRunId: null,
        decisionMakerId: null,
        personalizationId: null,
        lastWakeType: null,
        lastWakeAt: null,
        nextEligibleWakeAt: null,
        attemptCounts: {
          research: 0,
          decisionMaker: 0,
          contactVerification: 0,
          personalization: 0,
          generation: 0,
        },
        lastErrorCode: null,
        lastErrorStage: null,
        pausedReason: null,
        leaseOwner: null,
        leaseExpiresAt: null,
        createdAt: "",
        updatedAt: "",
      },
      packageId: row.packageId!,
      artifact,
      orphanReason: resolveOrphanReason(artifact),
      recovery,
    })
  }

  return {
    qaMarker: GROWTH_DRAFT_FACTORY_ORPHAN_APPROVAL_RECONCILE_1A_QA_MARKER,
    invariant: GROWTH_DRAFT_FACTORY_WAITING_FOR_APPROVAL_INVARIANT,
    candidatesFound: candidates.length,
    skippedAlreadyCorrect,
    candidates,
  }
}

export function buildOrphanApprovalPackageReconcileMutation(input: {
  row: AiOsDraftFactoryDurableLeadState
  recovery: OrphanApprovalPackageRecoveryPlan
  orphanReason: string
}): OrphanApprovalPackageReconcileMutation | null {
  if (input.row.state !== "waiting_for_approval" || !input.row.packageId?.trim()) return null

  return {
    leadId: input.row.leadId,
    previousState: input.row.state,
    previousPackageId: input.row.packageId,
    nextState: input.recovery.nextState,
    nextPackageId: null,
    nextEarliestIncompleteStage: input.recovery.nextEarliestIncompleteStage,
    pausedReason: input.recovery.pausedReason,
    orphanReason: input.orphanReason,
    reason: input.recovery.reason,
    readiness: input.recovery.readiness,
    stageGate: input.recovery.stageGate,
  }
}

export function applyOrphanApprovalPackageReconcileMutation(input: {
  row: AiOsDraftFactoryDurableLeadState
  recovery: OrphanApprovalPackageRecoveryPlan
  orphanReason: string
  now: string
  workerId: string
}): AiOsDraftFactoryDurableLeadState | null {
  const mutation = buildOrphanApprovalPackageReconcileMutation({
    row: input.row,
    recovery: input.recovery,
    orphanReason: input.orphanReason,
  })
  if (!mutation) return null

  return {
    ...input.row,
    state: mutation.nextState,
    earliestIncompleteStage: mutation.nextEarliestIncompleteStage,
    packageId: mutation.nextPackageId,
    lastWakeType: "scheduled_resume",
    lastWakeAt: input.now,
    nextEligibleWakeAt: input.now,
    lastErrorCode: "orphan_approval_package_reconciled",
    lastErrorStage: "approval",
    pausedReason: mutation.pausedReason,
    leaseOwner: input.workerId,
    updatedAt: input.now,
  }
}

export function isOrphanApprovalReconcileCorrectedOutcome(input: {
  previousState: string
  nextState: string
  previousPackageId: string | null
  nextPackageId: string | null
}): boolean {
  return (
    input.previousState === "waiting_for_approval" &&
    input.nextState !== "waiting_for_approval" &&
    Boolean(input.previousPackageId) &&
    !input.nextPackageId
  )
}

export { GROWTH_DRAFT_FACTORY_ORPHAN_APPROVAL_ARTIFACT_1A_QA_MARKER }
