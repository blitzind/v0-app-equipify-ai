import { NextResponse } from "next/server"
import { z } from "zod"
import { logGrowthEngine, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { discoverWebsiteContacts } from "@/lib/growth/contact-discovery/website-contact-discovery"

export const runtime = "nodejs"

const ContactEnrichmentSchema = z.object({
  contact_name: z.string().trim().max(200).optional().nullable(),
  title: z.string().trim().max(200).optional().nullable(),
  company_name: z.string().trim().max(200).optional().nullable(),
  location: z.string().trim().max(200).optional().nullable(),
  linkedin_url: z.string().trim().max(500).optional().nullable(),
  website: z.string().trim().max(500).optional().nullable(),
})

function normalize(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? ""
}

function scoreContact(contactName: string | null | undefined, title: string | null | undefined, candidate: {
  full_name: string
  title: string | null
  email: string | null
}) {
  let score = 0
  const wantedName = normalize(contactName)
  const candidateName = normalize(candidate.full_name)
  if (wantedName && candidateName) {
    if (candidateName === wantedName) score += 70
    else if (candidateName.includes(wantedName) || wantedName.includes(candidateName)) score += 45
  }

  const wantedTitle = normalize(title)
  const candidateTitle = normalize(candidate.title)
  if (wantedTitle && candidateTitle) {
    if (candidateTitle === wantedTitle) score += 20
    else if (candidateTitle.includes(wantedTitle) || wantedTitle.includes(candidateTitle)) score += 10
  }

  if (!wantedName && candidate.email) score += 10
  return score
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const rawBody = await request.json().catch(() => null)
  const parsed = ContactEnrichmentSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_body", message: "Invalid contact enrichment payload." },
      { status: 400 },
    )
  }

  const input = parsed.data
  const website = input.website?.trim() || null

  if (!website) {
    return NextResponse.json({
      ok: true,
      configured: false,
      message: "Contact enrichment provider not configured.",
      result: null,
    })
  }

  const discovery = await discoverWebsiteContacts(website)
  const ranked = discovery.contacts
    .map((contact) => ({
      contact,
      score: scoreContact(input.contact_name, input.title, contact),
    }))
    .sort((a, b) => b.score - a.score)

  const best = ranked.find((row) => row.contact.email || row.contact.phone)?.contact ?? null

  logGrowthEngine("browser_intake_contact_enrichment", {
    actorEmail: access.userEmail,
    companyName: input.company_name,
    website,
    contactsFound: discovery.contacts.length,
    matched: Boolean(best),
  })

  return NextResponse.json({
    ok: true,
    configured: true,
    message: best ? "Contact details found from approved providers." : "No contact details found.",
    result: best
      ? {
          work_email: best.email,
          phone: best.phone ?? best.branch_phone,
          provider_source: "website_public_extract",
          source_page_url: best.source_page_url,
          confidence: Math.min(100, Math.max(35, best.evidence_quality_score ?? 60)),
          verification_status: best.email_classification ?? "unknown",
          phone_verification_status: best.phone_classification ?? "unknown",
          contact_name: best.full_name,
          title: best.title,
        }
      : null,
    diagnostics: {
      provider_source: "website_public_extract",
      pages_crawled: discovery.pages_crawled.length,
      contacts_found: discovery.contacts.length,
      summary: discovery.diagnostics.summary,
    },
  })
}
