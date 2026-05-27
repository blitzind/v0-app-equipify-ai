import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { generateInboxReplyDraft } from "@/lib/growth/replies/reply-draft-repository"
import { isGrowthAiReplyDraftingSchemaReady } from "@/lib/growth/replies/reply-draft-schema-health"
import { GROWTH_REPLY_DRAFT_TYPES } from "@/lib/growth/replies/reply-draft-types"
import { GROWTH_AI_REPLY_DRAFTING_PRIVACY_NOTE } from "@/lib/growth/replies/reply-draft-types"

export const runtime = "nodejs"

const BodySchema = z.object({
  inboxThreadId: z.string().uuid(),
  draftType: z.enum(GROWTH_REPLY_DRAFT_TYPES).optional(),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthAiReplyDraftingSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete", message: "Apply reply drafting migration." }, { status: 503 })
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid generate payload." }, { status: 400 })
  }

  try {
    const draft = await generateInboxReplyDraft(access.admin, {
      inboxThreadId: parsed.data.inboxThreadId,
      draftType: parsed.data.draftType,
      actingUserId: access.userId,
      actingUserEmail: access.userEmail,
    })
    return NextResponse.json({ ok: true, draft, privacy_note: GROWTH_AI_REPLY_DRAFTING_PRIVACY_NOTE })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not generate reply draft."
    const status = message === "thread_not_found" || message === "lead_not_found" ? 404 : 500
    return NextResponse.json({ error: "generate_failed", message }, { status })
  }
}
