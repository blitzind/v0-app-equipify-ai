/**
 * Phase 7.PCA-3 — Apollo guardrails, diagnostics, title buckets, benchmark report.
 * Run: pnpm test:growth-contact-acquisition-apollo-7-pca-3
 */
import assert from "node:assert/strict"
import {
  assertApolloLiveBenchmarkAllowed,
  diagnoseApolloContactDiscoveryConfig,
} from "../lib/growth/providers/apollo/apollo-config-diagnostics"
import { resolveApolloCreditLimits } from "../lib/growth/providers/apollo/apollo-config"
import {
  beginApolloRunGuardrails,
  recordApolloSearchApiCall,
  resetApolloRunGuardrails,
  getApolloRunGuardrailSnapshot,
  ApolloRunGuardrailError,
  assertApolloCompanySearchAllowed,
} from "../lib/growth/providers/apollo/apollo-run-guardrails"
import {
  classifyApolloContactTitleBucket,
  isApolloIrrelevantTitleForIcp,
  tallyApolloTitleBuckets,
} from "../lib/growth/providers/apollo/apollo-title-buckets"
import { mapApolloPeopleToContactDiscoveryRaw } from "../lib/growth/providers/apollo/map-apollo-contact"
import { buildApolloBenchmarkReport } from "../lib/growth/benchmark/growth-contact-acquisition-apollo-benchmark-report"
import { GROWTH_APOLLO_PERSON_TITLES } from "../lib/growth/providers/apollo/apollo-query-builder"

async function main() {
  console.log("Phase 7.PCA-3 Apollo benchmark guardrails tests\n")

  const limits = resolveApolloCreditLimits({
    GROWTH_APOLLO_MAX_COMPANIES_PER_RUN: "54",
    GROWTH_APOLLO_MAX_API_CALLS_PER_RUN: "60",
    GROWTH_APOLLO_MAX_CONTACTS_PER_COMPANY: "25",
  })
  assert.equal(limits.max_companies_per_run, 54)
  assert.equal(limits.max_api_calls_per_run, 60)
  assert.equal(limits.max_contacts_per_company, 25)

  assert.equal(classifyApolloContactTitleBucket("CEO"), "owner_founder_president_ceo")
  assert.equal(classifyApolloContactTitleBucket("Field Service Manager"), "service_field_service_manager")
  assert.equal(classifyApolloContactTitleBucket("Account Executive"), "sales_marketing_admin_irrelevant")
  assert.equal(isApolloIrrelevantTitleForIcp("Marketing Director"), true)
  assert.equal(isApolloIrrelevantTitleForIcp("Director of Operations"), false)

  const buckets = tallyApolloTitleBuckets(["CEO", "Sales Rep", "Biomed Manager"])
  assert.equal(buckets.owner_founder_president_ceo, 1)
  assert.equal(buckets.sales_marketing_admin_irrelevant, 1)
  assert.equal(buckets.biomedical_equipment_facilities_maintenance, 1)

  assert.ok(!GROWTH_APOLLO_PERSON_TITLES.includes("operations" as never))
  assert.ok(!GROWTH_APOLLO_PERSON_TITLES.includes("biomedical" as never))

  const diagBlocked = diagnoseApolloContactDiscoveryConfig({
    GROWTH_DISCOVERY_DISABLE_APOLLO: "1",
    GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED: "true",
    APOLLO_API_KEY: "key",
    GROWTH_APOLLO_USE_MOCK: "false",
  })
  assert.equal(diagBlocked.ready_for_live_benchmark, false)
  assert.ok(diagBlocked.issues.some((i) => i.code === "apollo_discovery_disabled"))

  const gate = assertApolloLiveBenchmarkAllowed({
    GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED: "true",
    APOLLO_API_KEY: "key",
    GROWTH_APOLLO_USE_MOCK: "false",
    GROWTH_APOLLO_ENRICH_EMAILS: "false",
    GROWTH_APOLLO_LIVE_BENCHMARK_ACK: "1",
  })
  assert.equal(gate.ok, true)

  const gateNoAck = assertApolloLiveBenchmarkAllowed({
    GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED: "true",
    APOLLO_API_KEY: "key",
    GROWTH_APOLLO_USE_MOCK: "false",
    GROWTH_APOLLO_LIVE_BENCHMARK_ACK: "0",
  })
  assert.equal(gateNoAck.ok, false)

  beginApolloRunGuardrails()
  recordApolloSearchApiCall()
  const snap = getApolloRunGuardrailSnapshot()
  assert.equal(snap?.search_api_calls, 1)
  assert.equal(snap?.credits_estimate, 0)
  resetApolloRunGuardrails()

  beginApolloRunGuardrails()
  for (let i = 0; i < 60; i += 1) recordApolloSearchApiCall()
  assert.throws(() => assertApolloCompanySearchAllowed(), ApolloRunGuardrailError)
  resetApolloRunGuardrails()

  const skippedIrrelevant = mapApolloPeopleToContactDiscoveryRaw({
    people: [
      {
        id: "p1",
        name: "Jane Doe",
        title: "Account Executive",
        email: "jane@example.com",
        email_status: "verified",
      },
    ],
    company_name: "Acme",
    domain: "acme.com",
    mock: true,
  })
  assert.equal(skippedIrrelevant.contacts.length, 0)
  assert.ok((skippedIrrelevant.diagnostics.skip_reasons.irrelevant_title ?? 0) >= 1)

  const report = buildApolloBenchmarkReport({
    mock: true,
    mode: "dry_run",
    config_diagnostics: null,
    contacts_per_company: [2, 0, 4],
    title_buckets: buckets,
    raw_contacts_returned: 10,
    contacts_mapped: 6,
    contacts_skipped: 4,
    apollo_api_calls: 3,
    credits_consumed_estimate: 0,
    enrich_emails: false,
    rate_limit_events: 0,
    errors: [],
    metrics_before: null,
    metrics_after: null,
  })
  assert.equal(report.search_only_credits_confirmed_zero, true)
  assert.equal(report.distribution.median_contacts_per_company, 2)
  assert.equal(report.enablement_recommendation, "benchmark_only")

  console.log("All Phase 7.PCA-3 Apollo checks passed.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
