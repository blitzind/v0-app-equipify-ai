import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  GROWTH_AI_COPILOT_GENERATION_TYPES,
  GROWTH_AI_COPILOT_PROMPT_VARIANTS,
} from "@/lib/growth/ai-copilot-types"
import { runGrowthAiCopilotGeneration } from "@/lib/growth/run-ai-copilot-generation"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const BodySchema = z.object({
  generationType: z.enum(GROWTH_AI_COPILOT_GENERATION_TYPES),
  promptVariant: z.enum(GROWTH_AI_COPILOT_PROMPT_VARIANTS).optional(),
  sourceReplyId: z.string().uuid().nullable().optional(),
  senderAccountId: z.string().uuid().optional(),
  senderProfileId: z.string().uuid().optional(),
})

export async function POST(
  request: Request,
  context: { params: Promise<{ leadId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { leadId } = await context.params
  if (!UUID_RE.test(leadId)) {
    return NextResponse.json({ error: "invalid_lead", message: "Invalid lead id." }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid generation payload." }, { status: 400 })
  }

  const result = await runGrowthAiCopilotGeneration({
    admin: access.admin,
    leadId,
    generationType: parsed.data.generationType,
    promptVariant: parsed.data.promptVariant,
    sourceReplyId: parsed.data.sourceReplyId,
    senderAccountId: parsed.data.senderAccountId,
    senderProfileId: parsed.data.senderProfileId,
    actingUserId: access.userId,
    actingUserEmail: access.userEmail,
  })

  if (!result.ok) {
    return NextResponse.json(
      { error: result.code, message: result.message },
      { status: result.code === "rule_blocked" ? 409 : 400 },
    )
  }

  return NextResponse.json({ ok: true, generation: result.generation })
}
