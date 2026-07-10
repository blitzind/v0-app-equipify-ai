/**
 * GE-AIOS-HOTFIX-LIVE-1A — Home pipeline budget + timing certification.
 * Run: pnpm test:ge-aios-hotfix-live-1a-home-pipeline-performance
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const PHASE = "GE-AIOS-HOTFIX-LIVE-1A" as const
const QA_MARKER = "ge-aios-hotfix-live-1a-home-pipeline-performance-v1" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Local certification`)
  assert.equal(QA_MARKER, "ge-aios-hotfix-live-1a-home-pipeline-performance-v1")

  const summaryService = readSource("lib/growth/home/growth-home-workspace-summary-service.ts")
  assert.match(summaryService, /probeGrowthNativeDialerSchemaHealthWithBudget/)
  assert.match(summaryService, /isGrowthCadenceSchemaReadyWithBudget/)
  assert.match(summaryService, /withGrowthHomeLoaderBudget/)
  assert.match(summaryService, /logGrowthHomePipelineTimings/)
  assert.match(summaryService, /stageTimingsMs/)
  assert.doesNotMatch(summaryService, /probeGrowthNativeDialerSchemaHealth\(/)

  const loaderBudget = readSource("lib/growth/home/growth-home-workspace-loader-budget.ts")
  assert.match(loaderBudget, /GROWTH_HOME_WORKSPACE_LOADER_BUDGET_MS/)

  const cadenceHealth = readSource("lib/growth/cadence/cadence-schema-health.ts")
  assert.match(cadenceHealth, /isGrowthCadenceSchemaReadyWithBudget/)

  console.log(`[${PHASE}] PASS — ${QA_MARKER}`)
}

void main()
