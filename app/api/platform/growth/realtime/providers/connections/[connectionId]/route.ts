import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  fetchRealtimeProviderConnection,
  sanitizeRealtimeProviderConnectionForApi,
  updateRealtimeProviderConnection,
} from "@/lib/growth/realtime/providers/realtime-provider-connection-repository"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const PatchSchema = z.object({
  label: z.string().trim().min(1).max(120).optional(),
  status: z.enum(["inactive", "connecting", "connected", "error"]).optional(),
  configJson: z.record(z.unknown()).optional(),
})

export async function GET(
  _request: Request,
  context: { params: Promise<{ connectionId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { connectionId } = await context.params
  if (!UUID_RE.test(connectionId)) {
    return NextResponse.json({ error: "invalid_id", message: "Invalid id." }, { status: 400 })
  }

  try {
    const connection = await fetchRealtimeProviderConnection(access.admin, connectionId)
    if (!connection) {
      return NextResponse.json({ error: "not_found", message: "Connection not found." }, { status: 404 })
    }
    return NextResponse.json({ ok: true, connection: sanitizeRealtimeProviderConnectionForApi(connection) })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ connectionId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { connectionId } = await context.params
  if (!UUID_RE.test(connectionId)) {
    return NextResponse.json({ error: "invalid_id", message: "Invalid id." }, { status: 400 })
  }

  const parsed = PatchSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid update payload." }, { status: 400 })
  }

  try {
    const connection = await updateRealtimeProviderConnection(access.admin, connectionId, parsed.data)
    return NextResponse.json({ ok: true, connection: sanitizeRealtimeProviderConnectionForApi(connection) })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "update_failed", message }, { status: 500 })
  }
}
