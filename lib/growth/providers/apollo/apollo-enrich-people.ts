import "server-only"

import { safeDiscoveryProviderResponse } from "@/lib/growth/prospect-search/prospect-search-safe-fetch-json"
import {
  APOLLO_BULK_MATCH_BATCH_SIZE,
  APOLLO_BULK_MATCH_PATH,
  getApolloApiKey,
  isApolloEmailEnrichmentEnabled,
  isApolloMockEnabled,
  resolveApolloApiBaseUrl,
} from "@/lib/growth/providers/apollo/apollo-config"
import { recordApolloBulkMatchBatch } from "@/lib/growth/providers/apollo/apollo-run-guardrails"
import { normalizeApolloSearchPersonRecord } from "@/lib/growth/providers/apollo/apollo-search-person-normalize"
import type {
  ApolloBulkMatchResponse,
  ApolloPersonRecord,
} from "@/lib/growth/providers/apollo/apollo-types"

export const APOLLO_ENRICH_PEOPLE_QA_MARKER = "apollo-enrich-people-en-1-v1" as const

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function mockEnrichApolloPerson(person: ApolloPersonRecord, domain: string | null): ApolloPersonRecord {
  const id = asTrimmedString(person.id)
  const first = asTrimmedString(person.first_name) || "contact"
  const last = asTrimmedString(person.last_name) || id.slice(-6) || "mock"
  const emailDomain = domain || "example.com"
  return normalizeApolloSearchPersonRecord({
    ...person,
    email: person.email || `${first}.${last}@${emailDomain}`.toLowerCase().replace(/\s+/g, ""),
    email_status: person.email_status || "verified",
    sanitized_phone: person.sanitized_phone || "+15551234999",
    linkedin_url:
      person.linkedin_url || `https://www.linkedin.com/in/mock-${first}-${last}`.toLowerCase(),
  })
}

export async function enrichApolloPeopleWithBulkMatch(input: {
  people: ApolloPersonRecord[]
  apiKey?: string
  mock?: boolean
  domain?: string | null
  record_guardrails?: boolean
  env?: NodeJS.ProcessEnv
}): Promise<{
  people: ApolloPersonRecord[]
  batches: number
  credits_estimate: number
  enrich_endpoint: string | null
}> {
  const env = input.env ?? process.env
  const mock = input.mock ?? isApolloMockEnabled(env)
  const ids = input.people
    .map((person) => asTrimmedString(person.id))
    .filter(Boolean)

  const merged = new Map<string, ApolloPersonRecord>()
  for (const person of input.people) {
    const id = asTrimmedString(person.id)
    if (id) merged.set(id, person)
  }

  if (ids.length === 0) {
    return { people: input.people, batches: 0, credits_estimate: 0, enrich_endpoint: null }
  }

  if (mock) {
    const enriched = [...merged.values()].map((person) =>
      mockEnrichApolloPerson(person, input.domain ?? null),
    )
    const batches = Math.ceil(ids.length / APOLLO_BULK_MATCH_BATCH_SIZE)
    if (input.record_guardrails !== false && isApolloEmailEnrichmentEnabled(env)) {
      recordApolloBulkMatchBatch({ batches, env })
    }
    return {
      people: enriched,
      batches,
      credits_estimate: 0,
      enrich_endpoint: null,
    }
  }

  if (!isApolloEmailEnrichmentEnabled(env)) {
    return {
      people: input.people,
      batches: 0,
      credits_estimate: 0,
      enrich_endpoint: null,
    }
  }

  const apiKey = input.apiKey ?? getApolloApiKey(env)
  if (!apiKey) {
    return {
      people: input.people,
      batches: 0,
      credits_estimate: 0,
      enrich_endpoint: null,
    }
  }

  let batches = 0
  const enrich_endpoint = `${resolveApolloApiBaseUrl()}${APOLLO_BULK_MATCH_PATH}`

  for (let i = 0; i < ids.length; i += APOLLO_BULK_MATCH_BATCH_SIZE) {
    const batchIds = ids.slice(i, i + APOLLO_BULK_MATCH_BATCH_SIZE)
    batches += 1

    const res = await fetch(enrich_endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        details: batchIds.map((id) => ({ id })),
        reveal_personal_emails: false,
      }),
    })

    const parsed = await safeDiscoveryProviderResponse<ApolloBulkMatchResponse>(res)
    if (!parsed.ok) continue

    const matches = parsed.data.matches ?? parsed.data.people ?? []
    for (const match of matches) {
      const id = asTrimmedString(match.id)
      if (!id || !merged.has(id)) continue
      merged.set(id, normalizeApolloSearchPersonRecord({ ...merged.get(id)!, ...match }))
    }
  }

  if (input.record_guardrails !== false) {
    recordApolloBulkMatchBatch({ batches, env })
  }

  return {
    people: [...merged.values()],
    batches,
    credits_estimate: batches,
    enrich_endpoint,
  }
}
