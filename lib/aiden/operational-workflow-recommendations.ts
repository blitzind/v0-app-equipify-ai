import type { OrgPermissions } from "@/lib/permissions/model"
import type { OperationalHealthScoresReport } from "@/lib/aiden/operational-health-score-types"
import type { OperationalTimelineIntelligence, OperationalTimelineRuleId } from "@/lib/aiden/operational-timeline-types"
import type {
  OperationalWorkflowRecommendation,
  OperationalWorkflowRecommendationSeverity,
  OperationalWorkflowRecommendationsReport,
} from "@/lib/aiden/operational-workflow-recommendations-types"
import { OPERATIONAL_WORKFLOW_REC_SCHEMA_VERSION } from "@/lib/aiden/operational-workflow-recommendations-types"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const RULE_INSPECTION_SLIP: OperationalTimelineRuleId = "RULE.INSPECTION_SCHEDULE_SLIP_ACTIVE"
const RULE_PRIORITY: OperationalTimelineRuleId = "RULE.PRIORITY_INCREASE_SAME_EQUIP_14D"

function sevRank(s: OperationalWorkflowRecommendationSeverity): number {
  if (s === "high") return 3
  if (s === "medium") return 2
  return 1
}

function maintenancePlansNew(equipmentId: string): string {
  const sp = new URLSearchParams({ new: "1", equipmentId })
  return `/maintenance-plans?${sp.toString()}`
}

function workOrdersEquipment(equipmentId: string): string {
  const sp = new URLSearchParams({ equipmentId })
  return `/work-orders?${sp.toString()}`
}

function workOrdersOpen(woId: string): string {
  const sp = new URLSearchParams({ open: woId })
  return `/work-orders?${sp.toString()}`
}

function serviceScheduleOpen(woId: string): string {
  const sp = new URLSearchParams({ open: woId })
  return `/service-schedule?${sp.toString()}`
}

function woStatus(status: string): string {
  const sp = new URLSearchParams({ status })
  return `/work-orders?${sp.toString()}`
}

/**
 * Maps bounded operational snapshot + timeline intelligence to in-app navigation targets.
 * Does not perform mutations — operators confirm in destination screens.
 */
