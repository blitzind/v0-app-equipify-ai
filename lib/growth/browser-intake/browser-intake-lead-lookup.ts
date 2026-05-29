import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import {
  normalizeCompanyName,
  normalizeEmail,
  normalizeLinkedIn,
  normalizeWebsiteDomain,
} from "@/lib/growth/import/normalize"
import type { BrowserIntakeLeadLookupMatch } from "@/lib/growth/browser-intake/browser-intake-types"
import { sortBrowserIntakeLeadMatches } from "@/lib/growth/browser-intake/browser-intake-lookup-priority"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"

export const GROWTH_BROWSER_INTAKE_LOOKUP_QA_MARKER = "growth-browser-intake-lookup-v1" as const

export type { BrowserIntakeLeadLookupMatch } from "@/lib/growth/browser-intake/browser-intake-types"

type LeadLookupRow = {
  id: string
  company_name: string
  contact_name: string | null
  contact_email: string | null
  website: string | null
  status: string
  metadata: Record<string, unknown> | null
}

function growthLeadsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("leads")
}

function mapLeadToMatch(
  row: LeadLookupRow,
  rule: string,
  confidence: number,
  dedupeKey: string,
): BrowserIntakeLeadLookupMatch {
  return {
    lead_id: row.id,
    company_name: row.company_name,
    website: row.website,
    contact_name: row.contact_name,
    contact_email: row.contact_email,
    status: row.status,
    rule,
    confidence,
    dedupe_key: dedupeKey,
  }
}

function linkedinSlugFromLeadMetadata(metadata: Record<string, unknown> | null | undefined): string | null {
  if (!metadata) return null
  const importLinkedIn = (metadata.import as Record<string, unknown> | undefined)?.linkedin
  if (typeof importLinkedIn === "string" && importLinkedIn.trim()) {
    return normalizeLinkedIn(importLinkedIn)
  }

  const captures = metadata.browser_extension_captures
  if (Array.isArray(captures)) {
    for (const capture of captures) {
      if (!capture || typeof capture !== "object") continue
      const linkedinUrl = (capture as Record<string, unknown>).linkedin_url
      if (typeof linkedinUrl === "string") {
        const slug = normalizeLinkedIn(linkedinUrl)
        if (slug) return slug
      }
    }
  }

  const latest = metadata.browser_extension
  if (latest && typeof latest === "object") {
    const linkedinUrl = (latest as Record<string, unknown>).linkedin_url
    if (typeof linkedinUrl === "string") {
      return normalizeLinkedIn(linkedinUrl)
    }
  }

  return null
}

export async function findBrowserIntakeExistingLeads(
  admin: SupabaseClient,
  input: {
    company_name?: string | null
    website?: string | null
    linkedin_url?: string | null
    email?: string | null
    limit?: number
  },
): Promise<BrowserIntakeLeadLookupMatch[]> {
  const limit = input.limit ?? 5
  const matches = new Map<string, BrowserIntakeLeadLookupMatch>()

  const linkedin = normalizeLinkedIn(input.linkedin_url)
  const domain = normalizeWebsiteDomain(input.website)
  const company = normalizeCompanyName(input.company_name)
  const email = normalizeEmail(input.email)

  if (email) {
    const { data } = await growthLeadsTable(admin)
      .select("id, company_name, contact_name, contact_email, website, status, metadata")
      .eq("contact_email", email)
      .limit(5)

    for (const row of (data ?? []) as LeadLookupRow[]) {
      matches.set(row.id, mapLeadToMatch(row, "email", 0.92, email))
    }
  }

  if (domain) {
    const { data } = await growthLeadsTable(admin)
      .select("id, company_name, contact_name, contact_email, website, status, metadata")
      .not("website", "is", null)
      .limit(250)

    for (const row of (data ?? []) as LeadLookupRow[]) {
      if (normalizeWebsiteDomain(row.website) !== domain) continue
      const confidence = company && normalizeCompanyName(row.company_name) === company ? 0.95 : 0.82
      const rule = company && normalizeCompanyName(row.company_name) === company ? "website_company" : "website_domain"
      matches.set(row.id, mapLeadToMatch(row, rule, confidence, domain))
    }
  }

  if (linkedin) {
    const { data } = await growthLeadsTable(admin)
      .select("id, company_name, contact_name, contact_email, website, status, metadata")
      .contains("metadata", { import: { linkedin } })
      .limit(5)

    for (const row of (data ?? []) as LeadLookupRow[]) {
      matches.set(row.id, mapLeadToMatch(row, "linkedin", 0.88, linkedin))
    }

    const { data: allLeads } = await growthLeadsTable(admin)
      .select("id, company_name, contact_name, contact_email, website, status, metadata")
      .limit(300)

    for (const row of (allLeads ?? []) as LeadLookupRow[]) {
      const slug = linkedinSlugFromLeadMetadata(row.metadata)
      if (slug && slug === linkedin) {
        matches.set(row.id, mapLeadToMatch(row, "linkedin_metadata", 0.86, linkedin))
      }
    }
  }

  if (company) {
    const { data } = await growthLeadsTable(admin)
      .select("id, company_name, contact_name, contact_email, website, status, metadata")
      .limit(300)

    for (const row of (data ?? []) as LeadLookupRow[]) {
      if (normalizeCompanyName(row.company_name) !== company) continue
      if (matches.has(row.id)) continue
      matches.set(row.id, mapLeadToMatch(row, "company_name", 0.75, company))
    }
  }

  return sortBrowserIntakeLeadMatches([...matches.values()]).slice(0, limit)
}

export async function fetchBrowserIntakeLeadSummary(
  admin: SupabaseClient,
  leadId: string,
): Promise<BrowserIntakeLeadLookupMatch | null> {
  const lead = await fetchGrowthLeadById(admin, leadId)
  if (!lead) return null
  return {
    lead_id: lead.id,
    company_name: lead.companyName,
    website: lead.website,
    contact_name: lead.contactName,
    contact_email: lead.contactEmail,
    status: lead.status,
    rule: "explicit",
    confidence: 1,
    dedupe_key: lead.id,
  }
}

export function pickBestBrowserIntakeLeadMatch(
  matches: BrowserIntakeLeadLookupMatch[],
): BrowserIntakeLeadLookupMatch | null {
  return sortBrowserIntakeLeadMatches(matches)[0] ?? null
}

export function logBrowserIntakeLeadLookup(input: {
  matchCount: number
  topRule: string | null
  actorEmail: string
}): void {
  logGrowthEngine("browser_intake_lead_lookup", input)
}
