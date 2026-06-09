/**
 * Apollo-Primary-3 enrollment approval bridge certification — no live DB/Apollo HTTP in CI.
 * Run: pnpm test:apollo-primary-contact-acquisition-3
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  APOLLO_PRIMARY_CONTACT_ENROLLMENT_BRIDGE_QA_MARKER,
  type ApolloPrimaryContactEnrollmentApprovalQueueSnapshot,
} from "../lib/growth/apollo/apollo-primary-contact-enrollment-bridge-types"
import {
  buildApolloPrimaryContactEnrollmentApprovalQueueSnapshot,
  buildEnrollmentBridgeContactSnapshot,
  evaluateApolloEnrollmentApprovalGates,
  evaluateApolloEnrollmentBridgeHandoffGates,
  mapEnrollmentQueueDbRow,
} from "../lib/growth/apollo/apollo-primary-contact-enrollment-bridge-evidence"
import type { ApolloPrimaryContactOperatorReviewRow } from "../lib/growth/apollo/apollo-primary-contact-operator-review-types"

const ROUTE_ROOT = "app/api/platform/growth/apollo-primary-contact-acquisition/enrollment-approval-queue"
const QUEUE_ROUTE_PATH = `${ROUTE_ROOT}/route.ts`
const ACTIONS_ROUTE_PATH = `${ROUTE_ROOT}/actions/route.ts`
const PANEL_PATH = "components/growth/apollo-primary-contact-enrollment-approval-queue-panel.tsx"
const SERVER_PATH = "lib/growth/apollo/apollo-primary-contact-enrollment-bridge.ts"
const OPERATOR_ACTIONS_PATH =
  "app/api/platform/growth/apollo-primary-contact-acquisition/operator-review/actions/route.ts"
const MIGRATION_PATH =
  "supabase/migrations/20270811120000_growth_engine_apollo_primary_contact_enrollment_queue.sql"
const EXECUTION_PAGE_PATH = "app/(admin)/admin/growth/sequences/execution/page.tsx"

const REQUIRED_FILES = [
  "lib/growth/apollo/apollo-primary-contact-enrollment-bridge-types.ts",
  "lib/growth/apollo/apollo-primary-contact-enrollment-bridge-evidence.ts",
  SERVER_PATH,
  QUEUE_ROUTE_PATH,
  ACTIONS_ROUTE_PATH,
  PANEL_PATH,
  MIGRATION_PATH,
]

const FORBIDDEN_SIDE_EFFECT_IMPORTS = [
  "createGrowthSequenceEnrollmentDraft",
  "confirmGrowthSequenceEnrollment",
  "bulkEnrollLeadsInGrowthSequence",
  "enrollLeadInSequence",
  "queueSequenceStepTransportJob",
  "runSequenceExecutionJob",
  "insertGrowthOutreachQueueItem",
  "sendEmail",
  "sendSms",
  "voice-drop",
  "executeSequence",
]

function assertRouteExportsHttpMethod(source: string, method: "GET" | "POST"): void {
  assert.match(
    source,
    new RegExp(`export\\s+async\\s+function\\s+${method}\\b`),
    `Route must export async function ${method}`,
  )
}

for (const relativePath of REQUIRED_FILES) {
  assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  console.log(`  ✓ file.${relativePath}`)
}

const queueRoute = fs.readFileSync(path.join(process.cwd(), QUEUE_ROUTE_PATH), "utf8")
const actionsRoute = fs.readFileSync(path.join(process.cwd(), ACTIONS_ROUTE_PATH), "utf8")
const operatorActionsRoute = fs.readFileSync(path.join(process.cwd(), OPERATOR_ACTIONS_PATH), "utf8")
const serverSource = fs.readFileSync(path.join(process.cwd(), SERVER_PATH), "utf8")
const panelSource = fs.readFileSync(path.join(process.cwd(), PANEL_PATH), "utf8")
const migrationSource = fs.readFileSync(path.join(process.cwd(), MIGRATION_PATH), "utf8")
const executionPageSource = fs.readFileSync(path.join(process.cwd(), EXECUTION_PAGE_PATH), "utf8")

assertRouteExportsHttpMethod(queueRoute, "GET")
assertRouteExportsHttpMethod(actionsRoute, "POST")
assert.doesNotMatch(queueRoute, /export\s+async\s+function\s+POST\b/)
assert.doesNotMatch(actionsRoute, /export\s+async\s+function\s+GET\b/)
console.log("  ✓ route exports — GET enrollment queue, POST enrollment actions")

assert.match(queueRoute, /requireGrowthEnginePlatformAccess/)
assert.match(actionsRoute, /requireGrowthEnginePlatformAccess/)
assert.match(actionsRoute, /logGrowthEngine/)
assert.match(actionsRoute, /auto_enrollment:\s*false/)
assert.match(actionsRoute, /outreach_sent:\s*false/)
assert.match(actionsRoute, /enrolled_count:\s*0/)
console.log("  ✓ routes — platform admin + structured logging with safety flags")

for (const forbidden of FORBIDDEN_SIDE_EFFECT_IMPORTS) {
  assert.doesNotMatch(serverSource, new RegExp(forbidden, "i"), `Bridge server must not import ${forbidden}`)
  assert.doesNotMatch(actionsRoute, new RegExp(forbidden, "i"), `Actions route must not import ${forbidden}`)
}
console.log("  ✓ no enrollment/outreach side-effect imports in bridge server or actions route")

assert.match(serverSource, /auto_enrollment_attempted:\s*false/)
assert.match(serverSource, /outreach_sent:\s*false/)
assert.match(serverSource, /enrolled_count:\s*0/)
assert.match(serverSource, /outreach_count:\s*0/)
assert.doesNotMatch(serverSource, /createGrowthSequenceEnrollmentDraft/)
assert.doesNotMatch(serverSource, /confirmGrowthSequenceEnrollment/)
console.log("  ✓ bridge server hard-codes no auto-enrollment/outreach counters")

assert.match(migrationSource, /apollo_primary_contact_enrollment_queue/)
assert.match(migrationSource, /apollo_primary_contact_enrollment_handoffs/)
assert.match(migrationSource, /auto_enrollment_attempted boolean not null default false/)
assert.match(migrationSource, /outreach_sent boolean not null default false/)
console.log("  ✓ migration — queue + handoff tables with safety defaults")

assert.match(operatorActionsRoute, /handoffApprovedApolloContactToEnrollmentQueue/)
assert.match(operatorActionsRoute, /bulkHandoffApprovedApolloContactsToEnrollmentQueue/)
assert.match(operatorActionsRoute, /enrollment_handoff/)
console.log("  ✓ operator review actions — handoff to enrollment queue after approval")

assert.match(executionPageSource, /ApolloPrimaryContactEnrollmentApprovalQueuePanel/)
console.log("  ✓ sequence execution page — enrollment approval queue panel")

assert.match(panelSource, /APOLLO_PRIMARY_CONTACT_ENROLLMENT_BRIDGE_QA_MARKER/)
assert.match(panelSource, /Approve enrollment eligibility/)
assert.match(panelSource, /no auto-enrollment/i)
console.log("  ✓ UI panel — enrollment approval actions and no-side-effects copy")

assert.equal(
  APOLLO_PRIMARY_CONTACT_ENROLLMENT_BRIDGE_QA_MARKER,
  "apollo-primary-contact-enrollment-bridge-v3",
)
console.log("  ✓ Apollo-Primary-3 QA marker")

const approvedContact: ApolloPrimaryContactOperatorReviewRow = {
  row_id: "contact-1",
  company_contact_id: "contact-1",
  contact_candidate_id: "candidate-1",
  canonical_person_id: "person-1",
  full_name: "Carrie King",
  title: "Chief Operating Officer",
  company_name: "Henry Schein",
  source: "Apollo",
  channel_availability: { email: true, linkedin: true, phone: false },
  enrichment_status: "channel_ready",
  contactable: true,
  sequence_ready: true,
  operator_review_status: "approved",
  outreach_ready: true,
  blockers: [],
  contact_status: "candidate",
  email_status: "discovered",
  phone_status: "unknown",
}

const pendingContact: ApolloPrimaryContactOperatorReviewRow = {
  ...approvedContact,
  operator_review_status: "pending",
  outreach_ready: false,
}

const handoffGateApproved = evaluateApolloEnrollmentBridgeHandoffGates({ contact_row: approvedContact })
assert.equal(handoffGateApproved.allowed, true)
assert.equal(handoffGateApproved.code, null)

const handoffGatePending = evaluateApolloEnrollmentBridgeHandoffGates({ contact_row: pendingContact })
assert.equal(handoffGatePending.allowed, false)
assert.equal(handoffGatePending.code, "operator_review_not_approved")

const notReadyContact: ApolloPrimaryContactOperatorReviewRow = {
  ...approvedContact,
  sequence_ready: false,
  blockers: ["canonical_person_unlinked"],
}
const handoffGateNotReady = evaluateApolloEnrollmentBridgeHandoffGates({ contact_row: notReadyContact })
assert.equal(handoffGateNotReady.allowed, false)
assert.equal(handoffGateNotReady.code, "sequence_not_ready")

const missingPromotedContact: ApolloPrimaryContactOperatorReviewRow = {
  ...approvedContact,
  company_contact_id: null,
  operator_review_status: "approved",
}
const handoffGateMissingCompanyContact = evaluateApolloEnrollmentBridgeHandoffGates({
  contact_row: missingPromotedContact,
})
assert.equal(handoffGateMissingCompanyContact.allowed, false)
assert.equal(handoffGateMissingCompanyContact.code, "missing_company_contact_id")
console.log("  ✓ handoff gates — preserve operator review + sequence readiness + promoted contact id")

const snapshot = buildEnrollmentBridgeContactSnapshot(approvedContact)
assert.equal(snapshot.source, "Apollo")
assert.equal(snapshot.sequence_ready, true)
assert.equal(snapshot.contactable, true)

const queueRow = mapEnrollmentQueueDbRow({
  id: "queue-1",
  company_candidate_id: "company-1",
  company_contact_id: "contact-1",
  contact_candidate_id: null,
  operator_review_id: "review-1",
  status: "pending_enrollment_approval",
  contact_snapshot: snapshot,
  sequence_ready_at_handoff: true,
  blockers_at_handoff: [],
  created_at: "2026-06-09T00:00:00.000Z",
  enrollment_approved_at: null,
  enrollment_approved_email: null,
})

const approvalGate = evaluateApolloEnrollmentApprovalGates({ queue_row: queueRow })
assert.equal(approvalGate.allowed, true)

const queueSnapshot = buildApolloPrimaryContactEnrollmentApprovalQueueSnapshot({
  items: [queueRow],
}) satisfies ApolloPrimaryContactEnrollmentApprovalQueueSnapshot

assert.equal(queueSnapshot.qa_marker, APOLLO_PRIMARY_CONTACT_ENROLLMENT_BRIDGE_QA_MARKER)
assert.equal(queueSnapshot.summary.pending, 1)
assert.equal(queueSnapshot.auto_enrollment, false)
assert.equal(queueSnapshot.outreach_sent, false)
console.log("  ✓ queue snapshot builder — evidence fields and safety flags")

const blockedQueueRow = { ...queueRow, blockers_at_handoff: ["not_contactable"] }
const blockedApproval = evaluateApolloEnrollmentApprovalGates({ queue_row: blockedQueueRow })
assert.equal(blockedApproval.allowed, false)
assert.equal(blockedApproval.code, "blockers_at_handoff")
console.log("  ✓ enrollment approval gates — block when handoff blockers present")

const manifestPath = path.join(process.cwd(), ".next/app-path-routes-manifest.json")
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Record<string, string>
  const queueKey = "/api/platform/growth/apollo-primary-contact-acquisition/enrollment-approval-queue/route"
  const actionsKey =
    "/api/platform/growth/apollo-primary-contact-acquisition/enrollment-approval-queue/actions/route"
  assert.ok(Object.prototype.hasOwnProperty.call(manifest, queueKey), `Build manifest missing ${queueKey}`)
  assert.ok(Object.prototype.hasOwnProperty.call(manifest, actionsKey), `Build manifest missing ${actionsKey}`)
  console.log("  ✓ build manifest — enrollment-approval-queue routes registered")
} else {
  console.log("  · build manifest — skipped (.next/app-path-routes-manifest.json not found; run pnpm build)")
}

console.log("\nApollo-Primary-3 enrollment approval bridge certification passed.")
