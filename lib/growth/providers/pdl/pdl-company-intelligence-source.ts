import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { CompanyIntelligenceContext } from "@/lib/growth/company-intelligence/company-intelligence-sources"
import type { GrowthCompanyIntelligenceDraftFinding } from "@/lib/growth/company-intelligence/company-intelligence-types"
import { mapPdlCompanyToIntelligenceFindings } from "@/lib/growth/providers/pdl/pdl-company-mapper"
import { enrichPdlCompany, isPdlProviderConfigured } from "@/lib/growth/providers/pdl/pdl-client"

export async function collectPdlCompanyIntelligenceFindings(
  ctx: CompanyIntelligenceContext,
): Promise<{ drafts: GrowthCompanyIntelligenceDraftFinding[]; messages: string[] }> {
  const messages: string[] = []

  if (!isPdlProviderConfigured()) {
    messages.push("PDL company intelligence skipped: provider not configured.")
    return { drafts: [], messages }
  }

  const domain = ctx.primary_domain?.trim() || null
  const website = ctx.website_url?.trim() || null
  const companyName = ctx.company_name?.trim() || null

  if (!domain && !website && !companyName) {
    messages.push("PDL company intelligence skipped: no domain, website, or company name.")
    return { drafts: [], messages }
  }

  const enrich = await enrichPdlCompany({
    domain,
    website,
    company_name: companyName,
  })

  if (enrich.status === "skipped") {
    messages.push(`PDL company enrich skipped: ${enrich.message}`)
    return { drafts: [], messages }
  }

  if (enrich.status === "failed" || !enrich.company) {
    messages.push(`PDL company enrich failed: ${enrich.message}`)
    return { drafts: [], messages }
  }

  const drafts = mapPdlCompanyToIntelligenceFindings({
    company: enrich.company,
    company_id: ctx.company_id,
    sandbox: enrich.sandbox,
  })

  messages.push(`PDL company enrich: ${drafts.length} intelligence finding(s).`)
  return { drafts, messages }
}

/** No-op context loader — PDL company enrich uses CompanyIntelligenceContext directly. */
export async function loadPdlCompanyIntelligenceContext(
  _admin: SupabaseClient,
  input: { company_id: string },
): Promise<CompanyIntelligenceContext | null> {
  return null
}
