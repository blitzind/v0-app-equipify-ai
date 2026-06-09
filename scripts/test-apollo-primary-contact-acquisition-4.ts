/**
 * Apollo-Primary-4 enrollment draft creation & end-to-end certification — no live DB/Apollo HTTP in CI.
 * Run: pnpm test:apollo-primary-contact-acquisition-4
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  APOLLO_PRIMARY_CONTACT_ENROLLMENT_DRAFT_QA_MARKER,
  type ApolloPrimaryContactEnrollmentDraftSnapshot,
} from "../lib/growth/apollo/apollo-primary-contact-enrollment-draft-types"
import {
  buildApolloEnrollmentSourceAttributionChain,
  buildApolloPrimaryContactEnrollmentDraftSnapshot,
  evaluateApolloEnrollmentDraftGates,
  mapApolloEnrollmentDraftQueueRow,
  mergeApolloEnrollmentPanelRows,
  shouldShowApolloEnrollmentCreateDraftAction,
  shouldShowApolloEnrollmentDraftWorkflowLink,
} from "../lib/growth/apollo/apollo-primary-contact-enrollment-draft-evidence"
import { mapApolloEnrollmentDraftStagingRow } from "../lib/growth/apollo/apollo-primary-contact-enrollment-draft-staging-evidence"
import { mapEnrollmentQueueDbRow } from "../lib/growth/apollo/apollo-primary-contact-enrollment-bridge-evidence"
import { buildEnrollmentBridgeContactSnapshot } from "../lib/growth/apollo/apollo-primary-contact-enrollment-bridge-evidence"
import type { ApolloPrimaryContactOperatorReviewRow } from "../lib/growth/apollo/apollo-primary-contact-operator-review-types"

const ROUTE_ROOT = "app/api/platform/growth/apollo-primary-contact-acquisition/enrollment-draft"
const DRAFT_ROUTE_PATH = `${ROUTE_ROOT}/route.ts`
const DRAFT_ACTIONS_ROUTE_PATH = `${ROUTE_ROOT}/actions/route.ts`
const PANEL_PATH = "components/growth/apollo-primary-contact-enrollment-approval-queue-panel.tsx"
const SERVER_PATH = "lib/growth/apollo/apollo-primary-contact-enrollment-draft-bridge.ts"
const BRIDGE_SERVER_PATH = "lib/growth/apollo/apollo-primary-contact-enrollment-bridge.ts"
const MIGRATION_PATH =
  "supabase/migrations/20270812120000_growth_engine_apollo_primary_contact_enrollment_drafts.sql"
const EXECUTION_PAGE_PATH = "app/(admin)/admin/growth/sequences/execution/page.tsx"

const STAGING_EVIDENCE_PATH = "lib/growth/apollo/apollo-primary-contact-enrollment-draft-staging-evidence.ts"

const REQUIRED_FILES = [
  "lib/growth/apollo/apollo-primary-contact-enrollment-draft-types.ts",
  "lib/growth/apollo/apollo-primary-contact-enrollment-draft-evidence.ts",
  STAGING_EVIDENCE_PATH,
  SERVER_PATH,
  DRAFT_ROUTE_PATH,
  DRAFT_ACTIONS_ROUTE_PATH,
  PANEL_PATH,
  MIGRATION_PATH,
]

const FORBIDDEN_SIDE_EFFECT_IMPORTS = [
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

const draftRoute = fs.readFileSync(path.join(process.cwd(), DRAFT_ROUTE_PATH), "utf8")
const draftActionsRoute = fs.readFileSync(path.join(process.cwd(), DRAFT_ACTIONS_ROUTE_PATH), "utf8")
const serverSource = fs.readFileSync(path.join(process.cwd(), SERVER_PATH), "utf8")
const bridgeServerSource = fs.readFileSync(path.join(process.cwd(), BRIDGE_SERVER_PATH), "utf8")
const panelSource = fs.readFileSync(path.join(process.cwd(), PANEL_PATH), "utf8")
const migrationSource = fs.readFileSync(path.join(process.cwd(), MIGRATION_PATH), "utf8")
const executionPageSource = fs.readFileSync(path.join(process.cwd(), EXECUTION_PAGE_PATH), "utf8")

assertRouteExportsHttpMethod(draftRoute, "GET")
assertRouteExportsHttpMethod(draftActionsRoute, "POST")
assert.doesNotMatch(draftRoute, /export\s+async\s+function\s+POST\b/)
assert.doesNotMatch(draftActionsRoute, /export\s+async\s+function\s+GET\b/)
console.log("  ✓ route exports — GET enrollment draft snapshot, POST draft actions")

assert.match(draftRoute, /requireGrowthEnginePlatformAccess/)
assert.match(draftActionsRoute, /requireGrowthEnginePlatformAccess/)
assert.match(draftActionsRoute, /logGrowthEngine/)
assert.match(draftActionsRoute, /auto_enrollment:\s*false/)
assert.match(draftActionsRoute, /outreach_sent:\s*false/)
assert.match(draftActionsRoute, /enrolled_count:\s*0/)
console.log("  ✓ routes — platform admin + structured logging with safety flags")

assert.match(serverSource, /loadStagingCompanyCandidateRow/)
assert.match(serverSource, /mapApolloEnrollmentDraftStagingRow/)
assert.match(serverSource, /staging_evidence/)
assert.doesNotMatch(serverSource, /async function loadCompanyCandidate/)
console.log("  ✓ draft bridge — dual-key staging company candidate resolution")

const HENRY_SCHEIN_LOOKUP_KEY = "d2e669d5-e912-4fb7-992a-b4f9a92ff56a"
const HENRY_SCHEIN_STAGING_ROW_ID = "45863143-b63f-4880-8980-cbae40cb84e1"
const HENRY_SCHEIN_QUEUE_ITEM_ID = "7f5a5d69-4df0-4501-959a-5e74a1b0471e"
const HENRY_SCHEIN_CANONICAL_COMPANY_ID = "dd2b44c6-8383-4737-951a-6054200f45b5"

const henryScheinStaging = mapApolloEnrollmentDraftStagingRow({
  lookup_key: HENRY_SCHEIN_LOOKUP_KEY,
  source_table: "discovery_candidates",
  staging_row_id: HENRY_SCHEIN_STAGING_ROW_ID,
  row: {
    id: HENRY_SCHEIN_STAGING_ROW_ID,
    company_id: HENRY_SCHEIN_LOOKUP_KEY,
    company_name: "Henry Schein",
    domain: "henryschein.com",
    website: "https://www.henryschein.com",
    canonical_company_id: HENRY_SCHEIN_CANONICAL_COMPANY_ID,
  },
  queue_item_id: HENRY_SCHEIN_QUEUE_ITEM_ID,
  canonical_company_id: HENRY_SCHEIN_CANONICAL_COMPANY_ID,
})

assert.equal(henryScheinStaging.staging_evidence.lookup_key, HENRY_SCHEIN_LOOKUP_KEY)
assert.equal(henryScheinStaging.staging_evidence.staging_row_id, HENRY_SCHEIN_STAGING_ROW_ID)
assert.notEqual(
  henryScheinStaging.staging_evidence.lookup_key,
  henryScheinStaging.staging_evidence.staging_row_id,
)
assert.equal(henryScheinStaging.staging_evidence.staging_table_detected, "discovery_candidates")
assert.equal(henryScheinStaging.staging_evidence.queue_item_id, HENRY_SCHEIN_QUEUE_ITEM_ID)
assert.equal(henryScheinStaging.staging_evidence.canonical_company_id, HENRY_SCHEIN_CANONICAL_COMPANY_ID)
assert.equal(henryScheinStaging.company.company_name, "Henry Schein")
console.log("  ✓ staging evidence — discovery_candidates company_id lookup key resolves to staging row id")

assert.match(
  fs.readFileSync(path.join(process.cwd(), "lib/growth/canonical-companies/canonical-company-staging-linkage.ts"), "utf8"),
  /loadDiscoveryCandidateStagingRow/,
)
assert.match(
  fs.readFileSync(path.join(process.cwd(), "lib/growth/canonical-companies/canonical-company-staging-linkage.ts"), "utf8"),
  /\.eq\("company_id", lookupKey\)/,
)
console.log("  ✓ staging loader — discovery_candidates id OR company_id dual-key lookup")

assert.match(serverSource, /createGrowthSequenceEnrollmentDraft/)
assert.match(serverSource, /runSequenceEnrollmentPreflight/)
assert.doesNotMatch(serverSource, /confirmGrowthSequenceEnrollment/)
console.log("  ✓ draft bridge — creates draft via orchestrator, does not confirm")

for (const forbidden of FORBIDDEN_SIDE_EFFECT_IMPORTS) {
  assert.doesNotMatch(serverSource, new RegExp(forbidden, "i"), `Draft bridge must not import ${forbidden}`)
  assert.doesNotMatch(draftActionsRoute, new RegExp(forbidden, "i"), `Draft actions route must not import ${forbidden}`)
}
console.log("  ✓ no confirm/outreach side-effect imports in draft bridge or actions route")

assert.doesNotMatch(bridgeServerSource, /createGrowthSequenceEnrollmentDraft/)
assert.doesNotMatch(bridgeServerSource, /confirmGrowthSequenceEnrollment/)
console.log("  ✓ Primary-3 bridge remains isolated from draft orchestrator")

assert.match(serverSource, /auto_enrollment_attempted:\s*false/)
assert.match(serverSource, /outreach_sent:\s*false/)
assert.match(serverSource, /enrolled_count:\s*0/)
assert.match(serverSource, /outreach_count:\s*0/)
console.log("  ✓ draft bridge hard-codes no auto-enrollment/outreach counters")

assert.match(migrationSource, /apollo_primary_contact_enrollment_drafts/)
assert.match(migrationSource, /auto_enrollment_attempted boolean not null default false/)
assert.match(migrationSource, /outreach_sent boolean not null default false/)
console.log("  ✓ migration — draft audit table with safety defaults")

assert.match(executionPageSource, /ApolloPrimaryContactEnrollmentApprovalQueuePanel/)
console.log("  ✓ sequence execution page — enrollment approval queue panel")

assert.match(panelSource, /APOLLO_PRIMARY_CONTACT_ENROLLMENT_DRAFT_QA_MARKER/)
assert.match(panelSource, /enrollment-approval-queue/)
assert.match(panelSource, /enrollment-draft/)
assert.match(panelSource, /shouldShowApolloEnrollmentCreateDraftAction/)
assert.match(panelSource, /View draft in enrollment workflow/)
assert.match(panelSource, /Apollo → Operator Approved → Enrollment Queue → Draft/)
assert.match(panelSource, /no auto-enrollment/i)
console.log("  ✓ UI panel — draft creation, attribution chain, and enrollment workflow link")

assert.equal(
  APOLLO_PRIMARY_CONTACT_ENROLLMENT_DRAFT_QA_MARKER,
  "apollo-primary-contact-enrollment-draft-v4",
)
console.log("  ✓ Apollo-Primary-4 QA marker")

const attribution = buildApolloEnrollmentSourceAttributionChain()
assert.deepEqual(attribution, ["Apollo", "Operator Approved", "Enrollment Queue", "Draft"])
console.log("  ✓ source attribution — Apollo → Operator Approved → Enrollment Queue → Draft")

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

const contactSnapshot = buildEnrollmentBridgeContactSnapshot(approvedContact)
const queueRow = mapEnrollmentQueueDbRow({
  id: "queue-1",
  company_candidate_id: "company-1",
  company_contact_id: "contact-1",
  contact_candidate_id: null,
  operator_review_id: "review-1",
  status: "enrollment_approved",
  contact_snapshot: contactSnapshot,
  sequence_ready_at_handoff: true,
  blockers_at_handoff: [],
  created_at: "2026-06-09T00:00:00.000Z",
  enrollment_approved_at: "2026-06-09T01:00:00.000Z",
  enrollment_approved_email: "operator@example.com",
})

const draftableRow = mapApolloEnrollmentDraftQueueRow({ queue_row: queueRow, metadata: {} })
assert.equal(draftableRow.draftable, true)
assert.equal(draftableRow.enrollment_draft_id, null)
assert.deepEqual(draftableRow.source_attribution, attribution)

const draftGate = evaluateApolloEnrollmentDraftGates({ queue_row: queueRow })
assert.equal(draftGate.allowed, true)

const pendingQueueRow = { ...queueRow, status: "pending_enrollment_approval" as const }
const pendingGate = evaluateApolloEnrollmentDraftGates({ queue_row: pendingQueueRow })
assert.equal(pendingGate.allowed, false)
assert.equal(pendingGate.code, "enrollment_not_approved")

const existingDraftRow = mapApolloEnrollmentDraftQueueRow({
  queue_row: queueRow,
  metadata: {
    apollo_enrollment_draft: {
      growth_lead_id: "lead-1",
      enrollment_draft_id: "enrollment-1",
      created_at: "2026-06-09T02:00:00.000Z",
    },
  },
})
assert.equal(existingDraftRow.draftable, false)
assert.equal(existingDraftRow.enrollment_draft_id, "enrollment-1")

const blockedRow = mapApolloEnrollmentDraftQueueRow({
  queue_row: { ...queueRow, contactable: false },
  metadata: {},
})
assert.equal(blockedRow.draftable, false)

const draftSnapshot = buildApolloPrimaryContactEnrollmentDraftSnapshot({
  items: [draftableRow, existingDraftRow, blockedRow],
}) satisfies ApolloPrimaryContactEnrollmentDraftSnapshot

assert.equal(draftSnapshot.qa_marker, APOLLO_PRIMARY_CONTACT_ENROLLMENT_DRAFT_QA_MARKER)
assert.equal(draftSnapshot.evidence.queued_contacts, 3)
assert.equal(draftSnapshot.evidence.draftable_contacts, 1)
assert.equal(draftSnapshot.evidence.drafts_created, 1)
assert.equal(draftSnapshot.evidence.blocked_contacts, 1)
assert.equal(draftSnapshot.auto_enrollment, false)
assert.equal(draftSnapshot.outreach_sent, false)
console.log("  ✓ draft snapshot — evidence fields and safety flags")

const mergedApprovedDraftable = mergeApolloEnrollmentPanelRows({
  queue_items: [queueRow],
  draft_items: [draftableRow],
})
assert.equal(mergedApprovedDraftable.length, 1)
assert.equal(
  shouldShowApolloEnrollmentCreateDraftAction({
    row: mergedApprovedDraftable[0]!,
    draft_snapshot: draftSnapshot,
  }),
  true,
)
assert.match(
  fs.readFileSync(path.join(process.cwd(), PANEL_PATH), "utf8"),
  /shouldShowApolloEnrollmentCreateDraftAction/,
)
console.log("  ✓ approved + draftable queue item renders create draft action")

const manifestPath = path.join(process.cwd(), ".next/app-path-routes-manifest.json")
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Record<string, string>
  const draftKey = "/api/platform/growth/apollo-primary-contact-acquisition/enrollment-draft/route"
  const actionsKey =
    "/api/platform/growth/apollo-primary-contact-acquisition/enrollment-draft/actions/route"
  if (
    Object.prototype.hasOwnProperty.call(manifest, draftKey) &&
    Object.prototype.hasOwnProperty.call(manifest, actionsKey)
  ) {
    console.log("  ✓ build manifest — enrollment-draft routes registered")
  } else {
    console.log(
      "  · build manifest — enrollment-draft routes not yet registered (run pnpm build to refresh)",
    )
  }
} else {
  console.log("  · build manifest — skipped (.next/app-path-routes-manifest.json not found; run pnpm build)")
}

console.log("\nApollo-Primary-4 enrollment draft creation certification passed.")
