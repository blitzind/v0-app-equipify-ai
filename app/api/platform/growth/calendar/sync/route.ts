import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthCalendarConnectionSummary } from "@/lib/growth/calendar/calendar-sync-readiness-server"
import { fetchGrowthCalendarSyncStatusPanel } from "@/lib/growth/calendar/calendar-sync-run-repository"
import { listGrowthCalendarConflictMeetings } from "@/lib/growth/calendar/resolve-calendar-conflict"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const summary = await fetchGrowthCalendarConnectionSummary(access.admin, access.userId)
    const syncStatus = await fetchGrowthCalendarSyncStatusPanel(
      access.admin,
      access.userId,
      summary.lastSyncAt,
      summary.lastSyncError,
    )
    const conflicts = summary.connected
      ? await listGrowthCalendarConflictMeetings(access.admin, access.userId)
      : []
    return NextResponse.json({ ok: true, summary, syncStatus, conflicts })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load calendar sync status."
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}

const bodySchema = z.object({ confirm: z.literal(true) })

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", message: "Human confirmation is required: { confirm: true }." },
      { status: 400 },
    )
  }

  try {
    const { forceGrowthCalendarSync } = await import("@/lib/growth/calendar/pull-meeting-calendar")
    const result = await forceGrowthCalendarSync(access.admin, {
      actorUserId: access.userId,
      confirm: true,
    })
    if (!result.ok) {
      const status =
        result.code === "calendar_not_connected" ? 409 : result.code === "confirmation_required" ? 400 : 502
      return NextResponse.json(
        { ok: false, error: result.code, message: result.message, run: result.run ?? null },
        { status },
      )
    }
    return NextResponse.json({ ok: true, run: result.run })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Force sync failed."
    return NextResponse.json({ error: "sync_failed", message }, { status: 500 })
  }
}
