/** Apollo integration AI-1 — repository audit inventory (client-safe). */

import fs from "node:fs"
import path from "node:path"

export const APOLLO_INTEGRATION_AI_1_QA_MARKER = "apollo-integration-ai-1-v1" as const

export type ApolloAuditComponentStatus = "complete" | "partial" | "stub" | "missing"

export type ApolloAuditComponent = {
  id: string
  category:
    | "provider"
    | "adapter"
    | "mock"
    | "config"
    | "benchmark"
    | "migration"
    | "pipeline"
    | "dedupe"
    | "import"
    | "research"
    | "scoring"
    | "readiness"
    | "cost_controls"
  path: string
  status: ApolloAuditComponentStatus
  reusable: boolean
  notes: string
}

export type ApolloIntegrationAi1AuditReport = {
  qa_marker: typeof APOLLO_INTEGRATION_AI_1_QA_MARKER
  audited_at: string
  summary: {
    complete: number
    partial: number
    stub: number
    missing: number
    reusable: number
  }
  data_flow: string[]
  components: ApolloAuditComponent[]
  reusable_components: string[]
  partial_implementations: string[]
  missing_pieces: string[]
}

const INVENTORY: Omit<ApolloAuditComponent, "status">[] = [
  {
    id: "apollo_client",
    category: "provider",
    path: "lib/growth/providers/apollo/apollo-client.ts",
    reusable: true,
    notes: "Live HTTP: mixed_people/api_search + optional bulk_match.",
  },
  {
    id: "apollo_config",
    category: "config",
    path: "lib/growth/providers/apollo/apollo-config.ts",
    reusable: true,
    notes: "Env resolution, credit limits, feature flags.",
  },
  {
    id: "apollo_config_diagnostics",
    category: "config",
    path: "lib/growth/providers/apollo/apollo-config-diagnostics.ts",
    reusable: true,
    notes: "ready_for_live_* gates and ambiguous env detection.",
  },
  {
    id: "apollo_mapper",
    category: "adapter",
    path: "lib/growth/providers/apollo/map-apollo-contact.ts",
    reusable: true,
    notes: "Apollo person → raw contact + identity acceptance + provenance metadata.",
  },
  {
    id: "apollo_discovery_provider",
    category: "provider",
    path: "lib/growth/contact-discovery/providers/apollo-contact-discovery-provider.ts",
    reusable: true,
    notes: "GrowthContactDiscoveryProvider wired to Apollo client.",
  },
  {
    id: "apollo_acquisition_adapter",
    category: "adapter",
    path: "lib/growth/contact-discovery/providers/apollo-contact-acquisition-adapter.ts",
    reusable: true,
    notes: "Phase 7.PCA-1 adapter wrapper with vendor + buildDiagnostics.",
  },
  {
    id: "apollo_mock_fixtures",
    category: "mock",
    path: "lib/growth/providers/apollo/apollo-mock-fixtures.ts",
    reusable: true,
    notes: "Deterministic mock people — no API credits.",
  },
  {
    id: "apollo_run_guardrails",
    category: "cost_controls",
    path: "lib/growth/providers/apollo/apollo-run-guardrails.ts",
    reusable: true,
    notes: "Per-run company/API/credit caps.",
  },
  {
    id: "contact_normalizer",
    category: "dedupe",
    path: "lib/growth/contact-discovery/contact-normalizer.ts",
    reusable: true,
    notes: "contact_candidates dedupe hash (name+title).",
  },
  {
    id: "company_contact_dedupe",
    category: "dedupe",
    path: "lib/growth/contact-discovery/website-contact-discovery.ts",
    reusable: true,
    notes: "company_contacts email-aware dedupe.",
  },
  {
    id: "contact_repository",
    category: "pipeline",
    path: "lib/growth/contact-discovery/contact-repository.ts",
    reusable: true,
    notes: "runContactDiscoveryForCompany orchestrator.",
  },
  {
    id: "sync_candidates",
    category: "pipeline",
    path: "lib/growth/acquisition/sync-contact-candidates-to-company-contacts.ts",
    reusable: true,
    notes: "contact_candidates → company_contacts with resolution.",
  },
  {
    id: "human_acquisition",
    category: "pipeline",
    path: "lib/growth/prospect-search/prospect-search-human-acquisition.ts",
    reusable: true,
    notes: "Discovery → sync → canonical person backfill → prospect hydration.",
  },
  {
    id: "apollo_benchmark",
    category: "benchmark",
    path: "lib/growth/benchmark/growth-contact-acquisition-apollo-benchmark.ts",
    reusable: true,
    notes: "End-to-end benchmark through sync pipeline.",
  },
  {
    id: "contact_discovery_migration",
    category: "migration",
    path: "supabase/migrations/20270323120000_growth_engine_contact_discovery.sql",
    reusable: true,
    notes: "contact_discovery_runs, contact_candidates (future_apollo enum).",
  },
  {
    id: "company_contacts_migration",
    category: "migration",
    path: "supabase/migrations/20270403120000_growth_engine_company_contacts.sql",
    reusable: true,
    notes: "Canonical company_contacts store.",
  },
  {
    id: "apollo_benchmark_migration",
    category: "migration",
    path: "supabase/migrations/20270805120000_growth_apollo_replacement_benchmark_7_ps_ij.sql",
    reusable: true,
    notes: "Benchmark cohort + snapshot staging tables.",
  },
  {
    id: "apollo_csv_import",
    category: "import",
    path: "lib/growth/import/vendors/apollo-stub.ts",
    reusable: true,
    notes: "CSV column aliases only — not UI-enabled; complements API discovery.",
  },
  {
    id: "sequence_readiness",
    category: "readiness",
    path: "lib/growth/prospect-search/prospect-search-sequence-readiness.ts",
    reusable: true,
    notes: "Account-level sequence readiness after research.",
  },
  {
    id: "decision_maker_score",
    category: "scoring",
    path: "lib/growth/contact-discovery/decision-maker-score.ts",
    reusable: true,
    notes: "Title-based decision-maker scoring.",
  },
  {
    id: "decision_maker_source_weight",
    category: "scoring",
    path: "lib/growth/decision-maker-source-weight.ts",
    reusable: true,
    notes: "apollo source weight = 90.",
  },
  {
    id: "prospect_search_apollo_slot",
    category: "provider",
    path: "lib/growth/prospect-search/prospect-search-provider.ts",
    reusable: false,
    notes: "future_apollo prospect-search slot still skipped — company search not via Apollo.",
  },
  {
    id: "external_discovery_apollo_slot",
    category: "provider",
    path: "lib/growth/external-discovery/providers/future-provider-slots.ts",
    reusable: false,
    notes: "External company discovery Apollo slot skipped — contact-only integration.",
  },
  {
    id: "apollo_provider_cache",
    category: "cost_controls",
    path: "lib/growth/provider-cache/",
    reusable: false,
    notes: "No Apollo query cache — repeat searches not deduped server-side.",
  },
  {
    id: "lead_engine_bridge",
    category: "research",
    path: "lib/growth/lead-engine/providers/internal-growth-provider.ts",
    reusable: false,
    notes: "Lead Engine external vendor bridge deferred — research uses internal snapshot.",
  },
]

