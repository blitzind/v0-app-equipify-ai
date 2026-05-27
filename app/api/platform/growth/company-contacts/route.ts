import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  loadCompanyContactsSnapshot,
  runWebsiteContactDiscoveryForCompany,
} from "@/lib/growth/contact-discovery/company-contact-repository"
import { computeCompanyContactCoverage } from "@/lib/growth/contact-discovery/company-contact-coverage"
import {
  GROWTH_COMPANY_CONTACTS_SCHEMA_SETUP_MESSAGE,
  probeGrowthCompanyContactsSchema,
} from "@/lib/growth/contact-discovery/company-contact-schema-health"
import {
  GROWTH_COMPANY_CONTACTS_PRIVACY_NOTE,
  GROWTH_COMPANY_CONTACTS_QA_MARKER,
} from "@/lib/growth/contact-discovery/company-contact-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const schema_health = await probeGrowthCompanyContactsSchema(access.admin)
  if (!schema_health.ready) {
    return NextResponse.json({
      ok: true,
      meta: {
        schemaReady: false,
        setupMessage: schema_health.warning_message ?? GROWTH_COMPANY_CONTACTS_SCHEMA_SETUP_MESSAGE,
      },
      snapshot: {
        qa_marker: GROWTH_COMPANY_CONTACTS_QA_MARKER,
        schema_ready: false,
        schema_health,
        company_id: "",
        contacts: [],
        coverage: computeCompanyContactCoverage([]),
        privacy_note: GROWTH_COMPANY_CONTACTS_PRIVACY_NOTE,
      },
    })
  }

  const url = new URL(request.url)
  const companyId = url.searchParams.get("company_id")
  const website = url.searchParams.get("website")
  const growthLeadId = url.searchParams.get("growth_lead_id")
  const run = url.searchParams.get("run") === "1"

  if (!companyId || !z.string().uuid().safeParse(companyId).success) {
    return NextResponse.json({ error: "invalid_company_id", message: "Provide company_id." }, { status: 400 })
  }

  try {
    const snapshot =
      run && website
        ? await runWebsiteContactDiscoveryForCompany(access.admin, {
            company_id: companyId,
            website,
            growth_lead_id: growthLeadId,
          })
        : await loadCompanyContactsSnapshot(access.admin, companyId)

    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_COMPANY_CONTACTS_QA_MARKER,
      meta: { schemaReady: true },
      snapshot,
    })
  } catch {
    return NextResponse.json({ error: "fetch_failed", message: "Could not load company contacts." }, { status: 500 })
  }
}
