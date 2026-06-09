/** Apollo /mixed_people/api_search raw fixtures — client-safe test data. */

import type { ApolloPersonRecord } from "@/lib/growth/providers/apollo/apollo-types"
import {
  normalizeApolloSearchPersonRecord,
  normalizeApolloSearchPeople,
} from "@/lib/growth/providers/apollo/apollo-search-person-normalize"

export const APOLLO_API_SEARCH_FIXTURES_QA_MARKER = "apollo-api-search-fixtures-v1" as const

export function buildApolloApiSearchRawFixtures(): Record<string, unknown>[] {
  return [
    {
      id: "apollo-search-hs-evp",
      first_name: "Carrie",
      last_name_obfuscated: "Ki***g",
      title: "Executive Vice President, Chief Operating Officer",
      seniority: "c_suite",
      organization: {
        name: "Henry Schein",
        primary_domain: "henryschein.com",
      },
      has_email: false,
      has_direct_phone: "Yes",
    },
    {
      id: "apollo-search-one-token",
      first_name: "Support",
      title: "Help Desk",
      organization: {
        name: "Henry Schein",
        primary_domain: "henryschein.com",
      },
    },
    {
      id: "apollo-search-full-name",
      first_name: "Jane",
      last_name: "Smith",
      name: "Jane Smith",
      title: "Chief Executive Officer",
      email: "jane.smith@henryschein.com",
      email_status: "verified",
      organization: {
        name: "Henry Schein",
        primary_domain: "henryschein.com",
      },
    },
  ]
}

export function buildApolloApiSearchNormalizedFixtures(): ApolloPersonRecord[] {
  return normalizeApolloSearchPeople(buildApolloApiSearchRawFixtures())
}

export function buildApolloHenryScheinSearchPerson(): ApolloPersonRecord {
  return normalizeApolloSearchPersonRecord(buildApolloApiSearchRawFixtures()[0])
}
