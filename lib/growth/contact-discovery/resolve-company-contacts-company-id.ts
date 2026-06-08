/** Phase 7.PCA-1 — Resolve canonical company id before company_contacts writes. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logAcquisitionStep } from "@/lib/growth/acquisition/acquisition-diagnostics"
import {
  ensureStagingCanonicalCompanyLinkage,
  type StagingCanonicalCompanyResolutionMethod,
} from "@/lib/growth/canonical-companies/canonical-company-staging-linkage"

export const GROWTH_CONTACT_ACQUISITION_COMPANY_ID_QA_MARKER =
  "growth-contact-acquisition-company-id-7-pca-1-v1" as const

export type CompanyContactsPersistenceResolution = {
  qa_marker: typeof GROWTH_CONTACT_ACQUISITION_COMPANY_ID_QA_MARKER
  company_candidate_id: string
  canonical_company_id: string | null
  method: StagingCanonicalCompanyResolutionMethod | "explicit" | "unresolved"
  ambiguous: boolean
  diagnostics: string[]
  ready: boolean
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

/**
 * Resolve the canonical `growth.companies` id that must be used for `company_contacts.company_id`.
 * Never persist company_contacts against a staging candidate id when resolution fails.
 */
export async function resolveCompanyContactsCanonicalCompanyId(
  admin: SupabaseClient,
  input: {
    company_candidate_id: string
    explicit_canonical_company_id?: string | null
    ensure_linkage?: boolean
  },
): Promise<CompanyContactsPersistenceResolution> {
  const company_candidate_id = asString(input.company_candidate_id)
  const explicit = asString(input.explicit_canonical_company_id)
  const diagnostics: string[] = []

  const base: CompanyContactsPersistenceResolution = {
    qa_marker: GROWTH_CONTACT_ACQUISITION_COMPANY_ID_QA_MARKER,
    company_candidate_id,
    canonical_company_id: null,
    method: "unresolved",
    ambiguous: false,
    diagnostics,
    ready: false,
  }

  if (!company_candidate_id) {
    diagnostics.push("company_candidate_id is required for company_contacts persistence.")
    return base
  }

  if (explicit) {
    if (input.ensure_linkage !== false) {
      await ensureStagingCanonicalCompanyLinkage(admin, company_candidate_id, {
        explicit_canonical_company_id: explicit,
      }).catch(() => null)
    }
    return {
      ...base,
      canonical_company_id: explicit,
      method: "explicit",
      ready: true,
    }
  }

  const linkage = await ensureStagingCanonicalCompanyLinkage(admin, company_candidate_id, {
    upsert_lineage: true,
  })

  if (linkage.canonical_company_id) {
    const ambiguous =
      linkage.method === "company_contacts" &&
      diagnostics.length === 0 &&
      linkage.canonical_company_id !== asString(linkage.canonical_company_id)
    if (linkage.method === "unresolved") {
      diagnostics.push("Staging linkage returned unresolved canonical company.")
    }
    logAcquisitionStep("resolveCompanyContactsCanonicalCompanyId", {
      company_candidate_id,
      canonical_company_id: linkage.canonical_company_id,
      method: linkage.method,
    })
    return {
      ...base,
      canonical_company_id: linkage.canonical_company_id,
      method: linkage.method,
      ambiguous,
      ready: true,
    }
  }

  diagnostics.push(
    "Canonical company id could not be resolved for staging candidate — company_contacts sync skipped to avoid ID fragmentation.",
  )
  logAcquisitionStep("resolveCompanyContactsCanonicalCompanyId_unresolved", {
    company_candidate_id,
    diagnostics,
  })
  return base
}
