import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess, logGrowthEngine } from "@/lib/growth/access"
import { executeApolloMeetingBridgeInProduction } from "@/lib/growth/apollo/apollo-meeting-bridge-route"
import {
  assertApolloMeetingBridgeExecuteAllowed,
  validateApolloMeetingBridgeConfirmation,
} from "@/lib/growth/apollo/apollo-meeting-bridge-route-gates"

export const runtime = "nodejs"
export const maxDuration = 120

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const confirmation = validateApolloMeetingBridgeConfirmation(body)
  if (!confirmation.ok || !confirmation.sequence_execution_candidate_id) {
    return NextResponse.json(
      { ok: false, message: confirmation.error ?? "Invalid confirmation." },
      { status: 400 },
    )
  }

  const gates = assertApolloMeetingBridgeExecuteAllowed(process.env)
  if (!gates.ok) {
    return NextResponse.json(
      { ok: false, blockers: gates.blockers, message: gates.error },
      { status: 403 },
    )
  }

  const outboundReplyId =
    asString(body?.outboundReplyId) || asString(body?.outbound_reply_id) || null

  const result = await executeApolloMeetingBridgeInProduction(access.admin, {
    sequence_execution_candidate_id: confirmation.sequence_execution_candidate_id,
    outbound_reply_id: outboundReplyId,
    certification_mode: confirmation.certification_mode,
    env: process.env,
  })

  logGrowthEngine("apollo_meeting_bridge_execute_route", {
    execution_id: result.execution_id,
    ok: result.ok,
    error: result.error ?? null,
    outreach_sent: false,
    calendar_written: false,
    meeting_scheduled: false,
  })

  if (!result.ok) {
    return NextResponse.json(result, { status: result.error === "gates_failed" ? 403 : 500 })
  }

  return NextResponse.json(result)
}
