/** Per-provider contact discovery outcomes — client-safe. */

import type { GrowthContactDiscoveryProviderResult } from "@/lib/growth/contact-discovery/contact-discovery-provider-types"

export type GrowthContactDiscoveryProviderOutcome = {
  provider: string
  contacts_returned: number
  contacts_persisted: number
  status: GrowthContactDiscoveryProviderResult["status"]
  message: string | null
  provider_error: string | null
}

export function formatContactDiscoveryProviderLabel(provider: string): string {
  switch (provider) {
    case "internal_growth":
      return "Internal"
    case "website_public_extract":
      return "Website"
    case "people_data_labs":
      return "PDL"
    case "apollo":
      return "Apollo"
    default:
      return provider.replace(/_/g, " ")
  }
}

export function formatProviderOutcomeSummary(outcome: GrowthContactDiscoveryProviderOutcome): string {
  const label = formatContactDiscoveryProviderLabel(outcome.provider)
  if (outcome.provider_error) {
    return `${label}: error — ${outcome.provider_error}`
  }
  if (outcome.status === "skipped") {
    return `${label}: 0 returned (${outcome.message ?? "skipped"})`
  }
  if (outcome.contacts_returned === 0 && outcome.contacts_persisted === 0) {
    return `${label}: 0 returned${outcome.message ? ` (${outcome.message})` : ""}`
  }
  if (outcome.contacts_returned === outcome.contacts_persisted) {
    return `${label}: ${outcome.contacts_returned} returned, ${outcome.contacts_persisted} persisted`
  }
  return `${label}: ${outcome.contacts_returned} returned, ${outcome.contacts_persisted} persisted`
}

export function buildContactDiscoveryProviderOutcomes(input: {
  provider_results: GrowthContactDiscoveryProviderResult[]
  persisted_by_provider: Record<string, number>
  run_persistence_error?: string | null
  candidates_persistence_error?: string | null
}): GrowthContactDiscoveryProviderOutcome[] {
  const outcomes: GrowthContactDiscoveryProviderOutcome[] = []

  for (const pr of input.provider_results) {
    const persisted = input.persisted_by_provider[pr.provider_name] ?? 0
    const provider_error =
      pr.status === "failed"
        ? pr.message
        : pr.error
          ? String(pr.error)
          : null

    outcomes.push({
      provider: pr.provider_name,
      contacts_returned: pr.contacts.length,
      contacts_persisted: persisted,
      status: pr.status,
      message: pr.status === "skipped" || (pr.contacts.length === 0 && pr.message) ? pr.message : null,
      provider_error,
    })
  }

  if (input.run_persistence_error) {
    outcomes.push({
      provider: "contact_discovery_persistence",
      contacts_returned: 0,
      contacts_persisted: 0,
      status: "failed",
      message: null,
      provider_error: input.run_persistence_error,
    })
  } else if (input.candidates_persistence_error) {
    outcomes.push({
      provider: "contact_candidates_persistence",
      contacts_returned: 0,
      contacts_persisted: 0,
      status: "failed",
      message: null,
      provider_error: input.candidates_persistence_error,
    })
  }

  return outcomes
}

export function parseContactDiscoveryProviderOutcomes(
  value: unknown,
): GrowthContactDiscoveryProviderOutcome[] {
  if (!Array.isArray(value)) return []
  const out: GrowthContactDiscoveryProviderOutcome[] = []
  for (const row of value) {
    if (!row || typeof row !== "object") continue
    const r = row as Record<string, unknown>
    const provider = typeof r.provider === "string" ? r.provider.trim() : ""
    if (!provider) continue
    const statusRaw = typeof r.status === "string" ? r.status : "skipped"
    const status =
      statusRaw === "success" || statusRaw === "failed" || statusRaw === "skipped"
        ? statusRaw
        : "skipped"
    out.push({
      provider,
      contacts_returned: Number(r.contacts_returned ?? 0),
      contacts_persisted: Number(r.contacts_persisted ?? 0),
      status,
      message: typeof r.message === "string" ? r.message : null,
      provider_error: typeof r.provider_error === "string" ? r.provider_error : null,
    })
  }
  return out
}
