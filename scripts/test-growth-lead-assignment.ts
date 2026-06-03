/**
 * Regression checks for Growth Engine lead assignment (slice 6.17A).
 * Run: pnpm test:growth-lead-assignment
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_ASSIGNMENT_DEFAULT_BATCH_SIZE,
  GROWTH_ASSIGNMENT_MANUAL_PROTECTED_SOURCES,
  GROWTH_LEAD_ASSIGNMENT_QA_MARKER,
} from "../lib/growth/assignment/assignment-types"
import { isManualAssignmentProtected, selectAssignmentRepForLead } from "../lib/growth/assignment/assignment-engine"
import type { GrowthRepRosterEntry } from "../lib/growth/assignment/assignment-types"
import type { GrowthLead } from "../lib/growth/types"

assert.equal(GROWTH_LEAD_ASSIGNMENT_QA_MARKER, "growth-lead-assignment-v1")
assert.equal(GROWTH_ASSIGNMENT_DEFAULT_BATCH_SIZE, 25)
assert.deepEqual(GROWTH_ASSIGNMENT_MANUAL_PROTECTED_SOURCES, ["manual", "manager_override"])
assert.equal(isManualAssignmentProtected("manual"), true)
assert.equal(isManualAssignmentProtected("rule"), false)

const baseRep = (overrides: Partial<GrowthRepRosterEntry>): GrowthRepRosterEntry => ({
  id: "rep-1",
  userId: "user-1",
  email: "rep@example.com",
  displayName: "Rep One",
  status: "active",
  maxActiveLeads: 10,
  maxDailyNewAssignments: 5,
  industries: ["hvac"],
  territories: ["TX"],
  leadTypes: [],
  roundRobinOrder: 0,
  lastAssignedAt: null,
  activeLeadCount: 2,
  dailyAssignmentCount: 1,
  isOverCapacity: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
})

const baseLead = {
  id: "lead-1",
  companyName: "HVAC Services Inc",
  sourceKind: "manual",
  crmDetected: null,
  fieldServiceStackDetected: null,
  metadata: {},
  state: "TX",
  city: "Austin",
  country: "US",
  score: 80,
  callPriorityTier: "high",
  executivePriorityTier: null,
  engagementTier: "hot",
} as unknown as GrowthLead

const winner = selectAssignmentRepForLead({
  lead: baseLead,
  reps: [
    baseRep({ userId: "user-1", roundRobinOrder: 0 }),
    baseRep({ userId: "user-2", email: "rep2@example.com", roundRobinOrder: 1, industries: [] }),
  ],
  settings: {
    id: "settings-1",
    roundRobinEnabled: true,
    industrySpecializationEnabled: true,
    territoryMatchingEnabled: true,
    capacityBalancingEnabled: true,
    priorityRoutingEnabled: true,
    roundRobinCursorUserId: null,
    updatedBy: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
})

assert.ok(winner)
assert.equal(winner?.rep.userId, "user-1")

const pausedExcluded = selectAssignmentRepForLead({
  lead: baseLead,
  reps: [baseRep({ status: "paused" })],
  settings: {
    id: "settings-1",
    roundRobinEnabled: true,
    industrySpecializationEnabled: false,
    territoryMatchingEnabled: false,
    capacityBalancingEnabled: false,
    priorityRoutingEnabled: false,
    roundRobinCursorUserId: null,
    updatedBy: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
})
assert.equal(pausedExcluded, null)

const engineSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/assignment/run-assignment-engine.ts"),
  "utf8",
)
assert.match(engineSource, /dryRun/)
assert.match(engineSource, /emitGrowthLeadAssignmentRuleAppliedTimeline/)
assert.doesNotMatch(engineSource, /executeGrowthOutreachQueueItem/)

const assignSource = fs.readFileSync(path.join(process.cwd(), "lib/growth/assignment/assign-lead.ts"), "utf8")
assert.match(assignSource, /manual_owner_protected/)
assert.match(assignSource, /manager_override/)
assert.match(assignSource, /recordGrowthLeadInitialAssignment/)

const leadsRouteSource = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/leads/route.ts"),
  "utf8",
)
assert.match(leadsRouteSource, /assignedTo: z\.string\(\)\.uuid\(\)/)
assert.match(leadsRouteSource, /recordGrowthLeadInitialAssignment/)
assert.match(leadsRouteSource, /assignee_ineligible/)

const formDialogSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-lead-form-dialog.tsx"),
  "utf8",
)
assert.match(formDialogSource, /Assigned To \*/)
assert.match(formDialogSource, /Assign to me/)
assert.match(formDialogSource, /assignment\/reps/)

const crmPageSource = fs.readFileSync(
  path.join(process.cwd(), "app/(admin)/admin/growth/leads/crm/page.tsx"),
  "utf8",
)
assert.match(crmPageSource, /assignedTo: values\.assignedTo/)
assert.match(crmPageSource, /ownerLabels/)

const schedulerSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/sequence-enrollment/run-sequence-scheduler.ts"),
  "utf8",
)
assert.match(schedulerSource, /lead\.assignedTo/)

const assignRouteSource = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/leads/[leadId]/assign/route.ts"),
  "utf8",
)
assert.match(assignRouteSource, /requireGrowthEnginePlatformAccess/)

const runRouteSource = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/assignment/run/route.ts"),
  "utf8",
)
assert.match(runRouteSource, /requireGrowthEnginePlatformAccess/)

const migrationSource = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270224120000_growth_engine_lead_assignment.sql"),
  "utf8",
)
assert.match(migrationSource, /rep_roster/)
assert.match(migrationSource, /lead_assigned/)
assert.match(migrationSource, /assigned_at/)

console.log("growth lead assignment tests passed")
