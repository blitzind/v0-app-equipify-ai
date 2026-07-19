/**
 * GE-AIOS-OPERATOR-EXPERIENCE-1A — Canonical operator workspace projection (client-safe).
 * Single story across Home, Lead Workspace, Completed Work, and HAC.
 */

import type { GrowthAutonomousOutreachApprovalPackage } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import type { GrowthHumanApprovalItem } from "@/lib/growth/aios/approvals/growth-human-approval-center-types"
import {
  filterActiveCompletedWorkItems,
  resolveCompletedWorkOperatorBucket,
  summarizeActionableCompletedWork,
} from "@/lib/growth/aios/approvals/completed-work-operator-ux"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-workspace-base-path"
import type { GrowthCanonicalOperatorDecisionProjection } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1b-operator-projection"
import {
  formatCanonicalDraftCount,
  formatCanonicalPackageCount,
  humanizeOperatorDecisionTitle,
  humanizeOperatorFacingLine,
} from "@/lib/growth/aios/operator-experience/growth-operator-language-1a"
import {
  GROWTH_AIOS_OPERATOR_EXPERIENCE_1A_QA_MARKER,
  type GrowthCanonicalLeadOpportunityNarrative,
  type GrowthCanonicalOperatorApprovalPackagePreview,
  type GrowthCanonicalOperatorApprovalSnapshot,
  type GrowthCanonicalOperatorTask,
  type GrowthCanonicalOperatorWorkspaceLeadContext,
} from "@/lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a-types"
import {
  buildGrowthReviewHref,
  resolveOperatorPackageReviewHref,
} from "@/lib/growth/workspace/ux-1a/review/growth-review-routes"
import {
  GROWTH_OPERATOR_PACKAGE_AUTHORIZE_PROMISE_TASK,
} from "@/lib/growth/workspace/ux-1a/review/growth-operator-package-review-copy-1a"

