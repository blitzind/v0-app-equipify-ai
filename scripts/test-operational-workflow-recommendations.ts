import assert from "node:assert/strict"
import { buildOperationalWorkflowRecommendations } from "../lib/aiden/operational-workflow-recommendations"

const snapshot = {
  scope: "organization",
  counts: {
    activeWorkOrdersUnassigned: 2,
    agingActiveWorkOrdersUpdatedBefore14d: 0,
    scheduledDatePassedStillActive: 0,
  },
  samples: {
    repeatEquipmentPatterns: [{ equipmentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", workOrdersInWindow: 3 }],
    oldestActiveWorkOrderIds: [],
  },
  operationalTimelineIntelligence: {
    operationalEvents: [
      {
        workOrderId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        correlationRuleIds: ["RULE.INSPECTION_SCHEDULE_SLIP_ACTIVE"],
      },
    ],
    recurringIssueChains: [],
    escalationSequences: [],
    operationalEventGroups: [],
  },
  financialHints: { overdueInvoiceCount: 2 },
  operationalHealthScores: {
    categories: [{ id: "asset_readiness", score: 50, scoreIncludedInOverall: true }],
  },
} as Record<string, unknown>

const report = buildOperationalWorkflowRecommendations({
  snapshot,
  permissions: { canViewFinancials: true, canViewBilling: false, canViewFinancialReports: false },
})

const ids = new Set(report.recommendations.map((r) => r.id))
assert.ok(ids.has("wf.pm_plan.repeat_equipment.aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"))
assert.ok(ids.has("wf.inspection.slip.bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"))
assert.ok(ids.has("wf.dispatch.unassigned_active"))
assert.ok(ids.has("wf.invoice.overdue_review"))
assert.ok(ids.has("wf.readiness.equipment_review"))

const pm = report.recommendations.find((r) => r.templateId === "WF.PM_PLAN_FROM_REPEAT_EQUIPMENT")
assert.ok(pm?.primaryHref.includes("maintenance-plans"))
assert.ok(pm?.primaryHref.includes("equipmentId"))

console.info("operational-workflow-recommendations tests passed")
