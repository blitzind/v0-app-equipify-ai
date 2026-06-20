import { NextResponse } from "next/server"
import { z } from "zod"
import {
  GROWTH_SENDR_SEQUENCE_BRIDGE_QA_MARKER,
} from "@/lib/growth/sendr/growth-sendr-config"
import { requireSendrPlatformAccess } from "@/lib/growth/sendr/growth-sendr-platform-access"
import {
  attachSendrPageToSequence,
} from "@/lib/growth/sendr/growth-sendr-sequence-bridge-service"
import { listSendrSequencePageLinks } from "@/lib/growth/sendr/growth-sendr-sequence-link-repository"

export const runtime = "nodejs"

const BodySchema = z.object({
  landingPageId: z.string().uuid(),
  sequencePatternId: z.string().uuid(),
  sequencePatternStepId: z.string().uuid().optional().nullable(),
  enrollmentRunId: z.string().uuid().optional().nullable(),
})

export async function GET(request: Request) {
  const access = await requireSendrPlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const sequencePatternId = url.searchParams.get("sequencePatternId") ?? undefined
  const landingPageId = url.searchParams.get("landingPageId") ?? undefined

  try {
    const links = await listSendrSequencePageLinks(access.admin, {
      organizationId: access.organizationId,
      sequencePatternId,
      landingPageId,
    })
    return NextResponse.json({ ok: true, links, qa_marker: GROWTH_SENDR_SEQUENCE_BRIDGE_QA_MARKER })
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "links_load_failed" },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  const access = await requireSendrPlatformAccess()
  if (!access.ok) return access.response

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 })
  }

  try {
    const link = await attachSendrPageToSequence(access.admin, {
      organizationId: access.organizationId,
      landingPageId: parsed.data.landingPageId,
      sequencePatternId: parsed.data.sequencePatternId,
      sequencePatternStepId: parsed.data.sequencePatternStepId ?? null,
      enrollmentRunId: parsed.data.enrollmentRunId ?? null,
      attachedBy: access.userId,
    })
    return NextResponse.json({ ok: true, link, qa_marker: GROWTH_SENDR_SEQUENCE_BRIDGE_QA_MARKER })
  } catch (error) {
    const message = error instanceof Error ? error.message : "link_attach_failed"
    const status = message.includes("cap") || message.includes("budget") || message.includes("disabled") ? 429 : 500
    return NextResponse.json({ ok: false, message }, { status })
  }
}
