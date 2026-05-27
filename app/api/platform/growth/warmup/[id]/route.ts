import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  getWarmupProfile,
  softDeleteWarmupProfile,
  updateWarmupProfile,
} from "@/lib/growth/warmup/warmup-repository"
import { isGrowthWarmupFoundationSchemaReady } from "@/lib/growth/warmup/warmup-schema-health"
import { GROWTH_WARMUP_PROFILE_STATUSES } from "@/lib/growth/warmup/warmup-types"

export const runtime = "nodejs"

const UpdateWarmupSchema = z.object({
  notes: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(GROWTH_WARMUP_PROFILE_STATUSES).optional(),
  warmupDays: z.number().int().min(1).max(120).optional(),
})

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  const profile = await getWarmupProfile(access.admin, id)
  if (!profile) {
    return NextResponse.json({ error: "warmup_profile_not_found", message: "Warmup profile not found." }, { status: 404 })
  }
  return NextResponse.json({ ok: true, profile })
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthWarmupFoundationSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const { id } = await context.params
  const parsed = UpdateWarmupSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid warmup update payload." }, { status: 400 })
  }

  try {
    const profile = await updateWarmupProfile(access.admin, id, {
      notes: parsed.data.notes,
      status: parsed.data.status,
      warmup_days: parsed.data.warmupDays,
      actorUserId: access.userId,
      actorEmail: access.userEmail,
    })
    return NextResponse.json({ ok: true, profile })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update warmup profile."
    const status = message === "warmup_profile_not_found" ? 404 : 500
    return NextResponse.json({ error: "warmup_update_failed", message }, { status })
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthWarmupFoundationSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const { id } = await context.params

  try {
    const result = await softDeleteWarmupProfile(access.admin, id)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete warmup profile."
    const status = message === "warmup_profile_not_found" ? 404 : 500
    return NextResponse.json({ error: "warmup_delete_failed", message }, { status })
  }
}
