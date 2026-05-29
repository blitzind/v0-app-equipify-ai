import { NextResponse } from "next/server"
import {
  findBrowserIntakeExistingLeads,
  GROWTH_BROWSER_INTAKE_LOOKUP_QA_MARKER,
  logBrowserIntakeLeadLookup,
  pickBestBrowserIntakeLeadMatch,
} from "@/lib/growth/browser-intake/browser-intake-lead-lookup"
import { enrichBrowserIntakeLookupMatches } from "@/lib/growth/browser-intake/enrich-browser-intake-lookup"
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
  const companyName = url.searchParams.get("company_name")?.trim() || null
  const website = url.searchParams.get("website")?.trim() || null
  const linkedinUrl = url.searchParams.get("linkedin_url")?.trim() || null
  const email = url.searchParams.get("email")?.trim().toLowerCase() || null
  const sourceUrl = url.searchParams.get("source_url")?.trim() || linkedinUrl

  const linkedInQuery = buildLinkedInLookupQuery({
    url: sourceUrl,
    company_name: companyName,
    website,
    email,
    linkedin_url: linkedinUrl,
  })

  if (
    !linkedInQuery.company_name &&
    !linkedInQuery.website &&
    !linkedInQuery.linkedin_url &&
    !linkedInQuery.email
  ) {
    return NextResponse.json(
      {
        error: "invalid_query",
        message: "Provide company_name, website, linkedin_url, or email.",
      },
      { status: 400 },
    )
  }

  const matches = await findBrowserIntakeExistingLeads(access.admin, {
    company_name: linkedInQuery.company_name,
    website: linkedInQuery.website,
    linkedin_url: linkedInQuery.linkedin_url,
    email: linkedInQuery.email,
    limit: 5,
  })
  const bestMatch = pickBestBrowserIntakeLeadMatch(matches)
  const enrichedMatches = await enrichBrowserIntakeLookupMatches(access.admin, matches)
  const enrichedBestMatch = bestMatch
    ? enrichedMatches.find((match) => match.lead_id === bestMatch.lead_id) ?? null
    : null

  logBrowserIntakeLeadLookup({
    matchCount: matches.length,
    topRule: bestMatch?.rule ?? null,
    actorEmail: access.userEmail,
  })

  return NextResponse.json({
    ok: true,
    qa_marker: GROWTH_BROWSER_INTAKE_LOOKUP_QA_MARKER,
    existing_lead_found: Boolean(bestMatch && bestMatch.confidence >= 0.7),
    linkedin_page_kind: linkedInQuery.linkedin_page_kind ?? detectLinkedInPageKind(sourceUrl),
    best_match: enrichedBestMatch,
    matches: enrichedMatches,
    status_badge: enrichedBestMatch?.status_badge ?? "not_added",
    status_badge_label: enrichedBestMatch?.status_badge_label ?? "Not added",
  })
}
