import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  attachCompanyNamesToMeetings,
  listGrowthMeetingInbox,
} from "@/lib/growth/meeting-intelligence/meeting-repository"
import {
  GROWTH_MEETING_INBOX_VIEWS,
  GROWTH_MEETING_PROVIDERS,
  GROWTH_MEETING_STATUSES,
} from "@/lib/growth/meeting-intelligence/meeting-intelligence-types"
import {
  GROWTH_MEETING_SCHEMA_SETUP_MESSAGE,
  isGrowthMeetingSchemaReady,
} from "@/lib/growth/meeting-intelligence/meeting-schema-health"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const schemaReady = await isGrowthMeetingSchemaReady(access.admin)
  if (!schemaReady) {
    return NextResponse.json({
      ok: true,
      meta: { schemaReady: false, setupMessage: GROWTH_MEETING_SCHEMA_SETUP_MESSAGE },
      feed: { items: [] },
    })
  }

  const url = new URL(request.url)
  const view = z.enum(GROWTH_MEETING_INBOX_VIEWS).catch("upcoming").parse(url.searchParams.get("view"))
  const ownerUserIdParam = url.searchParams.get("ownerUserId")
  const ownerUserId =
    ownerUserIdParam === "me"
      ? access.userId
      : ownerUserIdParam && z.string().uuid().safeParse(ownerUserIdParam).success
        ? ownerUserIdParam
        : undefined
  const statusParam = url.searchParams.get("status")
  const status =
    statusParam && z.enum(GROWTH_MEETING_STATUSES).safeParse(statusParam).success ? statusParam : undefined
  const providerParam = url.searchParams.get("provider")
  const provider =
    providerParam && z.enum(GROWTH_MEETING_PROVIDERS).safeParse(providerParam).success ? providerParam : undefined
  const limit = z.coerce.number().int().min(1).max(100).catch(50).parse(url.searchParams.get("limit"))

  try {
    const items = await listGrowthMeetingInbox(access.admin, {
      view,
      ownerUserId,
      status,
      provider,
      limit,
    })
    const enriched = await attachCompanyNamesToMeetings(access.admin, items)
    return NextResponse.json({ ok: true, meta: { schemaReady: true }, feed: { items: enriched } })
  } catch {
    return NextResponse.json({ error: "fetch_failed", message: "Could not load meetings." }, { status: 500 })
  }
}
