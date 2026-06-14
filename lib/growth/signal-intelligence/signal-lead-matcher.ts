/** Lead matching for external signals — server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizeDomain } from "@/lib/growth/company-identification/company-identification-normalize"
import { resolveCrmCompanyMatches } from "@/lib/growth/company-identification/company-identification-match"
import { SIGNAL_EXTERNAL_BRIDGE_QA_MARKER } from "@/lib/growth/signal-intelligence/lead-signal-event-types"

export type SignalLeadMatchInput = {
  lead_id?: string | null
  person_id?: string | null
  company_id?: string | null
  domain?: string | null
  email?: string | null
  company_name?: string | null
}

export type SignalLeadMatch = {
  lead_id: string
  match_source: "lead_id" | "person_id" | "company_id" | "domain"
  confidence: number
}

export type SignalLeadMatchResult = {
  qa_marker: typeof SIGNAL_EXTERNAL_BRIDGE_QA_MARKER
  matches: SignalLeadMatch[]
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

async function matchByPersonId(admin: SupabaseClient, personId: string): Promise<SignalLeadMatch[]> {
  const matches: SignalLeadMatch[] = []
  try {
    const { data } = await admin
      .from("company_contacts")
      .select("growth_lead_id")
      .eq("canonical_person_id", personId)
      .not("growth_lead_id", "is", null)
      .limit(10)
    for (const row of data ?? []) {
      const leadId = asString((row as Record<string, unknown>).growth_lead_id)
      if (!leadId) continue
      matches.push({ lead_id: leadId, match_source: "person_id", confidence: 0.86 })
    }
  } catch {
    // fault isolated
  }
  return matches
}

async function matchByCompanyId(admin: SupabaseClient, companyId: string): Promise<SignalLeadMatch[]> {
  const matches: SignalLeadMatch[] = []
  try {
    const { data: contacts } = await admin
      .from("company_contacts")
      .select("growth_lead_id")
      .eq("company_id", companyId)
      .not("growth_lead_id", "is", null)
      .limit(10)
    for (const row of contacts ?? []) {
      const leadId = asString((row as Record<string, unknown>).growth_lead_id)
      if (!leadId) continue
      matches.push({ lead_id: leadId, match_source: "company_id", confidence: 0.84 })
    }

    const { data: companyRow } = await admin
      .from("companies")
      .select("primary_domain")
      .eq("id", companyId)
      .maybeSingle()
    const domain = normalizeDomain(asString((companyRow as Record<string, unknown> | null)?.primary_domain))
    if (domain) {
      const domainMatches = await matchByDomain(admin, domain)
      for (const match of domainMatches) {
        matches.push({ ...match, match_source: "company_id", confidence: 0.82 })
      }
    }
  } catch {
    // fault isolated
  }
  return matches
}

async function matchByDomain(admin: SupabaseClient, domain: string): Promise<SignalLeadMatch[]> {
  const matches: SignalLeadMatch[] = []
  const crm = await resolveCrmCompanyMatches(admin, {
    company_domain: domain,
    submitted_company_name: null,
    company_name: null,
    email: null,
    landing_page: null,
    referrer: null,
    intent_session_id: null,
  })
  for (const candidate of crm) {
    const leadId = asString(candidate.matched_growth_lead_id)
    if (!leadId) continue
    matches.push({
      lead_id: leadId,
      match_source: "domain",
      confidence: candidate.match_confidence,
    })
  }
  return matches
}

function dedupeMatches(matches: SignalLeadMatch[]): SignalLeadMatch[] {
  const byLead = new Map<string, SignalLeadMatch>()
  for (const match of matches) {
    const existing = byLead.get(match.lead_id)
    if (!existing || match.confidence > existing.confidence) {
      byLead.set(match.lead_id, match)
    }
  }
  return [...byLead.values()]
}

export async function matchSignalToLead(
  admin: SupabaseClient,
  input: SignalLeadMatchInput,
): Promise<SignalLeadMatchResult> {
  const leadId = asString(input.lead_id)
  if (leadId) {
    return {
      qa_marker: SIGNAL_EXTERNAL_BRIDGE_QA_MARKER,
      matches: [{ lead_id: leadId, match_source: "lead_id", confidence: 1 }],
    }
  }

  const personId = asString(input.person_id)
  if (personId) {
    return {
      qa_marker: SIGNAL_EXTERNAL_BRIDGE_QA_MARKER,
      matches: dedupeMatches(await matchByPersonId(admin, personId)),
    }
  }

  const companyId = asString(input.company_id)
  if (companyId) {
    return {
      qa_marker: SIGNAL_EXTERNAL_BRIDGE_QA_MARKER,
      matches: dedupeMatches(await matchByCompanyId(admin, companyId)),
    }
  }

  const domain =
    normalizeDomain(input.domain) ??
    normalizeDomain(input.email?.includes("@") ? input.email.split("@")[1] : null)
  if (domain) {
    return {
      qa_marker: SIGNAL_EXTERNAL_BRIDGE_QA_MARKER,
      matches: dedupeMatches(await matchByDomain(admin, domain)),
    }
  }

  if (asString(input.company_name)) {
    const crm = await resolveCrmCompanyMatches(admin, {
      submitted_company_name: input.company_name,
      company_name: input.company_name,
      company_domain: null,
      email: input.email ?? null,
      landing_page: null,
      referrer: null,
      intent_session_id: null,
    })
    const matches = crm
      .map((candidate) => {
        const matchedLeadId = asString(candidate.matched_growth_lead_id)
        if (!matchedLeadId) return null
        return {
          lead_id: matchedLeadId,
          match_source: "domain" as const,
          confidence: candidate.match_confidence,
        }
      })
      .filter((row): row is SignalLeadMatch => row !== null)
    return { qa_marker: SIGNAL_EXTERNAL_BRIDGE_QA_MARKER, matches: dedupeMatches(matches) }
  }

  return { qa_marker: SIGNAL_EXTERNAL_BRIDGE_QA_MARKER, matches: [] }
}
