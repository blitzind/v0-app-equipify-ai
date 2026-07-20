/**
 * GE-AIOS-FIRST-CUSTOMER-SUPERVISED-SALES-1B — Workflow scoring (client-safe).
 */

import type {
  SupervisedSalesOperatorPackageSection,
  SupervisedSalesProductionLeadCandidate,
  SupervisedSalesRuntimeComponentAudit,
  SupervisedSalesWorkflowDimensionScore,
} from "@/lib/growth/training/supervised-sales-workflow-1b-types"
import { summarizeRuntimeReadiness } from "@/lib/growth/training/supervised-sales-workflow-readiness-audit-1b"

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

export function scoreSupervisedSalesWorkflow(input: {
  runtimeAudit: SupervisedSalesRuntimeComponentAudit[]
  selectedLeads: SupervisedSalesProductionLeadCandidate[]
  packages: SupervisedSalesOperatorPackageSection[]
  outboundKillSwitchOff: boolean
}): {
  dimensions: SupervisedSalesWorkflowDimensionScore[]
  overallReadinessScore: number
} {
  const runtime = summarizeRuntimeReadiness(input.runtimeAudit)

  const discovery = clamp01(
    input.selectedLeads.length > 0 ? 0.85 + Math.min(input.selectedLeads.length, 3) * 0.05 : 0.4,
  )
  const research = clamp01(
    input.selectedLeads.length > 0
      ? input.selectedLeads.filter((l) => l.hasResearch).length / input.selectedLeads.length
      : 0,
  )
  const qualification = clamp01(
    input.selectedLeads.length > 0
      ? input.selectedLeads.filter((l) => l.admissionState === "accepted").length /
          input.selectedLeads.length +
        0.25
      : 0,
  )

  const sellerTruthScores = input.packages.map((pkg) => {
    let score = 0.5
    if (pkg.equipifySolution.length > 40) score += 0.2
    if (pkg.recommendedPackage.length > 10) score += 0.15
    if (pkg.approvalSummary.some((line) => /blocked|supervised/i.test(line))) score += 0.1
    return clamp01(score)
  })
  const sellerTruth =
    sellerTruthScores.length > 0
      ? sellerTruthScores.reduce((a, b) => a + b, 0) / sellerTruthScores.length
      : 0.3

  const personalizationScores = input.packages.map((pkg) => {
    let score = 0.35
    if (pkg.painPoints.length >= 2) score += 0.2
    if (pkg.outreach.email && pkg.outreach.email.length > 80) score += 0.2
    if (pkg.decisionMakers[0]?.evidence.length) score += 0.15
    if (pkg.missingInformation.length <= 3) score += 0.1
    return clamp01(score)
  })
  const personalization =
    personalizationScores.length > 0
      ? personalizationScores.reduce((a, b) => a + b, 0) / personalizationScores.length
      : 0.2

  const outreachScores = input.packages.map((pkg) => {
    const channels = [
      pkg.outreach.email,
      pkg.outreach.linkedIn,
      pkg.outreach.phoneOpening,
      pkg.outreach.voicemail,
      pkg.outreach.followUp,
    ].filter(Boolean)
    return clamp01(channels.length / 5)
  })
  const outreachQuality =
    outreachScores.length > 0
      ? outreachScores.reduce((a, b) => a + b, 0) / outreachScores.length
      : 0.2

  const approvalQuality =
    input.packages.length > 0
      ? clamp01(
          input.packages.filter((pkg) => pkg.approvalSummary.length >= 6).length /
            input.packages.length,
        )
      : 0

  const operatorConfidence = clamp01(
    (input.outboundKillSwitchOff ? 0.35 : 0) +
      (approvalQuality > 0.7 ? 0.35 : 0.15) +
      (personalization > 0.6 ? 0.3 : 0.1),
  )

  const dimensions: SupervisedSalesWorkflowDimensionScore[] = [
    { dimension: "Discovery", score: discovery, notes: `${input.selectedLeads.length} production leads selected` },
    { dimension: "Research", score: research, notes: "Requires completed prospect research runs" },
    { dimension: "Qualification", score: qualification, notes: "Admission gate + outreach eligibility" },
    { dimension: "Seller Truth", score: sellerTruth, notes: "Approved Business Profile + canonical knowledge" },
    { dimension: "Personalization", score: personalization, notes: "Evidence-backed pain points and hooks" },
    { dimension: "Outreach quality", score: outreachQuality, notes: "Multi-channel drafts from strategy brief" },
    { dimension: "Approval quality", score: approvalQuality, notes: "One-screen operator summary completeness" },
    { dimension: "Operator confidence", score: operatorConfidence, notes: "Outbound gated + approval-ready packages" },
    { dimension: "Runtime readiness", score: runtime.score, notes: `${runtime.present}/${input.runtimeAudit.length} components present` },
  ]

  const overallReadinessScore =
    dimensions.reduce((sum, row) => sum + row.score, 0) / dimensions.length

  return { dimensions, overallReadinessScore: clamp01(overallReadinessScore) }
}
