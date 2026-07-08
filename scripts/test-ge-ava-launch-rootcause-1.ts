/**
 * GE-AVA-LAUNCH-ROOTCAUSE-1 — Launch service exception transparency certification.
 * Run: pnpm test:ge-ava-launch-rootcause-1
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildGrowthMissionAvaLaunchExceptionFailureBody,
  formatGrowthAvaLaunchValidationErrorsForUi,
} from "../lib/growth/mission-center/growth-mission-ava-launch-run-api-contract"
import {
  GE_AVA_LAUNCH_ROOTCAUSE_1_TEST_THROW_ENV,
  GROWTH_AVA_LAUNCH_ROOTCAUSE_1_QA_MARKER,
  serializeAvaLaunchRunException,
} from "../lib/growth/mission-center/growth-mission-ava-launch-run-exception-transparency"

const PHASE = "GE-AVA-LAUNCH-ROOTCAUSE-1" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Launch service exception transparency certification`)

  assert.equal(GROWTH_AVA_LAUNCH_ROOTCAUSE_1_QA_MARKER, "ge-ava-launch-rootcause-1-v1")

  const service = readSource("lib/growth/mission-center/growth-mission-ava-launch-run-service.ts")
  const route = readSource("app/api/platform/growth/mission-center/[missionId]/ava-launch-run/route.ts")

  assert.match(service, /returnAvaLaunchUnexpectedExceptionFailure/)
  assert.match(service, /catch \(error\)/)
  assert.match(service, /serializeAvaLaunchRunException/)
  assert.match(service, /exception\?:/)
  assert.match(route, /buildGrowthMissionAvaLaunchExceptionFailureBody/)

  const serialized = serializeAvaLaunchRunException(new Error("TEST_EXCEPTION"))
  assert.equal(serialized.name, "Error")
  assert.equal(serialized.message, "TEST_EXCEPTION")
  assert.ok(serialized.stack)

  assert.match(service, /shouldThrowAvaLaunchRootCauseTestException/)
  assert.match(service, /buildAvaLaunchRootCauseTestException/)

  process.env[GE_AVA_LAUNCH_ROOTCAUSE_1_TEST_THROW_ENV] = "1"
  try {
    const { runGrowthMissionAvaLaunchRun } = await import(
      "../lib/growth/mission-center/growth-mission-ava-launch-run-service"
    )
    const result = await runGrowthMissionAvaLaunchRun({} as never, {
      organizationId: "org-test",
      missionId: "mission-test",
      audienceDraft: {
        audienceName: "Test audience",
        audienceType: "advanced_search",
        providerMode: "module",
        recordLimit: 100,
        lookbackDays: 7,
        intentLevels: [],
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
      },
      searchSummary: "Find Leads search",
      approvedByUser: true,
      actor: { userId: null },
    })

    assert.equal(result.ok, false)
    if (result.ok) throw new Error("expected failure")
    assert.equal(result.error, "validation_failed")
    assert.equal(result.exception?.message, "TEST_EXCEPTION")
    assert.equal(result.exception?.name, "Error")

    const apiBody = buildGrowthMissionAvaLaunchExceptionFailureBody({
      error: result.error,
      exception: result.exception!,
      runId: result.runId ?? null,
    })
    assert.equal(apiBody.exception.message, "TEST_EXCEPTION")
    assert.equal(apiBody.validationErrors[0]?.message, "TEST_EXCEPTION")
    assert.equal(apiBody.validationErrors[0]?.validator, "runGrowthMissionAvaLaunchRun")
    assert.doesNotMatch(apiBody.validationErrors[0]?.message ?? "", /Validation failed/)

    const uiMessage = formatGrowthAvaLaunchValidationErrorsForUi(apiBody.validationErrors)
    assert.match(uiMessage, /TEST_EXCEPTION/)
    assert.doesNotMatch(uiMessage, /Validation failed/)

    console.log(`[${PHASE}] API response body`)
    console.log(JSON.stringify(apiBody, null, 2))
  } finally {
    delete process.env[GE_AVA_LAUNCH_ROOTCAUSE_1_TEST_THROW_ENV]
  }

  console.log(`[${PHASE}] passed`)
}

void main()