function relativePreparedLabel(preparedAt: string | null): string | null {
  if (!preparedAt) return null
  const parsed = Date.parse(preparedAt)
  if (!Number.isFinite(parsed)) return null
  const minutes = Math.max(1, Math.round((Date.now() - parsed) / 60000))
  if (minutes < 60) return `Prepared ${minutes} minute${minutes === 1 ? "" : "s"} ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `Prepared ${hours} hour${hours === 1 ? "" : "s"} ago`
  const days = Math.round(hours / 24)
  return `Prepared ${days} day${days === 1 ? "" : "s"} ago`
}

function draftCountFromPackage(
  pkg: GrowthAutonomousOutreachApprovalPackage | null | undefined,
): number {
  if (!pkg) return 0
  return pkg.generatedAssets?.length ?? 0
}

function packagePreviewFromItem(input: {
  item: GrowthHumanApprovalItem
  pkg?: GrowthAutonomousOutreachApprovalPackage | null
}): GrowthCanonicalOperatorApprovalPackagePreview {
  const draftCount = draftCountFromPackage(input.pkg)
  const titleCompany = input.item.title.split("—").pop()?.trim()
  const companyName =
    input.pkg?.companyName?.trim() ||
    titleCompany ||
    input.item.summary?.trim() ||
    "Account"
  const packageIdFromRoute = input.item.route?.match(/packageId=([^&]+)/)?.[1]
  const packageId =
    input.pkg?.packageId ??
    (packageIdFromRoute ? decodeURIComponent(packageIdFromRoute) : null) ??
    input.item.id

  const assetEvidence = input.item.evidence.find((row) => /asset/i.test(row.label))
  const resolvedDraftCount =
    draftCount ||
    (typeof assetEvidence?.value === "number" ? assetEvidence.value : 0)

  return {
    itemId: input.item.id,
    packageId,
    leadId: input.item.subjectType === "lead" ? input.item.subjectId ?? "" : "",
    companyName,
    decisionMaker: input.item.summary || null,
    draftCount: resolvedDraftCount,
    preparedAt: input.pkg?.preparedAt ?? input.item.createdAt ?? null,
    preparedAgoLabel: relativePreparedLabel(input.pkg?.preparedAt ?? input.item.createdAt ?? null),
    channelLabel:
      input.pkg?.generatedAssets?.[0]?.channel ??
      (input.item.channel && input.item.channel !== "none" ? input.item.channel : "Email sequence"),
    statusLabel: "Waiting for approval",
    reviewHref: resolveOperatorPackageReviewHref(packageId),
  }
}

export function buildCanonicalOperatorApprovalSnapshot(input: {
  hacItems: GrowthHumanApprovalItem[]
  packagesById?: Map<string, GrowthAutonomousOutreachApprovalPackage>
  dismissedItemIds?: ReadonlySet<string>
  leadLifecycleById?: Map<string, { status?: string | null; archivedAt?: string | null }>
}): GrowthCanonicalOperatorApprovalSnapshot {
  const active = filterActiveCompletedWorkItems({
    items: input.hacItems,
    dismissedItemIds: input.dismissedItemIds,
    leadLifecycleById: input.leadLifecycleById as never,
  })
  const summary = summarizeActionableCompletedWork(active)

  const outreachItems = active.filter(
    (item) => resolveCompletedWorkOperatorBucket(item) === "ready_outreach",
  )

  const packages: GrowthCanonicalOperatorApprovalPackagePreview[] = outreachItems.map((item) => {
    const packageIdFromRoute = item.route?.match(/packageId=([^&]+)/)?.[1]
    const decodedPackageId = packageIdFromRoute ? decodeURIComponent(packageIdFromRoute) : null
    const pkg =
      (decodedPackageId ? input.packagesById?.get(decodedPackageId) : null) ??
      [...(input.packagesById?.values() ?? [])].find(
        (row) => row.leadId === item.subjectId && row.pendingHumanApproval,
      ) ??
      null
    return packagePreviewFromItem({ item, pkg })
  })

  const outreachDraftCount = packages.reduce((sum, row) => sum + Math.max(row.draftCount, 0), 0)

  return {
    qaMarker: GROWTH_AIOS_OPERATOR_EXPERIENCE_1A_QA_MARKER,
    outreachPackageCount: summary.outreachPackages,
    outreachDraftCount,
    pendingApprovalCount: summary.totalActionable,
    waitingForOperator: summary.totalActionable > 0,
    packages,
    topPackage: packages[0] ?? null,
  }
}

export function buildCanonicalOperatorTask(input: {
  approvalSnapshot: GrowthCanonicalOperatorApprovalSnapshot
  decision?: GrowthCanonicalOperatorDecisionProjection | null
  focusLeadId?: string | null
  focusCompanyName?: string | null
  focusHref?: string | null
  teammateName?: string
}): GrowthCanonicalOperatorTask | null {
  const teammate = input.teammateName?.trim() || "Ava"
  const top = input.approvalSnapshot.topPackage

  if (top) {
    const draftLabel =
      top.draftCount > 0
        ? `${top.draftCount} draft${top.draftCount === 1 ? "" : "s"}`
        : "outreach package"
    return {
      id: `approval:${top.itemId}`,
      kind: "approval",
      title: `Review ${top.companyName}`,
      detail: `${top.channelLabel ?? "Email sequence"} prepared · ${draftLabel}`,
      why: `${teammate} finished research and prepared outreach for your review.`,
      whatHappensNext: GROWTH_OPERATOR_PACKAGE_AUTHORIZE_PROMISE_TASK,
      confidenceLabel: null,
      href: top.reviewHref,
      companyName: top.companyName,
      leadId: top.leadId || null,
      draftCount: input.approvalSnapshot.outreachDraftCount,
      packageCount: input.approvalSnapshot.outreachPackageCount,
    }
  }

  const focusLeadId = input.focusLeadId?.trim() || null
  const focusCompanyName = input.focusCompanyName?.trim() || null
  const focusHref =
    input.focusHref?.trim() ||
    (focusLeadId ? `${GROWTH_WORKSPACE_BASE_PATH}/leads/${focusLeadId}` : null)

  if (input.decision?.operatorReviewRequired) {
    return {
      id: `decision:${input.decision.decisionFingerprint}`,
      kind: "decision",
      title: humanizeOperatorDecisionTitle(
        input.decision.whatToDo,
        input.decision.primaryAction,
      ),
      detail: input.decision.why[0] ?? "I need your input before I continue.",
      why: input.decision.why[0] ?? "This step needs your judgment.",
      whatHappensNext:
        input.decision.thenActions[0] ??
        "Once you confirm, I'll take the next step on this account.",
      confidenceLabel: input.decision.confidenceLabel,
      href: buildGrowthReviewHref({ tab: "packages" }),
      companyName: focusCompanyName,
      leadId: focusLeadId,
      draftCount: input.approvalSnapshot.outreachDraftCount,
      packageCount: input.approvalSnapshot.outreachPackageCount,
    }
  }

  if (input.decision) {
    return {
      id: `decision:${input.decision.decisionFingerprint}`,
      kind: "decision",
      title: humanizeOperatorDecisionTitle(
        input.decision.whatToDo,
        input.decision.primaryAction,
      ),
      detail: input.decision.why[0] ?? "",
      why: input.decision.why[0] ?? "",
      whatHappensNext:
        input.decision.thenActions[0] ?? "I'll keep working this account in the background.",
      confidenceLabel: input.decision.confidenceLabel,
      href: focusHref ?? `${GROWTH_WORKSPACE_BASE_PATH}/leads`,
      companyName: focusCompanyName,
      leadId: focusLeadId,
      draftCount: input.approvalSnapshot.outreachDraftCount,
      packageCount: input.approvalSnapshot.outreachPackageCount,
    }
  }

  return null
}

export function projectCanonicalLeadOpportunityNarrative(
  input: GrowthCanonicalOperatorWorkspaceLeadContext,
): GrowthCanonicalLeadOpportunityNarrative {
  const decision = input.decision
  const snapshot = input.approvalSnapshot
  const hac = input.hacItem
  const packageForLead = snapshot?.packages.find((row) => row.leadId === input.leadId) ?? null

  const approvalRequired =
    Boolean(decision?.operatorReviewRequired) ||
    Boolean(decision?.transportBlocked) ||
    Boolean(packageForLead) ||
    Boolean(hac?.status === "pending")

  const currentFocus = packageForLead
    ? `Review outreach for ${input.companyName}`
    : decision
      ? humanizeOperatorDecisionTitle(decision.whatToDo, decision.primaryAction)
      : `Research and qualify ${input.companyName}`

  const blockedBy = approvalRequired
    ? "Waiting for your approval before outreach"
    : decision?.transportBlocked
      ? "Waiting for your approval before outreach"
      : null

  const nextStep = packageForLead
    ? "Review the prepared sequence and approve send"
    : decision
      ? humanizeOperatorDecisionTitle(decision.whatToDo, decision.primaryAction)
      : "Continue qualification research"

  const why =
    decision?.why[0] ??
    (packageForLead
      ? `${packageForLead.channelLabel ?? "Outreach"} is ready for your review.`
      : "I'm building context on this account.")

  const evidence = [
    ...(decision?.why ?? []).slice(0, 3).map(humanizeOperatorFacingLine),
    packageForLead?.preparedAgoLabel,
    packageForLead ? `${packageForLead.draftCount} draft${packageForLead.draftCount === 1 ? "" : "s"} prepared` : null,
  ].filter((row): row is string => Boolean(row?.trim()))

  const waitingSummary = approvalRequired
    ? packageForLead
      ? `${formatCanonicalPackageCount(1)} · ${formatCanonicalDraftCount(packageForLead.draftCount)}`
      : formatCanonicalPackageCount(snapshot?.outreachPackageCount ?? 0)
    : null

  return {
    qaMarker: GROWTH_AIOS_OPERATOR_EXPERIENCE_1A_QA_MARKER,
    currentFocus,
    blockedBy,
    nextStep,
    why,
    evidence,
    progress: decision?.freshnessLabel
      ? humanizeOperatorFacingLine(decision.freshnessLabel)
      : null,
    approvalRequired,
    nextAction: nextStep,
    waitingForOperatorSummary: waitingSummary,
    draftCount: packageForLead?.draftCount ?? snapshot?.outreachDraftCount ?? 0,
    packageCount: packageForLead ? 1 : snapshot?.outreachPackageCount ?? 0,
    decisionFingerprint: decision?.decisionFingerprint ?? null,
    hacItemId: hac?.id ?? packageForLead?.itemId ?? null,
  }
}

export function buildCanonicalOperatorWaitingSummary(input: {
  approvalSnapshot: GrowthCanonicalOperatorApprovalSnapshot
  replyCount?: number
}): string {
  const packages = input.approvalSnapshot.outreachPackageCount
  const drafts = input.approvalSnapshot.outreachDraftCount
  const replies = Math.max(input.replyCount ?? 0, 0)

  if (packages > 0 && replies > 0) {
    return `I've prepared ${packages} outreach ${packages === 1 ? "package" : "packages"} with ${drafts} ${drafts === 1 ? "draft" : "drafts"}, and ${replies} ${replies === 1 ? "reply needs" : "replies need"} your review.`
  }
  if (packages > 0) {
    return `I've prepared ${packages} outreach ${packages === 1 ? "package" : "packages"} with ${drafts} ${drafts === 1 ? "draft" : "drafts"} that need your approval.`
  }
  if (drafts > 0) {
    return formatCanonicalDraftCount(drafts) + " that need your approval."
  }
  if (replies > 0) {
    return `${replies} ${replies === 1 ? "reply needs" : "replies need"} your review before I can continue.`
  }
  return "Nothing needs your approval right now — I'll add prepared work here when it's ready."
}

export function resolveCanonicalApprovalQueueCount(
  approvalSnapshot: GrowthCanonicalOperatorApprovalSnapshot | null | undefined,
  legacyFallback = 0,
): number {
  if (!approvalSnapshot) return legacyFallback
  return approvalSnapshot.pendingApprovalCount
}

export function resolveCanonicalOutreachDraftCount(
  approvalSnapshot: GrowthCanonicalOperatorApprovalSnapshot | null | undefined,
  legacyFallback = 0,
): number {
  if (!approvalSnapshot) return legacyFallback
  return approvalSnapshot.outreachDraftCount
}
