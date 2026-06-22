import { NextResponse } from "next/server"
import { growthSharePageAiDraftSchema } from "@/lib/growth/share-pages/share-page-api-schema"
import { generateSharePageDraft } from "@/lib/growth/share-pages/share-page-operator-service"
import { requireSharePagePlatformAccess } from "@/lib/growth/share-pages/share-page-platform-access"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const access = await requireSharePagePlatformAccess()
  if (!access.ok) return access.response

  const parsed = growthSharePageAiDraftSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body", message: "Invalid AI draft payload." }, { status: 400 })
  }

  const draft = await generateSharePageDraft(parsed.data)
  return NextResponse.json({
    ok: true,
    draft,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    qa_marker: draft.qaMarker,
  })
}
