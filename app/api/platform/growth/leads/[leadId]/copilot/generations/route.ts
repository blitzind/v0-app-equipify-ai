import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthAiCopilotGenerationById, listGrowthAiCopilotGenerationsForLead } from "@/lib/growth/ai-copilot-repository"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { buildCustomerPackageReviewHref } from "@/lib/growth/workspace/ux-1a/review/growth-review-routes"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(
  _request: Request,
  context: { params: Promise<{ leadId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { leadId } = await context.params
  if (!UUID_RE.test(leadId)) {
    return NextResponse.json({ error: "invalid_lead", message: "Invalid lead id." }, { status: 400 })
  }

  try {
    const lead = await fetchGrowthLeadById(access.admin, leadId)
    if (!lead) {
      const generation = await fetchGrowthAiCopilotGenerationById(access.admin, leadId)
      if (generation) {
        return NextResponse.json(
          {
            ok: false,
            error: "approval_package_source_mismatch",
            message: "This review link used a recommendation id instead of the account id.",
            reviewHref: buildCustomerPackageReviewHref(generation.leadId),
            generationId: generation.id,
            leadId: generation.leadId,
          },
          { status: 409 },
        )
      }
      return NextResponse.json(
        {
          ok: false,
          error: "approval_generation_not_found",
          message: "This review package could not be loaded.",
        },
        { status: 404 },
      )
    }

    const generations = await listGrowthAiCopilotGenerationsForLead(access.admin, leadId, 20)
    return NextResponse.json({ ok: true, generations })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json(
      { ok: false, error: "approval_response_invalid", message: message || "Could not load Ava recommendations." },
      { status: 500 },
    )
  }
}
