import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthCommunicationsSettingsAccess } from "@/lib/growth/settings/growth-workspace-settings-api-access"
import { listSenderAccounts } from "@/lib/growth/sender/sender-repository"
import { listSenderProviderCapabilities } from "@/lib/growth/sender/provider-sender-capabilities"
import { createWarmupProfile, listWarmupProfiles } from "@/lib/growth/warmup/warmup-repository"
import { isGrowthWarmupFoundationSchemaReady } from "@/lib/growth/warmup/warmup-schema-health"
import {
  GROWTH_WARMUP_FOUNDATION_QA_MARKER,
  GROWTH_WARMUP_PRIVACY_NOTE,
} from "@/lib/growth/warmup/warmup-types"

export const runtime = "nodejs"

const CreateWarmupSchema = z.object({
  senderAccountId: z.string().uuid(),
  warmupDays: z.number().int().min(1).max(120).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
})

export async function GET(request: Request) {
  const access = await requireGrowthCommunicationsSettingsAccess(request)
  if (!access.ok) return access.response

  if (!(await isGrowthWarmupFoundationSchemaReady(access.admin))) {
    return NextResponse.json(
      {
        error: "growth_schema_incomplete",
        message: "Apply migration 20270127120000_growth_warmup_foundation.sql, then reload.",
      },
      { status: 503 },
    )
  }

  try {
    const [profiles, senders] = await Promise.all([
      listWarmupProfiles(access.admin),
      listSenderAccounts(access.admin),
    ])
    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_WARMUP_FOUNDATION_QA_MARKER,
      privacy_note: GROWTH_WARMUP_PRIVACY_NOTE,
      profiles,
      senders,
      providerCapabilities: listSenderProviderCapabilities(),
    })
  } catch (error) {
    return NextResponse.json(
      { error: "warmup_list_failed", message: error instanceof Error ? error.message : "Could not load warmup profiles." },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  const access = await requireGrowthCommunicationsSettingsAccess(request)
  if (!access.ok) return access.response

  if (!(await isGrowthWarmupFoundationSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const parsed = CreateWarmupSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid warmup profile payload." }, { status: 400 })
  }

  try {
    const profile = await createWarmupProfile(access.admin, {
      sender_account_id: parsed.data.senderAccountId,
      warmup_days: parsed.data.warmupDays,
      notes: parsed.data.notes ?? null,
      actorUserId: access.userId,
      actorEmail: access.userEmail,
    })
    return NextResponse.json({ ok: true, profile }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create warmup profile."
    const status =
      message === "sender_not_found" ? 404
      : message === "warmup_profile_already_exists" ? 409
      : 500
    const friendlyMessage =
      message === "warmup_profile_already_exists"
        ? "Warmup profile already exists for this sender. Use Start Warmup to generate the schedule."
        : message
    return NextResponse.json({ error: "warmup_create_failed", message: friendlyMessage }, { status })
  }
}
