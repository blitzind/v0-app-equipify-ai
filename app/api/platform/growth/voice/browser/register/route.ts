import { NextResponse } from "next/server"
import { z } from "zod"
import { buildVoiceBrowserClientIdentity } from "@/lib/voice/browser-calling/status-mapping"
import { resolveVoiceBrowserCallingProvider } from "@/lib/voice/browser-calling/provider-registry"
import { VOICE_NATIVE_DIALER_INTEGRATION_QA_MARKER, VOICE_BROWSER_PROVIDER_IDS } from "@/lib/voice/browser-calling/types"
import { requireVoiceOperatorRouteContext } from "@/lib/voice/api/voice-operator-route"
import { registerVoiceBrowserDevice } from "@/lib/voice/repository/voice-browser-calling-repository"

export const runtime = "nodejs"

const bodySchema = z.object({
  clientIdentity: z.string().min(8).optional(),
  provider: z.enum(VOICE_BROWSER_PROVIDER_IDS).optional(),
  deviceFingerprint: z.string().optional(),
  userAgent: z.string().optional(),
})

export async function POST(request: Request) {
  const ctx = await requireVoiceOperatorRouteContext()
  if (!ctx.ok) return ctx.response

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid browser registration payload." }, { status: 400 })
  }

  const clientIdentity =
    parsed.data.clientIdentity ??
    buildVoiceBrowserClientIdentity({ organizationId: ctx.organizationId, userId: ctx.userId })
  const expectedIdentity = buildVoiceBrowserClientIdentity({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  })
  if (clientIdentity !== expectedIdentity) {
    return NextResponse.json({ ok: false, message: "Client identity does not match authenticated operator." }, { status: 403 })
  }

  const provider = resolveVoiceBrowserCallingProvider(parsed.data.provider)
  const validation = provider.validateRegistrationContext({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    clientIdentity,
  })
  if (!validation.ok) {
    return NextResponse.json({ ok: false, message: validation.message }, { status: 400 })
  }

  const device = await registerVoiceBrowserDevice(ctx.admin, {
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    clientIdentity,
    provider: provider.providerId,
    deviceFingerprint: parsed.data.deviceFingerprint,
    userAgent: parsed.data.userAgent,
  })

  return NextResponse.json({
    ok: true,
    qaMarker: VOICE_NATIVE_DIALER_INTEGRATION_QA_MARKER,
    device,
    message: validation.message,
  })
}

export async function DELETE(request: Request) {
  const ctx = await requireVoiceOperatorRouteContext()
  if (!ctx.ok) return ctx.response

  const url = new URL(request.url)
  const clientIdentity =
    url.searchParams.get("clientIdentity") ??
    buildVoiceBrowserClientIdentity({ organizationId: ctx.organizationId, userId: ctx.userId })

  const { disconnectVoiceBrowserDevice } = await import("@/lib/voice/repository/voice-browser-calling-repository")
  await disconnectVoiceBrowserDevice(ctx.admin, {
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    clientIdentity,
  })

  return NextResponse.json({ ok: true, qaMarker: VOICE_NATIVE_DIALER_INTEGRATION_QA_MARKER })
}
