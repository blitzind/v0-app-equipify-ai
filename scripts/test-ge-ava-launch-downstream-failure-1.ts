/**
 * GE-AVA-LAUNCH-DOWNSTREAM-FAILURE-1 — Downstream launch failure propagation certification.
 * Run: pnpm test:ge-ava-launch-downstream-failure-1
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildDatamoonImportRequestFromAudienceDraft } from "../lib/growth/ava-home/datamoon/ava-datamoon-sourcing-draft-builder"
import { createMinimalAvaDatamoonAudienceDraft } from "../lib/growth/ava-home/datamoon/ava-datamoon-sourcing-workbench-types"
import { mapPropagatedAvaLaunchIssuesToValidationErrors } from "../lib/growth/mission-center/growth-ava-launch-search-validation-trace"
import {
  buildGrowthMissionAvaLaunchValidationFailureBody,
  formatGrowthAvaLaunchValidationErrorsForUi,
} from "../lib/growth/mission-center/growth-mission-ava-launch-run-api-contract"
import {
  GROWTH_AVA_LAUNCH_DOWNSTREAM_FAILURE_1_QA_MARKER,
  mergeAvaLaunchRunServiceFailure,
} from "../lib/growth/mission-center/growth-mission-ava-launch-run-downstream-failure"

const PHASE = "GE-AVA-LAUNCH-DOWNSTREAM-FAILURE-1" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Downstream launch failure propagation certification`)

  assert.equal(GROWTH_AVA_LAUNCH_DOWNSTREAM_FAILURE_1_QA_MARKER, "ge-ava-launch-downstream-failure-1-v1")

  const service = readSource("lib/growth/mission-center/growth-mission-ava-launch-run-service.ts")
  const route = readSource("app/api/platform/growth/mission-center/[missionId]/ava-launch-run/route.ts")
  const diagnostics = readSource("lib/growth/mission-center/growth-ava-launch-validation-diagnostics.ts")

  assert.match(service, /mergeAvaLaunchRunServiceFailure/)
  assert.match(service, /mergeAvaLaunchRunServiceFailure\([\s\S]*started/)
  assert.match(route, /sourceFailure: result\.sourceFailure/)
  assert.match(route, /issues: result\.issues/)
  assert.match(diagnostics, /mapPropagatedAvaLaunchIssuesToValidationErrors/)

  const downstreamFailure = {
    ok: false as const,
    error: "validation_failed",
    issues: [
      {
        code: "topic_ids_required",
        field: "topic_ids",
        message: "b2b and b2c audiences require at least one topic_id.",
      },
    ],
  }

  const merged = mergeAvaLaunchRunServiceFailure(
    { ok: false, error: "validation_failed", status: 400 },
    downstreamFailure,
  )
  assert.deepEqual(merged.issues, downstreamFailure.issues)
  assert.deepEqual(merged.sourceFailure, downstreamFailure)

  const audienceDraft = {
    ...createMinimalAvaDatamoonAudienceDraft(),
    audienceType: "b2b" as const,
    topics: [],
  }
  const providerRequest = buildDatamoonImportRequestFromAudienceDraft(audienceDraft)

  const validationErrors = mapPropagatedAvaLaunchIssuesToValidationErrors(downstreamFailure.issues, {
    audienceDraft,
    providerRequest,
  })
  assert.ok(validationErrors)
  assert.equal(validationErrors![0]?.code, "topic_ids_required")
  assert.equal(
    validationErrors![0]?.message,
    "b2b and b2c audiences require at least one topic_id.",
  )
  assert.doesNotMatch(validationErrors![0]?.message ?? "", /Validation failed/)

  const apiBody = buildGrowthMissionAvaLaunchValidationFailureBody({
    validationErrors: validationErrors!,
    fallbackMessage: "validation_failed",
    runId: null,
    sourceFailure: merged.sourceFailure,
    issues: merged.issues,
  })
  assert.equal(apiBody.issues, downstreamFailure.issues)
  assert.deepEqual(apiBody.sourceFailure, downstreamFailure)
  assert.equal(apiBody.validationErrors[0]?.message, "b2b and b2c audiences require at least one topic_id.")

  const uiMessage = formatGrowthAvaLaunchValidationErrorsForUi(apiBody.validationErrors)
  assert.match(uiMessage, /b2b and b2c audiences require at least one topic_id\./)
  assert.doesNotMatch(uiMessage, /Validation failed/)

  const providerIssues = { topic_ids: ["Topic is required for this audience."] }
  const providerValidationErrors = mapPropagatedAvaLaunchIssuesToValidationErrors(providerIssues)
  assert.ok(providerValidationErrors)
  assert.equal(providerValidationErrors![0]?.message, "Topic is required for this audience.")

  console.log(`[${PHASE}] API response body`)
  console.log(JSON.stringify(apiBody, null, 2))
  console.log(`[${PHASE}] passed`)
}

void main()
