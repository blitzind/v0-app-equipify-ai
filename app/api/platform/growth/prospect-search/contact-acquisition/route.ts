import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { isContactAcquisitionEnabled } from "@/lib/growth/contact-verification/contact-acquisition-feature"
import {
  buildAcquisitionCandidateView,
  mapProspectSearchIntelligenceToAcquisitionInput,
} from "@/lib/growth/contact-verification/contact-acquisition-view"
import type { AcquisitionCandidateApiResponse } from "@/lib/growth/contact-verification/contact-acquisition-view"
import type { GrowthProspectSearchContactIntelligence } from "@/lib/growth/prospect-search/prospect-search-contact-intelligence-types"

export const runtime = "nodejs"

const ContactSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  title: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  linkedin_url: z.string().optional(),
  confidence: z.number().optional(),
})

const BodySchema = z.object({
  companyId: z.string().min(1),
  company_name: z.string().optional(),
  website: z.string().optional(),
  industry: z.string().optional(),
  visible_emails: z.array(z.string()).optional(),
  contacts: z.array(ContactSchema).optional(),
  intelligence: z.unknown().optional(),
})

function domainFromWebsite(website: string | null | undefined): string | undefined {
  if (!website?.trim()) return undefined
  try {
    const url = website.startsWith("http") ? new URL(website) : new URL(`https://${website}`)
    return url.hostname.replace(/^www\./, "")
  } catch {
    const stripped = website.replace(/^https?:\/\//, "").split("/")[0]?.trim()
    return stripped || undefined
  }
}

function acquisitionInputFromBody(input: z.infer<typeof BodySchema>) {
  if (input.contacts?.length) {
    return {
      visibleEmails: input.visible_emails ?? [],
      engineInput: {
        companyId: input.companyId,
        companyName: input.company_name,
        domain: domainFromWebsite(input.website),
        industry: input.industry,
        contacts: input.contacts.map((contact) => {
          const parts = contact.name.trim().split(/\s+/).filter(Boolean)
          return {
            personId: contact.id,
            firstName: parts[0],
            lastName: parts.length > 1 ? parts.slice(1).join(" ") : undefined,
            fullName: contact.name,
            email: contact.email,
            jobTitle: contact.title,
            phone: contact.phone,
            linkedinUrl: contact.linkedin_url,
            confidence: contact.confidence,
          }
        }),
      },
    }
  }

  if (!input.intelligence || typeof input.intelligence !== "object") return null

  const intelligence = input.intelligence as GrowthProspectSearchContactIntelligence
  const mapped = mapProspectSearchIntelligenceToAcquisitionInput({
    companyId: input.companyId,
    companyName: input.company_name,
    website: input.website,
    industry: input.industry,
    intelligence,
  })
  if (!mapped) return null

  return {
    visibleEmails:
      input.visible_emails ??
      intelligence.contacts
        .map((contact) => contact.email?.trim())
        .filter((email): email is string => Boolean(email)),
    engineInput: mapped,
  }
}

export async function POST(request: Request): Promise<NextResponse<AcquisitionCandidateApiResponse>> {
  if (!isContactAcquisitionEnabled()) {
    return NextResponse.json({ ok: false, enabled: false, message: "acquisition_disabled" })
  }

  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response as NextResponse<AcquisitionCandidateApiResponse>

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, enabled: true, message: "invalid_request" },
      { status: 400 },
    )
  }

  const prepared = acquisitionInputFromBody(parsed.data)
  if (!prepared?.engineInput) {
    return NextResponse.json(
      { ok: false, enabled: true, message: "insufficient_contact_context" },
      { status: 400 },
    )
  }

  try {
    const view = await buildAcquisitionCandidateView(
      {
        ...prepared.engineInput,
        visibleEmails: prepared.visibleEmails,
      },
      { skipDns: true },
    )

    if (!view) {
      return NextResponse.json({ ok: false, enabled: true, message: "acquisition_unavailable" })
    }

    return NextResponse.json({
      ok: true,
      enabled: true,
      view,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        enabled: true,
        message: error instanceof Error ? error.message : "acquisition_build_failed",
      },
      { status: 500 },
    )
  }
}
