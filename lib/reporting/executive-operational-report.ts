import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { OperationalModuleContext } from "@/lib/aiden/operational-recommendations-schema"
import { buildOperationalSnapshot, workOrderScopeForAssignedTechnicians } from "@/lib/aiden/operational-snapshot"
import type { OperationalHealthScoresReport } from "@/lib/aiden/operational-health-score-types"
import type { OperationalTimelineIntelligence } from "@/lib/aiden/operational-timeline-types"
import { industryLabelForLaunchpad } from "@/lib/first-run/launchpad-copy"
import { normalizeIndustryKey } from "@/lib/demo-seeding/profiles"
import { resolveOnboardingIndustryBundle } from "@/lib/onboarding-industry/resolve-onboarding-industry-bundle"
import type { OrgPermissions } from "@/lib/permissions/model"
import type { AssignedWorkScope } from "@/lib/permissions/technician-scope"
import type { WorkspaceIndustryKey } from "@/lib/workspace-industry-registry"
import type {
  ExecutiveOperationalBranchSlice,
  ExecutiveOperationalCadence,
  ExecutiveOperationalFlowByType,
  ExecutiveOperationalMethodologyEntry,
  ExecutiveOperationalReport,
  ExecutiveOperationalRiskFact,
  ExecutiveOperationalTimeWindow,
  ExecutiveOperationalTrendRow,
} from "@/lib/reporting/executive-operational-report-types"
import { EXECUTIVE_OPERATIONAL_REPORT_SCHEMA_VERSION } from "@/lib/reporting/executive-operational-report-types"

const MODULE_CTX: OperationalModuleContext = "dashboard"

const METHODOLOGY: ExecutiveOperationalMethodologyEntry[] = [
  {
    id: "METH.WINDOWS_UTC",
    title: "Reporting windows (UTC)",
    explanation:
      "Weekly cadence compares the last 7×24h ending at `generatedAt` vs the prior 7×24h. Monthly cadence uses the previous full calendar month (UTC month boundaries) vs the month before that. `created_at` / `completed_at` filters are `>= start` and `< end` (end exclusive).",
  },
  {
    id: "METH.FLOW_COUNTS",
    title: "Throughput counts",
    explanation:
      "`totalCreated` counts non-archived work orders in the window. Per-type counts use exact `type` matches; `other` is `totalCreated` minus the sum of known buckets (never negative). `totalCompleted` counts rows with non-null `completed_at` in the window.",
  },
  {
    id: "METH.BRANCH_AGGREGATE",
    title: "Branch / service site ranking",
    explanation:
      "When no `customer_location_id` filter is applied, branch slices rank `customer_location_id` among work orders **created** in the current period using a bounded fetch (see `branchRankingRowCap`). Labels come from `customer_locations.name` for the organization.",
  },
  {
    id: "METH.POSTURE_AS_OF_GENERATION",
    title: "Dispatch, health, and timeline posture",
    explanation:
      "Dispatch figures, operational health scores, and timeline intelligence reflect **as-of report generation**, not historical reconstruction at period end. Throughput sections alone are strictly period-bounded.",
  },
  {
    id: "METH.NO_AI_SYNTHESIS",
    title: "No fabricated conclusions",
    explanation:
      "Risk facts and summaries are assembled only from counted fields, existing health-score factor labels, industry brief lines, or timeline rule ids already present in the operational snapshot — no LLM narrative layer.",
  },
]

const BRANCH_SAMPLE_CAP = 4000
const BRANCH_TOP_N = 12

const WO_TYPES = ["repair", "pm", "inspection", "install", "emergency"] as const

