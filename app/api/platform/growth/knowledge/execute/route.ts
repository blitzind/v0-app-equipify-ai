import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  assertKnowledgeCenterFoundationAllowed,
  executeKnowledgeCenterFoundationCertification,
  KNOWLEDGE_CENTER_CONFIRM,
} from "@/lib/growth/knowledge-center/knowledge-certification"

export const runtime = "nodejs"
export const maxDuration = 300

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const gateCheck = assertKnowledgeCenterFoundationAllowed(process.env)
  if (!gateCheck.ok) {
    return NextResponse.json({ ok: false, blockers: gateCheck.blockers }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const confirm = (body as Record<string, unknown> | null)?.confirm
  if (confirm !== KNOWLEDGE_CENTER_CONFIRM) {
    return NextResponse.json({ ok: false, error: "confirm_token_mismatch" }, { status: 400 })
  }

  const report = await executeKnowledgeCenterFoundationCertification(access.admin, {
    dry_run: (body as Record<string, unknown>)?.dry_run === true,
  })

  return NextResponse.json(report, { status: report.ok ? 200 : 422 })
}
