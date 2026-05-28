import "server-only"

import { NextResponse } from "next/server"
import type { VoiceCallControlActionResult } from "@/lib/voice/transfer-control/types"
import { VOICE_TRANSFER_CONTROL_QA_MARKER } from "@/lib/voice/transfer-control/types"

export function voiceCallControlJsonResponse(
  result: VoiceCallControlActionResult,
  status = result.ok ? 200 : 400,
): NextResponse {
  return NextResponse.json(
    {
      ok: result.ok,
      qaMarker: VOICE_TRANSFER_CONTROL_QA_MARKER,
      message: result.message,
      voiceCallId: result.voiceCallId,
      transfer: result.transfer ?? null,
      participants: result.participants ?? [],
      timelineEventType: result.timelineEventType ?? null,
    },
    { status: result.ok ? 200 : status },
  )
}

export function voiceCallControlErrorResponse(message: string, status = 400): NextResponse {
  return NextResponse.json({ ok: false, qaMarker: VOICE_TRANSFER_CONTROL_QA_MARKER, message }, { status })
}
