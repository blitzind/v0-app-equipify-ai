/** Phase 7.PCA-1 — Enforced contact discovery provider write contract. Client-safe. */

export const GROWTH_CONTACT_DISCOVERY_PROVIDER_WRITE_CONTRACT_QA_MARKER =
  "growth-contact-discovery-provider-write-contract-7-pca-1-v1" as const

/**
 * Contact discovery providers MUST:
 * - Return raw contacts from `discover()` only.
 * - Avoid direct writes to `growth.company_contacts` (use orchestrator sync path).
 * - Set `pii_observed: true` when returning vendor-observed email/phone/LinkedIn.
 *
 * Documented exceptions (none by default after Phase 7.PCA-1):
 * - Legacy benchmark helpers may call `persistProviderContactsAndSync` explicitly.
 */
export const CONTACT_DISCOVERY_PROVIDER_MUST_NOT_WRITE_COMPANY_CONTACTS = true as const
