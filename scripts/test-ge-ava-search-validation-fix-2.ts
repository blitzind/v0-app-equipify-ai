/**
 * GE-AVA-SEARCH-VALIDATION-FIX-2 — Production failure trace coercion certification.
 * Run: pnpm test:ge-ava-search-validation-fix-2
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildDatamoonImportRequestFromAudienceDraft,
  datamoonImportRequestRequiresTopicIds,
  normalizeDatamoonImportRequestAudience,
  normalizeDatamoonTopicIds,
} from "../lib/growth/ava-home/datamoon/ava-datamoon-sourcing-draft-builder"
import { createMinimalAvaDatamoonAudienceDraft } from "../lib/growth/ava-home/datamoon/ava-datamoon-sourcing-workbench-types"
import type { DatamoonAudienceImportRequest } from "../lib/growth/lead-sources/datamoon/datamoon-audience-import-types"
import { GROWTH_DATAMOON_B2B_TOPIC_RESOLUTION_NO_MATCH_ERROR } from "../lib/growth/lead-sources/datamoon/datamoon-b2b-topic-resolution-types"
import { validateDatamoonAudienceImportRequest } from "../lib/growth/lead-sources/datamoon/datamoon-audience-import-validation"

const PHASE = "GE-AVA-SEARCH-VALIDATION-FIX-2" as const

/** Exact audienceDraft shape from GE-AVA-LAUNCH-RUN-TRACE-1 production failure. */
export const PRODUCTION_FAILURE_AUDIENCE_DRAFT = createMinimalAvaDatamoonAudienceDraft({
  audienceName: "Lead discovery search",
  audienceType: "b2b",
  providerMode: "module",
  recordLimit: 100,
  lookbackDays: 7,
  intentLevels: ["high", "medium"],
  geography: { country: "US", state: null, city: null },
  topics: [],
  customTopic: null,
  jobTitles: [],
  customJobTitle: null,
  companySize: "smb",
  revenueRange: null,
  includeBusinessEmail: true,
  includePhone: true,
  includeLinkedIn: true,
  excludeDuplicates: true,
  onlyNewSinceLastRefresh: true,
})

