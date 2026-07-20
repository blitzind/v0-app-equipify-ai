/**
 * GE-AIOS-LIVE-4B — Mission-to-portfolio autonomous discovery continuity (local).
 *
 * Run:
 *   pnpm test:ge-aios-live-4b-autonomous-discovery-continuity
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  diffMissionVsPortfolioDatamoonRunMetadata,
  GROWTH_MISSION_DATAMOON_CANONICAL_DISCOVERY_HANDOFF_LIVE_4B_QA_MARKER,
  isDatamoonRunEligibleForCanonicalDiscoveryPoller,
  missionDatamoonRunUsesCanonicalDiscoveryPrefix,
} from "@/lib/growth/mission-center/growth-mission-datamoon-canonical-discovery-handoff-live-4b"
import { GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-types-1a"
import type { DatamoonAudienceImportRun } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-types"

const PHASE = "GE-AIOS-LIVE-4B" as const
const ORG = "00757488-1026-44a5-aac4-269533ac21be"

function runFixture(input: Partial<DatamoonAudienceImportRun>): DatamoonAudienceImportRun {
  return {
    id: input.id ?? "run-fixture",
    runName: input.runName ?? "ge-aios-autonomous-prospect-search:2026-07-20",
    datamoonAudienceId: null,
    providerMode: "module",
    audienceType: "b2b",
    filters: [],
    topicIds: [],
    requestedLimit: 25,
    audienceName: "Equipify supported service verticals audience",
    websiteId: null,
    status: input.status ?? "building",
    recordCount: 0,
    loadingCount: 0,
    previewCount: 0,
    importedCount: 0,
    duplicateCount: 0,
    skippedCount: 0,
    errorCount: 0,
    providerMetadata: input.providerMetadata ?? {},
    errorMessage: null,
    dryRun: false,
    createdBy: null,
    lastPolledAt: input.lastPolledAt ?? null,
    completedAt: null,
    importedAt: null,
    createdAt: "2026-07-20T19:00:25.311068+00:00",
    updatedAt: "2026-07-20T19:00:26.253+00:00",
  }
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Mission-to-portfolio autonomous discovery continuity`)

  assert.equal(
    GROWTH_MISSION_DATAMOON_CANONICAL_DISCOVERY_HANDOFF_LIVE_4B_QA_MARKER,
    "ge-aios-live-4b-mission-datamoon-canonical-discovery-handoff-v1",
  )

  const missionCreatedMetadata = {
    qa_marker: "growth-datamoon-audience-import-ge-datamoon-1b-v1",
    poll_status: "in_progress",
    build_status: "success",
  }

  const portfolioCreatedMetadata = {
    qa_marker: "growth-datamoon-audience-import-ge-datamoon-1b-v1",
    autonomous_prospect_search_1a: {
      qa_marker: GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER,
      organization_id: ORG,
      business_profile_fingerprint: "844cbd8e",
      batch_size: 25,
      purpose: "prospect_search_intake",
      read_only_proof: false,
      authority: "autonomous_portfolio",
    },
  }

  const diff = diffMissionVsPortfolioDatamoonRunMetadata({
    missionRunProviderMetadata: missionCreatedMetadata,
    portfolioRunProviderMetadata: portfolioCreatedMetadata,
  })

  assert.deepEqual(diff.missionMissingCanonicalFields, [
    "qa_marker",
    "organization_id",
    "business_profile_fingerprint",
    "batch_size",
    "purpose",
    "authority",
  ])
  assert.equal(diff.missionEligibleForPortfolioPoller, false)
  assert.equal(diff.portfolioHasCanonicalFields.length, 6)

  const enrolledRun = runFixture({
    providerMetadata: portfolioCreatedMetadata,
  })
  assert.equal(isDatamoonRunEligibleForCanonicalDiscoveryPoller(enrolledRun, ORG), true)
  assert.equal(isDatamoonRunEligibleForCanonicalDiscoveryPoller(enrolledRun, "other-org"), false)

  const orphanedRun = runFixture({ providerMetadata: missionCreatedMetadata })
  assert.equal(isDatamoonRunEligibleForCanonicalDiscoveryPoller(orphanedRun, ORG), false)
  assert.equal(
    missionDatamoonRunUsesCanonicalDiscoveryPrefix("ge-aios-autonomous-prospect-search:2026-07-20"),
    true,
  )

  const orchestratorSource = readFileSync(
    resolve("lib/growth/mission-center/growth-mission-runtime-orchestrator.ts"),
    "utf8",
  )
  assert.equal(orchestratorSource.includes("pollDatamoonAudienceImportRun"), false)
  assert.equal(orchestratorSource.includes("startDatamoonAudienceImportRun"), false)
  assert.equal(orchestratorSource.includes("importDatamoonAudiencePreviewRecords"), false)
  assert.equal(
    orchestratorSource.includes("growth-mission-datamoon-canonical-discovery-handoff-live-4b"),
    true,
  )
  assert.equal(orchestratorSource.includes("handoffMissionDatamoonDiscoveryCreationToCanonicalRuntime"), true)
  assert.equal(orchestratorSource.includes("enrollMissionBoundDatamoonRunInCanonicalDiscovery"), true)
  assert.equal(orchestratorSource.includes("syncMissionRuntimeFromCanonicalDiscovery"), true)

  const handoffSource = readFileSync(
    resolve("lib/growth/mission-center/growth-mission-datamoon-canonical-discovery-handoff-live-4b.ts"),
    "utf8",
  )
  assert.equal(handoffSource.includes("pollDatamoonAudienceImportRun"), false)
  assert.equal(handoffSource.includes("runProspectSearchDatamoonAutonomousDiscovery"), true)
  assert.equal(handoffSource.includes("autonomous_portfolio"), true)

  console.log(`[${PHASE}] PASS — canonical handoff wired; mission poll loop removed`)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
