import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  bulkEnrollLeadsInGrowthSequence,
  GROWTH_SEQUENCE_BULK_ENROLL_MAX_LEADS,
} from "@/lib/growth/sequence-enrollment/bulk-sequence-enrollment"
import { GROWTH_SEQUENCE_BULK_ENROLL_QA_MARKER } from "@/lib/growth/sequence-enrollment/bulk-sequence-enrollment-types"

export const runtime = "nodejs"

const BodySchema = z
  .object({
    leadIds: z.array(z.string().uuid()).min(1),
    sequencePatternId: z.string().uuid().optional(),
    sequenceTemplateId: z.string().uuid().optional(),
    startImmediately: z.boolean().optional(),
    scheduledStartAt: z.string().datetime().optional().nullable(),
    assignedTo: z.string().uuid().optional().nullable(),
    ownerUserId: z.string().uuid().optional().nullable(),
    dryRun: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.sequencePatternId && !value.sequenceTemplateId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "sequencePatternId is required for scheduler-compatible bulk enrollment.",
        path: ["sequencePatternId"],
      })
    }
    if (value.sequenceTemplateId && !value.sequencePatternId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "sequenceTemplateId is not supported for bulk enrollment — use sequencePatternId (Growth sequence patterns).",
        path: ["sequenceTemplateId"],
      })
    }
  })

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", message: "Invalid bulk enrollment payload.", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  if (parsed.data.leadIds.length > GROWTH_SEQUENCE_BULK_ENROLL_MAX_LEADS) {
    return NextResponse.json(
      {
        error: "batch_limit_exceeded",
        message: `Bulk enrollment supports at most ${GROWTH_SEQUENCE_BULK_ENROLL_MAX_LEADS} leads per request.`,
        limit: GROWTH_SEQUENCE_BULK_ENROLL_MAX_LEADS,
        requested: parsed.data.leadIds.length,
      },
      { status: 400 },
    )
  }

  try {
    const result = await bulkEnrollLeadsInGrowthSequence(access.admin, {
      leadIds: parsed.data.leadIds,
      sequencePatternId: parsed.data.sequencePatternId!,
      startImmediately: parsed.data.startImmediately,
      scheduledStartAt: parsed.data.scheduledStartAt ?? null,
      ownerUserId: parsed.data.ownerUserId ?? parsed.data.assignedTo ?? null,
      actingUserId: access.userId,
      actingUserEmail: access.userEmail,
      dryRun: parsed.data.dryRun,
    })

    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_SEQUENCE_BULK_ENROLL_QA_MARKER,
      result,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "bulk_enroll_failed"
    const status = message === "pattern_not_found" ? 404 : 500
    return NextResponse.json({ error: "bulk_enroll_failed", message }, { status })
  }
}
