import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  fetchGrowthProviderConnectionInternal,
  updateGrowthProviderConnectionCredentials,
} from "@/lib/growth/outbound/provider-connection-repository"

export const runtime = "nodejs"

const CredentialsSchema = z.object({
  apiKey: z.string().trim().min(1).max(500).optional(),
  apiSecret: z.string().trim().min(1).max(500).optional(),
  accessToken: z.string().trim().min(1).max(2000).optional(),
  refreshToken: z.string().trim().min(1).max(2000).optional(),
  password: z.string().trim().min(1).max(500).optional(),
})

export async function PATCH(
  request: Request,
  context: { params: Promise<{ connectionId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { connectionId } = await context.params
  if (!z.string().uuid().safeParse(connectionId).success) {
    return NextResponse.json({ error: "invalid_connection_id", message: "Connection id must be a UUID." }, { status: 400 })
  }

  const rawBody = await request.json().catch(() => null)
  const parsed = CredentialsSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid credentials payload." }, { status: 400 })
  }

  const credentials = Object.fromEntries(
    Object.entries(parsed.data).filter(([, value]) => value != null && value !== ""),
  )
  if (Object.keys(credentials).length === 0) {
    return NextResponse.json({ error: "invalid_body", message: "At least one credential field is required." }, { status: 400 })
  }

  try {
    const existing = await fetchGrowthProviderConnectionInternal(access.admin, connectionId)
    if (!existing) {
      return NextResponse.json({ error: "not_found", message: "Connection not found." }, { status: 404 })
    }

    const connection = await updateGrowthProviderConnectionCredentials(
      access.admin,
      connectionId,
      credentials,
    )
    return NextResponse.json({ ok: true, connection })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "credentials_update_failed", message }, { status: 500 })
  }
}
