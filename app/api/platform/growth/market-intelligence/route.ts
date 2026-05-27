import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { isGrowthMarketIntelligenceSchemaReady, GROWTH_MARKET_INTELLIGENCE_SCHEMA_MIGRATION } from "@/lib/growth/market-intelligence/market-intelligence-schema-health"
import {
  computeAndPersistCompanyConfidence,
  fetchCommandMarketHealth,
  loadCompanyConfidenceScore,
  loadCompanyRelationships,
  marketIntelligenceMeta,
  persistCompanyRelationships,
} from "@/lib/growth/market-intelligence/market-repository"
import { computeCommitteeCompletion } from "@/lib/growth/committee-intelligence/committee-completion-engine"
import { listCompanyContacts } from "@/lib/growth/contact-discovery/company-contact-repository"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const schemaReady = await isGrowthMarketIntelligenceSchemaReady(access.admin)
  if (!schemaReady) {
    return NextResponse.json({
      ok: true,
      meta: { schemaReady: false, setupMessage: `Apply migration ${GROWTH_MARKET_INTELLIGENCE_SCHEMA_MIGRATION}.` },
      ...marketIntelligenceMeta(),
    })
  }

  const url = new URL(request.url)
  const companyId = url.searchParams.get("company_id")
  const view = url.searchParams.get("view")

  if (view === "command_market_health") {
    const marketHealth = await fetchCommandMarketHealth(access.admin)
    return NextResponse.json({ ok: true, ...marketIntelligenceMeta(), marketHealth })
  }

  if (companyId && z.string().uuid().safeParse(companyId).success) {
    const [relationships, confidence] = await Promise.all([
      loadCompanyRelationships(access.admin, companyId),
      loadCompanyConfidenceScore(access.admin, companyId),
    ])

    const contacts = await listCompanyContacts(access.admin, companyId).catch(() => [])
    const committee = computeCommitteeCompletion(
      contacts.map((contact) => ({ full_name: contact.full_name, job_title: contact.job_title })),
    )

    if (!confidence) {
      await computeAndPersistCompanyConfidence(access.admin, companyId)
    }

    return NextResponse.json({
      ok: true,
      ...marketIntelligenceMeta(),
      company_id: companyId,
      relationships,
      confidence: confidence ?? (await loadCompanyConfidenceScore(access.admin, companyId)),
      committee_completion: committee,
    })
  }

  const marketHealth = await fetchCommandMarketHealth(access.admin)
  return NextResponse.json({ ok: true, ...marketIntelligenceMeta(), marketHealth })
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response
  if (!(await isGrowthMarketIntelligenceSchemaReady(access.admin))) {
    return NextResponse.json({ ok: false, message: "Market intelligence schema not ready." })
  }

  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const anchor = body.anchor_company
  const pool = body.related_pool
  if (!anchor || typeof anchor !== "object" || !Array.isArray(pool)) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 })
  }

  const relationships = await persistCompanyRelationships(
    access.admin,
    anchor as import("@/lib/growth/prospect-search/prospect-search-types").GrowthProspectSearchCompanyResult,
    pool as import("@/lib/growth/prospect-search/prospect-search-types").GrowthProspectSearchCompanyResult[],
  )

  return NextResponse.json({ ok: true, relationships })
}
