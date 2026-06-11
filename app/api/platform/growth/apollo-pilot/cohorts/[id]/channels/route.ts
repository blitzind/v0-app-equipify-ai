import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { loadApolloPilotCohortAnalytics } from "@/lib/growth/apollo/apollo-pilot-route"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params

  try {
    const analytics = await loadApolloPilotCohortAnalytics(access.admin, id)
    if (!analytics) {
      return NextResponse.json({ ok: false, message: "Cohort not found." }, { status: 404 })
    }
    return NextResponse.json({ ok: true, channels: analytics.channels })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}
