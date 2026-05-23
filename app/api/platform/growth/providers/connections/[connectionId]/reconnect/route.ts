import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { appendGrowthPlatformTimelineEvent } from "@/lib/growth/outbound/platform-timeline-repository"
import {
  fetchGrowthProviderConnectionInternal,
  reconnectGrowthProviderConnection,
} from "@/lib/growth/outbound/provider-connection-repository"

export const runtime = "nodejs"

export async function POST(
  _request: Request,
  context: { params: Promise<{ connectionId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { connectionId } = await context.params
  if (!z.string().uuid().safeParse(connectionId).success) {
    return NextResponse.json({ error: "invalid_connection_id", message: "Connection id must be a UUID." }, { status: 400 })
  }

  try {
    const existing = await fetchGrowthProviderConnectionInternal(access.admin, connectionId)
    if (!existing) {
      return NextResponse.json({ error: "not_found", message: "Connection not found." }, { status: 404 })
    }

    const connection = await reconnectGrowthProviderConnection(access.admin, connectionId)
    await appendGrowthPlatformTimelineEvent(access.admin, {
      connectionId,
      eventType: "provider_reconnected",
      title: `${connection.label} reconnected`,
      summary: "Provider connection moved back to configuring; run validation.",
      actorUserId: access.userId,
      actorEmail: access.userEmail,
    })
    return NextResponse.json({ ok: true, connection })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "reconnect_failed", message }, { status: 500 })
  }
}
