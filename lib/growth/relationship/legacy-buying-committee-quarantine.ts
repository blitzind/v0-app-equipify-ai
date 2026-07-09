/** GE-AIOS-15B — Quarantine legacy Prompt 27 buying committee writes (7.7A is canonical). */

export const GROWTH_LEGACY_BUYING_COMMITTEE_QUARANTINE_QA_MARKER =
  "ge-aios-15b-legacy-buying-committee-quarantine-v1" as const

/** Canonical 7.7A tables — source of truth for Sales Specialist. */
export const GROWTH_CANONICAL_BUYING_COMMITTEE_TABLES = [
  "buying_committee_intelligence_members",
  "buying_committee_runs",
  "buying_committee_evidence",
  "person_company_roles",
] as const

/** Legacy Prompt 27 / pre-7.7A tables — read-only; new Sales writes quarantined. */
export const GROWTH_LEGACY_BUYING_COMMITTEE_TABLES = [
  "buying_committees",
  "buying_committee_members",
  "buying_committee_maps",
  "buying_committee_signals",
] as const

export function isLegacyBuyingCommitteeWriteQuarantined(): boolean {
  return true
}

export function legacyBuyingCommitteeWriteBlockedReason(table: string): string {
  return `GE-AIOS-15B quarantine: new writes to legacy buying committee table "${table}" are blocked; use buying_committee_intelligence_* (7.7A).`
}
