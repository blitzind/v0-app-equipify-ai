import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthCadenceTaskInbox } from "@/lib/growth/cadence/cadence-dashboard-repository"
import {
  GROWTH_CADENCE_INBOX_VIEWS,
  GROWTH_CADENCE_TASK_CHANNELS,
} from "@/lib/growth/cadence/cadence-types"
import { GROWTH_CADENCE_SCHEMA_SETUP_MESSAGE, isGrowthCadenceSchemaReady } from "@/lib/growth/cadence/cadence-schema-health"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthCadenceSchemaReady(access.admin))) {
    return NextResponse.json({
      ok: true,
      meta: { schemaReady: false, setupMessage: GROWTH_CADENCE_SCHEMA_SETUP_MESSAGE },
      feed: { items: [] },
    })
  }

  const url = new URL(request.url)
  const view = z.enum(GROWTH_CADENCE_INBOX_VIEWS).catch("due").parse(url.searchParams.get("view"))
  const ownerUserIdParam = url.searchParams.get("ownerUserId")
  const ownerUserId =
    ownerUserIdParam === "me"
      ? access.userId
      : ownerUserIdParam && z.string().uuid().safeParse(ownerUserIdParam).success
        ? ownerUserIdParam
        : undefined
  const channelParam = url.searchParams.get("channel")
  const channel =
    channelParam && z.enum(GROWTH_CADENCE_TASK_CHANNELS).safeParse(channelParam).success ? channelParam : undefined
  const leadIdParam = url.searchParams.get("leadId")
  const leadId = leadIdParam && z.string().uuid().safeParse(leadIdParam).success ? leadIdParam : undefined
  const limit = z.coerce.number().int().min(1).max(100).catch(50).parse(url.searchParams.get("limit"))

  try {
    const items = await fetchGrowthCadenceTaskInbox(access.admin, { view, ownerUserId, leadId, channel, limit })
    return NextResponse.json({ ok: true, meta: { schemaReady: true }, feed: { items } })
  } catch {
    return NextResponse.json({ error: "fetch_failed", message: "Could not load cadence tasks." }, { status: 500 })
  }
}
