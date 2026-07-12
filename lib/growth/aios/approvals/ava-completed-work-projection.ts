/** GE-AIOS-SV1-6B — Deterministic Ava Completed Work projection (client-safe). */

import type { GrowthAutonomousOutreachApprovalPackage } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import type { GrowthHumanApprovalItem } from "@/lib/growth/aios/approvals/growth-human-approval-center-types"
import {
  GROWTH_AVA_COMPLETED_WORK_CATEGORY_LABELS,
  GROWTH_AVA_COMPLETED_WORK_CATEGORY_ORDER,
  GROWTH_AVA_COMPLETED_WORK_NEEDS_REVISION_NOTE_PREFIX,
  GROWTH_AVA_COMPLETED_WORK_QA_MARKER,
  GROWTH_AVA_COMPLETED_WORK_RULE,
  type GrowthAvaCompletedWorkCategoryId,
} from "@/lib/growth/aios/approvals/ava-completed-work-contract"
import { resolveAiTeammatePresentation } from "@/lib/workspace/ai-teammate-identity"

export type GrowthAvaCompletedWorkCategoryCount = {
  id: GrowthAvaCompletedWorkCategoryId
  label: string
  count: number
}

export type GrowthAvaCompletedWorkExplainability = {
  whyCompany: string
  whyNow: string
  whyDecisionMaker: string
  whySequence: string
  supportingEvidence: string[]
  investmentDecision: string
  portfolioDecision: string
  knowledgeSummary: string
}

export type GrowthAvaCompletedOutreachPackageCard = {
  itemId: string
  packageId: string
  leadId: string
  company: string
  decisionMaker: string
  confidence: number
  whySelected: string
  businessObjective: string
  mission: string
  investmentState: string
  portfolioPriority: string
  personalizationSummary: string
  expectedOutcome: string
  risk: GrowthHumanApprovalItem["riskLevel"]
  timePrepared: string
  currentStage: string
  recommendedChannel: string
  recommendedSequence: string
  draftAssets: GrowthAutonomousOutreachApprovalPackage["generatedAssets"]
  explainability: GrowthAvaCompletedWorkExplainability
  route: string | null
  transportBlocked: true
  pendingHumanApproval: true
}

export type GrowthAvaCompletedWorkItem = {
  item: GrowthHumanApprovalItem
  category: GrowthAvaCompletedWorkCategoryId
  outreachCard: GrowthAvaCompletedOutreachPackageCard | null
}

export type GrowthAvaCompletedWorkProjection = {
  qaMarker: typeof GROWTH_AVA_COMPLETED_WORK_QA_MARKER
  rule: typeof GROWTH_AVA_COMPLETED_WORK_RULE
  totalCompleted: number
  categories: GrowthAvaCompletedWorkCategoryCount[]
  items: GrowthAvaCompletedWorkItem[]
}

export function categorizeAvaCompletedWorkItem(
  item: GrowthHumanApprovalItem,
): GrowthAvaCompletedWorkCategoryId {
  if (item.source === "outreach_package" || item.actionType === "approve_outreach_package") {
    return "outreach_packages"
  }
  if (item.source === "meeting_prep" || item.actionType === "approve_meeting_prep") {
    return "meeting_preparations"
  }
  if (
    item.source === "automation" ||
    item.source === "email_sequence" ||
    item.source === "sms_sequence" ||
    item.source === "voice_drop" ||
    item.source === "ai_voice" ||
    item.source === "human_execution" ||
    item.actionType === "send_email" ||
    item.actionType === "send_sms" ||
    item.actionType === "place_call" ||
    item.actionType === "approve_automation" ||
    item.actionType === "review_recommendation"
  ) {
    return "follow_up_recommendations"
  }
  if (
    item.source === "needs_attention" ||
    item.source === "priority_binding" ||
    item.source === "meta_recommender" ||
    item.source === "revenue_operator" ||
    item.source === "adaptive_calibration" ||
    item.source === "autonomous_outbound_scope" ||
    item.actionType === "review_blocker"
  ) {
    return "accounts_need_review"
  }
  return "other"
}

