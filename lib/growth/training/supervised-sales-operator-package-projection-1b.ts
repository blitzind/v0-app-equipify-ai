/**
 * GE-AIOS-FIRST-CUSTOMER-SUPERVISED-SALES-1B — Operator seller package projection (client-safe).
 */

import type { GrowthAutonomousOutreachApprovalPackage } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import { projectApprovals2AOperatorReviewPacket } from "@/lib/growth/aios/approvals/approvals-operator-review-packet"
import type { SupervisedSalesOperatorPackageSection } from "@/lib/growth/training/supervised-sales-workflow-1b-types"

function assetPreview(
  pkg: GrowthAutonomousOutreachApprovalPackage,
  channel: string,
): string | null {
  const asset = pkg.generatedAssets.find((row) => row.channel === channel)
  return (
    asset?.approvedPreview?.trim() ||
    asset?.operatorPreview?.trim() ||
    asset?.preview?.trim() ||
    asset?.generatedPreview?.trim() ||
    null
  )
}

function uniqueLines(values: Array<string | null | undefined>, limit = 8): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const trimmed = value?.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
    if (out.length >= limit) break
  }
  return out
}

export function projectSupervisedSalesOperatorPackage(input: {
  pkg: GrowthAutonomousOutreachApprovalPackage
  teammateName?: string | null
}): SupervisedSalesOperatorPackageSection {
  const review = projectApprovals2AOperatorReviewPacket({
    pkg: input.pkg,
    teammateName: input.teammateName,
  })
  const brief = input.pkg.salesStrategyBrief
  const strategy = brief
  const seller = strategy?.sellerTruth
  const prospect = strategy?.prospectTruth

  const painPoints = uniqueLines([
    ...(prospect?.businessProblems ?? []),
    ...(strategy?.businessProblems ?? []),
    ...(review.operatorReviewLayout.expandable.prospectTruthDetail.filter((line) =>
      line.startsWith("Problem:"),
    ) ?? []),
  ])

  const equipment = uniqueLines([
    ...(review.company.equipmentServiced ?? []),
    ...(strategy?.equipmentServiced ?? []),
  ])

  const operations = uniqueLines([
    review.company.industry ? `Industry: ${review.company.industry}` : null,
    review.company.employees ? `Size: ${review.company.employees}` : null,
    review.company.location ? `Location: ${review.company.location}` : null,
    ...(review.operatorReviewLayout.researchSummary.slice(0, 4) ?? []),
  ])

  const recommendedPackage =
    seller?.commercialGuidance?.find((line) => /packag|tier|plan|module/i.test(line)) ??
    seller?.currentCapabilities?.slice(0, 3).join(", ") ??
    "Tailored operations package based on team size and workflow scope"

  const packageRationale =
    seller?.primaryValueProposition ??
    seller?.elevatorPitch ??
    "Equipify aligns dispatch-to-cash workflows for equipment-service operators."

  const equipifySolution = uniqueLines([
    strategy?.businessValue,
    strategy?.recommendedConversation,
    ...(seller?.currentCapabilities?.slice(0, 4).map((cap) => `Capability: ${cap}`) ?? []),
    ...(seller?.differentiators.slice(0, 2).map((line) => `Differentiator: ${line}`) ?? []),
  ]).join(" ")

  const dmAnalysis = strategy?.decisionMakerAnalysis
  const decisionMakers = [
    {
      name: dmAnalysis?.name ?? review.decisionMaker.name ?? null,
      title: dmAnalysis?.title ?? review.decisionMaker.title ?? null,
      confidence:
        dmAnalysis?.likelyResponsibilities?.length
          ? "medium-high (research-backed role context)"
          : review.decisionMaker.contactConfidence != null
            ? `${Math.round(review.decisionMaker.contactConfidence * 100)}% contact confidence`
            : "medium (contact on file)",
      evidence: uniqueLines([
        dmAnalysis?.whyThisPerson,
        dmAnalysis?.whyTheyCare,
        ...(review.operatorReviewLayout.expandable.prospectTruthDetail.filter((line) =>
          /evidence|decision|contact/i.test(line),
        ) ?? []),
      ]),
      missing: uniqueLines([
        ...(review.risk.unknownFields ?? []),
        ...(strategy?.missingPersonalizationOpportunities ?? []),
        ...(prospect?.missingEvidence ?? []),
      ]),
    },
  ]

  const objections =
    strategy?.objections?.length
      ? strategy.objections
      : (seller?.objections ?? []).slice(0, 4)

  const approvalSummary = uniqueLines([
    `Company: ${input.pkg.companyName}`,
    `Confidence: ${Math.round((input.pkg.confidence ?? strategy?.confidence ?? review.explainability.confidence ?? 0.5) * 100)}%`,
    `Admission fit: ${prospect?.fitReason ?? review.explainability.whyPursue ?? "ICP-aligned"}`,
    `Hook: ${strategy?.primaryHook ?? review.explainability.whyMessaging ?? "See outreach drafts"}`,
    `Recommended: ${strategy?.recommendedConversation ?? review.explainability.whyContact ?? "Discovery conversation"}`,
    `Package: ${recommendedPackage}`,
    `Channels ready: ${review.drafts.filter((d) => d.prepared).map((d) => d.label).join(", ") || "pending"}`,
    input.pkg.transportBlocked ? "Outbound: BLOCKED (supervised only)" : "Outbound: gated",
    input.pkg.pendingHumanApproval ? "Awaiting operator Yes/No" : "Decision recorded",
  ], 10)

  return {
    executiveSummary: strategy?.executiveSummary ?? review.explainability.whyPursue ?? "",
    whyBuy:
      strategy?.businessValue ??
      seller?.primaryValueProposition ??
      "Operational clarity for field-service workflows.",
    companySummary: review.company.name ?? input.pkg.companyName,
    industry: review.company.industry ?? strategy?.industry ?? null,
    operations,
    equipment,
    fieldWorkforce: uniqueLines([
      dmAnalysis?.title?.includes("Dispatch") ? "Dispatch-led field operations" : null,
      dmAnalysis?.title?.includes("Service") ? "Service manager + technician workforce" : null,
      "Field technicians and service coordinators",
    ]),
    likelyWorkflow: uniqueLines([
      ...(seller?.discoveryQuestions?.slice(0, 3) ?? []),
      strategy?.recommendedConversation,
      "Dispatch → field completion → billing handoff",
    ]),
    growthStage: review.company.employees ?? null,
    painPoints,
    equipifySolution,
    recommendedPackage,
    packageRationale,
    decisionMakers,
    outreach: {
      email: assetPreview(input.pkg, "email"),
      linkedIn: assetPreview(input.pkg, "linkedin") ?? assetPreview(input.pkg, "linked_in"),
      phoneOpening: assetPreview(input.pkg, "call_guide") ?? assetPreview(input.pkg, "phone"),
      voicemail: assetPreview(input.pkg, "voicemail"),
      followUp: assetPreview(input.pkg, "follow_up") ?? assetPreview(input.pkg, "sms"),
    },
    objections,
    approvalSummary,
    missingInformation: uniqueLines([
      ...(review.risk.unknownFields ?? []),
      ...(prospect?.missingEvidence ?? []),
      ...(strategy?.missingPersonalizationOpportunities ?? []),
    ]),
  }
}
