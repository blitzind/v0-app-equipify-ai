/**
 * GE-AVA-RUNTIME-OBJECT-TRACE-1 — Runtime object trace instrumentation certification.
 * Run: pnpm test:ge-ava-runtime-object-trace-1
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildAvaRuntimeTraceRecord,
  GROWTH_AVA_RUNTIME_OBJECT_TRACE_1_QA_MARKER,
  hashAvaRuntimeTraceObject,
} from "../lib/growth/mission-center/growth-mission-ava-launch-runtime-object-trace-types"
import { createMinimalAvaDatamoonAudienceDraft } from "../lib/growth/ava-home/datamoon/ava-datamoon-sourcing-workbench-types"
import { buildDatamoonImportRequestFromAudienceDraft } from "../lib/growth/ava-home/datamoon/ava-datamoon-sourcing-draft-builder"

const PRODUCTION_FAILURE_AUDIENCE_DRAFT = createMinimalAvaDatamoonAudienceDraft({
  audienceName: "Lead discovery search",
  audienceType: "b2b",
  topics: [],
  customTopic: null,
})

const PHASE = "GE-AVA-RUNTIME-OBJECT-TRACE-1" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Runtime object trace instrumentation certification`)

  assert.equal(GROWTH_AVA_RUNTIME_OBJECT_TRACE_1_QA_MARKER, "ge-ava-runtime-object-trace-1-v1")

  const traceTypes = readSource(
    "lib/growth/mission-center/growth-mission-ava-launch-runtime-object-trace-types.ts",
  )
  const trace = readSource("lib/growth/mission-center/growth-mission-ava-launch-runtime-object-trace.ts")
  const launchService = readSource("lib/growth/mission-center/growth-mission-ava-launch-run-service.ts")
  const importService = readSource("lib/growth/lead-sources/datamoon/datamoon-audience-import-service.ts")

  assert.match(traceTypes, /hashAvaRuntimeTraceObject/)
  assert.match(traceTypes, /buildAvaRuntimeTraceRecord/)
  assert.match(trace, /AVA_RUNTIME_TRACE/)
  assert.match(trace, /AVA_RUNTIME_OBJECT_CONSTRUCTED/)
  assert.match(trace, /beginAvaLaunchRuntimeObjectTraceSession/)
  assert.match(trace, /endAvaLaunchRuntimeObjectTraceSession/)

  assert.match(launchService, /logAvaRuntimeObjectConstruction\([\s\S]*input\.audienceDraft/)
  assert.match(launchService, /logAvaRuntimeObjectConstruction\([\s\S]*datamoonRequest/)
  assert.match(launchService, /logAvaRuntimeTrace\([\s\S]*validateDatamoonAudienceImportRequest/)
  assert.match(launchService, /logAvaRuntimeTrace\([\s\S]*startDatamoonAudienceImportRun/)
  assert.match(launchService, /finally[\s\S]*endAvaLaunchRuntimeObjectTraceSession/)

  assert.match(importService, /logAvaRuntimeTrace\([\s\S]*preNormalize/)
  assert.match(importService, /logAvaRuntimeTrace\([\s\S]*preValidation/)
  assert.match(importService, /validationFailed/)

  const audienceDraft = PRODUCTION_FAILURE_AUDIENCE_DRAFT
  const providerRequest = buildDatamoonImportRequestFromAudienceDraft(audienceDraft)
  const preValidationRecord = buildAvaRuntimeTraceRecord({
    stage: "datamoon_validation",
    function: "validateDatamoonAudienceImportRequest",
    file: "lib/growth/lead-sources/datamoon/datamoon-audience-import-validation.ts",
    object: providerRequest,
    label: "datamoonRequest.preLaunchServiceValidation",
    constructedBy: {
      file: "lib/growth/ava-home/datamoon/ava-datamoon-sourcing-draft-builder.ts",
      function: "buildDatamoonImportRequestFromAudienceDraft",
    },
  })

  assert.equal(preValidationRecord.objectHash, hashAvaRuntimeTraceObject(providerRequest))
  assert.equal((preValidationRecord.object as { audience_type: string }).audience_type, "advanced_search")

  console.log(`[${PHASE}] example AVA_RUNTIME_TRACE`)
  console.log(JSON.stringify(preValidationRecord, null, 2))

  console.log(`[${PHASE}] passed`)
}

void main()
