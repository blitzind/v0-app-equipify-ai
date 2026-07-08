/**
 * GE-DATAMOON-B2B-TOPIC-RESOLUTION-1 — B2B topic resolution certification.
 * Run: pnpm test:ge-datamoon-b2b-topic-resolution-1
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import Module from "node:module"
import path from "node:path"
import {
  buildDatamoonImportRequestFromAudienceDraft,
  datamoonImportRequestIntendsB2bAudience,
} from "../lib/growth/ava-home/datamoon/ava-datamoon-sourcing-draft-builder"
import {
  createDefaultAvaDatamoonAudienceDraft,
  createMinimalAvaDatamoonAudienceDraft,
} from "../lib/growth/ava-home/datamoon/ava-datamoon-sourcing-workbench-types"
import {
  appendDatamoonB2bIntentFiltersFromWorkbenchContext,
  DATAMOON_B2B_EVENT_DATE_MAX_LOOKBACK_DAYS,
} from "../lib/growth/lead-sources/datamoon/datamoon-audience-filter-mapping"
import {
  GROWTH_DATAMOON_B2B_TOPIC_RESOLUTION_1_QA_MARKER,
  GROWTH_DATAMOON_B2B_TOPIC_RESOLUTION_NO_MATCH_ERROR,
  isDatamoonNumericTopicId,
} from "../lib/growth/lead-sources/datamoon/datamoon-b2b-topic-resolution-types"
import { validateDatamoonAudienceImportRequest } from "../lib/growth/lead-sources/datamoon/datamoon-audience-import-validation"

const PHASE = "GE-DATAMOON-B2B-TOPIC-RESOLUTION-1" as const

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

function mockTopicSearchFetch() {
  const responses: Record<string, Array<{ topic_id: string; label: string; match_score: number; match_method: string }>> = {
    "medical equipment service": [
      { topic_id: "4690", label: "Medical Equipment", match_score: 80.7, match_method: "semantic" },
      { topic_id: "29077", label: "Medical Equipment Management Plan", match_score: 81.1, match_method: "semantic" },
    ],
    "equipment maintenance software": [
      { topic_id: "22005", label: "Equipment Maintenance Software", match_score: 94.5, match_method: "semantic" },
    ],
  }

  return async (url: string | URL | Request) => {
    const href = typeof url === "string" ? url : url instanceof URL ? url.href : url.url
    const parsed = new URL(href)
    const keywords = parsed.searchParams.get("keywords") ?? ""
    const hits = responses[keywords] ?? []
    return new Response(JSON.stringify({ success: true, data: hits, total: hits.length }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  }
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] B2B topic resolution certification`)

  assert.equal(GROWTH_DATAMOON_B2B_TOPIC_RESOLUTION_1_QA_MARKER, "ge-datamoon-b2b-topic-resolution-1-v1")
  assert.equal(
    GROWTH_DATAMOON_B2B_TOPIC_RESOLUTION_NO_MATCH_ERROR,
    "No Datamoon B2B topics matched this search. Refine the topic or use Advanced Search.",
  )

  const importService = readSource("lib/growth/lead-sources/datamoon/datamoon-audience-import-service.ts")
  assert.match(importService, /prepareDatamoonAudienceImportRequestForBuild/)

  const defaultDraft = createDefaultAvaDatamoonAudienceDraft()
  const draftRequest = buildDatamoonImportRequestFromAudienceDraft(defaultDraft)
  assert.equal(draftRequest.audience_type, "b2b")
  assert.equal(draftRequest.topic_ids, undefined)
  assert.ok(datamoonImportRequestIntendsB2bAudience(draftRequest))
  assert.equal(validateDatamoonAudienceImportRequest(draftRequest).ok, true)
  for (const topic of draftRequest.workbench_context?.topics ?? []) {
    assert.equal(isDatamoonNumericTopicId(topic), false)
  }

  const manualAdvancedDraft = createMinimalAvaDatamoonAudienceDraft({
    audienceType: "advanced_search",
    topics: [],
    customTopic: null,
    intentLevels: [],
    jobTitles: ["CEO"],
  })
  const manualAdvancedRequest = buildDatamoonImportRequestFromAudienceDraft(manualAdvancedDraft)
  assert.equal(manualAdvancedRequest.audience_type, "advanced_search")
  assert.equal(manualAdvancedRequest.topic_ids, undefined)

  const intentFilters = appendDatamoonB2bIntentFiltersFromWorkbenchContext(
    [{ field: "contact_country", operator: "=", value: "US" }],
    { intentLevels: ["high", "medium"], lookbackDays: 30 },
  )
  assert.ok(intentFilters.some((filter) => filter.field === "score_category"))
  assert.ok(intentFilters.some((filter) => filter.field === "event_date"))
  const eventDateFilter = intentFilters.find((filter) => filter.field === "event_date")
  assert.ok(eventDateFilter?.value)
  const lookbackDaysUsed = Math.min(30, DATAMOON_B2B_EVENT_DATE_MAX_LOOKBACK_DAYS)
  const expectedDate = new Date()
  expectedDate.setUTCDate(expectedDate.getUTCDate() - lookbackDaysUsed)
  assert.equal(eventDateFilter?.value, expectedDate.toISOString().slice(0, 10))

  const { prepareDatamoonAudienceImportRequestForBuild } = await import(
    "../lib/growth/lead-sources/datamoon/datamoon-b2b-audience-import-prepare"
  )

  const medicalPrepared = await prepareDatamoonAudienceImportRequestForBuild(
    buildDatamoonImportRequestFromAudienceDraft(
      createMinimalAvaDatamoonAudienceDraft({
        topics: ["medical equipment service"],
        customTopic: null,
        jobTitles: ["owner", "CEO", "operations manager", "service manager"],
      }),
    ),
    {
      env: { ...process.env, DATAMOON_DRY_RUN_ONLY: "false" },
      fetchImpl: mockTopicSearchFetch(),
    },
  )
  assert.equal(medicalPrepared.ok, true)
  if (!medicalPrepared.ok) throw new Error("expected medical topic prepare success")
  assert.equal(medicalPrepared.request.audience_type, "b2b")
  assert.ok(medicalPrepared.request.topic_ids?.includes("4690"))
  assert.ok(
    medicalPrepared.request.workbench_context?.resolvedB2bTopics?.some((topic) =>
      /medical equipment/i.test(topic.label),
    ),
  )
  assert.ok(medicalPrepared.request.filters.some((filter) => filter.field === "score_category"))
  assert.ok(medicalPrepared.request.filters.some((filter) => filter.field === "event_date"))
  for (const topicId of medicalPrepared.request.topic_ids ?? []) {
    assert.equal(isDatamoonNumericTopicId(topicId), true)
  }

  const softwarePrepared = await prepareDatamoonAudienceImportRequestForBuild(
    buildDatamoonImportRequestFromAudienceDraft(
      createMinimalAvaDatamoonAudienceDraft({
        topics: ["equipment maintenance software"],
        customTopic: null,
      }),
    ),
    {
      env: { ...process.env, DATAMOON_DRY_RUN_ONLY: "false" },
      fetchImpl: mockTopicSearchFetch(),
    },
  )
  assert.equal(softwarePrepared.ok, true)
  if (!softwarePrepared.ok) throw new Error("expected software topic prepare success")
  assert.deepEqual(softwarePrepared.request.topic_ids, ["22005"])

  const unresolved = await prepareDatamoonAudienceImportRequestForBuild(
    buildDatamoonImportRequestFromAudienceDraft(
      createMinimalAvaDatamoonAudienceDraft({
        topics: [],
        customTopic: null,
        intentLevels: ["high"],
      }),
    ),
    { env: { ...process.env, DATAMOON_DRY_RUN_ONLY: "false" }, fetchImpl: mockTopicSearchFetch() },
  )
  assert.equal(unresolved.ok, false)
  if (unresolved.ok) throw new Error("expected unresolved topic failure")
  assert.equal(unresolved.error, GROWTH_DATAMOON_B2B_TOPIC_RESOLUTION_NO_MATCH_ERROR)

  console.log(`[${PHASE}] ✓ B2B topic resolution certified`)
}

main().catch((error) => {
  console.error(`[${PHASE}] FAILED`, error)
  process.exit(1)
})
