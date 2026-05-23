import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  approveGrowthAiCopilotGeneration,
  discardGrowthAiCopilotGeneration,
} from "@/lib/growth/run-ai-copilot-generation"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(
  _request: Request,
  context: { params: Promise<{ generationId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { generationId } = await context.params
  if (!UUID_RE.test(generationId)) {
    return NextResponse.json({ error: "invalid_generation", message: "Invalid generation id." }, { status: 400 })
  }

  try {
    const generation = await approveGrowthAiCopilotGeneration(access.admin, {
      generationId,
      actingUserId: access.userId,
      actingUserEmail: access.userEmail,
    })
    if (!generation) {
      return NextResponse.json({ error: "not_found", message: "Generation not found." }, { status: 404 })
    }
    return NextResponse.json({ ok: true, generation })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "approve_failed", message }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ generationId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { generationId } = await context.params
  if (!UUID_RE.test(generationId)) {
    return NextResponse.json({ error: "invalid_generation", message: "Invalid generation id." }, { status: 400 })
  }

  try {
    const generation = await discardGrowthAiCopilotGeneration(access.admin, generationId)
    if (!generation) {
      return NextResponse.json({ error: "not_found", message: "Generation not found." }, { status: 404 })
    }
    return NextResponse.json({ ok: true, generation })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "discard_failed", message }, { status: 500 })
  }
}
