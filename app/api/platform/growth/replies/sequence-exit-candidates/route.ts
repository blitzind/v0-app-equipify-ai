import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { listSequenceExitCandidates } from "@/lib/growth/reply-intelligence/sequence-exit-candidates-repository"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const leadId = url.searchParams.get("leadId")
  const pendingOnly = url.searchParams.get("pendingOnly") !== "false"
  const limit = z.coerce.number().int().min(1).max(100).catch(50).parse(url.searchParams.get("limit") ?? "50")

  try {
    const items = await listSequenceExitCandidates(access.admin, {
      leadId: leadId && z.string().uuid().safeParse(leadId).success ? leadId : undefined,
      pendingOnly,
      limit,
    })
    return NextResponse.json({ ok: true, items })
  } catch {
    return NextResponse.json({ error: "fetch_failed", message: "Could not load sequence exit candidates." }, { status: 500 })
  }
}
