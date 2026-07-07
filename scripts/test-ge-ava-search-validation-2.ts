/**
 * GE-AVA-SEARCH-VALIDATION-2 — Raw validator trace certification.
 * Run: pnpm test:ge-ava-search-validation-2
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createMinimalAvaDatamoonAudienceDraft } from "../lib/growth/ava-home/datamoon/ava-datamoon-sourcing-workbench-types"
import { validateDatamoonAudienceImportRequest } from "../lib/growth/lead-sources/datamoon/datamoon-audience-import-validation"
import {
  AVA_LAUNCH_VALIDATOR_DATAMOON_IMPORT,
  AVA_LAUNCH_VALIDATOR_LAUNCH_BODY_SCHEMA,
  buildDatamoonImportValidationTraceError,
  buildGrowthAvaLaunchSearchValidationTrace,
  GROWTH_AVA_SEARCH_VALIDATION_2_QA_MARKER,
} from "../lib/growth/mission-center/growth-ava-launch-search-validation-trace"
import {
  formatGrowthAvaLaunchValidationErrorsForUi,
  GROWTH_AVA_SEARCH_VALIDATION_2_QA_MARKER as CONTRACT_QA_MARKER,
  resolveGrowthAvaLaunchValidationMessage,
} from "../lib/growth/mission-center/growth-mission-ava-launch-run-api-contract"

const PHASE = "GE-AVA-SEARCH-VALIDATION-2" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Raw validator trace certification`)

  assert.equal(GROWTH_AVA_SEARCH_VALIDATION_2_QA_MARKER, "ge-ava-search-validation-2-v1")
  assert.equal(CONTRACT_QA_MARKER, "ge-ava-search-validation-2-v1")

  const invalidDraft = createMinimalAvaDatamoonAudienceDraft({
    audienceType: "b2b",
    topics: [],
    customTopic: null,
  })
  const providerRequest = {
    run_name: "Lead discovery audience",
    audience_type: "b2b" as const,
    filters: [],
    topic_ids: [] as string[],
    limit: 100,
  }
  const datamoonValidation = validateDatamoonAudienceImportRequest(providerRequest)
  assert.equal(datamoonValidation.ok, false)

  const traceError = buildDatamoonImportValidationTraceError(
    datamoonValidation.issues[0]!,
    invalidDraft,
    providerRequest,
  )
  assert.equal(traceError.validator, AVA_LAUNCH_VALIDATOR_DATAMOON_IMPORT)
  assert.equal(traceError.field, "topic_ids")
  assert.equal(traceError.code, "topic_ids_required")
  assert.match(traceError.message, /topic_id/i)
  assert.match(String(traceError.expected), /at least one topic_id/i)
  assert.equal((traceError.actual as { topic_ids_length: number }).topic_ids_length, 0)
  assert.equal((traceError.actual as { audienceType: string }).audienceType, "b2b")
  assert.ok(traceError.rawIssue)

  const uiMessage = resolveGrowthAvaLaunchValidationMessage(traceError)
  assert.match(uiMessage, /topic_id/i)
  assert.doesNotMatch(uiMessage, /^Lead search request is invalid\.$/)

  const formatted = formatGrowthAvaLaunchValidationErrorsForUi([traceError])
  assert.match(formatted, /topic_id/i)
  assert.doesNotMatch(formatted, /Lead search request is invalid\./)

  const searchTrace = buildGrowthAvaLaunchSearchValidationTrace({
    missionId: "mission-1",
    audienceDraft: invalidDraft,
    providerRequest,
    datamoonValidation,
    mission: {
      id: "mission-1",
      title: "Acquire New Customers",
      status: "active",
      hasBoundSearch: false,
    },
  })
  assert.equal(searchTrace.qa_marker, "ge-ava-search-validation-2-v1")
  assert.equal(searchTrace.providerRequest.topic_ids_length, 0)
  assert.equal(searchTrace.providerRequest.audience_type, "b2b")
  assert.equal(searchTrace.mission.hasBoundSearch, false)

  const zodTrace = {
    code: "validation_failed",
    message: "String must contain at least 1 character(s)",
    field: "audienceDraft.audienceName",
    severity: "error" as const,
    validator: AVA_LAUNCH_VALIDATOR_LAUNCH_BODY_SCHEMA,
    expected: "non-empty string (min 1)",
    actual: "",
    rawIssue: { code: "too_small", path: ["audienceDraft", "audienceName"] },
  }
  assert.equal(resolveGrowthAvaLaunchValidationMessage(zodTrace), zodTrace.message)

  const route = readSource("app/api/platform/growth/mission-center/[missionId]/ava-launch-run/route.ts")
  assert.match(route, /logGrowthAvaLaunchSearchValidationTrace/)
  assert.match(route, /buildSearchValidationTraceFromDraft/)

  const diagnostics = readSource("lib/growth/mission-center/growth-ava-launch-validation-diagnostics.ts")
  assert.match(diagnostics, /ava_launch_search_validation_trace/)
  assert.match(diagnostics, /validator:/)
  assert.match(diagnostics, /buildDatamoonImportValidationTraceError/)

  const contract = readSource("lib/growth/mission-center/growth-mission-ava-launch-run-api-contract.ts")
  assert.match(contract, /validator\?: string/)
  assert.match(contract, /rawIssue\?: unknown/)
  assert.doesNotMatch(contract, /validation_failed: "Lead search request is invalid\./)

  console.log(`[${PHASE}] passed`)
  console.log(`[${PHASE}] production failure shape example:`)
  console.log(
    JSON.stringify(
      {
        validator: traceError.validator,
        field: traceError.field,
        message: traceError.message,
        actual: traceError.actual,
      },
      null,
      2,
    ),
  )
}

void main()
