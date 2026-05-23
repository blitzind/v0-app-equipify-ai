import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { updateGrowthOutboundConnection } from "@/lib/growth/outbound/connection-repository"

export const runtime = "nodejs"

const PatchSchema = z.object({
  monthlyCostEstimate: z.number().min(0).nullable().optional(),
  seatCount: z.number().int().min(0).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
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
    const connection = await updateGrowthOutboundConnection(access.admin, connectionId, {
      monthlyCostEstimate: parsed.data.monthlyCostEstimate,
      seatCount: parsed.data.seatCount,
      notes: parsed.data.notes,
    })
    return NextResponse.json({ ok: true, connection })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "update_failed", message }, { status: 500 })
  }
}
