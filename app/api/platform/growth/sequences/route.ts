import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  createSequenceTemplate,
  listLeadsForSequenceEnrollment,
  listSequenceEnrollments,
  listSequenceTemplates,
} from "@/lib/growth/sequences/sequence-repository"
import { isGrowthSequenceExecutionSchemaReady } from "@/lib/growth/sequences/sequence-schema-health"
import {
  GROWTH_SEQUENCE_EXECUTION_FOUNDATION_QA_MARKER,
  GROWTH_SEQUENCE_EXECUTION_PRIVACY_NOTE,
  GROWTH_SEQUENCE_GENERATION_TYPES,
  GROWTH_SEQUENCE_STEP_CHANNELS,
} from "@/lib/growth/sequences/sequence-types"

export const runtime = "nodejs"

const StepSchema = z.object({
  stepNumber: z.number().int().min(1),
  channel: z.enum(GROWTH_SEQUENCE_STEP_CHANNELS),
  delayDays: z.number().int().min(0),
  generationType: z.enum(GROWTH_SEQUENCE_GENERATION_TYPES),
  approvalRequired: z.boolean().optional(),
})

const CreateSequenceSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).nullable().optional(),
  category: z.string().trim().max(120).nullable().optional(),
  approvalRequired: z.boolean().optional(),
  exitOnReply: z.boolean().optional(),
  exitOnMeeting: z.boolean().optional(),
  exitOnPositiveIntent: z.boolean().optional(),
  steps: z.array(StepSchema).min(1).max(20),
})

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthSequenceExecutionSchemaReady(access.admin))) {
    return NextResponse.json(
      {
        error: "growth_schema_incomplete",
        message: "Apply migration 20270128120000_growth_sequence_execution.sql, then reload.",
      },
      { status: 503 },
    )
  }

  try {
    const [templates, enrollments, leads] = await Promise.all([
      listSequenceTemplates(access.admin),
      listSequenceEnrollments(access.admin),
      listLeadsForSequenceEnrollment(access.admin),
    ])
    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_SEQUENCE_EXECUTION_FOUNDATION_QA_MARKER,
      privacy_note: GROWTH_SEQUENCE_EXECUTION_PRIVACY_NOTE,
      templates,
      enrollments,
      leads,
    })
  } catch (error) {
    return NextResponse.json(
      { error: "sequence_list_failed", message: error instanceof Error ? error.message : "Could not load sequences." },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthSequenceExecutionSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const parsed = CreateSequenceSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid sequence template payload." }, { status: 400 })
  }

  try {
    const template = await createSequenceTemplate(access.admin, {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      category: parsed.data.category ?? null,
      approval_required: parsed.data.approvalRequired,
      exit_on_reply: parsed.data.exitOnReply,
      exit_on_meeting: parsed.data.exitOnMeeting,
      exit_on_positive_intent: parsed.data.exitOnPositiveIntent,
      steps: parsed.data.steps.map((step) => ({
        step_number: step.stepNumber,
        channel: step.channel,
        delay_days: step.delayDays,
        generation_type: step.generationType,
        approval_required: step.approvalRequired,
      })),
      actorUserId: access.userId,
      actorEmail: access.userEmail,
    })
    return NextResponse.json({ ok: true, template }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: "sequence_create_failed", message: error instanceof Error ? error.message : "Could not create sequence." },
      { status: 500 },
    )
  }
}
