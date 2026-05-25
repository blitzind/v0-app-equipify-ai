import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthCalendarConnectionSummary } from "@/lib/growth/calendar/calendar-sync-readiness-server"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const summary = await fetchGrowthCalendarConnectionSummary(access.admin, access.userId)
    return NextResponse.json({ ok: true, summary })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load calendar connection."
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}

export async function DELETE() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const connection = await fetchGrowthCalendarConnectionSummary(access.admin, access.userId)
    if (!connection.connected) {
      return NextResponse.json({ ok: true, disconnected: false })
    }

    const { fetchGrowthCalendarConnectionForUser, disconnectGrowthCalendarConnection } = await import(
      "@/lib/growth/calendar/calendar-connection-repository"
    )
    const { revokeGrowthGoogleCalendarToken } = await import("@/lib/growth/calendar/google-calendar-oauth")

    const row = await fetchGrowthCalendarConnectionForUser(access.admin, access.userId)
    if (row?.refreshToken) {
      await revokeGrowthGoogleCalendarToken(row.refreshToken)
    }
    await disconnectGrowthCalendarConnection(access.admin, access.userId)
    return NextResponse.json({ ok: true, disconnected: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not disconnect calendar."
    return NextResponse.json({ error: "disconnect_failed", message }, { status: 500 })
  }
}
