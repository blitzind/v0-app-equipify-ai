import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  fetchGrowthProviderConnectionInternal,
  updateGrowthProviderConnectionDetails,
} from "@/lib/growth/outbound/provider-connection-repository"

export const runtime = "nodejs"

const PatchSchema = z.object({
  label: z.string().trim().min(1).max(120).optional(),
  apiBaseUrl: z.string().trim().url().nullable().optional(),
  config: z.record(z.unknown()).optional(),
  monthlyCostEstimate: z.number().min(0).nullable().optional(),
  seatCount: z.number().int().min(0).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
  webhookSecret: z.string().trim().max(500).nullable().optional(),
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
  const parsed = PatchSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid connection payload." }, { status: 400 })
  }

  try {
    const existing = await fetchGrowthProviderConnectionInternal(access.admin, connectionId)
    if (!existing) {
      return NextResponse.json({ error: "not_found", message: "Connection not found." }, { status: 404 })
    }

    const connection = await updateGrowthProviderConnectionDetails(access.admin, connectionId, parsed.data)
    return NextResponse.json({ ok: true, connection })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "update_failed", message }, { status: 500 })
  }
}
