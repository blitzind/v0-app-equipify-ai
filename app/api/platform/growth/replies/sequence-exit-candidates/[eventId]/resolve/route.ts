import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { resolveSequenceExitCandidate } from "@/lib/growth/reply-intelligence/sequence-exit-candidates-repository"

export const runtime = "nodejs"

const BodySchema = z.object({
  resolution: z.enum(["resume", "keep_paused", "exit"]),
})

export async function POST(
  request: Request,
  context: { params: Promise<{ eventId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 })

  const { eventId } = await context.params
  if (!z.string().uuid().safeParse(eventId).success) {
    return NextResponse.json({ error: "invalid_event_id" }, { status: 400 })
  }

  try {
    const item = await resolveSequenceExitCandidate(access.admin, {
      eventId,
      resolution: parsed.data.resolution,
      actorUserId: access.userId,
      actorEmail: access.userEmail,
    })
    return NextResponse.json({ ok: true, item })
  } catch (e) {
    const code = e instanceof Error ? e.message : "resolve_failed"
    return NextResponse.json({ error: code }, { status: 409 })
  }
}
