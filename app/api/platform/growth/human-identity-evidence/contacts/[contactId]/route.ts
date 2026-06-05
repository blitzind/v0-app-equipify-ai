import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { loadHumanIdentityEvidenceWorkspace } from "@/lib/growth/human-identity-evidence/human-identity-evidence-workspace"
import { GROWTH_HUMAN_IDENTITY_EVIDENCE_QA_MARKER } from "@/lib/growth/human-identity-evidence/human-identity-evidence-types"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  context: { params: Promise<{ contactId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { contactId } = await context.params
  const workspace = await loadHumanIdentityEvidenceWorkspace(access.admin, contactId.trim())
  if (!workspace) {
    return NextResponse.json(
      { ok: false, error: "not_found", message: "Contact not in review queue." },
      { status: 404 },
    )
  }

  return NextResponse.json({
    ok: true,
    qa_marker: GROWTH_HUMAN_IDENTITY_EVIDENCE_QA_MARKER,
    workspace,
  })
}
