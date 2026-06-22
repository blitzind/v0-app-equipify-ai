import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthCommunicationsSettingsAccess } from "@/lib/growth/settings/growth-workspace-settings-api-access"
import { addSenderPoolMember, listSenderPoolMembers } from "@/lib/growth/sender-pools/sender-pool-repository"
import { isGrowthSenderPoolIntelligenceSchemaReady } from "@/lib/growth/sender-pools/sender-pool-schema-health"
import { GROWTH_SENDER_POOL_MEMBER_STATUSES } from "@/lib/growth/sender-pools/sender-pool-types"

export const runtime = "nodejs"

const AddMemberSchema = z.object({
  senderAccountId: z.string().uuid(),
  memberStatus: z.enum(GROWTH_SENDER_POOL_MEMBER_STATUSES).optional(),
  priorityWeight: z.number().int().min(0).max(10000).optional(),
  manualPriority: z.number().int().min(0).max(10000).optional(),
  notes: z.string().trim().max(1000).optional(),
})

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireGrowthCommunicationsSettingsAccess(request)
  if (!access.ok) return access.response

  if (!(await isGrowthSenderPoolIntelligenceSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const { id } = await context.params
  try {
    const members = await listSenderPoolMembers(access.admin, id)
    return NextResponse.json({ ok: true, members })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireGrowthCommunicationsSettingsAccess(request)
  if (!access.ok) return access.response

  if (!(await isGrowthSenderPoolIntelligenceSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const parsed = AddMemberSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid pool member payload." }, { status: 400 })
  }

  const { id } = await context.params
  try {
    const member = await addSenderPoolMember(access.admin, {
      senderPoolId: id,
      senderAccountId: parsed.data.senderAccountId,
      memberStatus: parsed.data.memberStatus,
      priorityWeight: parsed.data.priorityWeight,
      manualPriority: parsed.data.manualPriority,
      notes: parsed.data.notes,
    })
    return NextResponse.json({ ok: true, member })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "create_failed", message }, { status: 500 })
  }
}
