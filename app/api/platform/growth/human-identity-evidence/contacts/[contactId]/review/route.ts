import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess, logGrowthEngine } from "@/lib/growth/access"
import { submitHumanIdentityEvidenceReview } from "@/lib/growth/human-identity-evidence/human-identity-evidence-review"
import { GROWTH_HUMAN_IDENTITY_EVIDENCE_QA_MARKER } from "@/lib/growth/human-identity-evidence/human-identity-evidence-types"

export const runtime = "nodejs"
export const maxDuration = 120

const BodySchema = z.object({
  actions: z
    .array(
      z.enum([
        "mark_contact_verified",
        "mark_phone_verified",
        "update_name_from_evidence",
        "update_title_from_evidence",
      ]),
    )
    .min(1),
  full_name: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
  review_note: z.string().optional().nullable(),
  rerun_phone_discovery: z.boolean().optional(),
})

export async function POST(
  request: Request,
  context: { params: Promise<{ contactId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { contactId } = await context.params
  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "validation_error", message: "Invalid review payload." },
      { status: 400 },
    )
  }

  const result = await submitHumanIdentityEvidenceReview(access.admin, {
    company_contact_id: contactId.trim(),
    actions: parsed.data.actions,
    full_name: parsed.data.full_name,
    title: parsed.data.title,
    review_note: parsed.data.review_note,
    rerun_phone_discovery: parsed.data.rerun_phone_discovery,
    reviewer_user_id: access.userId,
    reviewer_email: access.userEmail,
  })

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, qa_marker: GROWTH_HUMAN_IDENTITY_EVIDENCE_QA_MARKER, result },
      { status: 400 },
    )
  }

  logGrowthEngine("human_identity_evidence_review", {
    review_id: result.review_id,
    company_contact_id: result.company_contact_id,
    fields_changed: result.fields_changed,
    phone_promoted_count: result.phone_discovery?.promoted_count ?? 0,
    reviewer: access.userEmail,
  })

  return NextResponse.json({
    ok: true,
    qa_marker: GROWTH_HUMAN_IDENTITY_EVIDENCE_QA_MARKER,
    result,
  })
}
