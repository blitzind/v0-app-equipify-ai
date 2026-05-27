import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { runProviderTestSend } from "@/lib/growth/provider-setup/provider-test-send"
import {
  isGrowthProviderSetupFamily,
  GROWTH_LIVE_PROVIDER_SETUP_QA_MARKER,
} from "@/lib/growth/provider-setup/provider-setup-types"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ providerFamily: string }> }

export async function POST(request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { providerFamily } = await context.params
  if (!isGrowthProviderSetupFamily(providerFamily)) {
    return NextResponse.json({ ok: false, error: "invalid_provider" }, { status: 400 })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const senderAccountId = typeof body.sender_account_id === "string" ? body.sender_account_id.trim() : ""
  const to = typeof body.to === "string" ? body.to.trim() : ""
  const subject = typeof body.subject === "string" ? body.subject.trim() : "Equipify provider test send"
  const humanApprovalConfirmed = body.humanApprovalConfirmed === true

  if (!senderAccountId || !to) {
    return NextResponse.json(
      { ok: false, error: "validation_error", message: "sender_account_id and to are required." },
      { status: 400 },
    )
  }

  const result = await runProviderTestSend(access.admin, {
    providerFamily,
    senderAccountId,
    to,
    subject,
    text: typeof body.text === "string" ? body.text : "Equipify Growth Engine provider setup test send.",
    html: typeof body.html === "string" ? body.html : undefined,
    humanApprovalConfirmed,
    actorUserId: access.userId,
    actorEmail: access.userEmail,
  })

  return NextResponse.json({ ok: result.status === "passed", qa_marker: GROWTH_LIVE_PROVIDER_SETUP_QA_MARKER, result })
}
