import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildAccountOutreachStrategyPanelView } from "@/lib/growth/contact-verification/account-outreach-strategy-panel-view"
import {
  GROWTH_ACCOUNT_OUTREACH_STRATEGY_PANEL_QA_MARKER,
  isAccountOutreachStrategyPanelEnabled,
} from "@/lib/growth/contact-verification/account-outreach-strategy-panel-feature"
import type { AccountOutreachStrategyPanelApiResponse } from "@/lib/growth/contact-verification/account-outreach-strategy-panel-types"
import { mapProspectSearchContactIntelligenceToShadowInput } from "@/lib/growth/contact-verification/account-outreach-strategy-shadow"
import type { GrowthProspectSearchContactIntelligence } from "@/lib/growth/prospect-search/prospect-search-contact-intelligence-types"

export const runtime = "nodejs"

const ContactSchema = z.object({
  name: z.string().min(1),
  title: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  linkedin_url: z.string().optional(),
})

const BodySchema = z.object({
  company_name: z.string().optional(),
  website: z.string().optional(),
  industry: z.string().optional(),
  target_use_case: z
    .enum(["growth_engine", "equipify_core", "service_operations", "generic"])
    .optional(),
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

function intelligenceFromBody(input: z.infer<typeof BodySchema>): {
  companyName?: string
  website?: string
  industry?: string
  visibleEmails: string[]
  recommendationInput: ReturnType<typeof mapProspectSearchContactIntelligenceToShadowInput>
} | null {
  if (input.contacts?.length) {
    return {
      companyName: input.company_name,
      website: input.website,
      industry: input.industry,
      visibleEmails: input.visible_emails ?? [],
      recommendationInput: {
        companyName: input.company_name,
        domain: domainFromWebsite(input.website),
        industry: input.industry,
        targetUseCase: input.target_use_case,
        contacts: input.contacts.map((contact) => {
          const parts = contact.name.trim().split(/\s+/).filter(Boolean)
          return {
            firstName: parts[0],
            lastName: parts.length > 1 ? parts.slice(1).join(" ") : undefined,
            fullName: contact.name,
            email: contact.email,
            jobTitle: contact.title,
            phone: contact.phone,
            linkedinUrl: contact.linkedin_url,
          }
        }),
      },
    }
  }

  if (!input.intelligence || typeof input.intelligence !== "object") return null

  const intelligence = input.intelligence as GrowthProspectSearchContactIntelligence
  const mapped = mapProspectSearchContactIntelligenceToShadowInput({
    companyName: input.company_name,
    website: input.website,
    industry: input.industry,
    intelligence,
    context: { surface: "account_outreach_strategy_panel_api" },
  })
  if (!mapped) return null

  return {
    companyName: input.company_name,
    website: input.website,
    industry: input.industry,
    visibleEmails:
      input.visible_emails ??
      intelligence.contacts
        .map((contact) => contact.email?.trim())
        .filter((email): email is string => Boolean(email)),
    recommendationInput: mapped,
  }
}

export async function POST(request: Request): Promise<NextResponse<AccountOutreachStrategyPanelApiResponse>> {
  if (!isAccountOutreachStrategyPanelEnabled()) {
    return NextResponse.json({ ok: false, enabled: false, message: "panel_disabled" })
  }

  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response as NextResponse<AccountOutreachStrategyPanelApiResponse>

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, enabled: true, message: "invalid_request" },
      { status: 400 },
    )
  }

  const prepared = intelligenceFromBody(parsed.data)
  if (!prepared?.recommendationInput) {
    return NextResponse.json(
      { ok: false, enabled: true, message: "insufficient_contact_context" },
      { status: 400 },
    )
  }

  try {
    const view = await buildAccountOutreachStrategyPanelView(
      {
        ...prepared.recommendationInput,
        targetUseCase: parsed.data.target_use_case ?? prepared.recommendationInput.targetUseCase,
        visibleEmails: prepared.visibleEmails,
      },
      { skipDns: true },
    )

    if (!view) {
      return NextResponse.json({ ok: false, enabled: true, message: "panel_unavailable" })
    }

    return NextResponse.json({
      ok: true,
      enabled: true,
      view: {
        ...view,
        qa_marker: GROWTH_ACCOUNT_OUTREACH_STRATEGY_PANEL_QA_MARKER,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        enabled: true,
        message: error instanceof Error ? error.message : "panel_build_failed",
      },
      { status: 500 },
    )
  }
}
