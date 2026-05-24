import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { upsertRealtimeProviderCredentials } from "@/lib/growth/realtime/providers/realtime-provider-connection-repository"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const CredentialsSchema = z.object({
  apiKey: z.string().trim().min(1).max(500).optional(),
  apiSecret: z.string().trim().min(1).max(500).optional(),
})

export async function POST(
  request: Request,
  context: { params: Promise<{ connectionId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { connectionId } = await context.params
  if (!UUID_RE.test(connectionId)) {
    return NextResponse.json({ error: "invalid_id", message: "Invalid id." }, { status: 400 })
  }

  const parsed = CredentialsSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid credentials payload." }, { status: 400 })
  }

  try {
    await upsertRealtimeProviderCredentials(access.admin, connectionId, parsed.data)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "credentials_failed", message }, { status: 500 })
  }
}
