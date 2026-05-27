import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  GROWTH_COMPANY_GROWTH_SIGNALS_SCHEMA_SETUP_MESSAGE,
  isGrowthCompanyGrowthSignalsSchemaReady,
  probeGrowthCompanyGrowthSignalsSchema,
} from "@/lib/growth/company-growth-signals/company-growth-signal-schema-health"
import { GROWTH_COMPANY_GROWTH_SIGNALS_PRIVACY_NOTE, GROWTH_COMPANY_GROWTH_SIGNALS_QA_MARKER } from "@/lib/growth/company-growth-signals/company-growth-signal-types"
import {
  loadCompanyGrowthSignalsSnapshot,
  runCompanyGrowthSignalDiscovery,
} from "@/lib/growth/company-growth-signals/growth-signal-repository"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const companyId = url.searchParams.get("company_id")

  const schemaReady = await isGrowthCompanyGrowthSignalsSchemaReady(access.admin)
  const schema_health = schemaReady ? null : await probeGrowthCompanyGrowthSignalsSchema(access.admin)
  if (!schemaReady) {
    return NextResponse.json({
      ok: true,
      meta: { schemaReady: false, setupMessage: schema_health?.warning_message ?? GROWTH_COMPANY_GROWTH_SIGNALS_SCHEMA_SETUP_MESSAGE },
      snapshot: {
        qa_marker: GROWTH_COMPANY_GROWTH_SIGNALS_QA_MARKER,
        schema_ready: false,
        schema_health,
        company_id: companyId ?? "",
        evidence_sources: [],
        signals: [],
        score: null,
        privacy_note: GROWTH_COMPANY_GROWTH_SIGNALS_PRIVACY_NOTE,
      },
    })
  }

  const run = url.searchParams.get("run") === "1"
  const website = url.searchParams.get("website")
  const companyName = url.searchParams.get("company_name") ?? "Company"

  if (!companyId || !z.string().uuid().safeParse(companyId).success) {
    return NextResponse.json({ error: "invalid_company_id", message: "Provide company_id." }, { status: 400 })
  }

  try {
    const snapshot =
      run
        ? await runCompanyGrowthSignalDiscovery(access.admin, {
            company_id: companyId,
            website,
            company_name: companyName,
            domain: url.searchParams.get("domain"),
            description: url.searchParams.get("description"),
            review_count: url.searchParams.get("review_count")
              ? Number(url.searchParams.get("review_count"))
              : null,
            rating: url.searchParams.get("rating") ? Number(url.searchParams.get("rating")) : null,
            website_maturity_score: url.searchParams.get("website_maturity_score")
              ? Number(url.searchParams.get("website_maturity_score"))
              : null,
          })
        : await loadCompanyGrowthSignalsSnapshot(access.admin, companyId)

    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_COMPANY_GROWTH_SIGNALS_QA_MARKER,
      meta: { schemaReady: true },
      snapshot,
    })
  } catch {
    return NextResponse.json({ error: "fetch_failed", message: "Could not load growth signals." }, { status: 500 })
  }
}
