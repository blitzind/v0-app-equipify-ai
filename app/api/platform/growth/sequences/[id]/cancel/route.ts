import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { cancelSequenceEnrollment } from "@/lib/growth/sequences/sequence-repository"
import { isGrowthSequenceExecutionSchemaReady } from "@/lib/growth/sequences/sequence-schema-health"

export const runtime = "nodejs"

const CancelSchema = z.object({
  reason: z.string().trim().max(500).optional(),
})

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthSequenceExecutionSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const { id } = await context.params
  const parsed = CancelSchema.safeParse(await request.json().catch(() => ({})))

  try {
    const enrollment = await cancelSequenceEnrollment(access.admin, id, {
      reason: parsed.success ? parsed.data.reason : undefined,
      actorUserId: access.userId,
      actorEmail: access.userEmail,
    })
    return NextResponse.json({ ok: true, enrollment })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not cancel sequence."
    const status =
      message === "sequence_enrollment_not_found"
        ? 404
        : message === "invalid_sequence_enrollment_transition"
          ? 409
          : 500
    return NextResponse.json({ error: "sequence_cancel_failed", message }, { status })
  }
}
