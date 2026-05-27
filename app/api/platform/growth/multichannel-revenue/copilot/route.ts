import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchMultichannelCopilotForLead } from "@/lib/growth/revenue-intelligence/process-multichannel-revenue-intelligence"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const leadId = z.string().uuid().parse(url.searchParams.get("leadId"))
  const companyName = url.searchParams.get("companyName")

  try {
    const assist = await fetchMultichannelCopilotForLead(access.admin, { leadId, companyName })
    return NextResponse.json({ ok: true, assist })
  } catch {
    return NextResponse.json({ error: "fetch_failed", message: "Could not load multi-channel copilot." }, { status: 500 })
  }
}