export function parsePackageIdFromApprovalRoute(route: string | undefined): string | null {
  if (!route) return null
  try {
    const url = new URL(route, "https://equipify.local")
    const packageId = url.searchParams.get("packageId")?.trim()
    return packageId || null
  } catch {
    const match = route.match(/[?&]packageId=([^&]+)/)
    if (!match?.[1]) return null
    try {
      return decodeURIComponent(match[1])
    } catch {
      return match[1]
    }
  }
}

export function indexOutreachPackagesById(
  packages: GrowthAutonomousOutreachApprovalPackage[],
): Map<string, GrowthAutonomousOutreachApprovalPackage> {
  const map = new Map<string, GrowthAutonomousOutreachApprovalPackage>()
  for (const pkg of packages) {
    if (!pkg.packageId) continue
    map.set(pkg.packageId, pkg)
  }
  return map
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim()
    if (trimmed) return trimmed
  }
  return null
}

export function projectAvaCompletedOutreachExplainability(
  pkg: GrowthAutonomousOutreachApprovalPackage,
  teammateName?: string | null,
): GrowthAvaCompletedWorkExplainability {
  const teammate = resolveAiTeammatePresentation(teammateName)
  const supportingEvidence = [
    ...pkg.supportingResearch.slice(0, 6),
    ...pkg.personalizationEvidence.slice(0, 4),
  ]

  return {
    whyCompany:
      firstNonEmpty(
        pkg.supportingResearch[0],
        pkg.companyName ? `${teammate.name} selected ${pkg.companyName} after research completed.` : null,
      ) ?? `${teammate.name} completed research and prepared this account for outreach review.`,
    whyNow: `${teammate.name} finished preparation at ${pkg.preparedAt} and stopped for your authorization.`,
    whyDecisionMaker:
      firstNonEmpty(
        pkg.personalizationEvidence.find((line) => /decision|contact|maker|dm/i.test(line)),
        pkg.personalizationEvidence[0],
      ) ?? `${teammate.name} used the available decision-maker context for personalization.`,
    whySequence: `${teammate.name} recommends sequence ${pkg.recommendedSequence} on ${pkg.recommendedChannel}.`,
    supportingEvidence,
    investmentDecision:
      "Account cleared Draft Factory investment gates far enough to prepare a draft package.",
    portfolioDecision:
      `Account won scarce drafting capacity — ${teammate.name} prepared the package and stopped at waiting_for_approval.`,
    knowledgeSummary:
      firstNonEmpty(pkg.supportingResearch.slice(0, 3).join(" · "), pkg.expectedOutcome) ??
      "Knowledge summary is attached as supporting research on the package.",
  }
}

