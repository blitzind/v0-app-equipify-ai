import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { listSequenceChannelTasks } from "@/lib/growth/multichannel/channel-events"
import { isGrowthMultichannelSequencesSchemaReady } from "@/lib/growth/multichannel/schema-health"
import type {
  GrowthSequenceChannelTaskStatus,
  GrowthSequenceChannelType,
} from "@/lib/growth/multichannel/multichannel-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthMultichannelSequencesSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const url = new URL(request.url)
  const leadId = url.searchParams.get("leadId") ?? undefined
  const enrollmentId = url.searchParams.get("enrollmentId") ?? undefined
  const status = url.searchParams.get("status") as GrowthSequenceChannelTaskStatus | null
  const channel = url.searchParams.get("channel") as GrowthSequenceChannelType | null

  try {
    const tasks = await listSequenceChannelTasks(access.admin, {
      leadId,
      enrollmentId,
      status: status ?? undefined,
      channel: channel ?? undefined,
      limit: 100,
    })
    return NextResponse.json({ ok: true, tasks })
  } catch {
    return NextResponse.json({ error: "fetch_failed", message: "Could not load channel tasks." }, { status: 500 })
  }
}
