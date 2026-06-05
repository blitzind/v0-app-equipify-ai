/** Phase 7.PS-IE — Audit wave-enriched companies for person-page discovery gaps. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { parseWebsiteExtractionDiagnosticsFromMetadata } from "@/lib/growth/contact-discovery/website-acquisition-metadata-bridge"
import { classifyContactIdentity } from "@/lib/growth/human-identity-evidence/contact-identity-classification"
import { isGenericIdentityName } from "@/lib/growth/human-identity-evidence/human-identity-evidence-evidence"
import { loadPersonCommitteeDensityCompanySnapshot } from "@/lib/growth/graph-expansion/person-committee-density-expansion"
import type {
  BatchWaveDensityCompanyAudit,
  BatchWaveDensityImprovementCohortCompany,
} from "@/lib/growth/graph-expansion/batch-wave-density-improvement-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

const PERSON_PAGE_PATTERN =
  /\/(team|staff|about|leadership|management|people|our-people|meet-the|who-we-are|executives)\b/i

const COMMON_PERSON_PROBE_PATHS = [
  "/team",
  "/our-team",
  "/meet-the-team",
  "/about",
  "/about-us",
  "/leadership",
  "/staff",
  "/our-people",
  "/people",
  "/management",
]

async function loadCompanyWebsite(
  admin: SupabaseClient,
  company_id: string,
): Promise<string | null> {
  const { data } = await admin
    .schema("growth")
    .from("companies")
    .select("website, primary_domain")
    .eq("id", company_id)
    .maybeSingle()
  const website = asString(data?.website) || asString(data?.primary_domain)
  if (!website) return null
  return website.startsWith("http") ? website : `https://${website}`
}

function personPagePathsFromUrls(urls: string[]): string[] {
  return urls.filter((url) => PERSON_PAGE_PATTERN.test(url))
}

function missingPersonProbePaths(website: string | null, crawled: string[]): string[] {
  if (!website) return COMMON_PERSON_PROBE_PATHS
  let origin = ""
  try {
    origin = new URL(website).origin
  } catch {
    return COMMON_PERSON_PROBE_PATHS
  }
  const crawledPaths = new Set(
    crawled.map((url) => {
      try {
        return new URL(url).pathname.toLowerCase()
      } catch {
        return url.toLowerCase()
      }
    }),
  )
  return COMMON_PERSON_PROBE_PATHS.filter((path) => !crawledPaths.has(path.toLowerCase())).map(
    (path) => `${origin}${path}`,
  )
}

export async function auditBatchWaveDensityCompany(
  admin: SupabaseClient,
  company: BatchWaveDensityImprovementCohortCompany,
): Promise<BatchWaveDensityCompanyAudit> {
  const website_url = await loadCompanyWebsite(admin, company.canonical_company_id)
  const snapshot = await loadPersonCommitteeDensityCompanySnapshot(admin, {
    canonical_company_id: company.canonical_company_id,
    company_name: company.company_name,
    cohort_kind: "ps_ht_new",
  })

  const { data: contacts } = await admin
    .schema("growth")
    .from("company_contacts")
    .select("full_name, title, email, phone, source_type, metadata, linkedin_url")
    .eq("company_id", company.canonical_company_id)
    .neq("contact_status", "archived")

  let pages_crawled_before: string[] = []
  let pages_skipped_before: string[] = []
  let pages_failed_before: string[] = []
  const contact_evidence: BatchWaveDensityCompanyAudit["contact_evidence"] = []
  let generic_contacts_before = 0

  for (const row of contacts ?? []) {
    const full_name = asString((row as Record<string, unknown>).full_name) || "Company contact"
    const title = asString((row as Record<string, unknown>).title) || null
    const email = asString((row as Record<string, unknown>).email) || null
    const phone = asString((row as Record<string, unknown>).phone) || null
    const source_type = asString((row as Record<string, unknown>).source_type) || null
    const metadata =
      (row as Record<string, unknown>).metadata &&
      typeof (row as Record<string, unknown>).metadata === "object"
        ? ((row as Record<string, unknown>).metadata as Record<string, unknown>)
        : {}
    const source_page_url = asString(metadata.source_page_url) || null

    const diagnostics = parseWebsiteExtractionDiagnosticsFromMetadata(metadata)
    if (diagnostics && pages_crawled_before.length === 0) {
      pages_crawled_before = diagnostics.pages_crawled
      pages_skipped_before = diagnostics.pages_skipped
      pages_failed_before = diagnostics.pages_failed
    }

    const identity = classifyContactIdentity({
      full_name,
      title,
      email,
      phone,
      linkedin_url: asString((row as Record<string, unknown>).linkedin_url),
      source_type,
    })

    let generic_reason: string | null = null
    if (identity.classification !== "named_person") {
      generic_contacts_before += 1
      if (isGenericIdentityName(full_name)) {
        generic_reason = "generic_identity_name"
      } else if (!title && !email?.includes("@")) {
        generic_reason = "no_title_or_personal_email"
      } else {
        generic_reason = identity.classification
      }
    }

    contact_evidence.push({
      full_name,
      title,
      email,
      phone,
      source_type,
      source_page_url,
      generic_reason,
    })
  }

  const person_page_paths_attempted = personPagePathsFromUrls([
    ...pages_crawled_before,
    ...pages_failed_before,
  ])
  const person_page_paths_missing = missingPersonProbePaths(website_url, pages_crawled_before)

  const why_remained_generic: string[] = []
  const discovery_gaps: string[] = []

  if (person_page_paths_missing.length > 0) {
    discovery_gaps.push(`person_probe_paths_not_crawled:${person_page_paths_missing.length}`)
  }
  if (person_page_paths_attempted.length === 0) {
    discovery_gaps.push("no_team_about_leadership_pages_crawled")
    why_remained_generic.push("team_about_pages_never_reached")
  }
  if (generic_contacts_before > 0 && snapshot.named_persons === 0) {
    why_remained_generic.push("only_generic_company_channels_extracted")
  }
  if (pages_crawled_before.length <= 2) {
    discovery_gaps.push("shallow_crawl_budget")
  }
  if (pages_failed_before.some((url) => PERSON_PAGE_PATTERN.test(url))) {
    discovery_gaps.push("person_page_fetch_failed")
  }

  const externalCount = (contacts ?? []).filter((row) => {
    const source_type = asString((row as Record<string, unknown>).source_type)
    const metadata =
      (row as Record<string, unknown>).metadata &&
      typeof (row as Record<string, unknown>).metadata === "object"
        ? ((row as Record<string, unknown>).metadata as Record<string, unknown>)
        : {}
    return (
      source_type === "public_record" ||
      asString(metadata.external_evidence_source) ||
      asString(metadata.external_evidence_url)
    )
  }).length

  return {
    company_name: company.company_name,
    canonical_company_id: company.canonical_company_id,
    website_url,
    pages_crawled_before,
    pages_skipped_before,
    pages_failed_before,
    person_page_paths_attempted,
    person_page_paths_missing,
    contact_evidence,
    named_persons_before: snapshot.named_persons,
    titled_persons_before: snapshot.titled_persons,
    verified_emails_before: snapshot.verified_emails,
    verified_phones_before: snapshot.verified_phones,
    generic_contacts_before,
    external_evidence_signals: externalCount ?? 0,
    why_remained_generic,
    discovery_gaps,
  }
}
