import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildSequencePreviewReadinessPayload } from "@/lib/growth/sequence-preview/sequence-preview-route-gates"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  return NextResponse.json({
    ok: true,
    ...buildSequencePreviewReadinessPayload(),
  })
}
