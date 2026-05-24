import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  getBrowserAudioCaptureDetail,
  ingestBrowserAudioChunk,
  mapBrowserAudioChunkError,
} from "@/lib/growth/realtime/browser-audio/ingest-browser-audio-chunk"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const AudioChunkSchema = z.object({
  encoding: z.string().trim().min(3).max(120),
  payloadBase64: z.string().min(1),
  sequenceNumber: z.number().int().min(0),
  timestampMs: z.number().int().min(0),
  durationMs: z.number().int().min(0).optional(),
})

export async function POST(
  request: Request,
  context: { params: Promise<{ leadId: string; sessionId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { leadId, sessionId } = await context.params
  if (!UUID_RE.test(leadId) || !UUID_RE.test(sessionId)) {
    return NextResponse.json({ error: "invalid_id", message: "Invalid id." }, { status: 400 })
  }

  const parsed = AudioChunkSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid audio chunk payload." }, { status: 400 })
  }

  try {
    const result = await ingestBrowserAudioChunk(access.admin, {
      sessionId,
      leadId,
      ...parsed.data,
    })

    return NextResponse.json({
      ok: true,
      session: result.session,
      metrics: result.metrics,
      scaffold: result.scaffold,
      message: result.message,
    })
  } catch (e) {
    const mapped = mapBrowserAudioChunkError(e)
    return NextResponse.json({ error: mapped.error, message: mapped.message }, { status: mapped.status })
  }
}
