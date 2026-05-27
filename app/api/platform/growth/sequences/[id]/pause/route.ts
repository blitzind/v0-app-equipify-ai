import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { pauseSequenceEnrollment } from "@/lib/growth/sequences/sequence-repository"
import { isGrowthSequenceExecutionSchemaReady } from "@/lib/growth/sequences/sequence-schema-health"

export const runtime = "nodejs"

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthSequenceExecutionSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const { id } = await context.params

  try {
    const enrollment = await pauseSequenceEnrollment(access.admin, id, {
      actorUserId: access.userId,
      actorEmail: access.userEmail,
    })
    return NextResponse.json({ ok: true, enrollment })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not pause sequence."
    const status =
      message === "sequence_enrollment_not_found"
        ? 404
        : message === "invalid_sequence_enrollment_transition"
          ? 409
          : 500
    return NextResponse.json({ error: "sequence_pause_failed", message }, { status })
  }
}
