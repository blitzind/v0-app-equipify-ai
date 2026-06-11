import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { loadApolloOperatorScaleReport } from "@/lib/growth/apollo/apollo-operator-scale-route"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const baselineCompanies = Number(url.searchParams.get("baselineCompanies") ?? "1")
  const meetingConversion = url.searchParams.get("meetingConversionPct")
  const meeting_conversion_pct =
    meetingConversion != null && meetingConversion.trim()
      ? Number.parseFloat(meetingConversion)
      : null

  try {
    const report = await loadApolloOperatorScaleReport(access.admin, {
      baseline_companies: Number.isFinite(baselineCompanies) ? baselineCompanies : 1,
      meeting_conversion_pct:
        meeting_conversion_pct != null && Number.isFinite(meeting_conversion_pct)
          ? meeting_conversion_pct
          : null,
    })
    return NextResponse.json({ ok: true, report })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}
