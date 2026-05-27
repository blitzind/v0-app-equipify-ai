import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { estimateProspectSearchMatches } from "@/lib/growth/prospect-search/prospect-search-estimation"
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

  const estimate = await estimateProspectSearchMatches(access.admin, {
    query,
    filters,
    discovery_mode,
  })

  return NextResponse.json({ ok: true, estimate })
}
