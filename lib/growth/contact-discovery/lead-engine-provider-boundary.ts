/** Phase 7.PCA-1 — Lead Engine vs Contact Discovery provider boundary. Client-safe. */

export const GROWTH_LEAD_ENGINE_CONTACT_DISCOVERY_BOUNDARY_QA_MARKER =
  "growth-lead-engine-contact-discovery-boundary-7-pca-1-v1" as const

/**
 * ## Recommendation: Option 1 — Keep separate, document the boundary (Phase 7.PCA-1)
 *
 * **Contact Discovery providers** (`lib/growth/contact-discovery/`)
 * - Purpose: Acquire net-new human contacts for a **company candidate** from external/internal sources.
 * - Output: `GrowthContactDiscoveryProviderRawContact[]` → `contact_candidates` → `company_contacts`.
 * - Consumers: Bulk acquisition, Prospect Search human acquisition, operator contact discovery.
 *
 * **Lead Engine providers** (`lib/growth/lead-engine/providers/`)
 * - Purpose: Stage-scoped **research signals** for the AI copilot workspace pipeline
 *   (ICP targeting, company research, decision-maker hypothesis, contact_research, verification triage).
 * - Output: Normalized provider responses for workspace UI / copilot — not the canonical acquisition store.
 * - Consumers: Lead Engine workspace runs, sandbox fixtures, operator research flows.
 *
 * ### Why not consolidate now
 * - Different lifecycles: acquisition persists to DB tables; Lead Engine returns ephemeral research payloads.
 * - Lead Engine `contact_research` reads existing CRM/leads — it does not replace vendor acquisition.
 * - Merging registries risks coupling outreach-critical ingestion to copilot experimentation.
 *
 * ### Safe bridge (future, optional)
 * - Read-only: Lead Engine `contact_research` may call `loadContactDiscoverySnapshot` for a company candidate.
 * - Metadata-only: Share `GrowthContactAcquisitionProviderDiagnostics` in operator dashboards.
 * - Do **not** route Lead Engine stages through vendor APIs until Phase 7.PCA-2+ adapters are certified.
 */
export const GROWTH_LEAD_ENGINE_CONTACT_DISCOVERY_BOUNDARY_DECISION =
  "keep_separate_document_boundary" as const

export type GrowthLeadEngineContactDiscoveryBoundaryDecision =
  typeof GROWTH_LEAD_ENGINE_CONTACT_DISCOVERY_BOUNDARY_DECISION
