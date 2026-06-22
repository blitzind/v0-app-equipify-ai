import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthCommunicationsSettingsAccess } from "@/lib/growth/settings/growth-workspace-settings-api-access"
import {
  insertWarmupRecipient,
  listWarmupRecipients,
} from "@/lib/growth/warmup/warmup-recipient-repository"
import { isGrowthWarmupExecutorSchemaReady } from "@/lib/growth/warmup/warmup-executor-schema-health"
import { GROWTH_WARMUP_EXECUTOR_QA_MARKER, GROWTH_WARMUP_RECIPIENT_TYPES } from "@/lib/growth/warmup/warmup-executor-types"

export const runtime = "nodejs"

const CreateSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().max(120).optional(),
  label: z.string().trim().max(120).optional(),
  recipient_type: z.enum(GROWTH_WARMUP_RECIPIENT_TYPES).optional(),
  active: z.boolean().optional(),
  approved: z.boolean().optional(),
  max_emails_per_day: z.number().int().min(0).max(50).optional(),
  max_emails_per_week: z.number().int().min(0).max(200).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
})

export async function GET(request: Request) {
  const access = await requireGrowthCommunicationsSettingsAccess(request)
  if (!access.ok) return access.response

  if (!(await isGrowthWarmupExecutorSchemaReady(access.admin))) {
    return NextResponse.json({
      ok: true,
      recipients: [],
      schema_ready: false,
      qa_marker: GROWTH_WARMUP_EXECUTOR_QA_MARKER,
    })
  }

  const recipients = await listWarmupRecipients(access.admin)
  return NextResponse.json({ ok: true, recipients, schema_ready: true, qa_marker: GROWTH_WARMUP_EXECUTOR_QA_MARKER })
}

export async function POST(request: Request) {
  const access = await requireGrowthCommunicationsSettingsAccess(request)
  if (!access.ok) return access.response

  if (!(await isGrowthWarmupExecutorSchemaReady(access.admin))) {
    return NextResponse.json(
      { ok: false, error: "schema_not_ready", message: "Apply migration 20270925120000_growth_warmup_executor_1a.sql first." },
      { status: 503 },
    )
  }

  const parsed = CreateSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 })
  }

  const recipient = await insertWarmupRecipient(access.admin, parsed.data)
  return NextResponse.json({ ok: true, recipient, qa_marker: GROWTH_WARMUP_EXECUTOR_QA_MARKER })
}
