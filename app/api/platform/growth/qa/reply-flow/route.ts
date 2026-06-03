/**
 * Production-native Growth Engine reply-flow QA harness.
 *
 * Runs inside the deployed Vercel runtime (production secrets available).
 * Does not depend on local env files or `vercel env run`.
 *
 * Usage (platform admin session required; GROWTH_ENABLE_QA_ACCELERATION=true in prod):
 *
 *   curl -sS -X POST 'https://app.equipify.ai/api/platform/growth/qa/reply-flow' \
 *     -H 'Content-Type: application/json' \
 *     -H 'Cookie: <platform-admin-session-cookies>' \
 *     -d '{"fresh":true,"contactEmail":"mike@fuzor.io","step":"all","pattern":"email_then_call"}'
 *
 * Response: `{ ok: true, qaMarker, report }` where `report.overall` is PASS or FAIL.
 */
import { NextResponse } from "next/server"
import { logGrowthEngine, requireGrowthQaAccelerationAccess } from "@/lib/growth/access"
import {
  GROWTH_REPLY_FLOW_API_QA_MARKER,
  mapGrowthReplyFlowApiErrorStatus,
  parseGrowthReplyFlowApiRequest,
  sanitizeGrowthReplyFlowApiErrorMessage,
} from "@/lib/growth/qa/reply-flow-api-types"
import { runGrowthReplyFlowHarness } from "@/lib/growth/qa/reply-flow-harness"
import { GROWTH_REPLY_FLOW_QA_MARKER } from "@/lib/growth/qa/reply-flow-harness-types"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const access = await requireGrowthQaAccelerationAccess()
  if (!access.ok) return access.response

  let body: unknown = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "invalid_json", message: "Request body must be valid JSON." },
      { status: 400 },
    )
  }

  let input
  try {
    input = parseGrowthReplyFlowApiRequest(body)
  } catch (error) {
    return NextResponse.json(
      {
        error: "invalid_request",
        message: sanitizeGrowthReplyFlowApiErrorMessage(error),
        qaMarker: GROWTH_REPLY_FLOW_API_QA_MARKER,
      },
      { status: 400 },
    )
  }

  logGrowthEngine("reply_flow_qa_started", {
    step: input.step ?? "all",
    fresh: input.fresh ?? false,
    leadId: input.leadId ?? null,
    pattern: input.pattern ?? null,
    actingUserEmail: access.userEmail,
  })

  try {
    const report = await runGrowthReplyFlowHarness(access.admin, {
      step: input.step ?? "all",
      fresh: input.fresh,
      leadId: input.leadId ?? null,
      companyName: input.companyName ?? null,
      contactEmail: input.contactEmail ?? null,
      patternKey: input.pattern,
      skipExecute: input.skipExecute,
      actingUserId: access.userId,
      actingUserEmail: access.userEmail,
    })

    logGrowthEngine("reply_flow_qa_completed", {
      overall: report.overall,
      leadId: report.ids.leadId,
      executionJobId: report.ids.executionJobId,
      actingUserEmail: access.userEmail,
    })

    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_REPLY_FLOW_API_QA_MARKER,
      harnessMarker: GROWTH_REPLY_FLOW_QA_MARKER,
      report,
    })
  } catch (error) {
    const message = sanitizeGrowthReplyFlowApiErrorMessage(error)
    logGrowthEngine("reply_flow_qa_failed", {
      message,
      actingUserEmail: access.userEmail,
    })
    return NextResponse.json(
      {
        error: "reply_flow_qa_failed",
        message,
        qaMarker: GROWTH_REPLY_FLOW_API_QA_MARKER,
      },
      { status: mapGrowthReplyFlowApiErrorStatus(message) },
    )
  }
}
