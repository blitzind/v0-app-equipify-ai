import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthAiCopilotGenerationById } from "@/lib/growth/ai-copilot-repository"
import { isAvaSupervisedOutboundGeneration } from "@/lib/growth/ava-reasoning/ava-supervised-outbound-1a-types"
import { buildCustomerPackageReviewHref } from "@/lib/growth/workspace/ux-1a/review/growth-review-routes"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(
  _request: Request,
  context: { params: Promise<{ generationId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { generationId } = await context.params
  if (!UUID_RE.test(generationId)) {
    return NextResponse.json(
      { ok: false, error: "approval_response_invalid", message: "Invalid recommendation id." },
      { status: 400 },
    )
  }

  const generation = await fetchGrowthAiCopilotGenerationById(access.admin, generationId)
  if (!generation) {
    return NextResponse.json(
      { ok: false, error: "approval_generation_not_found", message: "This review package could not be loaded." },
      { status: 404 },
    )
  }

  if (!isAvaSupervisedOutboundGeneration(generation)) {
    return NextResponse.json(
      {
        ok: false,
        error: "approval_package_source_mismatch",
        message: "This package must open through its legacy review path.",
      },
      { status: 409 },
    )
  }

  return NextResponse.json({
    ok: true,
    generationId: generation.id,
    leadId: generation.leadId,
    reviewHref: buildCustomerPackageReviewHref(generation.leadId),
  })
}
