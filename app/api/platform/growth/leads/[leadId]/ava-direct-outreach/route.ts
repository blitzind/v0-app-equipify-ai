/**
 * AVA-SUPERVISED-CUTOVER-1A — Platform-operator entry for supervised GPT reasoning.
 * Replaces legacy ava-direct-outreach reasoning. Does not send outbound. Does not touch Home.
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  AVA_SUPERVISED_CUTOVER_1A_QA_MARKER,
  runEquipifySupervisedAvaOutreach,
} from "@/lib/growth/ava-reasoning/equipify-supervised-cutover-service"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const BodySchema = z
  .object({
    persist: z.boolean().optional(),
  })
  .optional()

export async function POST(
  request: Request,
  context: { params: Promise<{ leadId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess(request, {
    minimumRole: "growth_operator",
  })
  if (!access.ok) return access.response

  const { leadId } = await context.params
  if (!UUID_RE.test(leadId)) {
    return NextResponse.json({ error: "invalid_lead", message: "Invalid lead id." }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid request body." }, { status: 400 })
  }

  const result = await runEquipifySupervisedAvaOutreach({
    admin: access.admin,
    leadId,
    actingUserId: access.userId,
    actingUserEmail: access.userEmail,
    persist: parsed.data?.persist,
  })

  if (!result.ok) {
    const status =
      result.code === "lead_not_found"
        ? 404
        : result.code === "organization_unavailable"
          ? 503
          : result.code === "model_failed"
            ? 502
            : 400
    return NextResponse.json(
      { error: result.code, message: result.message, qaMarker: AVA_SUPERVISED_CUTOVER_1A_QA_MARKER },
      { status },
    )
  }

  return NextResponse.json({
    ok: true,
    qaMarker: AVA_SUPERVISED_CUTOVER_1A_QA_MARKER,
    output: result.output,
  })
}
