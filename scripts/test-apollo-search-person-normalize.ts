/**
 * Apollo /mixed_people/api_search person normalize + mapper regression checks.
 * Run: pnpm test:apollo-search-person-normalize
 */
import assert from "node:assert/strict"
import {
  APOLLO_SEARCH_PERSON_NORMALIZE_QA_MARKER,
  buildApolloRedactedRawFieldDiagnostics,
  normalizeApolloSearchPeople,
  normalizeApolloSearchPersonRecord,
} from "../lib/growth/providers/apollo/apollo-search-person-normalize"
import {
  buildApolloApiSearchRawFixtures,
  buildApolloHenryScheinSearchPerson,
} from "../lib/growth/providers/apollo/apollo-api-search-fixtures"
import { mapApolloPeopleToContactDiscoveryRaw } from "../lib/growth/providers/apollo/map-apollo-contact"

function main(): void {
  console.log("Apollo api_search normalize + mapper tests\n")

  assert.equal(APOLLO_SEARCH_PERSON_NORMALIZE_QA_MARKER, "apollo-search-person-normalize-v1")

  const obfuscatedRaw = buildApolloApiSearchRawFixtures()[0]!
  const obfuscated = normalizeApolloSearchPersonRecord(obfuscatedRaw)
  assert.equal(obfuscated.first_name, "Carrie")
  assert.equal(obfuscated.last_name, "Ki***g")
  assert.equal(obfuscated.last_name_obfuscated, "Ki***g")
  assert.equal(obfuscated.name, "Carrie Ki***g")
  assert.equal(obfuscated.apollo_name_fields?.last_name_source, "last_name_obfuscated")
  assert.ok(obfuscated.apollo_search_field_diagnostics)
  assert.deepEqual(obfuscated.apollo_search_field_diagnostics?.available_name_keys, [
    "first_name",
    "last_name_obfuscated",
  ])
  assert.equal(obfuscated.apollo_search_field_diagnostics?.first_name_present, true)
  assert.equal(obfuscated.apollo_search_field_diagnostics?.last_name_obfuscated_present, true)
  assert.equal(obfuscated.apollo_search_field_diagnostics?.full_name_present, true)
  assert.equal(obfuscated.apollo_search_field_diagnostics?.organization_domain, "henryschein.com")

  const obfuscatedInLastNameField = normalizeApolloSearchPersonRecord({
    id: "nested-obfuscated-last-name",
    first_name: "Carrie",
    last_name: "Ki***g",
    title: "Executive Vice President, Chief Operating Officer",
    organization: { primary_domain: "henryschein.com" },
  })
  assert.equal(obfuscatedInLastNameField.last_name, "Ki***g")
  assert.equal(obfuscatedInLastNameField.apollo_name_fields?.last_name_source, "last_name_obfuscated")
  assert.equal(obfuscatedInLastNameField.name, "Carrie Ki***g")

  const nestedPerson = normalizeApolloSearchPersonRecord({
    id: "nested-person-wrapper",
    person: {
      first_name: "Jane",
      last_name: "Smith",
      title: "Chief Executive Officer",
    },
    organization: { primary_domain: "henryschein.com" },
  })
  assert.equal(nestedPerson.first_name, "Jane")
  assert.equal(nestedPerson.last_name, "Smith")
  assert.equal(nestedPerson.apollo_name_fields?.last_name_source, "last_name")

  const fullNameRaw = buildApolloApiSearchRawFixtures()[2]!
  const fullName = normalizeApolloSearchPersonRecord(fullNameRaw)
  assert.equal(fullName.name, "Jane Smith")
  assert.equal(fullName.apollo_name_fields?.last_name_source, "last_name")

  const oneToken = normalizeApolloSearchPersonRecord(buildApolloApiSearchRawFixtures()[1]!)
  assert.equal(oneToken.first_name, "Support")
  assert.equal(oneToken.last_name, null)
  assert.equal(oneToken.name, "Support")

  const mappedFromRaw = mapApolloPeopleToContactDiscoveryRaw({
    people: normalizeApolloSearchPeople(buildApolloApiSearchRawFixtures()),
    company_name: "Henry Schein",
    domain: "henryschein.com",
    mock: false,
  })
  assert.equal(mappedFromRaw.apollo_people_returned, 3)
  assert.equal(mappedFromRaw.diagnostics.contacts_mapped, 2)
  assert.equal(mappedFromRaw.diagnostics.skip_reasons.name_not_plausible, 1)
  const henryMapped = mappedFromRaw.contacts.find((contact) => contact.full_name.includes("*"))
  assert.ok(henryMapped)
  assert.match(henryMapped!.full_name, /Carrie Ki\*\*\*g/)

  const rejected = mappedFromRaw.rejected_sample
  assert.ok(rejected)
  assert.equal(rejected.rejection_reason, "name_not_plausible")
  assert.equal(rejected.raw_first_name_present, true)
  assert.equal(rejected.raw_last_name_present, false)
  assert.ok(rejected.available_name_keys.includes("first_name"))
  assert.ok(rejected.available_person_keys.includes("first_name"))
  assert.ok(rejected.available_person_keys.includes("title"))

  const henryPerson = buildApolloHenryScheinSearchPerson()
  const henryOnly = mapApolloPeopleToContactDiscoveryRaw({
    people: [henryPerson],
    company_name: "Henry Schein",
    domain: "henryschein.com",
    mock: false,
  })
  assert.equal(henryOnly.contacts.length, 1)
  assert.equal(henryOnly.diagnostics.skip_reasons.name_not_plausible ?? 0, 0)

  const diagnostics = buildApolloRedactedRawFieldDiagnostics({
    raw: obfuscatedRaw as Record<string, unknown>,
    person: obfuscated,
  })
  assert.equal(diagnostics.person_id_present, true)
  assert.equal(diagnostics.title, "Executive Vice President, Chief Operating Officer")
  assert.ok(!JSON.stringify(diagnostics).includes("@"))

  console.log("All Apollo api_search normalize + mapper checks passed.")
}

main()
