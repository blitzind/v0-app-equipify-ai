import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  getSenderPoolMember,
  removeSenderPoolMember,
  updateSenderPoolMember,
} from "@/lib/growth/sender-pools/sender-pool-repository"
import { isGrowthSenderPoolIntelligenceSchemaReady } from "@/lib/growth/sender-pools/sender-pool-schema-health"
import { GROWTH_SENDER_POOL_MEMBER_STATUSES } from "@/lib/growth/sender-pools/sender-pool-types"

export const runtime = "nodejs"

const PatchMemberSchema = z.object({
  memberStatus: z.enum(GROWTH_SENDER_POOL_MEMBER_STATUSES).optional(),
  manualPriority: z.number().int().min(0).max(10000).optional(),
  priorityWeight: z.number().int().min(0).max(10000).optional(),
  notes: z.string().trim().max(1000).optional(),
  operationalPauseReason: z.string().trim().max(240).nullable().optional(),
})

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; memberId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthSenderPoolIntelligenceSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const parsed = PatchMemberSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid pool member update." }, { status: 400 })
  }

  const { id, memberId } = await context.params
  try {
    const existing = await getSenderPoolMember(access.admin, memberId)
    if (!existing || existing.senderPoolId !== id) {
      return NextResponse.json({ error: "not_found", message: "Pool member not found." }, { status: 404 })
    }

    const member = await updateSenderPoolMember(access.admin, memberId, {
      ...parsed.data,
      actorUserId: access.userId,
      actorEmail: access.userEmail,
    })
    return NextResponse.json({ ok: true, member })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "update_failed", message }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; memberId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthSenderPoolIntelligenceSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const { id, memberId } = await context.params
  try {
    const existing = await getSenderPoolMember(access.admin, memberId)
    if (!existing || existing.senderPoolId !== id) {
      return NextResponse.json({ error: "not_found", message: "Pool member not found." }, { status: 404 })
    }

    await removeSenderPoolMember(access.admin, memberId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "delete_failed", message }, { status: 500 })
  }
}
