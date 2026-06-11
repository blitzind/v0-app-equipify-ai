/**
 * Apollo single-company search diagnostic route gates.
 * Run: pnpm test:apollo-single-company-search-diagnostic-route
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  APOLLO_SINGLE_COMPANY_SEARCH_DIAGNOSTIC_EXECUTE_CONFIRM,
  APOLLO_SCALE_3_RECOMMENDED_MAX_API_CALLS_PER_RUN,
  assertApolloSingleCompanySearchDiagnosticExecuteAllowed,
  buildApolloSingleCompanySearchDiagnosticReadinessPayload,
  validateApolloSingleCompanySearchDiagnosticConfirmation,
} from "../lib/growth/apollo/apollo-single-company-search-diagnostic-gates"

function testConfirmationRequiresCompany(): void {
  const missing = validateApolloSingleCompanySearchDiagnosticConfirmation({
    confirm: APOLLO_SINGLE_COMPANY_SEARCH_DIAGNOSTIC_EXECUTE_CONFIRM,
  })
  assert.equal(missing.ok, false)

  const byName = validateApolloSingleCompanySearchDiagnosticConfirmation({
    confirm: APOLLO_SINGLE_COMPANY_SEARCH_DIAGNOSTIC_EXECUTE_CONFIRM,
    company_name: "Stat Biomedical Technicians, Inc.",
    include_domain_aliases: true,
  })
  assert.equal(byName.ok, true)
  assert.equal(byName.company_name, "Stat Biomedical Technicians, Inc.")
  assert.equal(byName.include_domain_aliases, true)
}

function testReadinessIncludesBudgetRecommendation(): void {
  const payload = buildApolloSingleCompanySearchDiagnosticReadinessPayload({
    env: {
      VERCEL_ENV: "production",
      GROWTH_APOLLO_SINGLE_COMPANY_SEARCH_DIAGNOSTIC_ACK: "1",
      GROWTH_APOLLO_LIVE_BENCHMARK_ACK: "1",
      GROWTH_APOLLO_USE_MOCK: "false",
      GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED: "true",
      APOLLO_API_KEY: "test-key",
      GROWTH_APOLLO_MAX_API_CALLS_PER_RUN: "60",
    } as NodeJS.ProcessEnv,
  })

  assert.equal(payload.recommended_scale_3_max_api_calls_per_run, APOLLO_SCALE_3_RECOMMENDED_MAX_API_CALLS_PER_RUN)
  assert.equal(APOLLO_SCALE_3_RECOMMENDED_MAX_API_CALLS_PER_RUN, 90)
}

function testProductionGates(): void {
  const blocked = assertApolloSingleCompanySearchDiagnosticExecuteAllowed({
    VERCEL_ENV: "preview",
    GROWTH_APOLLO_SINGLE_COMPANY_SEARCH_DIAGNOSTIC_ACK: "1",
    GROWTH_APOLLO_LIVE_BENCHMARK_ACK: "1",
    GROWTH_APOLLO_USE_MOCK: "false",
    GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED: "true",
    APOLLO_API_KEY: "test-key",
  } as NodeJS.ProcessEnv)
  assert.equal(blocked.ok, false)
}

function testRoutesExist(): void {
  const readiness = readFileSync(
    resolve(process.cwd(), "app/api/platform/growth/apollo-single-company-search/readiness/route.ts"),
    "utf8",
  )
  const execute = readFileSync(
    resolve(process.cwd(), "app/api/platform/growth/apollo-single-company-search/execute/route.ts"),
    "utf8",
  )
  assert.match(readiness, /buildApolloSingleCompanySearchDiagnosticReadiness/)
  assert.match(execute, /executeApolloSingleCompanySearchDiagnostic/)
}

function main(): void {
  testConfirmationRequiresCompany()
  console.log("  ✓ confirmation requires company id or name")
  testReadinessIncludesBudgetRecommendation()
  console.log("  ✓ readiness includes Scale-3 API budget recommendation")
  testProductionGates()
  console.log("  ✓ production-only gates enforced")
  testRoutesExist()
  console.log("  ✓ diagnostic routes wired")
  console.log("\nApollo single-company search diagnostic route checks passed.")
}

main()
