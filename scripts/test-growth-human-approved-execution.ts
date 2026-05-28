/**
 * Regression checks for Growth Human-Approved Multi-Channel Execution slice 6.32A.
 * Run: pnpm test:growth-human-approved-execution
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  canTransitionHumanExecutionApproval,
  humanExecutionApprovalNextActions,
} from "../lib/growth/human-execution/human-execution-approval-engine"
import { evaluateHumanExecutionFatigue } from "../lib/growth/human-execution/human-execution-fatigue-engine"
import {
  buildHumanExecutionSequencePlan,
  DEFAULT_HUMAN_EXECUTION_SEQUENCE_RULES,
  resolveHumanExecutionSequenceTemplate,
  shouldPauseSequenceForReply,
} from "../lib/growth/human-execution/human-execution-sequence-builder"
import {
  computeHumanExecutionReadiness,
  resolveHumanExecutionReadinessBand,
} from "../lib/growth/human-execution/human-execution-readiness-score"
import { routeHumanExecutionReply } from "../lib/growth/human-execution/human-execution-reply-router"
import { GROWTH_HUMAN_APPROVED_EXECUTION_QA_MARKER } from "../lib/growth/human-execution/human-execution-types"

assert.equal(GROWTH_HUMAN_APPROVED_EXECUTION_QA_MARKER, "human-approved-execution-v1")

const readiness = computeHumanExecutionReadiness({
  dealCloseProbability: 70,
  dealRiskScore: 65,
  revenueExecutionScore: 72,
  callOverallScore: 35,
  callNextStepScore: 30,
  engagementScore: 55,
  replyIntent: "positive_interest",
  meetingFollowUpOverdue: true,
  researchMaturityScore: 48,
  opportunityAmount: 85000,
  daysSinceLastTouch: 14,
  expansionCandidate: true,
})
assert.equal(readiness.readinessBand, "high")
assert.ok(readiness.readinessScore >= 60)
assert.ok(readiness.signals.length >= 3)
assert.equal(resolveHumanExecutionReadinessBand(82), "critical")
assert.equal(resolveHumanExecutionReadinessBand(55), "normal")

const template = resolveHumanExecutionSequenceTemplate(readiness, "positive_interest")
assert.equal(template, "meeting_push")
const plan = buildHumanExecutionSequencePlan(template)
assert.ok(plan.steps.length >= 3)
assert.equal(plan.steps[0].channel, "email")
assert.equal(plan.rules.stopOnPositiveReply, true)

const pause = shouldPauseSequenceForReply("objection", DEFAULT_HUMAN_EXECUTION_SEQUENCE_RULES)
assert.equal(pause.pause, true)

const fatigue = evaluateHumanExecutionFatigue({
  recentTouchCount7d: 4,
  recentTouchCount24h: 2,
  lastTouchAt: new Date().toISOString(),
  rules: DEFAULT_HUMAN_EXECUTION_SEQUENCE_RULES,
})
assert.equal(fatigue.blocked, true)
assert.equal(fatigue.fatiguePrevented, true)

assert.equal(canTransitionHumanExecutionApproval("draft", "review"), true)
assert.equal(canTransitionHumanExecutionApproval("draft", "approved"), false)
assert.equal(canTransitionHumanExecutionApproval("approved", "executed"), true)
assert.deepEqual(humanExecutionApprovalNextActions("review"), ["approved", "draft", "cancelled"])

const positiveRoute = routeHumanExecutionReply({ intent: "positive_interest", leadId: "lead-1" })
assert.equal(positiveRoute.route, "meeting_queue")
assert.equal(positiveRoute.requiresHumanApproval, false)

const negativeRoute = routeHumanExecutionReply({ intent: "not_interested", leadId: "lead-1" })
assert.equal(negativeRoute.route, "suppression_suggestion")
assert.equal(negativeRoute.requiresHumanApproval, true)

const oooRoute = routeHumanExecutionReply({ intent: "out_of_office", leadId: "lead-1" })
assert.equal(oooRoute.route, "resume_recommendation")

const migration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270313120000_growth_engine_human_approved_execution.sql"),
  "utf8",
)
assert.match(migration, /human_execution_plans/)
assert.match(migration, /human_execution_approvals/)
assert.match(migration, /approval_status/)
assert.match(migration, /executed/)

const grantsMigration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270313123000_growth_engine_human_approved_execution_service_role_grants.sql"),
  "utf8",
)
assert.match(grantsMigration, /human_execution_plans/)
assert.match(grantsMigration, /human_execution_plan_steps/)
assert.match(grantsMigration, /human_execution_approvals/)
assert.match(grantsMigration, /grant select, insert, update, delete/)

const schemaHealthSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/human-execution/human-execution-schema-health.ts"),
  "utf8",
)
assert.match(schemaHealthSource, /human-execution-schema-health-v2/)
assert.match(schemaHealthSource, /probeGrowthHumanExecutionSchemaHealth/)
assert.match(schemaHealthSource, /fetchGrowthHumanExecutionSchemaAdminDiagnostics/)
assert.match(schemaHealthSource, /permission_blocked/)
assert.match(schemaHealthSource, /20270313123000_growth_engine_human_approved_execution_service_role_grants/)
assert.match(schemaHealthSource, /Required table missing/)
assert.match(schemaHealthSource, /Readiness check blocked by permissions/)

const schemaHealthRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/human-execution/schema-health/route.ts"),
  "utf8",
)
assert.match(schemaHealthRoute, /fetchGrowthHumanExecutionSchemaAdminDiagnostics/)

const dashboardRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/human-execution/dashboard/route.ts"),
  "utf8",
)
assert.match(dashboardRoute, /requireGrowthEnginePlatformAccess/)
assert.match(dashboardRoute, /GROWTH_HUMAN_APPROVED_EXECUTION_QA_MARKER/)
assert.match(dashboardRoute, /probeGrowthHumanExecutionSchemaHealth/)
assert.match(dashboardRoute, /growthHumanExecutionSchemaResponseMeta/)

const approvalRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/human-execution/approvals/[approvalId]/route.ts"),
  "utf8",
)
assert.match(approvalRoute, /transitionGrowthHumanExecutionApproval/)

const commandSection = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-command-human-execution-section.tsx"),
  "utf8",
)
assert.match(commandSection, /Execution Queue/)

const schemaNotice = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-human-execution-schema-notice.tsx"),
  "utf8",
)
assert.match(schemaNotice, /GrowthHumanExecutionSchemaNotice/)

const executionDashboard = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-human-execution-dashboard.tsx"),
  "utf8",
)
assert.match(executionDashboard, /GrowthHumanExecutionSchemaNotice/)

const leadCard = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-lead-execution-readiness.tsx"),
  "utf8",
)
assert.match(leadCard, /Execution Readiness/)
assert.match(leadCard, /Recommended sequence/)

const drawer = fs.readFileSync(path.join(process.cwd(), "components/growth/growth-lead-drawer.tsx"), "utf8")
assert.match(drawer, /GrowthLeadExecutionReadiness/)

const notificationTypes = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/notifications/notification-types.ts"),
  "utf8",
)
assert.match(notificationTypes, /execution_ready/)
assert.match(notificationTypes, /execution_approval_needed/)
assert.match(notificationTypes, /fatigue_protection_triggered/)
assert.match(notificationTypes, /call_now_opportunity/)

const masterContext = fs.readFileSync(path.join(process.cwd(), "lib/admin/master-context.manual.before.md"), "utf8")
assert.match(masterContext, /6\.32A.*Human.*Approved|human-approved-execution-v1/i)

const service = fs.readFileSync(path.join(process.cwd(), "lib/growth/human-execution/human-execution-service.ts"), "utf8")
assert.doesNotMatch(service, /auto.?send|openai|autonomous/i)

console.log("growth-human-approved-execution: all checks passed")
