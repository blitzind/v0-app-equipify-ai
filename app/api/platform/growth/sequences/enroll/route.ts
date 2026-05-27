import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { enrollLeadInSequence } from "@/lib/growth/sequences/sequence-repository"
import { isGrowthSequenceExecutionSchemaReady } from "@/lib/growth/sequences/sequence-schema-health"

export const runtime = "nodejs"

const EnrollSchema = z.object({
  leadId: z.string().uuid(),
  sequenceTemplateId: z.string().uuid(),
  startImmediately: z.boolean().optional(),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthSequenceExecutionSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const parsed = EnrollSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid enrollment payload." }, { status: 400 })
  }

  try {
    const enrollment = await enrollLeadInSequence(access.admin, {
      lead_id: parsed.data.leadId,
      sequence_template_id: parsed.data.sequenceTemplateId,
      start_immediately: parsed.data.startImmediately ?? true,
      actorUserId: access.userId,
      actorEmail: access.userEmail,
    })
    return NextResponse.json({ ok: true, enrollment }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not enroll lead."
    const status =
      message === "lead_not_found" || message === "sequence_template_not_found"
        ? 404
        : message === "sequence_enrollment_blocked" || message === "sequence_template_has_no_steps"
          ? 409
          : 500
    return NextResponse.json({ error: "sequence_enroll_failed", message }, { status })
  }
}
