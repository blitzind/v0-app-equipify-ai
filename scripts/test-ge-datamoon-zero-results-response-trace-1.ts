/**
 * GE-DATAMOON-ZERO-RESULTS-RESPONSE-TRACE-1 — Zero-preview Ava launch debug response certification.
 * Run: pnpm test:ge-datamoon-zero-results-response-trace-1
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_DATAMOON_ZERO_RESULTS_RESPONSE_TRACE_1_QA_MARKER,
  GROWTH_HOME_FIND_LEADS_ZERO_PREVIEW_DEBUG_TITLE,
  buildGrowthMissionAvaLaunchZeroPreviewDebug,
  growthMissionAvaLaunchZeroPreviewDebugContainsPii,
} from "../lib/growth/mission-center/growth-mission-ava-launch-zero-preview-debug"
import {
  buildAvaLaunchRunResultSemantics,
  buildAvaLaunchRunSuccessMessage,
} from "../lib/growth/mission-center/growth-mission-ava-launch-run-result-semantics"

const PHASE = "GE-DATAMOON-ZERO-RESULTS-RESPONSE-TRACE-1" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log(`[${PHASE}] Zero-preview Ava launch debug response certification`)

  assert.equal(GROWTH_DATAMOON_ZERO_RESULTS_RESPONSE_TRACE_1_QA_MARKER, "ge-datamoon-zero-results-response-trace-1-v1")
  assert.equal(GROWTH_HOME_FIND_LEADS_ZERO_PREVIEW_DEBUG_TITLE, "Debug run details")

  const service = readSource("lib/growth/mission-center/growth-mission-ava-launch-run-service.ts")
  const contract = readSource("lib/growth/mission-center/growth-mission-ava-launch-run-api-contract.ts")
  const workbench = readSource(
    "components/growth/workspace/executive-briefing/growth-home-datamoon-sourcing-workbench-section.tsx",
  )

  assert.match(service, /buildGrowthMissionAvaLaunchZeroPreviewDebug/)
  assert.match(service, /previewCount === 0/)
  assert.match(service, /zeroPreviewDebug/)
  assert.match(contract, /zeroPreviewDebug\?: GrowthMissionAvaLaunchZeroPreviewDebug/)
  assert.match(workbench, /GROWTH_HOME_FIND_LEADS_ZERO_PREVIEW_DEBUG_TITLE/)
  assert.match(workbench, /result\.zeroPreviewDebug/)
  assert.match(workbench, /result\.importedLeadCount === 0/)

  const zeroPreviewDebug = buildGrowthMissionAvaLaunchZeroPreviewDebug({
    run: {
      id: "run-zero",
      runName: "Zero preview",
      datamoonAudienceId: "4538",
      providerMode: "module",
      audienceType: "advanced_search",
      filters: [{ field: "personal_state", operator: "equals", value: "fl" }],
      topicIds: ["topic-1"],
      requestedLimit: 25,
      audienceName: "Florida search",
      websiteId: null,
      status: "completed",
      recordCount: 3,
      loadingCount: 0,
      previewCount: 0,
      importedCount: 0,
      duplicateCount: 0,
      skippedCount: 3,
      errorCount: 0,
      providerMetadata: {
        poll_status: "completed",
        fetch_response_keys: ["data.status", "data.records"],
      },
      errorMessage: null,
      dryRun: false,
      createdBy: "user-1",
      lastPolledAt: "2026-07-08T00:00:00.000Z",
      completedAt: "2026-07-08T00:00:00.000Z",
      importedAt: null,
      createdAt: "2026-07-08T00:00:00.000Z",
      updatedAt: "2026-07-08T00:00:00.000Z",
    },
    records: [
      {
        id: "rec-1",
        runId: "run-zero",
        recordIndex: 0,
        status: "skipped",
        normalized: {
          first_name: "Hidden",
          last_name: "Lead",
          contact_name: "Hidden Lead",
          business_email: "hidden@example.com",
          personal_emails: null,
          email: "hidden@example.com",
          personal_phone: "5550001111",
          phone: "5550001111",
          linkedin_url: null,
          address_line1: null,
          address_line2: null,
          city: null,
          state: null,
          postal_code: null,
          country: null,
          company_name: null,
          company_domain: null,
          source: "datamoon",
          source_confidence: "provider",
        },
        dedupeRule: null,
        dedupeKey: null,
        matchedLeadId: null,
        leadId: null,
        message: "Missing importable identity (email, phone, LinkedIn, or name).",
        createdAt: "2026-07-08T00:00:00.000Z",
        updatedAt: "2026-07-08T00:00:00.000Z",
      },
    ],
    importRequest: {
      run_name: "Zero preview",
      audience_type: "advanced_search",
      filters: [{ field: "personal_state", operator: "equals", value: "fl" }],
      topic_ids: ["topic-1"],
      workbench_context: {
        omittedWorkbenchFilterFields: ["lookback_days", "intent_level"],
      },
    },
  })

  assert.equal(zeroPreviewDebug.runId, "run-zero")
  assert.equal(zeroPreviewDebug.datamoonAudienceId, "4538")
  assert.equal(zeroPreviewDebug.provider_status, "completed")
  assert.equal(zeroPreviewDebug.run_status, "completed")
  assert.equal(zeroPreviewDebug.record_count, 3)
  assert.equal(zeroPreviewDebug.preview_count, 0)
  assert.equal(zeroPreviewDebug.skipped_count, 3)
  assert.deepEqual(zeroPreviewDebug.omittedWorkbenchFilterFields, ["lookback_days", "intent_level"])
  assert.equal(zeroPreviewDebug.childRecordStatusCounts.skipped, 1)
  assert.equal(zeroPreviewDebug.childRecordSamples.length, 1)
  assert.equal(zeroPreviewDebug.childRecordSamples[0]?.status, "skipped")
  assert.match(zeroPreviewDebug.childRecordSamples[0]?.message ?? "", /Missing importable identity/)
  assert.equal(growthMissionAvaLaunchZeroPreviewDebugContainsPii(zeroPreviewDebug), false)

  const successfulImportSemantics = buildAvaLaunchRunResultSemantics({
    importedLeadIds: ["lead-1"],
    researchLeads: [{ leadId: "lead-1", workflowStatus: "researching", researchPilotEnabled: true }],
    orgHumanApprovalPendingTotal: 0,
    runCreatedApprovalCount: 0,
  })
  assert.equal(successfulImportSemantics.importedLeadCount, 1)
  assert.equal(successfulImportSemantics.stoppedAt, "research_pending")
  assert.match(buildAvaLaunchRunSuccessMessage(successfulImportSemantics), /Imported 1 lead/)

  console.log(`[${PHASE}] ✓ zero-preview debug payload certified without PII`)
}

main()
