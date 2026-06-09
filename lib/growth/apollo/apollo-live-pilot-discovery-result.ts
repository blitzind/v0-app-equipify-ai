/** Apollo live pilot contact discovery result parsing — client-safe. */

import {
  parseContactDiscoveryProviderOutcomes,
  type GrowthContactDiscoveryProviderOutcome,
} from "@/lib/growth/contact-discovery/contact-discovery-provider-outcomes"
import type { GrowthContactDiscoverySnapshot } from "@/lib/growth/contact-discovery/contact-discovery-types"

export const APOLLO_LIVE_PILOT_DISCOVERY_RESULT_QA_MARKER =
  "apollo-live-pilot-discovery-result-v1" as const

export const APOLLO_LIVE_PILOT_APOLLO_PROVIDER_KEYS = ["apollo", "future_apollo"] as const

export type ApolloLivePilotResolvedProviderOutcome = GrowthContactDiscoveryProviderOutcome & {
  source: "provider_outcomes" | "run_metadata" | "provider_messages"
}

export function parseApolloProviderMessageLine(
  message: string,
): GrowthContactDiscoveryProviderOutcome | null {
  const match = message.match(/^apollo:\s*(success|skipped|failed)\s*—\s*(.+)$/i)
  if (!match) return null

  const status = match[1]!.toLowerCase() as GrowthContactDiscoveryProviderOutcome["status"]
  const detail = match[2]!.trim()
  const provider_error = status === "failed" ? detail : null

  return {
    provider: "apollo",
    contacts_returned: 0,
    contacts_persisted: 0,
    status,
    message: status === "skipped" || status === "failed" ? detail : null,
    provider_error,
  }
}

function findApolloProviderOutcome(
  outcomes: GrowthContactDiscoveryProviderOutcome[],
): GrowthContactDiscoveryProviderOutcome | null {
  return (
    outcomes.find((outcome) =>
      APOLLO_LIVE_PILOT_APOLLO_PROVIDER_KEYS.includes(
        outcome.provider as (typeof APOLLO_LIVE_PILOT_APOLLO_PROVIDER_KEYS)[number],
      ),
    ) ?? null
  )
}

export function resolveApolloProviderOutcomeFromDiscoverySnapshot(
  snapshot: GrowthContactDiscoverySnapshot,
): ApolloLivePilotResolvedProviderOutcome | null {
  const direct = findApolloProviderOutcome(snapshot.provider_outcomes)
  if (direct) {
    return { ...direct, source: "provider_outcomes" }
  }

  const metadataOutcomes = parseContactDiscoveryProviderOutcomes(
    snapshot.run?.metadata?.provider_outcomes,
  )
  const fromMetadata = findApolloProviderOutcome(metadataOutcomes)
  if (fromMetadata) {
    return { ...fromMetadata, source: "run_metadata" }
  }

  for (const message of snapshot.provider_messages) {
    const parsed = parseApolloProviderMessageLine(message)
    if (parsed) {
      const persisted = snapshot.contacts.filter(
        (contact) =>
          contact.provider_name === "apollo" || contact.provider_type === "future_apollo",
      ).length
      return {
        ...parsed,
        contacts_returned: persisted,
        contacts_persisted: persisted,
        source: "provider_messages",
      }
    }
  }

  return null
}

export function resolveApolloContactsFromDiscoverySnapshot(
  snapshot: GrowthContactDiscoverySnapshot,
): GrowthContactDiscoverySnapshot["contacts"] {
  return snapshot.contacts.filter(
    (contact) => contact.provider_name === "apollo" || contact.provider_type === "future_apollo",
  )
}

export function discoverySnapshotMissingApolloProvider(
  snapshot: GrowthContactDiscoverySnapshot,
): boolean {
  return resolveApolloProviderOutcomeFromDiscoverySnapshot(snapshot) === null
}
