import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { softDeleteSequenceTemplate, updateSequenceTemplate } from "@/lib/growth/sequences/sequence-repository"
import { isGrowthSequenceExecutionSchemaReady } from "@/lib/growth/sequences/sequence-schema-health"
import { GROWTH_SEQUENCE_TEMPLATE_STATUSES } from "@/lib/growth/sequences/sequence-types"

export const runtime = "nodejs"

const UpdateSequenceSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  category: z.string().trim().max(120).nullable().optional(),
  status: z.enum(GROWTH_SEQUENCE_TEMPLATE_STATUSES).optional(),
  approvalRequired: z.boolean().optional(),
  exitOnReply: z.boolean().optional(),
  exitOnMeeting: z.boolean().optional(),
  exitOnPositiveIntent: z.boolean().optional(),
})

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthSequenceExecutionSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const { id } = await context.params
  const parsed = UpdateSequenceSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid sequence update payload." }, { status: 400 })
  }

  try {
    const template = await updateSequenceTemplate(access.admin, id, {
      name: parsed.data.name,
      description: parsed.data.description,
      category: parsed.data.category,
      status: parsed.data.status,
      approval_required: parsed.data.approvalRequired,
      exit_on_reply: parsed.data.exitOnReply,
      exit_on_meeting: parsed.data.exitOnMeeting,
      exit_on_positive_intent: parsed.data.exitOnPositiveIntent,
    })
    return NextResponse.json({ ok: true, template })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update sequence."
    const status = message === "sequence_template_not_found" ? 404 : 500
    return NextResponse.json({ error: "sequence_update_failed", message }, { status })
  }
}

export async function DELETE(
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
    const result = await softDeleteSequenceTemplate(access.admin, id)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete sequence."
    const status = message === "sequence_template_not_found" ? 404 : 500
    return NextResponse.json({ error: "sequence_delete_failed", message }, { status })
  }
}
