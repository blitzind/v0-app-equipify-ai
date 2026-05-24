import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { cancelGrowthSequenceEnrollment } from "@/lib/growth/sequence-enrollment/sequence-enrollment-orchestrator"

export const runtime = "nodejs"

const BodySchema = z.object({ reason: z.string().min(1).max(500) })

export async function POST(
  request: Request,
  context: { params: Promise<{ leadId: string; enrollmentId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 })

  const { leadId, enrollmentId } = await context.params
  try {
    const enrollment = await cancelGrowthSequenceEnrollment(access.admin, {
      leadId,
      enrollmentId,
      reason: parsed.data.reason,
      actingUserId: access.userId,
      actingUserEmail: access.userEmail,
    })
    return NextResponse.json({ ok: true, enrollment })
  } catch (e) {
    const code = e instanceof Error ? e.message : "cancel_failed"
    return NextResponse.json({ error: code }, { status: 409 })
  }
}