export const APOLLO_INTEGRATION_DATA_FLOW = [
  "Apollo Search (mixed_people/api_search)",
  "→ contact_candidates (provider=future_apollo, metadata.provenance)",
  "→ normalize + dedupe (name+title hash)",
  "→ company_contacts (email-aware dedupe, canonical company match)",
  "→ canonical persons backfill",
  "→ company intelligence + buying committee discovery",
  "→ fit scoring + relationship intelligence",
  "→ prospect search sequence readiness",
  "→ sequence enrollment (email / voice drop / SMS / call)",
] as const

function fileExists(cwd: string, relativePath: string): boolean {
  if (relativePath.endsWith("/")) {
    return fs.existsSync(path.join(cwd, relativePath))
  }
  return fs.existsSync(path.join(cwd, relativePath))
}

function resolveStatus(cwd: string, component: Omit<ApolloAuditComponent, "status">): ApolloAuditComponentStatus {
  if (component.path.endsWith("/")) {
    return fileExists(cwd, component.path) ? "partial" : "missing"
  }
  if (!fileExists(cwd, component.path)) return "missing"
  if (component.notes.includes("still skipped") || component.notes.includes("stub")) return "stub"
  if (component.notes.includes("only") && component.category === "import") return "partial"
  if (component.notes.includes("No Apollo") || component.notes.includes("deferred")) return "stub"
  return "complete"
}

export function runApolloIntegrationAi1Audit(options?: {
  cwd?: string
  nowIso?: string
}): ApolloIntegrationAi1AuditReport {
  const cwd = options?.cwd ?? process.cwd()
  const components: ApolloAuditComponent[] = INVENTORY.map((entry) => ({
    ...entry,
    status: resolveStatus(cwd, entry),
  }))

  const summary = components.reduce(
    (acc, component) => {
      acc[component.status] += 1
      if (component.reusable && component.status !== "missing") acc.reusable += 1
      return acc
    },
    { complete: 0, partial: 0, stub: 0, missing: 0, reusable: 0 },
  )

  const reusable_components = components
    .filter((c) => c.reusable && c.status === "complete")
    .map((c) => c.id)

  const partial_implementations = components
    .filter((c) => c.status === "partial")
    .map((c) => `${c.id}: ${c.notes}`)

  const missing_pieces = components
    .filter((c) => c.status === "stub" || c.status === "missing")
    .map((c) => `${c.id}: ${c.notes}`)

  return {
    qa_marker: APOLLO_INTEGRATION_AI_1_QA_MARKER,
    audited_at: options?.nowIso ?? new Date().toISOString(),
    summary,
    data_flow: [...APOLLO_INTEGRATION_DATA_FLOW],
    components,
    reusable_components,
    partial_implementations,
    missing_pieces,
  }
}
