import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { listGrowthSuppressionEntries, upsertGrowthSuppressionEntry } from "@/lib/growth/outbound/suppression-repository"
import { GROWTH_SUPPRESSION_REASONS } from "@/lib/growth/outbound/types"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const entries = await listGrowthSuppressionEntries(access.admin)
    return NextResponse.json({ ok: true, entries })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "list_failed", message }, { status: 500 })
  }
}

const PostSchema = z.object({
  email: z.string().email(),
  reason: z.enum(GROWTH_SUPPRESSION_REASONS),
  notes: z.string().trim().max(500).optional(),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const raw = await request.json().catch(() => null)
  const parsed = PostSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid suppression payload." }, { status: 400 })
  }

  try {
    const entry = await upsertGrowthSuppressionEntry(access.admin, {
      email: parsed.data.email,
      reason: parsed.data.reason,
      source: "manual",
      notes: parsed.data.notes,
    })
    return NextResponse.json({ ok: true, entry }, { status: 201 })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "create_failed", message }, { status: 500 })
  }
}
