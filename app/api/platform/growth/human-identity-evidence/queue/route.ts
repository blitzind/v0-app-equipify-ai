import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { loadHumanIdentityEvidenceQueue } from "@/lib/growth/human-identity-evidence/human-identity-evidence-queue"
import { GROWTH_HUMAN_IDENTITY_EVIDENCE_QA_MARKER } from "@/lib/growth/human-identity-evidence/human-identity-evidence-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const company_id = url.searchParams.get("company_id")?.trim()
  const limit = Number.parseInt(url.searchParams.get("limit") ?? "50", 10)

  const queue = await loadHumanIdentityEvidenceQueue(access.admin, {
    company_ids: company_id ? [company_id] : undefined,
    limit: Number.isFinite(limit) ? limit : 50,
  })

  return NextResponse.json({
    ok: true,
    qa_marker: GROWTH_HUMAN_IDENTITY_EVIDENCE_QA_MARKER,
    count: queue.length,
    queue,
  })
}
