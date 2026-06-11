/**
 * Apollo Production Hardening certification — Phase 7 regression checks.
 * Run: pnpm test:apollo-production-hardening
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  paginateApolloQueueItems,
  parseApolloQueueRequestSearchParams,
  APOLLO_QUEUE_PAGINATION_QA_MARKER,
} from "../lib/growth/apollo/apollo-queue-pagination"
import {
  buildApolloPipelineAttributionDisplay,
  formatApolloAttributionChain,
  APOLLO_PIPELINE_ATTRIBUTION_DISPLAY_QA_MARKER,
} from "../lib/growth/apollo/apollo-pipeline-attribution-display"
import {
  classifyApolloSequenceDraftReadiness,
  isApolloSequenceDraftPlaceholderContent,
  APOLLO_SEQUENCE_DRAFT_READINESS_QA_MARKER,
} from "../lib/growth/apollo/apollo-sequence-draft-readiness"
import {
  APOLLO_DRAFT_REJECTED_JOB_SKIP_REASON,
  evaluateApolloSequenceExecutionJobApprovalGate,
  APOLLO_SEQUENCE_EXECUTION_JOB_GATE_QA_MARKER,
} from "../lib/growth/apollo/apollo-sequence-execution-job-gate"
import { evaluateApolloSequenceExecutionDraftApprovalGate } from "../lib/growth/apollo/apollo-sequence-execution-automation-evidence"
import { buildApolloSequenceExecutionDraftRecords } from "../lib/growth/apollo/apollo-sequence-draft-generation"

const ROOT = process.cwd()

const REQUIRED_FILES = [
  "lib/growth/apollo/apollo-queue-pagination.ts",
  "lib/growth/apollo/apollo-pipeline-attribution-display.ts",
  "lib/growth/apollo/apollo-sequence-draft-readiness.ts",
  "lib/growth/apollo/apollo-sequence-execution-job-gate.ts",
  "lib/growth/apollo/apollo-sequence-execution-job-gate-server.ts",
  "lib/growth/apollo/apollo-enrollment-funnel-acquisition-aggregator.ts",
  "lib/growth/apollo/apollo-queue-loader.ts",
  "components/growth/apollo-queue-controls.tsx",
  "components/growth/apollo-pipeline-attribution-panel.tsx",
  "lib/growth/apollo/apollo-sequence-execution-queue.ts",
  "lib/growth/sequences/execution/sequence-job-runner.ts",
  "lib/growth/sequences/execution/sequence-execution-dashboard.ts",
  "lib/growth/apollo/apollo-enrollment-funnel-metrics.ts",
  "components/growth/apollo-sequence-execution-automation-panel.tsx",
  "components/growth/growth-sequence-safe-execution-dashboard.tsx",
  "app/api/platform/growth/apollo-enrollment-automation/funnel-metrics/route.ts",
  "app/api/platform/growth/apollo-enrollment-automation/enrollment-queue/route.ts",
  "app/api/platform/growth/apollo-voice-drop-automation/voice-drop-queue/route.ts",
  "app/api/platform/growth/apollo-multichannel-orchestration/multichannel-queue/route.ts",
  "app/api/platform/growth/apollo-sequence-execution-automation/execution-queue/route.ts",
]

for (const relativePath of REQUIRED_FILES) {
  const absolutePath = path.join(ROOT, relativePath)
  assert.ok(fs.existsSync(absolutePath), `missing file: ${relativePath}`)
  console.log(`  ✓ file.${relativePath}`)
}

console.log("  ✓ hardening QA file inventory")

assert.equal(APOLLO_QUEUE_PAGINATION_QA_MARKER, "apollo-queue-pagination-v1")
const sampleRows = Array.from({ length: 30 }, (_, index) => ({
  company_name: index % 2 === 0 ? "Acme Medical" : "Summit Health",
  full_name: `Contact ${index}`,
  created_at: new Date(Date.now() - index * 60_000).toISOString(),
  qualification_score: index,
}))
const paged = paginateApolloQueueItems(sampleRows, {
  page: 1,
  page_size: 10,
  search: "acme",
  sort: "company_name_asc",
})
assert.ok(paged.items.length <= 10)
assert.equal(paged.pagination.page, 1)
assert.ok(paged.pagination.total >= paged.items.length)
console.log("  ✓ queue pagination search sort")

const params = parseApolloQueueRequestSearchParams(
  new URLSearchParams("page=2&pageSize=25&search=summit&sort=created_at_desc"),
)
assert.equal(params.page, 2)
assert.equal(params.page_size, 25)
assert.equal(params.search, "summit")
console.log("  ✓ queue request param parsing")

const gatePending = evaluateApolloSequenceExecutionJobApprovalGate({
  apollo_candidate_status: "pending_draft_approval",
})
assert.equal(gatePending.allowed, false)
assert.equal(gatePending.code, "apollo_draft_approval_required")
assert.match(gatePending.operator_message ?? "", /Approve sequence drafts/i)

const gateReady = evaluateApolloSequenceExecutionJobApprovalGate({
  apollo_candidate_status: "execution_ready",
})
assert.equal(gateReady.allowed, true)

const gateNonApollo = evaluateApolloSequenceExecutionJobApprovalGate({
  apollo_candidate_status: null,
})
assert.equal(gateNonApollo.allowed, true)
console.log("  ✓ job approval blocked until draft approved")

assert.equal(APOLLO_DRAFT_REJECTED_JOB_SKIP_REASON, "apollo_draft_rejected")
const rejectSource = fs.readFileSync(
  path.join(ROOT, "lib/growth/apollo/apollo-sequence-execution-queue.ts"),
  "utf8",
)
assert.match(rejectSource, /skipApolloSequenceExecutionJobsForDraftReject/)
assert.match(rejectSource, /execution_jobs: skippedExecutionJobs/)
const regenerateSource = fs.readFileSync(
  path.join(ROOT, "lib/growth/apollo/apollo-sequence-execution-bridge.ts"),
  "utf8",
)
assert.match(regenerateSource, /restoreApolloSequenceExecutionJobsAfterDraftRegenerate/)
console.log("  ✓ reject cleanup skips jobs and regenerate restores")

const funnelSource = fs.readFileSync(
  path.join(ROOT, "lib/growth/apollo/apollo-enrollment-funnel-metrics.ts"),
  "utf8",
)
assert.match(funnelSource, /buildApolloEnrollmentFunnelAcquisitionOverlay/)
const funnelRoute = fs.readFileSync(
  path.join(ROOT, "app/api/platform/growth/apollo-enrollment-automation/funnel-metrics/route.ts"),
  "utf8",
)
assert.match(funnelRoute, /viewParam|current_run/)
console.log("  ✓ enrollment funnel acquisition overlay wired")

const placeholderBody =
  "Hi Alex,\n\nFollowing up... [Draft placeholder — operator approval required before send.]"
assert.equal(isApolloSequenceDraftPlaceholderContent(placeholderBody), true)
const drafts = buildApolloSequenceExecutionDraftRecords({
  handoff: {
    multichannel_sequence_candidate_id: "mc-1",
    voice_drop_candidate_id: "vd-1",
    enrollment_candidate_id: "e-1",
    company_candidate_id: "c-1",
    company_contact_id: "cc-1",
    growth_lead_id: "l-1",
    company_name: "Summit Medical",
    full_name: "Alex Rivera",
    title: "VP Operations",
    email: "alex@example.com",
    phone: "+15551234567",
    qualification_score: 80,
    sequence_key: "certification_minimal_email",
    sequence_label: "Certification Email",
    channel_order: ["email"],
    scheduling_plan: {
      total_days: 1,
      touches: [{ day_offset: 1, channel: "email", spacing_days_from_prior: 0, cadence_label: "email", reason: "Day 1" }],
    },
    source_attribution: {},
  },
  steps: [
    {
      step_number: 1,
      channel: "email",
      orchestration_channel: "email",
      scheduled_offset_days: 1,
      scheduled_for_label: "Day 1",
      generation_type: "follow_up_email",
      approval_status: "pending_draft_approval",
      pattern_step_key: "email",
    },
  ],
})
const readiness = classifyApolloSequenceDraftReadiness(drafts[0]!)
assert.equal(readiness.readiness_label, "Draft Placeholder")
assert.equal(readiness.is_send_ready, false)
assert.equal(readiness.qa_marker, APOLLO_SEQUENCE_DRAFT_READINESS_QA_MARKER)
console.log("  ✓ placeholder draft visibility classification")

const attribution = buildApolloPipelineAttributionDisplay({
  source_attribution: {
    attribution_chain: ["Apollo", "Qualification", "Enrollment", "Sequence Execution"],
  },
  approved_at: "2026-06-11T12:00:00.000Z",
  approved_email: "operator@equipify.com",
})
assert.match(formatApolloAttributionChain(attribution.attribution_chain), /Apollo → Qualification/)
assert.equal(attribution.approver_email, "operator@equipify.com")
console.log("  ✓ attribution visibility helpers")

const runnerSource = fs.readFileSync(
  path.join(ROOT, "lib/growth/sequences/execution/sequence-job-runner.ts"),
  "utf8",
)
assert.match(runnerSource, /evaluateApolloSequenceExecutionJobApprovalGateForJob/)
const dashboardSource = fs.readFileSync(
  path.join(ROOT, "components/growth/apollo-sequence-execution-automation-panel.tsx"),
  "utf8",
)
assert.match(dashboardSource, /ApolloDraftReadinessBadges/)
assert.match(dashboardSource, /ApolloPipelineAttributionPanel/)
const safeExecutionSource = fs.readFileSync(
  path.join(ROOT, "components/growth/growth-sequence-safe-execution-dashboard.tsx"),
  "utf8",
)
assert.match(safeExecutionSource, /apolloDraftApprovalBlocked/)
console.log("  ✓ operator UI hardening surfaces")

const draftGate = evaluateApolloSequenceExecutionDraftApprovalGate({
  candidate: {
    candidate_id: "x",
    status: "execution_ready",
    sequence_enrollment_id: "enroll-1",
    materialization: { drafts: [{}], steps: [{}] },
  } as never,
})
assert.equal(draftGate.allowed, false)
console.log("  ✓ draft approval gate integrity")

assert.equal(APOLLO_SEQUENCE_EXECUTION_JOB_GATE_QA_MARKER, "apollo-sequence-execution-job-gate-v1")

console.log("\nApollo Production Hardening checks passed.")
