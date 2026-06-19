/**
 * Growth Engine SP-UX-2 — Share page operator workspace certification.
 *
 * Local: pnpm test:growth-share-page-workspace
 * Production: pnpm test:growth-share-page-workspace:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildGrowthSharePageOperatorSummaryCards,
  buildGrowthSharePageOperatorWorkspaceActions,
  emptyGrowthSharePageOperatorWorkspaceOperatorState,
  resolveGrowthSharePageOperatorDraftStatusLabel,
} from "../lib/growth/share-pages/growth-share-page-operator-summary-service"
import { buildGrowthSharePageOperatorTimeline } from "../lib/growth/share-pages/growth-share-page-timeline-service"
import {
  GROWTH_SHARE_PAGE_OPERATOR_WORKSPACE_CONFIRM,
  GROWTH_SHARE_PAGE_OPERATOR_WORKSPACE_METADATA_KEY,
  GROWTH_SHARE_PAGE_OPERATOR_WORKSPACE_QA_MARKER,
  growthSharePageOperatorWorkspaceSafetyPayload,
} from "../lib/growth/share-pages/growth-share-page-operator-workspace-types"
import { EMPTY_GROWTH_SHARE_PAGE_ENGAGEMENT_SUMMARY } from "../lib/growth/share-pages/share-page-types"

const REQUIRED_FILES = [
  "lib/growth/share-pages/growth-share-page-operator-workspace-types.ts",
  "lib/growth/share-pages/growth-share-page-operator-workspace-service.ts",
  "lib/growth/share-pages/growth-share-page-operator-actions-service.ts",
  "lib/growth/share-pages/growth-share-page-operator-summary-service.ts",
  "lib/growth/share-pages/growth-share-page-operator-analytics-service.ts",
  "lib/growth/share-pages/growth-share-page-preview-service.ts",
  "lib/growth/share-pages/growth-share-page-timeline-service.ts",
  "lib/growth/share-pages/share-page-workspace-api-utils.ts",
  "lib/growth/navigation/growth-share-pages-workspace-navigation.ts",
  "app/api/growth/share-pages/workspace/route.ts",
  "app/api/growth/share-pages/workspace/[id]/route.ts",
  "app/api/growth/share-pages/workspace/[id]/approve/route.ts",
  "app/api/growth/share-pages/workspace/[id]/publish/route.ts",
  "app/api/growth/share-pages/workspace/[id]/duplicate/route.ts",
  "app/api/growth/share-pages/workspace/[id]/archive/route.ts",
  "app/api/growth/share-pages/workspace/[id]/rebuild/route.ts",
  "components/growth/share-pages/growth-share-page-operator-workspace.tsx",
  "components/growth/share-pages/growth-share-page-operator-sidebar.tsx",
  "components/growth/share-pages/growth-share-page-review-panel.tsx",
  "components/growth/share-pages/growth-share-page-preview-panel.tsx",
  "components/growth/share-pages/growth-share-page-analytics-panel.tsx",
  "components/growth/share-pages/growth-share-page-summary-cards.tsx",
  "components/growth/share-pages/growth-share-page-timeline-panel.tsx",
  "components/growth/share-pages/growth-share-pages-workspace-tabs.tsx",
  "app/(growth)/growth/share-pages/workspace/page.tsx",
  "app/(admin)/admin/growth/share-pages/workspace/page.tsx",
] as const

const UNTOUCHED_EXECUTION = [
  "lib/growth/sequences/execution/sequence-job-runner.ts",
  "lib/growth/sequences/execution/queue-sequence-step-transport-job.ts",
] as const

function samplePage() {
  return {
    id: "00000000-0000-4000-8000-000000000101",
    organizationId: "00000000-0000-4000-8000-000000000002",
    leadId: "00000000-0000-4000-8000-000000000001",
    companyId: null,
    campaignId: null,
    enrollmentId: null,
    sequenceStepId: null,
    sequenceEnrollmentStepId: null,
    sequenceExecutionJobId: null,
    sourceChannel: "manual" as const,
    status: "pending_review" as const,
    tokenPrefix: "sp_test",
    publishedAt: null,
    expiresAt: null,
    revokedAt: null,
    archivedAt: null,
    firstViewedAt: null,
    lastViewedAt: null,
    maxViews: null,
    engagementSummary: { ...EMPTY_GROWTH_SHARE_PAGE_ENGAGEMENT_SUMMARY, viewCount: 3, ctaClickCount: 1 },
    personalizationSnapshot: {
      prospectName: "Alex Rivera",
      companyName: "Summit Diagnostics",
      headline: "A note for Alex",
      personalizedMessage: "Hi Alex",
      whyReachingOut: "Manual follow-up",
      companyObservations: ["Growing team"],
      researchSummary: "Healthcare expansion",
      accountPlaybookSummary: null,
      suggestedCta: null,
      nextBestMessage: null,
      bookingLink: null,
      resources: [],
      sourcesUsed: ["growth.leads"],
      evidenceCoverageScore: 72,
      researchConfidence: null,
      generatedAt: new Date().toISOString(),
    },
    personalizationContextVersion: 1,
    sourcesUsed: ["growth.leads"],
    evidenceCoverageScore: 72,
    theme: {
      brandColor: "#059669",
      accentColor: "#047857",
      logoUrl: null,
      heroImageUrl: null,
      publicThemeMode: "system" as const,
      footerNote: null,
    },
    headline: "A note for Alex",
    subheadline: null,
    heroMessage: "Hi Alex",
    whyReachingOut: "Manual follow-up",
    companyObservations: ["Growing team"],
    ctaConfig: [],
    resources: [],
    bookingPageId: null,
    heroMediaType: "none" as const,
    heroMediaUrl: null,
    heroMediaThumbnailUrl: null,
    voiceAssetId: null,
    videoAssetId: null,
    sharePageTemplateId: null,
    sharePageTemplateVersionId: null,
    templateBlocksSnapshot: null,
    createdBy: null,
    approvedBy: null,
    approvedAt: null,
    requiresHumanReview: true as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function runStaticChecks() {
  for (const relativePath of REQUIRED_FILES) {
    const absolutePath = path.join(process.cwd(), relativePath)
    assert.ok(fs.existsSync(absolutePath), `Missing required file: ${relativePath}`)
  }

  for (const relativePath of UNTOUCHED_EXECUTION) {
    const absolutePath = path.join(process.cwd(), relativePath)
    const source = fs.readFileSync(absolutePath, "utf8")
    assert.ok(!source.includes("growth_share_page_operator_spux2"), `${relativePath} must remain untouched`)
  }

  const workspaceUi = fs.readFileSync(
    path.join(process.cwd(), "components/growth/share-pages/growth-share-page-operator-workspace.tsx"),
    "utf8",
  )
  assert.ok(workspaceUi.includes("/api/growth/share-pages/workspace"), "Workspace UI must call SP-UX-2 APIs")
  assert.ok(!workspaceUi.includes("sequence"), "Workspace UI must not trigger sequence execution")

  const actionsService = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/share-pages/growth-share-page-operator-actions-service.ts"),
    "utf8",
  )
  assert.ok(!actionsService.includes("dispatchSequence"), "Actions service must not dispatch sequences")
  assert.ok(!actionsService.includes("runEnrollment"), "Actions service must not run enrollments")

  const navSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/navigation/growth-share-pages-workspace-navigation.ts"),
    "utf8",
  )
  assert.ok(navSource.includes("workspace"), "Share pages nav must include Workspace tab")

  const safety = growthSharePageOperatorWorkspaceSafetyPayload()
  assert.equal(safety.qa_marker, GROWTH_SHARE_PAGE_OPERATOR_WORKSPACE_QA_MARKER)
  assert.equal(safety.autonomous_execution_enabled, false)
  assert.equal(safety.outreach_execution, false)
  assert.equal(safety.enrollment_execution, false)
}

function runUnitChecks() {
  const page = samplePage()
  const operatorState = emptyGrowthSharePageOperatorWorkspaceOperatorState()

  assert.equal(
    resolveGrowthSharePageOperatorDraftStatusLabel({ page, operatorState }),
    "Pending Review",
  )

  const approvedState = {
    ...operatorState,
    draftApprovedAt: new Date().toISOString(),
  }
  assert.equal(
    resolveGrowthSharePageOperatorDraftStatusLabel({ page, operatorState: approvedState }),
    "Approved",
  )

  const summary = buildGrowthSharePageOperatorSummaryCards({
    page,
    lead: null,
    analytics: null,
    templateName: "Executive intro",
    operatorState: approvedState,
  })
  assert.equal(summary.draftStatus, "Approved")
  assert.equal(summary.personalizationScore, 72)
  assert.equal(summary.templateName, "Executive intro")

  const actions = buildGrowthSharePageOperatorWorkspaceActions({
    page,
    operatorState: approvedState,
    hasPublicUrl: false,
  })
  assert.equal(actions.approveDraft, "completed")
  assert.equal(actions.publish, "idle")
  assert.equal(actions.rebuildPersonalization, "idle")

  const timeline = buildGrowthSharePageOperatorTimeline({
    page,
    operatorState: approvedState,
    recentEvents: [
      {
        id: "evt-1",
        sharePageId: page.id,
        sharePageViewId: null,
        leadId: page.leadId,
        eventType: "SHARE_PAGE_VIEWED",
        eventLabel: "Viewed",
        metadata: {},
        occurredAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
    ],
  })
  assert.ok(timeline.some((entry) => entry.kind === "page_created"))
  assert.ok(timeline.some((entry) => entry.kind === "approved"))
  assert.ok(timeline.some((entry) => entry.kind === "viewed"))
}

async function main() {
  const production = process.argv.includes("--production")
  console.log(`Growth Share Page Operator Workspace certification (${production ? "production env" : "local"})`)
  console.log(`QA marker: ${GROWTH_SHARE_PAGE_OPERATOR_WORKSPACE_QA_MARKER}`)
  console.log(`Metadata key: ${GROWTH_SHARE_PAGE_OPERATOR_WORKSPACE_METADATA_KEY}`)
  console.log(`Confirm token: ${GROWTH_SHARE_PAGE_OPERATOR_WORKSPACE_CONFIRM}`)

  runStaticChecks()
  runUnitChecks()

  console.log("PASS — growth share page operator workspace certification")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
