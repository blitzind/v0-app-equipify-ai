import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { listRecentDatamoonImportedLeads } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-repository"
import { GROWTH_HOME_NO_STORE_CACHE_CONTROL } from "@/lib/growth/home/growth-home-workspace-api-contract"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const limit = Math.min(24, Math.max(1, Number(url.searchParams.get("limit") ?? 12) || 12))

  const rows = await listRecentDatamoonImportedLeads(access.admin, limit)
  const leads = await Promise.all(
    rows.map(async (row) => {
      const lead = await fetchGrowthLeadById(access.admin, row.leadId)
      return {
        ...row,
        companyName: lead?.companyName ?? row.companyName,
        contactName: lead?.contactName ?? null,
      }
    }),
  )

  return NextResponse.json(
    {
      ok: true,
      readOnly: true,
      leads,
    },
    {
      headers: {
        "Cache-Control": GROWTH_HOME_NO_STORE_CACHE_CONTROL,
      },
    },
  )
}