/** Pre-fix providerRequest emitted before FIX-2 (topic_ids_required failure). */
export const PRODUCTION_FAILURE_PROVIDER_REQUEST: DatamoonAudienceImportRequest = {
  run_name: "Lead discovery search",
  audience_type: "b2b",
  provider_mode: "module",
  filters: buildDatamoonImportRequestFromAudienceDraft(PRODUCTION_FAILURE_AUDIENCE_DRAFT).filters,
  topic_ids: [],
  limit: 100,
  name: "Lead discovery search",
}

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertNoEmptyTopicIdAudience(request: DatamoonAudienceImportRequest): void {
  const topicIds = request.topic_ids ?? []
  assert.equal(
    datamoonImportRequestRequiresTopicIds(request),
    false,
    `invalid request: audience_type=${request.audience_type} topic_ids=${JSON.stringify(topicIds)}`,
  )
  if (request.audience_type === "b2b" || request.audience_type === "b2c") {
    assert.ok(topicIds.length > 0, "b2b/b2c must have non-empty topic_ids")
  } else {
    assert.equal(request.topic_ids, undefined, "advanced_search must omit topic_ids")
  }
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Production failure trace coercion certification`)

  const builder = readSource("lib/growth/ava-home/datamoon/ava-datamoon-sourcing-draft-builder.ts")
  const importService = readSource("lib/growth/lead-sources/datamoon/datamoon-audience-import-service.ts")
  const bindingService = readSource("lib/growth/mission-center/growth-mission-find-leads-binding-service.ts")
  const launchService = readSource("lib/growth/mission-center/growth-mission-ava-launch-run-service.ts")

  assert.match(builder, /normalizeDatamoonImportRequestAudience/)
  assert.match(builder, /resolveDatamoonAudienceTypeForImport/)
  assert.match(importService, /normalizeDatamoonImportRequestAudience\(input\)/)
  assert.match(bindingService, /normalizeDatamoonImportRequestAudience/)
  assert.match(launchService, /buildDatamoonImportRequestFromAudienceDraft\(input\.audienceDraft\)/)

  assert.equal(PRODUCTION_FAILURE_AUDIENCE_DRAFT.audienceType, "b2b")
  assert.deepEqual(PRODUCTION_FAILURE_AUDIENCE_DRAFT.topics, [])
  assert.equal(PRODUCTION_FAILURE_AUDIENCE_DRAFT.customTopic, null)

  const preFixValidation = validateDatamoonAudienceImportRequest(PRODUCTION_FAILURE_PROVIDER_REQUEST)
  assert.equal(preFixValidation.ok, false)
  assert.equal(preFixValidation.issues[0]?.code, "topic_ids_required")

  const providerRequest = buildDatamoonImportRequestFromAudienceDraft(PRODUCTION_FAILURE_AUDIENCE_DRAFT)
  assert.equal(providerRequest.audience_type, "b2b")
  assert.equal(providerRequest.topic_ids, undefined)
  assert.equal(datamoonImportRequestRequiresTopicIds(providerRequest), true)
  const providerValidation = validateDatamoonAudienceImportRequest(providerRequest)
  assert.equal(providerValidation.ok, false)
  assert.equal(providerValidation.issues[0]?.code, "datamoon_b2b_topics_unresolved")
  assert.equal(providerValidation.issues[0]?.message, GROWTH_DATAMOON_B2B_TOPIC_RESOLUTION_NO_MATCH_ERROR)

  const normalizedRawFailure = normalizeDatamoonImportRequestAudience(PRODUCTION_FAILURE_PROVIDER_REQUEST)
  assert.equal(normalizedRawFailure.audience_type, "advanced_search")
  assert.equal(normalizedRawFailure.topic_ids, undefined)
  assert.equal(validateDatamoonAudienceImportRequest(normalizedRawFailure).ok, true)

  const whitespaceOnlyDraft = createMinimalAvaDatamoonAudienceDraft({
    audienceType: "b2b",
    topics: ["", "   "],
    customTopic: "   ",
    intentLevels: [],
  })
  const whitespaceRequest = buildDatamoonImportRequestFromAudienceDraft(whitespaceOnlyDraft)
  assert.equal(whitespaceRequest.audience_type, "advanced_search")
  assert.equal(whitespaceRequest.topic_ids, undefined)
  assert.equal(validateDatamoonAudienceImportRequest(whitespaceRequest).ok, true)

  const b2cWithoutTopics = normalizeDatamoonImportRequestAudience({
    run_name: "Lead discovery search",
    audience_type: "b2c",
    filters: providerRequest.filters,
    topic_ids: [],
    limit: 100,
  })
  assert.equal(b2cWithoutTopics.audience_type, "b2c")
  assert.equal(b2cWithoutTopics.topic_ids, undefined)
  assert.equal(validateDatamoonAudienceImportRequest(b2cWithoutTopics).ok, false)

  const b2cWithTopics = normalizeDatamoonImportRequestAudience({
    run_name: "Lead discovery search",
    audience_type: "b2c",
    filters: providerRequest.filters,
    topic_ids: ["12345"],
    limit: 100,
  })
  assert.equal(b2cWithTopics.audience_type, "b2c")
  assert.deepEqual(b2cWithTopics.topic_ids, ["12345"])

  assert.deepEqual(normalizeDatamoonTopicIds([" topic-a ", "topic-a", ""]), ["topic-a"])

  console.log(`[${PHASE}] production failure trace`)
  console.log(
    JSON.stringify(
      {
        audienceDraft: {
          audienceType: PRODUCTION_FAILURE_AUDIENCE_DRAFT.audienceType,
          topics: PRODUCTION_FAILURE_AUDIENCE_DRAFT.topics,
          customTopic: PRODUCTION_FAILURE_AUDIENCE_DRAFT.customTopic,
        },
        preFixProviderRequest: {
          audience_type: PRODUCTION_FAILURE_PROVIDER_REQUEST.audience_type,
          topic_ids: PRODUCTION_FAILURE_PROVIDER_REQUEST.topic_ids,
          filters_count: PRODUCTION_FAILURE_PROVIDER_REQUEST.filters.length,
        },
        fixedProviderRequest: {
          audience_type: providerRequest.audience_type,
          topic_ids: providerRequest.topic_ids,
          filters_count: providerRequest.filters.length,
        },
      },
      null,
      2,
    ),
  )

  console.log(`[${PHASE}] passed`)
}

void main()
