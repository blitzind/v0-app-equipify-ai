/**
 * Phase 7.PCA-2 — Apollo contact discovery provider regression checks.
 * Run: pnpm test:growth-contact-acquisition-apollo-7-pca-2
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { normalizeContactCandidate } from "../lib/growth/contact-discovery/contact-normalizer"
import { resolveOperatorContactDiscoveryProviderTypes } from "../lib/growth/contact-discovery/contact-discovery-operator-providers"
import { createApolloContactDiscoveryProvider } from "../lib/growth/contact-discovery/providers/apollo-contact-discovery-provider"
import { mapApolloPeopleToContactDiscoveryRaw } from "../lib/growth/providers/apollo/map-apollo-contact"
import { buildApolloMockPeople } from "../lib/growth/providers/apollo/apollo-mock-fixtures"
import { shouldMaterializeCanonicalPerson } from "../lib/growth/human-identity-evidence/contact-identity-classification"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

async function main() {
  console.log("Phase 7.PCA-2 Apollo provider tests\n")

  const priorEnv = { ...process.env }
  process.env.GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED = "false"
  process.env.APOLLO_API_KEY = ""
  process.env.GROWTH_APOLLO_USE_MOCK = "false"

  const disabledProvider = createApolloContactDiscoveryProvider()
  assert.equal(disabledProvider.isConfigured(), false)
  const skipped = await disabledProvider.discover({
    company_candidate_id: "co-1",
    company_name: "Acme Medical",
    domain: "acme.com",
    website_url: "https://acme.com",
    growth_lead_id: null,
    industry: "Healthcare",
  })
  assert.equal(skipped.status, "skipped")
  assert.equal(skipped.contacts.length, 0)

  const providerSource = readSource("lib/growth/contact-discovery/providers/apollo-contact-discovery-provider.ts")
  assert.ok(!providerSource.includes("company_contacts"))
  assert.ok(!providerSource.includes("upsertProviderCompanyContacts"))
  assert.ok(!providerSource.includes("verifyCompanyContact"))

  process.env.GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED = "true"
  process.env.GROWTH_APOLLO_USE_MOCK = "true"
  process.env.APOLLO_API_KEY = ""

  const mockProvider = createApolloContactDiscoveryProvider()
  assert.equal(mockProvider.isConfigured(), true)
  assert.equal(mockProvider.provider_name, "apollo")
  assert.equal(mockProvider.provider_type, "future_apollo")

  const mockResult = await mockProvider.discover({
    company_candidate_id: "co-1",
    company_name: "Acme Medical",
    domain: "acme.com",
    website_url: "https://acme.com",
    growth_lead_id: null,
    industry: "Healthcare",
    limit: 10,
  })
  assert.equal(mockResult.status, "success")
  assert.ok(mockResult.contacts.length >= 1)

  const withEmail = mockResult.contacts.find((c) => c.email)
  assert.ok(withEmail)
  assert.equal(withEmail.pii_observed, true)
  assert.ok(withEmail.external_provider_contact_id || withEmail.metadata?.apollo_person_id)

  const withLinkedInOnly = mockResult.contacts.find((c) => c.linkedin_url && !c.email)
  if (withLinkedInOnly) {
    assert.equal(withLinkedInOnly.pii_observed, true)
  }

  const mapped = mapApolloPeopleToContactDiscoveryRaw({
    people: buildApolloMockPeople({ company_name: "Acme", domain: "acme.com", limit: 3 }),
    company_name: "Acme",
    domain: "acme.com",
    mock: true,
  })
  assert.ok(mapped.diagnostics.contacts_skipped >= 1, "generic Customer Service fixture should be skipped")
  assert.ok(mapped.contacts.length >= 1)

  const normalized = normalizeContactCandidate(
    mapped.contacts[0]!,
    "apollo",
    "future_apollo",
    "candidate-1",
  )
  assert.ok(normalized)
  assert.equal(normalized.identity_classification, "named_person")
  assert.equal(normalized.metadata.eligible_for_canonical_person, true)
  assert.equal(shouldMaterializeCanonicalPerson({ full_name: "Customer Service", email: "support@acme.com" }), false)

  const operatorTypes = resolveOperatorContactDiscoveryProviderTypes()
  assert.ok(operatorTypes.includes("future_apollo"))

  process.env.GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED = "false"
  const operatorTypesDisabled = resolveOperatorContactDiscoveryProviderTypes()
  assert.ok(!operatorTypesDisabled.includes("future_apollo"))

  process.env.GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED = "true"
  process.env.GROWTH_APOLLO_USE_MOCK = "true"
  assert.equal(createApolloContactDiscoveryProvider().provider_name, "apollo")

  const benchmarkSource = readSource("scripts/benchmark-growth-contact-acquisition-apollo-7-pca-2.ts")
  assert.ok(benchmarkSource.includes("dry_run"))
  assert.ok(benchmarkSource.includes("GROWTH_APOLLO_USE_MOCK"))

  Object.assign(process.env, priorEnv)

  console.log("All Phase 7.PCA-2 Apollo provider checks passed.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
