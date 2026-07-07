/**
 * GE-AVA-PERSISTENCE-1 — Outreach preparation pilot durable storage certification.
 * Run: pnpm test:ge-ava-persistence-1
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AVA_OUTREACH_PREPARATION_PILOT_RUNS_TABLE,
  GROWTH_AVA_OUTREACH_PREPARATION_PILOT_RUN_RETENTION_LIMIT,
  GROWTH_AVA_OUTREACH_PREPARATION_PILOT_STATE_TABLE,
  GROWTH_AVA_PERSISTENCE_1_QA_MARKER,
} from "../lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-persistence-types"

const PHASE = "GE-AVA-PERSISTENCE-1" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Outreach preparation pilot persistence certification`)

  assert.equal(GROWTH_AVA_PERSISTENCE_1_QA_MARKER, "ge-ava-persistence-1-v1")
  assert.equal(GROWTH_AVA_OUTREACH_PREPARATION_PILOT_STATE_TABLE, "autonomous_outreach_preparation_pilot_states")
  assert.equal(GROWTH_AVA_OUTREACH_PREPARATION_PILOT_RUNS_TABLE, "autonomous_outreach_preparation_runs")
  assert.equal(GROWTH_AVA_OUTREACH_PREPARATION_PILOT_RUN_RETENTION_LIMIT, 500)

  const migration = readSource(
    "supabase/migrations/20271002140000_ge_ava_persistence_1_outreach_preparation_pilot.sql",
  )
  assert.match(migration, /autonomous_outreach_preparation_pilot_states/)
  assert.match(migration, /autonomous_outreach_preparation_runs/)
  assert.match(migration, /approval_package jsonb/)
  assert.match(migration, /ge-ava-persistence-1-v1/)
  assert.match(migration, /service_role/)

  const repository = readSource(
    "lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-repository.ts",
  )
  assert.match(repository, /listOutreachPreparationPilotRuns/)
  assert.match(repository, /insertOutreachPreparationPilotRun/)
  assert.match(repository, /findOutreachPreparationRunByPackageId/)
  assert.match(repository, /markOutreachPreparationPackageApprovalDecision/)
  assert.match(repository, /pruneOutreachPreparationPilotRuns/)
  assert.doesNotMatch(repository, /orgStateById|new Map/)

  const store = readSource("lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-store.ts")
  assert.match(store, /GE-AVA-PERSISTENCE-1/)
  assert.match(store, /findAutonomousOutreachPreparationRunByPackageId/)
  assert.match(store, /markAutonomousOutreachPackageApprovalDecision/)
  assert.doesNotMatch(store, /orgStateById|new Map/)

  const executionRequest = readSource(
    "lib/growth/mission-center/growth-ava-outreach-execution-request-service.ts",
  )
  assert.match(executionRequest, /await findAutonomousOutreachPreparationRunByPackageId/)
  assert.match(executionRequest, /await markAutonomousOutreachPackageApprovalDecision/)

  const pilotService = readSource(
    "lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-service.ts",
  )
  assert.match(pilotService, /await getAutonomousOutreachPreparationPilotOrgState/)
  assert.match(pilotService, /await appendAutonomousOutreachPreparationRun/)

  const types = readSource("lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types.ts")
  assert.match(types, /GrowthAutonomousOutreachApprovalPackage/)
  assert.doesNotMatch(types, /GE-AVA-PERSISTENCE/)

  console.log(`[${PHASE}] passed`)
}

void main()
