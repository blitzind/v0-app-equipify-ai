import { NextResponse } from "next/server"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { estimateProspectSearchMatches } from "@/lib/growth/prospect-search/prospect-search-estimation"
import { withProspectSearchGuardrails } from "@/lib/growth/runtime-guardrails/growth-search-rate-limiter"
import type {
  GrowthProspectSearchDiscoveryMode,
  GrowthProspectSearchFilters,
} from "@/lib/growth/prospect-search/prospect-search-types"

export const runtime = "nodejs"

function parseFiltersParam(raw: string | null): Partial<GrowthProspectSearchFilters> {
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Partial<GrowthProspectSearchFilters>
  } catch {
    return {}
  }
}

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const query = url.searchParams.get("q") ?? ""
  const filters = parseFiltersParam(url.searchParams.get("filters"))
  const discovery_mode: GrowthProspectSearchDiscoveryMode =
    url.searchParams.get("mode") === "discover_external" ? "discover_external" : "internal"

  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) {
    return NextResponse.json({ error: "growth_engine_org_not_configured" }, { status: 503 })
  }

  const guarded = await withProspectSearchGuardrails(access.admin, {
    organizationId,
    userId: access.userId,
    operation: "estimate",
    query,
    execute: async () => {
      const estimate = await estimateProspectSearchMatches(access.admin, {
        query,
        filters,
        discovery_mode,
      })
      return {
        result: estimate,
        rowsReturned: estimate.estimated_matches ?? 0,
      }
    },
  })

  if (!guarded.ok) {
    return NextResponse.json({ error: guarded.error }, { status: guarded.status })
  }

  return NextResponse.json({ ok: true, estimate: guarded.result })
}