function rollingWeekWindows(generatedAt: Date): { current: ExecutiveOperationalTimeWindow; prior: ExecutiveOperationalTimeWindow } {
  const end = generatedAt.toISOString()
  const curStart = new Date(generatedAt.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const priEnd = curStart
  const priStart = new Date(generatedAt.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()
  return {
    current: {
      cadence: "weekly",
      label: "Last 7 days (UTC rolling)",
      startUtc: curStart,
      endUtc: end,
    },
    prior: {
      cadence: "weekly",
      label: "Prior 7 days (UTC rolling)",
      startUtc: priStart,
      endUtc: priEnd,
    },
  }
}

function calendarMonthWindows(generatedAt: Date): { current: ExecutiveOperationalTimeWindow; prior: ExecutiveOperationalTimeWindow } {
  const y = generatedAt.getUTCFullYear()
  const m = generatedAt.getUTCMonth()
  const curStartMs = Date.UTC(y, m - 1, 1)
  const curEndMs = Date.UTC(y, m, 1)
  const priStartMs = Date.UTC(y, m - 2, 1)
  const priEndMs = Date.UTC(y, m - 1, 1)
  const curStart = new Date(curStartMs).toISOString()
  const curEnd = new Date(curEndMs).toISOString()
  const priStart = new Date(priStartMs).toISOString()
  const priEnd = new Date(priEndMs).toISOString()
  const curLabel = new Date(curStartMs).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
  const priLabel = new Date(priStartMs).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
  return {
    current: { cadence: "monthly", label: curLabel, startUtc: curStart, endUtc: curEnd },
    prior: { cadence: "monthly", label: priLabel, startUtc: priStart, endUtc: priEnd },
  }
}

async function headCountWorkOrders(
  supabase: SupabaseClient,
  args: {
    organizationId: string
    woIds: string[] | null
    customerLocationId: string | null
    startUtc: string
    endUtc: string
    mode: "created" | "completed"
    type: (typeof WO_TYPES)[number] | null
  },
): Promise<number> {
  let q = supabase
    .from("work_orders")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", args.organizationId)
    .is("archived_at", null)
  if (args.woIds) q = q.in("id", args.woIds)
  if (args.customerLocationId) q = q.eq("customer_location_id", args.customerLocationId)
  if (args.mode === "created") {
    q = q.gte("created_at", args.startUtc).lt("created_at", args.endUtc)
  } else {
    q = q.not("completed_at", "is", null).gte("completed_at", args.startUtc).lt("completed_at", args.endUtc)
  }
  if (args.type) q = q.eq("type", args.type)
  const { count, error } = await q
  if (error) return 0
  return count ?? 0
}

async function fetchFlowForWindow(
  supabase: SupabaseClient,
  args: {
    organizationId: string
    woIds: string[] | null
    customerLocationId: string | null
    startUtc: string
    endUtc: string
  },
): Promise<ExecutiveOperationalFlowByType> {
  const totalCreated = await headCountWorkOrders(supabase, { ...args, mode: "created", type: null })
  const totalCompleted = await headCountWorkOrders(supabase, { ...args, mode: "completed", type: null })
  const byT = await Promise.all(
    WO_TYPES.map((type) => headCountWorkOrders(supabase, { ...args, mode: "created", type })),
  )
  const repair = byT[0] ?? 0
  const pm = byT[1] ?? 0
  const inspection = byT[2] ?? 0
  const install = byT[3] ?? 0
  const emergency = byT[4] ?? 0
  const typedSum = repair + pm + inspection + install + emergency
  const other = Math.max(0, totalCreated - typedSum)
  return {
    repair,
    pm,
    inspection,
    install,
    emergency,
    other,
    typedSum,
    totalCreated,
    totalCompleted,
  }
}

function trendDirection(current: number, prior: number): ExecutiveOperationalTrendRow["direction"] {
  if (current === prior) return "flat"
  if (prior === 0 && current === 0) return "na"
  if (current > prior) return "up"
  return "down"
}

function buildVolumeTrends(current: ExecutiveOperationalFlowByType, prior: ExecutiveOperationalFlowByType): ExecutiveOperationalTrendRow[] {
  const rows: ExecutiveOperationalTrendRow[] = [
    {
      metricId: "wo_created_total",
      label: "Work orders created (all types)",
      currentPeriod: current.totalCreated,
      priorPeriod: prior.totalCreated,
      direction: trendDirection(current.totalCreated, prior.totalCreated),
    },
    {
      metricId: "wo_completed_total",
      label: "Work orders completed",
      currentPeriod: current.totalCompleted,
      priorPeriod: prior.totalCompleted,
      direction: trendDirection(current.totalCompleted, prior.totalCompleted),
    },
    {
      metricId: "wo_created_pm",
      label: "PM-type work orders created",
      currentPeriod: current.pm,
      priorPeriod: prior.pm,
      direction: trendDirection(current.pm, prior.pm),
    },
    {
      metricId: "wo_created_emergency",
      label: "Emergency-type work orders created",
      currentPeriod: current.emergency,
      priorPeriod: prior.emergency,
      direction: trendDirection(current.emergency, prior.emergency),
    },
    {
      metricId: "wo_created_inspection",
      label: "Inspection-type work orders created",
      currentPeriod: current.inspection,
      priorPeriod: prior.inspection,
      direction: trendDirection(current.inspection, prior.inspection),
    },
  ]
  return rows
}

async function fetchBranchSlices(
  supabase: SupabaseClient,
  args: {
    organizationId: string
    woIds: string[] | null
    startUtc: string
    endUtc: string
  },
): Promise<{ slices: ExecutiveOperationalBranchSlice[]; rowCap: number | null }> {
  let q = supabase
    .from("work_orders")
    .select("customer_location_id")
    .eq("organization_id", args.organizationId)
    .is("archived_at", null)
    .gte("created_at", args.startUtc)
    .lt("created_at", args.endUtc)
    .not("customer_location_id", "is", null)
    .limit(BRANCH_SAMPLE_CAP)
  if (args.woIds) q = q.in("id", args.woIds)
  const { data, error } = await q
  if (error || !data) return { slices: [], rowCap: null }
  const rows = data as Array<{ customer_location_id: string | null }>
  const agg = new Map<string, number>()
  for (const r of rows) {
    const lid = r.customer_location_id
    if (!lid) continue
    agg.set(lid, (agg.get(lid) ?? 0) + 1)
  }
  const topIds = [...agg.entries()].sort((a, b) => b[1] - a[1]).slice(0, BRANCH_TOP_N).map(([id]) => id)
  if (topIds.length === 0) return { slices: [], rowCap: rows.length >= BRANCH_SAMPLE_CAP ? BRANCH_SAMPLE_CAP : null }
  const { data: locs } = await supabase
    .from("customer_locations")
    .select("id, name")
    .eq("organization_id", args.organizationId)
    .eq("is_archived", false)
    .in("id", topIds)
  const nameById = new Map((locs ?? []).map((l) => [String((l as { id: string }).id), String((l as { name: string }).name)]))
  const slices: ExecutiveOperationalBranchSlice[] = topIds.map((id) => ({
    customerLocationId: id,
    locationName: nameById.get(id) ?? id,
    workOrdersCreatedInWindow: agg.get(id) ?? 0,
  }))
  return { slices, rowCap: rows.length >= BRANCH_SAMPLE_CAP ? BRANCH_SAMPLE_CAP : null }
}

function parseHealthScores(snap: Record<string, unknown>): OperationalHealthScoresReport | null {
  const h = snap.operationalHealthScores
  if (!h || typeof h !== "object") return null
  const o = h as OperationalHealthScoresReport
  if (typeof o.overallScore !== "number" || !Array.isArray(o.categories)) return null
  return o
}

function parseTimeline(snap: Record<string, unknown>): OperationalTimelineIntelligence | null {
  const t = snap.operationalTimelineIntelligence
  if (!t || typeof t !== "object") return null
  return t as OperationalTimelineIntelligence
}

function deriveRiskFacts(snap: Record<string, unknown>, timeline: OperationalTimelineIntelligence | null): ExecutiveOperationalRiskFact[] {
  const facts: ExecutiveOperationalRiskFact[] = []
  const counts = snap.counts as Record<string, number> | undefined
  if (counts && typeof counts.agingActiveWorkOrdersUpdatedBefore14d === "number" && counts.agingActiveWorkOrdersUpdatedBefore14d > 0) {
    facts.push({
      statement: `${counts.agingActiveWorkOrdersUpdatedBefore14d} active work order(s) have not been updated in 14+ days (stale active pipeline).`,
      evidencePath: "/counts/agingActiveWorkOrdersUpdatedBefore14d",
    })
  }
  if (counts && typeof counts.scheduledDatePassedStillActive === "number" && counts.scheduledDatePassedStillActive > 0) {
    facts.push({
      statement: `${counts.scheduledDatePassedStillActive} active work order(s) remain open with a scheduled date before today (UTC).`,
      evidencePath: "/counts/scheduledDatePassedStillActive",
    })
  }
  if (counts && typeof counts.activeWorkOrdersUnassigned === "number" && counts.activeWorkOrdersUnassigned > 0) {
    facts.push({
      statement: `${counts.activeWorkOrdersUnassigned} active work order(s) have no assigned user or technician.`,
      evidencePath: "/counts/activeWorkOrdersUnassigned",
    })
  }
  if (counts && typeof counts.maintenancePlansPastDue === "number" && counts.maintenancePlansPastDue > 0) {
    facts.push({
      statement: `${counts.maintenancePlansPastDue} active maintenance plan(s) list a next due date before today.`,
      evidencePath: "/counts/maintenancePlansPastDue",
    })
  }
  const samples = snap.samples as { repeatEquipmentPatterns?: Array<{ equipmentId: string; workOrdersInWindow: number }> } | undefined
  const repeats = samples?.repeatEquipmentPatterns ?? []
  const heavy = repeats.filter((r) => r.workOrdersInWindow >= 3)
  if (heavy.length > 0) {
    facts.push({
      statement: `${heavy.length} equipment asset(s) each have 3+ work orders in the rolling 90-day sample (repeat workload signal).`,
      evidencePath: "/samples/repeatEquipmentPatterns",
    })
  }
  if (timeline && timeline.recurringIssueChains.length > 0) {
    facts.push({
      statement: `Operational timeline lists ${timeline.recurringIssueChains.length} recurring issue chain(s) from bounded work-order history.`,
      evidencePath: "/timelineIntelligence/recurringIssueChains",
    })
  }
  if (timeline && timeline.escalationSequences.length > 0) {
    facts.push({
      statement: `Operational timeline lists ${timeline.escalationSequences.length} priority-escalation sequence(s) on shared equipment within the sampled window.`,
      evidencePath: "/timelineIntelligence/escalationSequences",
      correlationRuleIds: ["RULE.PRIORITY_INCREASE_SAME_EQUIP_14D"],
    })
  }
  return facts
}

export type BuildExecutiveOperationalReportArgs = {
  supabase: SupabaseClient
  organizationId: string
  organizationName: string | null
  industryRaw: string | null
  industryKey: WorkspaceIndustryKey
  permissions: OrgPermissions
  assignedScope: AssignedWorkScope | null
  cadence: ExecutiveOperationalCadence
  customerLocationId: string | null
  customerLocationName: string | null
}

export async function buildExecutiveOperationalReport(args: BuildExecutiveOperationalReportArgs): Promise<ExecutiveOperationalReport> {
  const generatedAt = new Date()
  const generatedAtIso = generatedAt.toISOString()
  const scope = workOrderScopeForAssignedTechnicians(args.permissions, args.assignedScope)
  const includeFinancialHints = Boolean(args.permissions.canViewFinancials || args.permissions.canViewBilling)

  const { current: currentPeriod, prior: priorPeriod } =
    args.cadence === "weekly" ? rollingWeekWindows(generatedAt) : calendarMonthWindows(generatedAt)

  const industryLabel = industryLabelForLaunchpad(args.industryRaw ?? undefined)
  const bundle = resolveOnboardingIndustryBundle(args.industryRaw ?? undefined, industryLabel)

  const limitations: string[] = []

  if (scope.skip) {
    limitations.push("Assigned work scope is empty — throughput and branch sections are zeroed.")
  }

  const [flowCurrent, flowPrior, branchPack] = await Promise.all([
    scope.skip ?
      Promise.resolve({
        repair: 0,
        pm: 0,
        inspection: 0,
        install: 0,
        emergency: 0,
        other: 0,
        typedSum: 0,
        totalCreated: 0,
        totalCompleted: 0,
      } satisfies ExecutiveOperationalFlowByType)
    : fetchFlowForWindow(args.supabase, {
        organizationId: args.organizationId,
        woIds: scope.woIds,
        customerLocationId: args.customerLocationId,
        startUtc: currentPeriod.startUtc,
        endUtc: currentPeriod.endUtc,
      }),
    scope.skip ?
      Promise.resolve({
        repair: 0,
        pm: 0,
        inspection: 0,
        install: 0,
        emergency: 0,
        other: 0,
        typedSum: 0,
        totalCreated: 0,
        totalCompleted: 0,
      } satisfies ExecutiveOperationalFlowByType)
    : fetchFlowForWindow(args.supabase, {
        organizationId: args.organizationId,
        woIds: scope.woIds,
        customerLocationId: args.customerLocationId,
        startUtc: priorPeriod.startUtc,
        endUtc: priorPeriod.endUtc,
      }),
    scope.skip || args.customerLocationId ?
      Promise.resolve({ slices: [] as ExecutiveOperationalBranchSlice[], rowCap: null as number | null })
    : fetchBranchSlices(args.supabase, {
        organizationId: args.organizationId,
        woIds: scope.woIds,
        startUtc: currentPeriod.startUtc,
        endUtc: currentPeriod.endUtc,
      }),
  ])

  if (branchPack.rowCap) {
    limitations.push(
      `Branch ranking used the first ${BRANCH_SAMPLE_CAP} work orders with a service site in the current period — counts may be incomplete if volume exceeded the cap.`,
    )
  }

  const snapshot = await buildOperationalSnapshot(args.supabase, {
    organizationId: args.organizationId,
    permissions: args.permissions,
    assignedScope: args.assignedScope,
    moduleContext: MODULE_CTX,
    includeFinancialHints,
    industryKey: args.industryKey ?? undefined,
  })

  const health = parseHealthScores(snapshot)
  const timeline = parseTimeline(snapshot)
  const counts = snapshot.counts as Record<string, number> | undefined
  const samples = snapshot.samples as
    | { scheduleCongestionExamples?: Array<{ jobsThatDay?: number }> }
    | undefined

  const dispatchAtGeneration = {
    activeWorkOrdersUnassigned: counts?.activeWorkOrdersUnassigned ?? 0,
    scheduledDatePassedStillActive: counts?.scheduledDatePassedStillActive ?? 0,
    maxJobsSameDaySameAssignee: counts?.maxJobsSameDaySameAssignee ?? 0,
    scheduleCongestionExamplesCount: samples?.scheduleCongestionExamples?.length ?? 0,
    methodologyNote:
      "Dispatch metrics mirror the operational snapshot: unassigned active jobs, active jobs past scheduled date, and congestion examples from the next-7d scheduled sample — all as-of generation time.",
  }

  const inspectionCategory = health?.categories.find((c) => c.id === "inspection_compliance")
  const inspectionComplianceSummary = {
    headline: inspectionCategory?.title ?? "Inspection compliance",
    categoryScore: inspectionCategory?.scoreIncludedInOverall === false ? null : (inspectionCategory?.score ?? null),
    contributingFactorLabels: (inspectionCategory?.contributingFactors ?? []).map((f) => f.label),
  }

  const industryBrief = snapshot.industryOperational as { dashboardSummaryLines?: string[] } | undefined
  const readinessSummary = {
    headline: "Deterministic industry dashboard summary lines (from operational snapshot)",
    industryOperationalPresent: Boolean(industryBrief?.dashboardSummaryLines?.length),
    bullets: (industryBrief?.dashboardSummaryLines ?? []).slice(0, 8),
  }
  if (!args.industryRaw?.trim()) {
    limitations.push("Organization `industry` is unset — normalized vertical defaults to the field-service template for weighting.")
  }

  const pmTrends =
    timeline?.operationalTrendTimelines?.find((x) => x.id === "wo_volume_by_type_weekly")?.points?.slice(-8)?.map((p) => ({
      weekStartUtc: p.weekStartUtc,
      pm: p.pm,
      emergency: p.emergency,
      inspection: p.inspection,
      other: p.other,
    })) ?? []

  const operationalSnapshotRef =
    snapshot.scope === "assigned_empty" ?
      null
    : {
        generatedAt: String(snapshot.generatedAt ?? generatedAtIso),
        scope: String(snapshot.scope ?? "unknown"),
        counts: (snapshot.counts as Record<string, unknown>) ?? {},
      }

  return {
    schemaVersion: EXECUTIVE_OPERATIONAL_REPORT_SCHEMA_VERSION,
    generatedAt: generatedAtIso,
    organizationId: args.organizationId,
    organizationName: args.organizationName,
    industryRaw: args.industryRaw,
    industryKey: args.industryKey,
    industryDisplayLabel: industryLabel,
    sectorFramingOneLiner: bundle.aidenSectorFraming ?? null,
    cadence: args.cadence,
    customerLocationId: args.customerLocationId,
    customerLocationName: args.customerLocationName,
    methodology: METHODOLOGY,
    currentPeriod,
    priorPeriod,
    flowCurrent,
    flowPrior,
    volumeTrends: buildVolumeTrends(flowCurrent, flowPrior),
    branchSlices: branchPack.slices,
    branchRankingRowCap: branchPack.rowCap,
    dispatchAtGeneration,
    pmAndMixTrends: pmTrends,
    readinessSummary,
    inspectionComplianceSummary,
    operationalHealthAtGeneration: health,
    timelineIntelligence: timeline,
    operationalRiskFacts: deriveRiskFacts(snapshot, timeline),
    operationalSnapshotRef,
    limitations,
  }
}

export async function loadExecutiveReportOrgContext(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<{ name: string | null; industry: string | null }> {
  const { data } = await supabase.from("organizations").select("name, industry").eq("id", organizationId).maybeSingle()
  const row = data as { name?: string; industry?: string | null } | null
  return { name: row?.name ?? null, industry: row?.industry ?? null }
}

export function resolveIndustryKeyForReporting(industryRaw: string | null | undefined): WorkspaceIndustryKey {
  return normalizeIndustryKey(industryRaw ?? undefined)
}
