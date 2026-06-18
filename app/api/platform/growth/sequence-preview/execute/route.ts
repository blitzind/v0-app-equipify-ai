import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  assertSequencePreviewExecuteAllowed,
  SEQUENCE_PREVIEW_CONFIRM,
} from "@/lib/growth/sequence-preview/sequence-preview-route-gates"
import { executeSequencePreviewCertification } from "@/lib/growth/sequence-preview/sequence-preview-certification"
import { guardGrowthFeatureApiRoute } from "@/lib/growth/runtime/growth-feature-api-guards"

export const runtime = "nodejs"
export const maxDuration = 300

export async function POST(request: Request) {
  const coldGuard = await guardGrowthFeatureApiRoute("sequencePreviewStudio", request)
  if (coldGuard) return coldGuard
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const gateCheck = assertSequencePreviewExecuteAllowed(process.env)
  if (!gateCheck.ok) {
    return NextResponse.json({ ok: false, blockers: gateCheck.blockers }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const confirm = (body as Record<string, unknown> | null)?.confirm
  if (confirm !== SEQUENCE_PREVIEW_CONFIRM) {
    return NextResponse.json({ ok: false, error: "confirm_token_mismatch" }, { status: 400 })
  }

  const report = await executeSequencePreviewCertification(access.admin, {
    dry_run: (body as Record<string, unknown>)?.dry_run === true,
  })

  return NextResponse.json(report, { status: report.ok ? 200 : 422 })
}
