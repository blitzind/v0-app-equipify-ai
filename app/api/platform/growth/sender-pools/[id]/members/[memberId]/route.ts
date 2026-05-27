import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { removeSenderPoolMember } from "@/lib/growth/sender-pools/sender-pool-repository"
import { isGrowthSenderPoolIntelligenceSchemaReady } from "@/lib/growth/sender-pools/sender-pool-schema-health"

export const runtime = "nodejs"

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; memberId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthSenderPoolIntelligenceSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const { memberId } = await context.params
  try {
    await removeSenderPoolMember(access.admin, memberId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "delete_failed", message }, { status: 500 })
  }
}