export function buildOperationalWorkflowRecommendations(args: {
  snapshot: Record<string, unknown>
  permissions: Pick<OrgPermissions, "canViewFinancials" | "canViewBilling" | "canViewFinancialReports">
}): OperationalWorkflowRecommendationsReport {
  const methodologyNote =
    "Each item maps snapshot facts to in-app navigation targets only. Nothing runs automatically; confirmation happens in the destination screen."

  const snap = args.snapshot
  if (snap.scope === "assigned_empty") {
    return {
      schemaVersion: OPERATIONAL_WORKFLOW_REC_SCHEMA_VERSION,
      methodologyNote,
      recommendations: [],
    }
  }

  const counts = (snap.counts ?? {}) as Record<string, unknown>
  const num = (k: string): number => {
    const v = counts[k]
    return typeof v === "number" && Number.isFinite(v) ? v : 0
  }

  const timeline = snap.operationalTimelineIntelligence as OperationalTimelineIntelligence | undefined
  const health = snap.operationalHealthScores as OperationalHealthScoresReport | undefined
  const samples = (snap.samples ?? {}) as {
    repeatEquipmentPatterns?: Array<{ equipmentId: string; workOrdersInWindow: number }>
    oldestActiveWorkOrderIds?: string[]
  }

  const recs: OperationalWorkflowRecommendation[] = []
  const seen = new Set<string>()

  function pushRec(r: OperationalWorkflowRecommendation) {
    if (seen.has(r.id)) return
    if (recs.length >= 12) return
    seen.add(r.id)
    recs.push(r)
  }

  const dispatchAutomation: OperationalWorkflowRecommendation["suggestedAutomation"] = {
    automationKey: "review_dispatch_assignment_rules",
    label: "Review assignment / dispatch rules in Automations",
    rationale:
      "When unassigned or stale dispatch signals fire, teams often add reminders or routing rules — configure only after human review.",
    href: "/settings/automations",
  }

  const repeat = samples.repeatEquipmentPatterns ?? []
  for (const row of repeat) {
    if (!row.equipmentId || !UUID_RE.test(row.equipmentId) || row.workOrdersInWindow < 2) continue
    const sev: OperationalWorkflowRecommendationSeverity = row.workOrdersInWindow >= 4 ? "high" : "medium"
    pushRec({
      id: `wf.pm_plan.repeat_equipment.${row.equipmentId}`,
      templateId: "WF.PM_PLAN_FROM_REPEAT_EQUIPMENT",
      title: "Open PM plan creation for a high-repeat asset",
      rationale: `Equipment ${row.equipmentId} has ${row.workOrdersInWindow} work order(s) in the 90-day sample — consider formal PM coverage.`,
      severity: sev,
      primaryHref: maintenancePlansNew(row.equipmentId),
      secondaryHrefs: [
        { label: "Work orders for this equipment", href: workOrdersEquipment(row.equipmentId) },
        { label: "Asset record", href: `/equipment/${row.equipmentId}` },
      ],
      targetRecordIds: [row.equipmentId],
      relatedModule: "maintenance_plans",
      evidencePaths: ["/samples/repeatEquipmentPatterns"],
      correlationRuleIds: [],
      suggestedAutomation: {
        automationKey: "pm_plan_follow_up_reminder",
        label: "Consider a PM / follow-up reminder automation after plans exist",
        rationale: "Automations can remind planners when repeat workload spikes — only after PM plans are in place.",
        href: "/settings/automations",
      },
      executionMode: "manual_navigation_only",
    })
  }

  const chains = timeline?.recurringIssueChains ?? []
  for (const ch of chains) {
    if (ch.chainKind !== "pm_recurrence_same_equipment") continue
    const eq = ch.equipmentId
    if (!eq || !UUID_RE.test(eq)) continue
    pushRec({
      id: `wf.pm_plan.pm_chain.${eq}`,
      templateId: "WF.PM_PLAN_FROM_PM_RECURRENCE_CHAIN",
      title: "Reconcile PM cadence for a recurring PM asset",
      rationale: ch.summary,
      severity: "high",
      primaryHref: maintenancePlansNew(eq),
      secondaryHrefs: [{ label: "Filtered work orders", href: workOrdersEquipment(eq) }],
      targetRecordIds: [eq, ...ch.workOrderIds.filter((id) => UUID_RE.test(id))].slice(0, 8),
      relatedModule: "maintenance_plans",
      evidencePaths: ["/operationalTimelineIntelligence/recurringIssueChains"],
      correlationRuleIds: ch.correlationRuleIds ?? [],
      suggestedAutomation: dispatchAutomation,
      executionMode: "manual_navigation_only",
    })
  }

  const slipWos = new Set<string>()
  for (const ev of timeline?.operationalEvents ?? []) {
    if (!ev.correlationRuleIds?.includes(RULE_INSPECTION_SLIP)) continue
    if (UUID_RE.test(ev.workOrderId)) slipWos.add(ev.workOrderId)
  }
  for (const woId of [...slipWos].slice(0, 3)) {
    pushRec({
      id: `wf.inspection.slip.${woId}`,
      templateId: "WF.INSPECTION_FROM_TIMELINE_SLIP",
      title: "Review a slipped inspection work order",
      rationale:
        "Timeline marks this inspection-type job as active with scheduled date before today and no completion timestamp (UTC date compare).",
      severity: "high",
      primaryHref: workOrdersOpen(woId),
      secondaryHrefs: [{ label: "Service schedule board", href: serviceScheduleOpen(woId) }],
      targetRecordIds: [woId],
      relatedModule: "work_orders",
      evidencePaths: ["/operationalTimelineIntelligence/operationalEvents"],
      correlationRuleIds: [RULE_INSPECTION_SLIP],
      suggestedAutomation: null,
      executionMode: "manual_navigation_only",
    })
  }

  if (num("activeWorkOrdersUnassigned") > 0) {
    pushRec({
      id: "wf.dispatch.unassigned_active",
      templateId: "WF.DISPATCH_UNASSIGNED_ACTIVE",
      title: "Assign technicians to active unassigned jobs",
      rationale: `${num("activeWorkOrdersUnassigned")} active work order(s) have neither assigned user nor technician.`,
      severity: num("activeWorkOrdersUnassigned") >= 6 ? "high" : "medium",
      primaryHref: "/dispatch",
      secondaryHrefs: [
        { label: "Open work orders", href: woStatus("Open") },
        { label: "Scheduled work orders", href: woStatus("Scheduled") },
      ],
      targetRecordIds: [],
      relatedModule: "service_schedule",
      evidencePaths: ["/counts/activeWorkOrdersUnassigned"],
      correlationRuleIds: [],
      suggestedAutomation: dispatchAutomation,
      executionMode: "manual_navigation_only",
    })
  }

  if (num("agingActiveWorkOrdersUpdatedBefore14d") > 0) {
    const oldest = (samples.oldestActiveWorkOrderIds ?? []).filter((id) => UUID_RE.test(id)).slice(0, 1)
    const openQ = oldest[0] ? workOrdersOpen(oldest[0]!) : "/work-orders"
    pushRec({
      id: "wf.dispatch.stale_active",
      templateId: "WF.DISPATCH_STALE_ACTIVE",
      title: "Clear stale active work orders (14+ days without update)",
      rationale: `${num("agingActiveWorkOrdersUpdatedBefore14d")} active work order(s) have updated_at older than fourteen days.`,
      severity: num("agingActiveWorkOrdersUpdatedBefore14d") >= 10 ? "high" : "medium",
      primaryHref: openQ,
      secondaryHrefs: [{ label: "Dispatch board", href: "/dispatch" }],
      targetRecordIds: oldest,
      evidencePaths: ["/counts/agingActiveWorkOrdersUpdatedBefore14d", "/samples/oldestActiveWorkOrderIds"],
      correlationRuleIds: [],
      suggestedAutomation: dispatchAutomation,
      executionMode: "manual_navigation_only",
    })
  }

  if (num("scheduledDatePassedStillActive") > 0) {
    pushRec({
      id: "wf.dispatch.past_scheduled_active",
      templateId: "WF.DISPATCH_PAST_SCHEDULED_ACTIVE",
      title: "Reschedule jobs past their scheduled date",
      rationale: `${num("scheduledDatePassedStillActive")} active work order(s) have scheduled_on before today (UTC).`,
      severity: "high",
      primaryHref: "/dispatch",
      secondaryHrefs: [{ label: "Work orders", href: "/work-orders" }],
      targetRecordIds: [],
      relatedModule: "service_schedule",
      evidencePaths: ["/counts/scheduledDatePassedStillActive"],
      correlationRuleIds: [],
      suggestedAutomation: dispatchAutomation,
      executionMode: "manual_navigation_only",
    })
  }

  const assetCat = health?.categories?.find((c) => c.id === "asset_readiness")
  if (assetCat && typeof assetCat.score === "number" && assetCat.scoreIncludedInOverall !== false && assetCat.score < 55) {
    pushRec({
      id: "wf.readiness.equipment_review",
      templateId: "WF.READINESS_EQUIPMENT_REVIEW",
      title: "Review equipment readiness (sampled asset mix)",
      rationale: `Asset readiness index is ${assetCat.score}/100 in the deterministic health rollup — see contributing factors in health scores.`,
      severity: assetCat.score < 40 ? "high" : "medium",
      primaryHref: "/equipment",
      secondaryHrefs: [{ label: "Work orders", href: "/work-orders" }],
      targetRecordIds: [],
      relatedModule: "equipment",
      evidencePaths: ["/operationalHealthScores/categories/asset_readiness"],
      correlationRuleIds: [],
      suggestedAutomation: {
        automationKey: "readiness_status_digest",
        label: "Optional: digest automations for status changes",
        rationale: "Automations can notify teams when equipment status shifts — configure only with governance review.",
        href: "/settings/automations",
      },
      executionMode: "manual_navigation_only",
    })
  }

  const groups = timeline?.operationalEventGroups?.length ?? 0
  const chainTotal = chains.length
  if (groups >= 1 || chainTotal >= 2) {
    pushRec({
      id: "wf.cleanup.timeline_clusters",
      templateId: "WF.CLEANUP_REPEAT_OR_GROUPS",
      title: "Triage clustered operational events",
      rationale: `Bounded timeline shows ${groups} label group(s) and ${chainTotal} recurring chain(s) — review related work orders manually.`,
      severity: "low",
      primaryHref: "/work-orders",
      secondaryHrefs: [{ label: "Equipment", href: "/equipment" }],
      targetRecordIds: [],
      relatedModule: "work_orders",
      evidencePaths: [
        "/operationalTimelineIntelligence/operationalEventGroups",
        "/operationalTimelineIntelligence/recurringIssueChains",
      ],
      correlationRuleIds: [],
      suggestedAutomation: null,
      executionMode: "manual_navigation_only",
    })
  }

  for (const seq of (timeline?.escalationSequences ?? []).slice(0, 2)) {
    const wo = seq.steps[0]?.workOrderId
    if (!wo || !UUID_RE.test(wo)) continue
    pushRec({
      id: `wf.cleanup.escalation.${wo}`,
      templateId: "WF.CLEANUP_ESCALATION_SEQUENCE",
      title: "Review a priority escalation thread",
      rationale: seq.summary,
      severity: "medium",
      primaryHref: workOrdersOpen(wo),
      secondaryHrefs: [{ label: "Dispatch", href: "/dispatch" }],
      targetRecordIds: seq.steps.map((s) => s.workOrderId).filter((id) => UUID_RE.test(id)).slice(0, 6),
      relatedModule: "work_orders",
      evidencePaths: ["/operationalTimelineIntelligence/escalationSequences"],
      correlationRuleIds: seq.correlationRuleIds?.length ? seq.correlationRuleIds : [RULE_PRIORITY],
      suggestedAutomation: dispatchAutomation,
      executionMode: "manual_navigation_only",
    })
  }

  const fin = snap.financialHints as { overdueInvoiceCount?: number } | undefined
  const overdue = typeof fin?.overdueInvoiceCount === "number" ? fin.overdueInvoiceCount : 0
  const canFin =
    args.permissions.canViewFinancials || args.permissions.canViewBilling || args.permissions.canViewFinancialReports
  if (canFin && overdue > 0) {
    const invoicesOverdue = (() => {
      const sp = new URLSearchParams({ status: "Overdue" })
      return `/invoices?${sp.toString()}`
    })()
    pushRec({
      id: "wf.invoice.overdue_review",
      templateId: "WF.INVOICE_OVERDUE_REVIEW",
      title: "Review overdue or past-due operational invoices",
      rationale: `Financial snapshot lists ${overdue} invoice row(s) as overdue or past due date in the bounded unpaid/sent sample.`,
      severity: overdue >= 5 ? "high" : "medium",
      primaryHref: invoicesOverdue,
      secondaryHrefs: [{ label: "All invoices", href: "/invoices" }],
      targetRecordIds: [],
      relatedModule: "dashboard",
      evidencePaths: ["/financialHints/overdueInvoiceCount"],
      correlationRuleIds: [],
      suggestedAutomation: {
        automationKey: "collections_invoice_reminder",
        label: "Review collections / invoice reminder automations",
        rationale: "Invoice reminders are sensitive — only enable with explicit policy review.",
        href: "/settings/automations",
      },
      executionMode: "manual_navigation_only",
    })
  }

  recs.sort((a, b) => sevRank(b.severity) - sevRank(a.severity) || a.title.localeCompare(b.title))

  return {
    schemaVersion: OPERATIONAL_WORKFLOW_REC_SCHEMA_VERSION,
    methodologyNote,
    recommendations: recs.slice(0, 12),
  }
}
