import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthCommunicationsSettingsAccess } from "@/lib/growth/settings/growth-workspace-settings-api-access"
import { createSenderProfile, listSenderProfiles } from "@/lib/growth/signatures/sender-profile-repository"
import { isGrowthSenderProfilesSchemaReady } from "@/lib/growth/signatures/sender-profile-schema-health"
import {
  growthSignatureProfileFieldsSchema,
  mapSignatureProfileApiFields,
} from "@/lib/growth/signatures/signature-profile-api-schema"

export const runtime = "nodejs"

const CreateSchema = z.object({
  senderAccountId: z.string().uuid(),
  mailboxConnectionId: z.string().uuid().nullable().optional(),
  displayName: z.string().trim().min(1).max(200),
  title: z.string().trim().max(200).nullable().optional(),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(80).nullable().optional(),
  ...growthSignatureProfileFieldsSchema,
  active: z.boolean().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
})

export async function GET(request: Request) {
  const access = await requireGrowthCommunicationsSettingsAccess(request)
  if (!access.ok) return access.response

  if (!(await isGrowthSenderProfilesSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  try {
    const profiles = await listSenderProfiles(access.admin)
    return NextResponse.json({ ok: true, profiles })
  } catch (error) {
    return NextResponse.json(
      { error: "sender_profiles_list_failed", message: error instanceof Error ? error.message : "List failed." },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  const access = await requireGrowthCommunicationsSettingsAccess(request)
  if (!access.ok) return access.response

  if (!(await isGrowthSenderProfilesSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const parsed = CreateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid sender profile payload." }, { status: 400 })
  }

  try {
    const profile = await createSenderProfile(access.admin, {
      sender_account_id: parsed.data.senderAccountId,
      mailbox_connection_id: parsed.data.mailboxConnectionId ?? null,
      display_name: parsed.data.displayName,
      title: parsed.data.title ?? null,
      email: parsed.data.email,
      phone: parsed.data.phone ?? null,
      ...mapSignatureProfileApiFields(parsed.data),
      active: parsed.data.active,
      notes: parsed.data.notes ?? null,
    })
    return NextResponse.json({ ok: true, profile }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create sender profile."
    const status =
      message === "sender_profile_already_exists" ? 409
      : 500
    return NextResponse.json({ error: "sender_profile_create_failed", message }, { status })
  }
}
