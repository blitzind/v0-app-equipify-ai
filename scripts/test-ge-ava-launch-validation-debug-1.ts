/**
 * GE-AVA-LAUNCH-VALIDATION-DEBUG-1 — Ava launch validation diagnostics certification.
 * Run: pnpm test:ge-ava-launch-validation-debug-1
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AVA_LAUNCH_CANT_START_HEADING,
  GROWTH_AVA_LAUNCH_VALIDATION_DEBUG_1_QA_MARKER,
  GROWTH_AVA_LAUNCH_VALIDATION_FAILED_ERROR,
  formatGrowthAvaLaunchValidationErrorsForUi,
} from "../lib/growth/mission-center/growth-mission-ava-launch-run-api-contract"

const PHASE = "GE-AVA-LAUNCH-VALIDATION-DEBUG-1" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Ava launch validation diagnostics certification`)

  assert.equal(GROWTH_AVA_LAUNCH_VALIDATION_DEBUG_1_QA_MARKER, "ge-ava-launch-validation-debug-1-v1")
  assert.equal(GROWTH_AVA_LAUNCH_VALIDATION_FAILED_ERROR, "Validation failed")
  assert.equal(GROWTH_AVA_LAUNCH_CANT_START_HEADING, "Ava can't start yet.")

  const formatted = formatGrowthAvaLaunchValidationErrorsForUi([
    {
      code: "no_approved_lead_search",
      message: "No approved search attached to this mission.",
      field: "audienceDraft",
      severity: "error",
    },
    {
      code: "datamoon_provider_disabled",
      message: "Datamoon provider is disabled.",
      field: "datamoonProvider",
      severity: "error",
    },
    {
      code: "mission_blocked",
      message: "Mission is blocked.",
      field: "mission",
      severity: "error",
    },
  ])
  assert.match(formatted, /Ava can't start yet\./)
  assert.match(formatted, /No approved search attached to this mission\./)
  assert.match(formatted, /Datamoon provider is disabled\./)
  assert.match(formatted, /Mission is blocked\./)

  const route = readSource("app/api/platform/growth/mission-center/[missionId]/ava-launch-run/route.ts")
  assert.match(route, /evaluateGrowthAvaLaunchValidation/)
  assert.match(route, /validationErrors/)
  assert.match(route, /GROWTH_AVA_LAUNCH_VALIDATION_FAILED_ERROR/)
  assert.match(route, /logGrowthAvaLaunchValidationResult/)
  assert.match(route, /runGrowthMissionAvaLaunchRun/)
  assert.doesNotMatch(route, /stack|Stack/i)

  const diagnostics = readSource("lib/growth/mission-center/growth-ava-launch-validation-diagnostics.ts")
  assert.match(diagnostics, /AVA Launch validation failed/)
  assert.match(diagnostics, /Business profile approved/)
  assert.match(diagnostics, /Mission active/)
  assert.match(diagnostics, /Datamoon provider enabled/)
  assert.match(diagnostics, /Growth autonomy enabled/)
  assert.match(diagnostics, /shouldBlockGrowthAvaLaunchValidation/)

  const service = readSource("lib/growth/mission-center/growth-mission-ava-launch-run-service.ts")
  assert.doesNotMatch(service, /validationErrors|GROWTH_AVA_LAUNCH_VALIDATION_FAILED_ERROR/)

  const workbench = readSource(
    "components/growth/workspace/executive-briefing/growth-home-datamoon-sourcing-workbench-section.tsx",
  )
  assert.match(workbench, /formatAvaLaunchFailureMessage/)
  assert.match(workbench, /formatGrowthAvaLaunchValidationErrorsForUi/)
  assert.match(workbench, /validationErrors/)

  console.log(`[${PHASE}] passed`)
}

void main()
