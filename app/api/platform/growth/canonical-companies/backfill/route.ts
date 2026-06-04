import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess, logGrowthEngine } from "@/lib/growth/access"
import { runCanonicalCompanyBackfill } from "@/lib/growth/canonical-companies/canonical-company-backfill"
import {
  buildCanonicalCompanyBackfillApiResponse,
  parseCanonicalCompanyBackfillRequest,
} from "@/lib/growth/canonical-companies/canonical-company-backfill-api"
import {
  GROWTH_CANONICAL_COMPANY_MIGRATION,
  isGrowthCanonicalCompanySchemaReady,
} from "@/lib/growth/canonical-companies/canonical-company-schema-health"

export const runtime = "nodejs"
export const maxDuration = 120

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = parseCanonicalCompanyBackfillRequest(await request.json().catch(() => null))
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, error: parsed.error, message: parsed.message },
      { status: 400 },
    )
  }

  if (!(await isGrowthCanonicalCompanySchemaReady(access.admin))) {
    return NextResponse.json(
      {
        ok: false,
        reason: "schema_not_ready",
        migration: GROWTH_CANONICAL_COMPANY_MIGRATION,
        message: "Apply migration 20270708120000_growth_engine_canonical_companies_7_2a.sql first.",
      },
      { status: 503 },
    )
  }

  const startedMs = Date.now()
  try {
    const stats = await runCanonicalCompanyBackfill(access.admin, { mode: parsed.mode })
    const duration_ms = Date.now() - startedMs

    logGrowthEngine("canonical_company_backfill", {
      mode: parsed.mode,
      duration_ms,
      actor_user_id: access.userId,
      merge_groups_by_domain: stats.merge_groups_by_domain,
      canonical_companies_after: stats.canonical_companies_after,
    })

    return NextResponse.json(
      buildCanonicalCompanyBackfillApiResponse({
        mode: parsed.mode,
        stats,
        duration_ms,
      }),
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : "Canonical company backfill failed."
    logGrowthEngine("canonical_company_backfill_failed", {
      mode: parsed.mode,
      message,
      actor_user_id: access.userId,
    })
    return NextResponse.json({ ok: false, error: "backfill_failed", message }, { status: 500 })
  }
}
