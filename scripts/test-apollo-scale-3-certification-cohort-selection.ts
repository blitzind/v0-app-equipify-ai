/**
 * Apollo Scale-3 certification cohort selection regression checks.
 * Run: pnpm test:apollo-scale-3-certification-cohort-selection
 */
import assert from "node:assert/strict"
import {
  APOLLO_SCALE_3_CERTIFICATION_WINNER_COMPANY_NAMES,
  dedupeApolloScale3CompanyNames,
  normalizeApolloScale3CompanyName,
} from "../lib/growth/apollo/apollo-scale-3-certification-cohort-selection"
import {
  assertApolloScale3ProductionExecuteAllowed,
  validateApolloScale3Confirmation,
  APOLLO_SCALE_3_EXECUTE_CONFIRM,
} from "../lib/growth/apollo/apollo-scale-3-production-route-gates"

function testDuplicateCompanyNamesDeduped(): void {
  const { unique, deduped_count } = dedupeApolloScale3CompanyNames([
    "Stat Biomedical Technicians, Inc.",
    "stat biomedical technicians inc",
    "Biomedical Fix Solutions",
    "Biomedical Fix Solutions",
  ])
  assert.equal(unique.length, 2)
  assert.equal(deduped_count, 2)
  assert.equal(unique[0], "Stat Biomedical Technicians, Inc.")
  assert.equal(unique[1], "Biomedical Fix Solutions")
}

function testForcedCompanyNamesParsedFromExecuteBody(): void {
  const parsed = validateApolloScale3Confirmation({
    confirm: APOLLO_SCALE_3_EXECUTE_CONFIRM,
    company_names: [
      "Stat Biomedical Technicians, Inc.",
      "Sterling Biomedical",
      "Vanguard Medical LLC",
    ],
  })
  assert.equal(parsed.ok, true)
  assert.deepEqual(parsed.company_names, [
    "Stat Biomedical Technicians, Inc.",
    "Sterling Biomedical",
    "Vanguard Medical LLC",
  ])
}

function testCohortPresetParsed(): void {
  const parsed = validateApolloScale3Confirmation({
    confirm: APOLLO_SCALE_3_EXECUTE_CONFIRM,
    cohort_preset: "certification_winners",
  })
  assert.equal(parsed.ok, true)
  assert.equal(parsed.cohort_preset, "certification_winners")
}

function testCompanyNamesAndIdsMutuallyExclusive(): void {
  const parsed = validateApolloScale3Confirmation({
    confirm: APOLLO_SCALE_3_EXECUTE_CONFIRM,
    company_names: ["Stat Biomedical Technicians, Inc."],
    company_candidate_ids: ["company-1"],
  })
  assert.equal(parsed.ok, false)
  assert.match(parsed.error ?? "", /either company_names or company_candidate_ids/)
}

function testForcedCohortCannotBypassEnvGates(): void {
  const gates = assertApolloScale3ProductionExecuteAllowed({
    GROWTH_APOLLO_SCALE_3_ENABLED: "false",
    GROWTH_APOLLO_SCALE_3_ACK: "0",
    GROWTH_APOLLO_SCALE_2_ENABLED: "false",
    GROWTH_APOLLO_SCALE_2_ACK: "0",
    APOLLO_API_KEY: "test-key",
    GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED: "true",
  } as NodeJS.ProcessEnv)
  assert.equal(gates.ok, false)
  assert.ok(gates.blockers.some((blocker) => blocker.includes("GROWTH_APOLLO_SCALE_3_ENABLED")))
}

function testDeterministicNameNormalizationStable(): void {
  const a = normalizeApolloScale3CompanyName("Stat Biomedical Technicians, Inc.")
  const b = normalizeApolloScale3CompanyName("STAT   Biomedical   Technicians Inc")
  assert.equal(a, b)
}

function testCertificationWinnerPresetIncludesPriorYieldCompanies(): void {
  assert.equal(APOLLO_SCALE_3_CERTIFICATION_WINNER_COMPANY_NAMES.length, 5)
  assert.ok(
    APOLLO_SCALE_3_CERTIFICATION_WINNER_COMPANY_NAMES.includes("Stat Biomedical Technicians, Inc."),
  )
  assert.ok(APOLLO_SCALE_3_CERTIFICATION_WINNER_COMPANY_NAMES.includes("Pulse Biomedical Service"))
}

function main(): void {
  testDuplicateCompanyNamesDeduped()
  console.log("  ✓ duplicate company names deduped")
  testForcedCompanyNamesParsedFromExecuteBody()
  console.log("  ✓ forced company_names parsed from execute body")
  testCohortPresetParsed()
  console.log("  ✓ cohort_preset certification_winners parsed")
  testCompanyNamesAndIdsMutuallyExclusive()
  console.log("  ✓ company_names and company_candidate_ids are mutually exclusive")
  testForcedCohortCannotBypassEnvGates()
  console.log("  ✓ forced cohort cannot bypass auth/env gates")
  testDeterministicNameNormalizationStable()
  console.log("  ✓ deterministic name normalization stable across reruns")
  testCertificationWinnerPresetIncludesPriorYieldCompanies()
  console.log("  ✓ certification winner preset includes prior yield companies")
  console.log("\nApollo Scale-3 certification cohort selection checks passed.")
}

main()
