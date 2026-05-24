import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  createRealtimeProviderConnection,
  listRealtimeProviderConnections,
  sanitizeRealtimeProviderConnectionForApi,
} from "@/lib/growth/realtime/providers/realtime-provider-connection-repository"

export const runtime = "nodejs"

const CreateSchema = z.object({
  provider: z.enum(["deepgram", "assemblyai", "openai_realtime", "custom"]),
  label: z.string().trim().min(1).max(120),
  configJson: z.record(z.unknown()).optional(),
})

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const connections = await listRealtimeProviderConnections(access.admin)
    return NextResponse.json({
      ok: true,
      connections: connections.map(sanitizeRealtimeProviderConnectionForApi),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = CreateSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid connection payload." }, { status: 400 })
  }

  try {
    const connection = await createRealtimeProviderConnection(access.admin, {
      provider: parsed.data.provider,
      label: parsed.data.label,
      configJson: parsed.data.configJson,
      createdBy: access.userId,
    })
    return NextResponse.json({ ok: true, connection: sanitizeRealtimeProviderConnectionForApi(connection) })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "create_failed", message }, { status: 500 })
  }
}
