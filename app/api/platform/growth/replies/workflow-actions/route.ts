import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { listReplyWorkflowActions } from "@/lib/growth/reply-intelligence/workflow-actions-repository"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const leadId = url.searchParams.get("leadId")
  const status = url.searchParams.get("status") ?? "pending_review"
  const limit = z.coerce.number().int().min(1).max(100).catch(50).parse(url.searchParams.get("limit") ?? "50")

  try {
    const items = await listReplyWorkflowActions(access.admin, {
      leadId: leadId && z.string().uuid().safeParse(leadId).success ? leadId : undefined,
      status: status === "all" ? undefined : status,
      limit,
    })
    return NextResponse.json({ ok: true, items })
  } catch {
    return NextResponse.json({ error: "fetch_failed", message: "Could not load workflow actions." }, { status: 500 })
  }
}
