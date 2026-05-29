import { NextResponse } from "next/server"
import {
  findBrowserIntakeExistingLeads,
  GROWTH_BROWSER_INTAKE_LOOKUP_QA_MARKER,
  logBrowserIntakeLeadLookup,
  pickBestBrowserIntakeLeadMatch,
} from "@/lib/growth/browser-intake/browser-intake-lead-lookup"
import { formatBrowserIntakeMatchRuleLabel } from "@/lib/growth/browser-intake/browser-intake-match-labels"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const companyName = url.searchParams.get("company_name")?.trim() || null
  const website = url.searchParams.get("website")?.trim() || null
  const linkedinUrl = url.searchParams.get("linkedin_url")?.trim() || null

  if (!companyName && !website && !linkedinUrl) {
    return NextResponse.json(
      { error: "invalid_query", message: "Provide company_name, website, or linkedin_url." },
      { status: 400 },
    )
  }

  const matches = await findBrowserIntakeExistingLeads(access.admin, {
    company_name: companyName,
    website,
    linkedin_url: linkedinUrl,
    limit: 5,
  })
  const bestMatch = pickBestBrowserIntakeLeadMatch(matches)
  const enrichedMatches = matches.map((match) => ({
    ...match,
    match_label: formatBrowserIntakeMatchRuleLabel(match.rule),
  }))
  const enrichedBestMatch = bestMatch
    ? { ...bestMatch, match_label: formatBrowserIntakeMatchRuleLabel(bestMatch.rule) }
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
    best_match: enrichedBestMatch,
    matches: enrichedMatches,
  })
}
