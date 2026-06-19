import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { executeCallWorkspaceFollowUpAction } from "@/lib/growth/native-dialer/call-workspace-follow-up-service"
import { GROWTH_CALL_WORKSPACE_OPS_QA_MARKER } from "@/lib/growth/native-dialer/call-workspace-operator-types"
import { GROWTH_NATIVE_DIALER_QA_MARKER } from "@/lib/growth/native-dialer/native-dialer-types"
import {
  growthNativeDialerSchemaResponseMeta,
  requireGrowthNativeDialerSchemaReady,
} from "@/lib/growth/native-dialer/native-dialer-schema-health"

export const runtime = "nodejs"

const FollowUpSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("schedule_callback"),
    leadId: z.string().uuid(),
    phoneNumber: z.string().min(3),
    callbackAt: z.string().datetime(),
    ownerUserId: z.string().uuid().nullable().optional(),
    contactName: z.string().nullable().optional(),
    companyName: z.string().nullable().optional(),
  }),
  z.object({
    kind: z.literal("create_task"),
    leadId: z.string().uuid(),
    title: z.string().min(1).max(200),
    dueAt: z.string().datetime().nullable().optional(),
    ownerUserId: z.string().uuid().nullable().optional(),
    instructions: z.string().max(4000).nullable().optional(),
  }),
  z.object({
    kind: z.literal("book_meeting"),
    leadId: z.string().uuid(),
    title: z.string().min(1).max(200),
    startAt: z.string().datetime(),
    endAt: z.string().datetime().nullable().optional(),
    ownerUserId: z.string().uuid().nullable().optional(),
  }),
  z.object({
    kind: z.literal("send_sms"),
    leadId: z.string().uuid(),
    toE164: z.string().min(8).max(20),
    body: z.string().min(1).max(1600),
  }),
  z.object({
    kind: z.literal("send_email_task"),
    leadId: z.string().uuid(),
    subject: z.string().min(1).max(200),
    body: z.string().min(1).max(8000),
    dueAt: z.string().datetime().nullable().optional(),
    ownerUserId: z.string().uuid().nullable().optional(),
  }),
])

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const schemaGate = await requireGrowthNativeDialerSchemaReady(access.admin)
  if (!schemaGate.ok) {
    return NextResponse.json(
      { ok: false, message: schemaGate.probe.setupMessage, meta: growthNativeDialerSchemaResponseMeta(schemaGate.probe) },
      { status: schemaGate.status },
    )
  }

  const parsed = FollowUpSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid follow-up payload." }, { status: 400 })
  }

  try {
    const origin = new URL(request.url).origin
    const action =
      parsed.data.kind === "send_sms"
        ? { ...parsed.data, actingUserId: access.userId, requestOrigin: origin }
        : parsed.data
    const result = await executeCallWorkspaceFollowUpAction(access.admin, action)
    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_NATIVE_DIALER_QA_MARKER,
      opsMarker: GROWTH_CALL_WORKSPACE_OPS_QA_MARKER,
      result,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Follow-up action failed."
    return NextResponse.json({ error: "follow_up_failed", message }, { status: 500 })
  }
}
