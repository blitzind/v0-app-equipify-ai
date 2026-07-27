/**
 * AVA-CANONICAL-WAIT-RECOVERY-1A — Authoritative outreach package resolution (client-safe).
 *
 * Orphan-reconciled draft-factory rows may still have legacy preparation runs whose
 * pending_approval snapshots pollute canonical decision authority. Only packages with
 * durable approval bodies (or explicit approval) remain authoritative.
 */

import { evaluateDraftFactoryApprovalArtifactPresence } from "@/lib/growth/draft-factory/draft-factory-orphan-approval-package-artifact-1a"
import type {
  GrowthAutonomousOutreachApprovalPackage,
  GrowthAutonomousOutreachPreparationRunRecord,
} from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"

export const GROWTH_CANONICAL_OUTREACH_PACKAGE_AUTHORITY_1A_QA_MARKER =
  "ava-canonical-wait-recovery-1a-outreach-package-authority-v1" as const

export function outreachApprovalPackageHasDurableBody(
  pkg: GrowthAutonomousOutreachApprovalPackage | null | undefined,
): boolean {
  if (!pkg) return false
  if (pkg.packageApprovalDecision === "approved") return true
  return (
    pkg.pendingHumanApproval === true &&
    pkg.transportBlocked === true &&
    Array.isArray(pkg.generatedAssets) &&
    pkg.generatedAssets.length > 0
  )
}

export function isAuthoritativeCanonicalOutreachPackage(input: {
  package: GrowthAutonomousOutreachApprovalPackage | null | undefined
  draftFactoryPackageId?: string | null
  hasSupervisedGenerationForLead?: boolean
  draftFactoryState?: string | null
}): boolean {
  const pkg = input.package
  if (!pkg?.packageId?.trim()) return false

  if (pkg.packageApprovalDecision === "approved") {
    return outreachApprovalPackageHasDurableBody(pkg)
  }

  if (pkg.packageApprovalDecision === "rejected") {
    return false
  }

  const dfPointer = input.draftFactoryPackageId?.trim() || null
  const dfState = input.draftFactoryState ?? null

  // Orphan-reconciled recovery: draft factory cleared the pointer while generation-ready.
  if (
    dfState === "waiting_for_generation" &&
    !dfPointer &&
    input.hasSupervisedGenerationForLead !== true &&
    pkg.packageApprovalDecision !== "approved"
  ) {
    return false
  }

  const artifact = evaluateDraftFactoryApprovalArtifactPresence({
    state: input.draftFactoryState ?? "waiting_for_approval",
    packageId: pkg.packageId,
    hasPreparationRunForPackageId: true,
    preparationRunHasApprovalBody: outreachApprovalPackageHasDurableBody(pkg),
    hasSupervisedGenerationForLead: input.hasSupervisedGenerationForLead === true,
    packageApproved: pkg.packageApprovalDecision === "approved",
    packageSent: false,
  })

  if (!artifact.resolvable) return false

  if (dfPointer && dfPointer !== pkg.packageId) {
    return false
  }

  return outreachApprovalPackageHasDurableBody(pkg)
}

export function selectLatestAuthoritativeOutreachPackage(input: {
  runs: GrowthAutonomousOutreachPreparationRunRecord[]
  draftFactoryPackageId?: string | null
  hasSupervisedGenerationForLead?: boolean
  draftFactoryState?: string | null
}): GrowthAutonomousOutreachApprovalPackage | null {
  const eligible = input.runs
    .filter(
      (run): run is GrowthAutonomousOutreachPreparationRunRecord & {
        approvalPackage: GrowthAutonomousOutreachApprovalPackage
      } => run.outcome === "completed" && Boolean(run.approvalPackage),
    )
    .filter((run) =>
      isAuthoritativeCanonicalOutreachPackage({
        package: run.approvalPackage,
        draftFactoryPackageId: input.draftFactoryPackageId,
        hasSupervisedGenerationForLead: input.hasSupervisedGenerationForLead,
        draftFactoryState: input.draftFactoryState,
      }),
    )
    .sort((left, right) => Date.parse(right.completedAt) - Date.parse(left.completedAt))

  return eligible[0]?.approvalPackage ?? null
}
