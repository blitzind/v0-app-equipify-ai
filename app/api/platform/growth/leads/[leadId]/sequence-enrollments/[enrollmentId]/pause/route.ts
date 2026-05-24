import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { pauseGrowthSequenceEnrollment } from "@/lib/growth/sequence-enrollment/sequence-enrollment-orchestrator"

export const runtime = "nodejs"

const BodySchema = z.object({ pauseReason: z.string().min(1).max(500) })

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
    const enrollment = await pauseGrowthSequenceEnrollment(access.admin, {
      leadId,
      enrollmentId,
      pauseReason: parsed.data.pauseReason,
    })
    return NextResponse.json({ ok: true, enrollment })
  } catch (e) {
    const code = e instanceof Error ? e.message : "pause_failed"
    return NextResponse.json({ error: code }, { status: 409 })
  }
}