export function projectAvaCompletedOutreachPackageCard(input: {
  item: GrowthHumanApprovalItem
  packageId: string
  pkg: GrowthAutonomousOutreachApprovalPackage | null
  decisionMakerLabel?: string | null
  teammateName?: string | null
}): GrowthAvaCompletedOutreachPackageCard {
  const { item, packageId, pkg } = input
  const company =
    firstNonEmpty(pkg?.companyName, item.title.replace(/^Outreach package —\s*/i, "")) ?? "Account"
  const explainability = pkg
    ? projectAvaCompletedOutreachExplainability(pkg, input.teammateName)
    : {
        whyCompany: item.summary,
        whyNow: `${resolveAiTeammatePresentation(input.teammateName).name} completed this package and is waiting for your authorization.`,
        whyDecisionMaker: `Open details to review decision-maker context ${resolveAiTeammatePresentation(input.teammateName).name} used.`,
        whySequence: String(
          item.evidence.find((row) => /channel/i.test(row.label))?.value ?? "Sequence pending review",
        ),
        supportingEvidence: item.evidence.map((row) =>
          row.value != null ? `${row.label}: ${String(row.value)}` : row.label,
        ),
        investmentDecision: "Prepared under existing Draft Factory investment gates.",
        portfolioDecision: `Priority score ${item.priorityScore} from Human Approval Center ranking.`,
        knowledgeSummary: item.summary,
      }

  const personalizationSummary =
    firstNonEmpty(
      pkg?.personalizationEvidence.slice(0, 2).join(" · "),
      pkg?.generatedAssets[0]?.preview?.slice(0, 160),
      item.summary,
    ) ?? "Personalization attached on the prepared package."

  return {
    itemId: item.id,
    packageId,
    leadId: item.subjectId ?? pkg?.leadId ?? "",
    company,
    decisionMaker:
      firstNonEmpty(input.decisionMakerLabel, explainability.whyDecisionMaker) ??
      "Decision maker prepared with this package",
    confidence: pkg?.confidence ?? item.priorityScore / 100,
    whySelected: explainability.whyCompany,
    businessObjective: firstNonEmpty(pkg?.expectedOutcome, item.summary) ?? "Authorize prepared outreach",
    mission:
      firstNonEmpty(
        pkg?.complianceNotes.find((note) => /mission|objective|plan/i.test(note)),
        "Mission context carried on the preparation package",
      ) ?? "Mission context carried on the preparation package",
    investmentState: explainability.investmentDecision,
    portfolioPriority: `Priority ${item.priorityScore}`,
    personalizationSummary,
    expectedOutcome: firstNonEmpty(pkg?.expectedOutcome, item.summary) ?? "Human-authorized outreach",
    risk: item.riskLevel,
    timePrepared: pkg?.preparedAt ?? item.createdAt,
    currentStage: "Waiting for your authorization",
    recommendedChannel: pkg?.recommendedChannel ?? String(
      item.evidence.find((row) => /channel/i.test(row.label))?.value ?? item.channel ?? "email",
    ),
    recommendedSequence: pkg?.recommendedSequence ?? "email_first_multichannel",
    draftAssets: pkg?.generatedAssets ?? [],
    explainability,
    route: item.route ?? null,
    transportBlocked: true,
    pendingHumanApproval: true,
  }
}

export function projectAvaCompletedWork(input: {
  items: GrowthHumanApprovalItem[]
  packagesById?: Map<string, GrowthAutonomousOutreachApprovalPackage>
  teammateName?: string | null
}): GrowthAvaCompletedWorkProjection {
  const packagesById = input.packagesById ?? new Map()
  const projected: GrowthAvaCompletedWorkItem[] = input.items.map((item) => {
    const category = categorizeAvaCompletedWorkItem(item)
    const packageId =
      category === "outreach_packages" ? parsePackageIdFromApprovalRoute(item.route) : null
    const outreachCard =
      packageId != null
        ? projectAvaCompletedOutreachPackageCard({
            item,
            packageId,
            pkg: packagesById.get(packageId) ?? null,
            teammateName: input.teammateName,
          })
        : null
    return { item, category, outreachCard }
  })

  const counts = Object.fromEntries(
    GROWTH_AVA_COMPLETED_WORK_CATEGORY_ORDER.map((id) => [id, 0]),
  ) as Record<GrowthAvaCompletedWorkCategoryId, number>

  for (const row of projected) {
    counts[row.category] += 1
  }

  const categories = GROWTH_AVA_COMPLETED_WORK_CATEGORY_ORDER.map((id) => ({
    id,
    label: GROWTH_AVA_COMPLETED_WORK_CATEGORY_LABELS[id],
    count: counts[id],
  })).filter((row) => row.count > 0 || row.id === "outreach_packages")

  return {
    qaMarker: GROWTH_AVA_COMPLETED_WORK_QA_MARKER,
    rule: GROWTH_AVA_COMPLETED_WORK_RULE,
    totalCompleted: projected.length,
    categories,
    items: projected,
  }
}

export function buildNeedsRevisionNote(detail?: string | null): string {
  const trimmed = detail?.trim()
  if (!trimmed) return `${GROWTH_AVA_COMPLETED_WORK_NEEDS_REVISION_NOTE_PREFIX} operator requested revision`
  return `${GROWTH_AVA_COMPLETED_WORK_NEEDS_REVISION_NOTE_PREFIX} ${trimmed}`.slice(0, 500)
}
