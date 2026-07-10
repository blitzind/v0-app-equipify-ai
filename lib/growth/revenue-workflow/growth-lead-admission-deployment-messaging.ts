/** GE-AIOS-21C-4 — Admission deployment status messaging (client-safe, validation scripts). */

export type GrowthLeadAdmissionDeploymentStatus = {
  /** True when ≥1 lead in pool has `admission_qa_marker` from 21C (gate has written metadata). */
  deploymentActive: boolean
  totalActiveLeads: number
  leadsWithAdmissionMetadata: number
  legacyLeadsMissingMetadata: number
}

export function summarizeGrowthLeadAdmissionDeploymentStatus(input: {
  deploymentMarkerPresent: boolean
  counts: {
    totalActiveLeads: number
    missingAdmissionMetadata: number
  }
}): GrowthLeadAdmissionDeploymentStatus {
  return {
    deploymentActive: input.deploymentMarkerPresent,
    totalActiveLeads: input.counts.totalActiveLeads,
    leadsWithAdmissionMetadata:
      input.counts.totalActiveLeads - input.counts.missingAdmissionMetadata,
    legacyLeadsMissingMetadata: input.counts.missingAdmissionMetadata,
  }
}

export function formatAdmissionDeploymentStatusMessage(
  status: GrowthLeadAdmissionDeploymentStatus,
  options?: { codeDeployedAssumed?: boolean },
): string {
  if (status.deploymentActive) {
    if (status.legacyLeadsMissingMetadata === 0) {
      return `21C deployment active — all ${status.totalActiveLeads} active lead(s) in pool have admission metadata.`
    }
    return `21C deployment active — ${status.leadsWithAdmissionMetadata}/${status.totalActiveLeads} lead(s) have admission metadata; ${status.legacyLeadsMissingMetadata} legacy row(s) pending historical migration.`
  }

  if (options?.codeDeployedAssumed) {
    return "21C metadata not yet observed in pool — no lead has passed the admission gate since deploy (historical pool may need migration)."
  }

  return "21C metadata not yet observed in pool — deploy 21C or process new leads through the gate before trusting admission."
}

export function formatAdmissionMetadataGateDetail(
  input: {
    deploymentMarkerPresent: boolean
    counts: {
      totalActiveLeads: number
      missingAdmissionMetadata: number
    }
  },
  options?: { codeDeployedAssumed?: boolean },
): string {
  return formatAdmissionDeploymentStatusMessage(
    summarizeGrowthLeadAdmissionDeploymentStatus(input),
    options,
  )
}
