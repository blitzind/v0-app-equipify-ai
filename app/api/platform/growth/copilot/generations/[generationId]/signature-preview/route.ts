import { NextResponse } from "next/server"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthAiCopilotGenerationById } from "@/lib/growth/ai-copilot-repository"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import {
  isAvaSupervisedOutboundGeneration,
  readAvaSupervisedOutboundApprovalBinding,
} from "@/lib/growth/ava-reasoning/ava-supervised-outbound-1a-types"
import { stripAccidentalAvaSignatureFromBody } from "@/lib/growth/ava-reasoning/ava-supervised-outbound-signature-boundary-core"
import { resolveOutboundSignatureForSender } from "@/lib/growth/signatures/signature-resolver"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const PRE_APPROVAL_SIGNATURE_MESSAGE =
  "Signature will be applied from the assigned sending mailbox at send time."

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

  const unsignedBody = stripAccidentalAvaSignatureFromBody(generation.generatedContent)
  const supervisedOutbound = isAvaSupervisedOutboundGeneration(generation)
  const binding = readAvaSupervisedOutboundApprovalBinding(
    generation.classification as Record<string, unknown>,
  )
  const senderAccountId = binding?.senderAccountId?.trim() || null

  if (supervisedOutbound && !senderAccountId) {
    return NextResponse.json({
      ok: true,
      previewMode: "message_only",
      message: PRE_APPROVAL_SIGNATURE_MESSAGE,
      unsignedBody,
      signatureText: null,
      signatureHtml: null,
      senderAccountId: null,
      supervisedOutbound: true,
    })
  }

  const lead = await fetchGrowthLeadById(access.admin, generation.leadId)
  const organizationId = lead?.promotedOrganizationId?.trim() || getGrowthEngineAiOrgId() || null
  if (!senderAccountId || !organizationId) {
    return NextResponse.json({
      ok: true,
      previewMode: "unavailable",
      message: PRE_APPROVAL_SIGNATURE_MESSAGE,
      unsignedBody,
      signatureText: null,
      signatureHtml: null,
      senderAccountId: null,
      supervisedOutbound,
    })
  }

  const resolved = await resolveOutboundSignatureForSender(access.admin, { senderAccountId })
  const strippedBody = stripAccidentalAvaSignatureFromBody(
    generation.generatedContent,
    resolved.signature?.text ?? null,
  )

  return NextResponse.json({
    ok: true,
    previewMode: resolved.signature?.text ? "signature" : "message_only",
    message: resolved.signature?.text ? null : PRE_APPROVAL_SIGNATURE_MESSAGE,
    unsignedBody: strippedBody,
    signatureText: resolved.signature?.text ?? null,
    signatureHtml: resolved.signature?.html ?? null,
    senderAccountId,
    senderEmail: binding?.senderEmail ?? null,
    supervisedOutbound,
  })
}
