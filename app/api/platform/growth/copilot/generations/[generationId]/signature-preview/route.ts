import { NextResponse } from "next/server"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthAiCopilotGenerationById } from "@/lib/growth/ai-copilot-repository"
import { loadEquipifyApprovedSenderBundle } from "@/lib/growth/ava-reasoning/equipify-approved-sender"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { isAvaSupervisedOutboundGeneration } from "@/lib/growth/ava-reasoning/ava-supervised-outbound-1a-types"
import { stripAccidentalAvaSignatureFromBody } from "@/lib/growth/ava-reasoning/ava-supervised-outbound-signature-boundary-core"
import { resolveOutboundSignatureForSender } from "@/lib/growth/signatures/signature-resolver"

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
    return NextResponse.json({ error: "invalid_generation", message: "Invalid generation id." }, { status: 400 })
  }

  const generation = await fetchGrowthAiCopilotGenerationById(access.admin, generationId)
  if (!generation) {
    return NextResponse.json({ error: "not_found", message: "Generation not found." }, { status: 404 })
  }

  const lead = await fetchGrowthLeadById(access.admin, generation.leadId)
  const organizationId = lead?.promotedOrganizationId?.trim() || getGrowthEngineAiOrgId() || null
  const snapshot = generation.inputSnapshot ?? {}
  const snapshotSender =
    snapshot.approvedSender && typeof snapshot.approvedSender === "object"
      ? (snapshot.approvedSender as { senderAccountId?: string | null }).senderAccountId?.trim() || null
      : null

  const senderBundle = organizationId
    ? await loadEquipifyApprovedSenderBundle(access.admin, organizationId)
    : { senderAccountId: null, identity: null }

  const senderAccountId = snapshotSender ?? senderBundle.senderAccountId
  if (!senderAccountId) {
    return NextResponse.json({
      ok: true,
      previewMode: "unavailable",
      message: "Signature added when sent",
      unsignedBody: stripAccidentalAvaSignatureFromBody(generation.generatedContent),
    })
  }

  const resolved = await resolveOutboundSignatureForSender(access.admin, { senderAccountId })
  const unsignedBody = stripAccidentalAvaSignatureFromBody(
    generation.generatedContent,
    resolved.signature?.text ?? null,
  )

  return NextResponse.json({
    ok: true,
    previewMode: resolved.signature?.text ? "signature" : "message_only",
    message: resolved.signature?.text ? null : "Signature added when sent",
    unsignedBody,
    signatureText: resolved.signature?.text ?? null,
    signatureHtml: resolved.signature?.html ?? null,
    senderAccountId,
    supervisedOutbound: isAvaSupervisedOutboundGeneration(generation),
  })
}
