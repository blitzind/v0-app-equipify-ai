import { NextResponse } from "next/server"
import { resolveBrowserIntakeCrmContextFromLookup } from "@/lib/growth/browser-intake/build-browser-intake-crm-context"
import { GROWTH_BROWSER_INTAKE_CRM_CONTEXT_QA_MARKER } from "@/lib/growth/browser-intake/browser-intake-crm-context-types"
import {
  buildLinkedInLookupQuery,
  detectLinkedInPageKind,
} from "@/lib/growth/browser-intake/linkedin-context-detect"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const leadId = url.searchParams.get("lead_id")?.trim() || null
  const companyName = url.searchParams.get("company_name")?.trim() || null
  const website = url.searchParams.get("website")?.trim() || null
  const linkedinUrl = url.searchParams.get("linkedin_url")?.trim() || null
  const email = url.searchParams.get("email")?.trim().toLowerCase() || null
  const sourceUrl = url.searchParams.get("source_url")?.trim() || linkedinUrl

  if (!leadId && !companyName && !website && !linkedinUrl && !email) {
    return NextResponse.json(
      {
        error: "invalid_query",
        message: "Provide lead_id or lookup fields (company_name, website, linkedin_url, email).",
      },
      { status: 400 },
    )
  }

  const appBasePath = `${url.protocol}//${url.host}`
  const linkedInQuery = buildLinkedInLookupQuery({
    url: sourceUrl,
    company_name: companyName,
    website,
    email,
    linkedin_url: linkedinUrl,
  })

  const resolved = await resolveBrowserIntakeCrmContextFromLookup(access.admin, {
    lead_id: leadId,
    company_name: linkedInQuery.company_name,
    website: linkedInQuery.website,
    linkedin_url: linkedInQuery.linkedin_url,
    email: linkedInQuery.email,
    source_url: sourceUrl,
    appBasePath,
  })

  return NextResponse.json({
    ok: true,
    qa_marker: GROWTH_BROWSER_INTAKE_CRM_CONTEXT_QA_MARKER,
    matched: resolved.matched,
    linkedin_page_kind: linkedInQuery.linkedin_page_kind ?? detectLinkedInPageKind(sourceUrl),
    context: resolved.context,
    status_badge: resolved.context?.status_badge ?? "not_added",
    status_badge_label: resolved.context?.status_badge_label ?? "Not added",
  })
}
