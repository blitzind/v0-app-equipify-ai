/** Phase 7.PCA-1 — Contact acquisition provider adapter contract (future vendor integrations). Client-safe. */

import type {
  GrowthContactDiscoveryProvider,
  GrowthContactDiscoveryProviderQuery,
  GrowthContactDiscoveryProviderRawContact,
  GrowthContactDiscoveryProviderResult,
  GrowthContactDiscoveryProviderType,
} from "@/lib/growth/contact-discovery/contact-discovery-provider-types"

export const GROWTH_CONTACT_ACQUISITION_PROVIDER_ADAPTER_QA_MARKER =
  "growth-contact-acquisition-provider-adapter-7-pca-1-v1" as const

/**
 * Planned third-party contact acquisition vendors for Phase 7.PCA-2+.
 * Stub slots in contact-discovery-registry may use legacy `future_*` provider types until wired.
 */
export const GROWTH_CONTACT_ACQUISITION_PLANNED_VENDORS = [
  "apollo",
  "seamless",
  "prospeo",
  "rocketreach",
  "people_data_labs",
  "clay",
  "csv_import",
] as const

export type GrowthContactAcquisitionPlannedVendor =
  (typeof GROWTH_CONTACT_ACQUISITION_PLANNED_VENDORS)[number]

/** Vendor-specific metadata carried on raw contacts and persisted to contact_candidates.metadata. */
export type GrowthContactAcquisitionProviderAdapterMetadata = {
  qa_marker: typeof GROWTH_CONTACT_ACQUISITION_PROVIDER_ADAPTER_QA_MARKER
  /** Stable id from vendor API when available. */
  external_provider_contact_id?: string | null
  /** Vendor-side company/account id when available. */
  external_provider_company_id?: string | null
  /** Declared vendor source confidence 0–1. */
  source_confidence?: number | null
  /** Whether vendor returned observed PII (email/phone/profile). */
  pii_observed?: boolean
  /** Optional rate-limit / cost hints for operator diagnostics. */
  rate_limit_remaining?: number | null
  estimated_cost_usd?: number | null
  /** Isolated provider run id for support / replay. */
  provider_run_id?: string | null
  /** Non-fatal warnings from vendor mapping. */
  adapter_warnings?: string[]
}

export type GrowthContactAcquisitionProviderDiagnostics = {
  qa_marker: typeof GROWTH_CONTACT_ACQUISITION_PROVIDER_ADAPTER_QA_MARKER
  provider_name: string
  provider_type: GrowthContactDiscoveryProviderType
  configured: boolean
  duration_ms?: number | null
  contacts_returned?: number
  error?: string | null
  skipped_reason?: string | null
  adapter_metadata?: Partial<GrowthContactAcquisitionProviderAdapterMetadata>
}

/**
 * Provider write contract (Phase 7.PCA-1):
 *
 * 1. `discover()` returns raw contacts only — no direct `company_contacts` writes.
 * 2. Orchestrator normalizes → `contact_candidates` → sync → `company_contacts`.
 * 3. Set `pii_observed: true` when returning email/phone/LinkedIn from vendor APIs.
 * 4. Populate `external_provider_contact_id` when vendor supplies a stable person key.
 * 5. Provider failures must not abort other providers in the registry runner.
 */
export type GrowthContactAcquisitionProviderAdapter = GrowthContactDiscoveryProvider & {
  vendor: GrowthContactAcquisitionPlannedVendor
  buildDiagnostics: (
    result: GrowthContactDiscoveryProviderResult,
    input?: { duration_ms?: number },
  ) => GrowthContactAcquisitionProviderDiagnostics
}

export function attachContactAcquisitionAdapterMetadata(
  contact: GrowthContactDiscoveryProviderRawContact,
  metadata: Partial<GrowthContactAcquisitionProviderAdapterMetadata>,
): GrowthContactDiscoveryProviderRawContact {
  return {
    ...contact,
    pii_observed: metadata.pii_observed ?? contact.pii_observed,
    metadata: {
      ...(contact.metadata ?? {}),
      ...metadata,
      qa_marker: GROWTH_CONTACT_ACQUISITION_PROVIDER_ADAPTER_QA_MARKER,
    },
  }
}

export function buildContactAcquisitionProviderDiagnostics(
  provider: Pick<GrowthContactDiscoveryProvider, "provider_name" | "provider_type" | "isConfigured">,
  result: GrowthContactDiscoveryProviderResult,
  input?: { duration_ms?: number },
): GrowthContactAcquisitionProviderDiagnostics {
  return {
    qa_marker: GROWTH_CONTACT_ACQUISITION_PROVIDER_ADAPTER_QA_MARKER,
    provider_name: provider.provider_name,
    provider_type: provider.provider_type,
    configured: provider.isConfigured(),
    duration_ms: input?.duration_ms ?? null,
    contacts_returned: result.contacts.length,
    error: result.error ?? null,
    skipped_reason: result.status === "skipped" ? result.message : null,
  }
}

export type GrowthContactAcquisitionProviderAdapterFactory = (
  admin: import("@supabase/supabase-js").SupabaseClient,
) => GrowthContactAcquisitionProviderAdapter

/** Shared query shape for all contact acquisition adapters. */
export type GrowthContactAcquisitionProviderQuery = GrowthContactDiscoveryProviderQuery
