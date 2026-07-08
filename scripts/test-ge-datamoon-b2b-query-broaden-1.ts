/**
 * GE-DATAMOON-B2B-QUERY-BROADEN-1 — B2B query broadening certification.
 * Run: pnpm test:ge-datamoon-b2b-query-broaden-1
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import Module from "node:module"
import path from "node:path"
import { buildDatamoonImportRequestFromAudienceDraft } from "../lib/growth/ava-home/datamoon/ava-datamoon-sourcing-draft-builder"
import { createMinimalAvaDatamoonAudienceDraft } from "../lib/growth/ava-home/datamoon/ava-datamoon-sourcing-workbench-types"
import {
  consolidateDatamoonProviderFiltersForOrSemantics,
  mapDatamoonFiltersToProviderFilters,
} from "../lib/growth/lead-sources/datamoon/datamoon-audience-filter-mapping"
import {
  DATAMOON_REPEATED_FILTER_AND_SEMANTICS_NOTE,
  expandDatamoonB2bTopicSearchQueries,
  GROWTH_DATAMOON_B2B_QUERY_BROADEN_1_QA_MARKER,
  rankDatamoonB2bTopicCandidates,
  selectBroadenedDatamoonB2bTopics,
} from "../lib/growth/lead-sources/datamoon/datamoon-b2b-topic-broadening"

const PHASE = "GE-DATAMOON-B2B-QUERY-BROADEN-1" as const

const originalLoad = (Module as unknown as { _load: (...args: unknown[]) => unknown })._load
;(Module as unknown as { _load: (...args: unknown[]) => unknown })._load = function patchedLoad(
  request: string,
  parent: unknown,
  isMain: boolean,
) {
  if (request === "server-only") return {}
  return originalLoad.call(this, request, parent, isMain)
}

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function mockBroadTopicSearchFetch() {
  const responses: Record<string, Array<{ topic_id: string; label: string; match_score: number; match_method: string }>> = {
    "medical equipment service": [
      { topic_id: "29077", label: "Medical Equipment Management Plan", match_score: 81.1, match_method: "semantic" },
      { topic_id: "4690", label: "Medical Equipment", match_score: 80.7, match_method: "semantic" },
      { topic_id: "48172", label: "Industrial Equipment Maintenance", match_score: 77.4, match_method: "semantic" },
    ],
    "medical equipment": [{ topic_id: "4690", label: "Medical Equipment", match_score: 95, match_method: "semantic" }],
    "industrial equipment maintenance": [
      { topic_id: "48172", label: "Industrial Equipment Maintenance", match_score: 94, match_method: "semantic" },
    ],
    "equipment maintenance software": [
      { topic_id: "22005", label: "Equipment Maintenance Software", match_score: 94.5, match_method: "semantic" },
    ],
    "field service management": [
      { topic_id: "1897", label: "Field Service Management", match_score: 93, match_method: "semantic" },
    ],
    "maintenance repair overhaul": [
      { topic_id: "927", label: "Maintenance, Repair and Overhaul (MRO)", match_score: 90, match_method: "semantic" },
    ],
  }

  return async (url: string | URL | Request) => {
    const href = typeof url === "string" ? url : url instanceof URL ? url.href : url.url
    const keywords = new URL(href).searchParams.get("keywords") ?? ""
    const hits = responses[keywords] ?? []
    return new Response(JSON.stringify({ success: true, data: hits, total: hits.length }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  }
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] B2B query broadening certification`)

  assert.equal(GROWTH_DATAMOON_B2B_QUERY_BROADEN_1_QA_MARKER, "ge-datamoon-b2b-query-broaden-1-v1")
  assert.match(DATAMOON_REPEATED_FILTER_AND_SEMANTICS_NOTE, /AND semantics/)

  const builder = readSource("lib/growth/ava-home/datamoon/ava-datamoon-sourcing-draft-builder.ts")
  assert.match(builder, /operator: "in", value: jobTitles/)
  assert.doesNotMatch(builder, /operator: "contains", value: title/)

  const draftRequest = buildDatamoonImportRequestFromAudienceDraft(
    createMinimalAvaDatamoonAudienceDraft({
      topics: ["medical equipment service"],
      customTopic: null,
      jobTitles: ["owner", "CEO", "operations manager", "service manager"],
    }),
  )
  const jobTitleFilters = draftRequest.filters.filter((filter) => filter.field === "job_title")
  assert.equal(jobTitleFilters.length, 1)
  assert.equal(jobTitleFilters[0]?.operator, "in")
  assert.deepEqual(jobTitleFilters[0]?.value, ["owner", "CEO", "operations manager", "service manager"])

  const consolidated = consolidateDatamoonProviderFiltersForOrSemantics([
    { field: "job_title", operator: "contains", value: "owner" },
    { field: "job_title", operator: "contains", value: "CEO" },
    { field: "contact_country", operator: "=", value: "US" },
  ])
  assert.equal(consolidated.filter((filter) => filter.field === "job_title").length, 1)
  assert.equal(consolidated.find((filter) => filter.field === "job_title")?.operator, "in")

  const mapped = mapDatamoonFiltersToProviderFilters([
    { field: "job_title", operator: "contains", value: "owner" },
    { field: "job_title", operator: "contains", value: "CEO" },
  ])
  assert.equal(mapped.providerFilters.length, 1)
  assert.equal(mapped.providerFilters[0]?.operator, "in")

  const broadenedQueries = expandDatamoonB2bTopicSearchQueries(["medical equipment service"])
  assert.ok(broadenedQueries.includes("medical equipment service"))
  assert.ok(broadenedQueries.includes("medical equipment"))
  assert.ok(broadenedQueries.includes("field service management"))

  const ranked = rankDatamoonB2bTopicCandidates([
    {
      originalQuery: "medical equipment service",
      topic_id: "29077",
      label: "Medical Equipment Management Plan",
      match_score: 81.1,
      match_method: "semantic",
      searchQuery: "medical equipment service",
    },
    {
      originalQuery: "medical equipment",
      topic_id: "4690",
      label: "Medical Equipment",
      match_score: 80.7,
      match_method: "semantic",
      searchQuery: "medical equipment",
    },
  ])
  assert.equal(ranked[0]?.topic_id, "4690")

  const selected = selectBroadenedDatamoonB2bTopics(ranked)
  assert.equal(selected.topic_ids[0], "4690")

  const { prepareDatamoonAudienceImportRequestForBuild } = await import(
    "../lib/growth/lead-sources/datamoon/datamoon-b2b-audience-import-prepare"
  )

  const prepared = await prepareDatamoonAudienceImportRequestForBuild(draftRequest, {
    env: { ...process.env, DATAMOON_DRY_RUN_ONLY: "false" },
    fetchImpl: mockBroadTopicSearchFetch(),
  })
  assert.equal(prepared.ok, true)
  if (!prepared.ok) throw new Error("expected broadened prepare success")

  assert.ok((prepared.request.topic_ids?.length ?? 0) >= 2)
  assert.ok(prepared.request.topic_ids?.includes("4690"))
  assert.ok(prepared.request.topic_ids?.includes("22005"))
  assert.ok(prepared.request.topic_ids?.includes("1897"))
  assert.equal(
    prepared.request.filters.filter((filter) => filter.field === "job_title").length,
    1,
  )
  assert.equal(
    prepared.request.filters.find((filter) => filter.field === "job_title")?.operator,
    "in",
  )
  assert.ok(prepared.request.workbench_context?.broadenedTopicSearchQueries?.includes("medical equipment"))
  assert.ok((prepared.request.workbench_context?.resolvedB2bTopics?.length ?? 0) >= 2)

  const { buildGrowthMissionAvaLaunchZeroPreviewDebug } = await import(
    "../lib/growth/mission-center/growth-mission-ava-launch-zero-preview-debug"
  )
  const zeroPreviewDebug = buildGrowthMissionAvaLaunchZeroPreviewDebug({
    run: {
      id: "run-broaden",
      runName: "Broaden smoke",
      datamoonAudienceId: "9999",
      providerMode: "module",
      audienceType: "b2b",
      filters: prepared.request.filters,
      topicIds: prepared.request.topic_ids ?? [],
      requestedLimit: 25,
      audienceName: "Medical equipment",
      websiteId: null,
      status: "completed",
      recordCount: 0,
      loadingCount: 0,
      previewCount: 0,
      importedCount: 0,
      duplicateCount: 0,
      skippedCount: 0,
      errorCount: 0,
      providerMetadata: { poll_status: "completed" },
      errorMessage: null,
      dryRun: false,
      createdBy: "user-1",
      lastPolledAt: "2026-07-08T00:00:00.000Z",
      completedAt: "2026-07-08T00:00:00.000Z",
      importedAt: null,
      createdAt: "2026-07-08T00:00:00.000Z",
      updatedAt: "2026-07-08T00:00:00.000Z",
    },
    records: [],
    importRequest: prepared.request,
  })
  assert.ok((zeroPreviewDebug.topic_ids?.length ?? 0) >= 2)
  assert.ok(zeroPreviewDebug.broadenedTopicSearchQueries.includes("medical equipment"))
  assert.ok(zeroPreviewDebug.resolvedB2bTopics.some((topic) => topic.topic_id === "4690"))
  assert.equal(
    zeroPreviewDebug.filters.filter((filter) => filter.field === "job_title").length,
    1,
  )
  assert.equal(
    zeroPreviewDebug.filters.find((filter) => filter.field === "job_title")?.operator,
    "in",
  )

  console.log(`[${PHASE}] ✓ B2B query broadening certified`)
}

main().catch((error) => {
  console.error(`[${PHASE}] FAILED`, error)
  process.exit(1)
})
