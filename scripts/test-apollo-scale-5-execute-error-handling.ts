/**
 * Apollo-Scale-5 execute error handling — enrichment throw returns JSON failure shape.
 * Run: pnpm test:apollo-scale-5-execute-error-handling
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  ApolloScale5StageError,
  formatApolloScale5ExecutionFailure,
  runApolloScale5ExecutionStage,
  shouldIncludeApolloScale5ExecutionStack,
} from "../lib/growth/apollo/apollo-scale-5-execution-errors"
import { enrichApolloCandidatesNeedingEmail } from "../lib/growth/apollo/apollo-candidate-email-enrichment"

function testStructuredFailurePayload(): void {
  const failure = formatApolloScale5ExecutionFailure({
    execution_id: "exec-test-1",
    stage: "apollo_bulk_match_enrichment",
    error: "execution_failed",
    message: "bulk_match network failure",
    company: {
      company_name: "Medical Equipment Solutions",
      domain: "medicalequipmentsolutions.com",
      company_candidate_id: "mes-id",
    },
    blockers: ["bulk_match network failure"],
    cause: new Error("bulk_match network failure"),
    env: { NODE_ENV: "production", VERCEL_ENV: "production" } as NodeJS.ProcessEnv,
  })

  assert.equal(failure.ok, false)
  assert.equal(failure.execution_id, "exec-test-1")
  assert.equal(failure.stage, "apollo_bulk_match_enrichment")
  assert.equal(failure.error, "execution_failed")
  assert.equal(failure.message, "bulk_match network failure")
  assert.equal(failure.company?.company_candidate_id, "mes-id")
  assert.equal(failure.verdict, null)
  assert.equal(failure.certification, null)
  assert.equal(failure.stack, undefined)
}

function testStackIncludedOutsideProduction(): void {
  assert.equal(
    shouldIncludeApolloScale5ExecutionStack({
      NODE_ENV: "development",
      VERCEL_ENV: "preview",
    } as NodeJS.ProcessEnv),
    true,
  )

  const failure = formatApolloScale5ExecutionFailure({
    execution_id: "exec-test-2",
    stage: "apollo_bulk_match_enrichment",
    error: "execution_failed",
    message: "simulated",
    company: null,
    cause: new Error("simulated"),
    env: { NODE_ENV: "development", VERCEL_ENV: "preview" } as NodeJS.ProcessEnv,
  })
  assert.match(failure.stack ?? "", /simulated/)
}

async function testRunApolloScale5ExecutionStageCapturesThrow(): Promise<void> {
  const result = await runApolloScale5ExecutionStage({
    stage: "apollo_bulk_match_enrichment",
    run: async () => {
      throw new ApolloScale5StageError("apollo_bulk_match_enrichment", "forced enrichment failure")
    },
  })

  assert.equal(result.ok, false)
  if (result.ok) throw new Error("expected stage failure")
  assert.equal(result.stage, "apollo_bulk_match_enrichment")
  assert.match(result.message, /forced enrichment failure/)
}

async function testEnrichmentFailureReturnsEvidenceInsteadOfThrowing(): Promise<void> {
  const enrichmentSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/apollo/apollo-candidate-email-enrichment.ts"),
    "utf8",
  )
  assert.match(enrichmentSource, /enrichApolloPeopleWithBulkMatch\(/)
  assert.match(enrichmentSource, /catch \(error\)/)
  assert.match(enrichmentSource, /apollo_bulk_match_failed/)

  const admin = { schema: () => ({ from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ limit: async () => ({ data: [], error: null }) }) }) }) }) }) }
  const blocked = await enrichApolloCandidatesNeedingEmail(admin as never, {
    company_candidate_id: "mes-company",
    domain: "medicalequipmentsolutions.com",
    max_people: 5,
    env: { GROWTH_APOLLO_ENRICH_EMAILS: "false" } as NodeJS.ProcessEnv,
  })
  assert.equal(blocked.skipped_reason, "enrichment_gates_blocked")
  assert.equal(blocked.error, null)
}

function testExecuteRouteHasJsonFailureGuards(): void {
  const route = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/apollo-scale-5/execute/route.ts"),
    "utf8",
  )
  assert.match(route, /try \{/)
  assert.match(route, /catch \(error\)/)
  assert.match(route, /jsonResponse/)
  assert.match(route, /formatApolloScale5ExecutionFailure/)
  assert.match(route, /stage:/)
  assert.match(route, /execution_id/)
  assert.doesNotMatch(route, /confirmGrowthSequenceEnrollment|runSequenceExecutionJob|sendOutreach/)
}

async function main(): Promise<void> {
  testStructuredFailurePayload()
  console.log("  ✓ structured failure payload includes ok/stage/error/execution_id/company")
  testStackIncludedOutsideProduction()
  console.log("  ✓ stack included only outside production")
  await testRunApolloScale5ExecutionStageCapturesThrow()
  console.log("  ✓ stage runner captures enrichment throw")
  await testEnrichmentFailureReturnsEvidenceInsteadOfThrowing()
  console.log("  ✓ enrichApolloCandidatesNeedingEmail catches bulk_match failures as evidence")
  testExecuteRouteHasJsonFailureGuards()
  console.log("  ✓ execute route catches failures and returns JSON")
  console.log("\nApollo-Scale-5 execute error handling checks passed.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
