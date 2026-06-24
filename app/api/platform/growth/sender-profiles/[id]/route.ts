import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthCommunicationsSettingsAccess } from "@/lib/growth/settings/growth-workspace-settings-api-access"
import {
  assignSenderProfileMailbox,
  getSenderProfile,
  softDeleteSenderProfile,
  updateSenderProfile,
} from "@/lib/growth/signatures/sender-profile-repository"
import { isGrowthSenderProfilesSchemaReady } from "@/lib/growth/signatures/sender-profile-schema-health"
import {
  growthSignatureProfileFieldsSchema,
  mapSignatureProfileApiFields,
} from "@/lib/growth/signatures/signature-profile-api-schema"

export const runtime = "nodejs"

const PatchSchema = z.object({
  mailboxConnectionId: z.string().uuid().nullable().optional(),
  senderAccountId: z.string().uuid().optional(),
  displayName: z.string().trim().min(1).max(200).optional(),
  title: z.string().trim().max(200).nullable().optional(),
  email: z.string().trim().email().max(320).optional(),
  phone: z.string().trim().max(80).nullable().optional(),
  ...growthSignatureProfileFieldsSchema,
  active: z.boolean().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
})

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireGrowthCommunicationsSettingsAccess(request)
  if (!access.ok) return access.response

  if (!(await isGrowthSenderProfilesSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const { id } = await context.params
  const profile = await getSenderProfile(access.admin, id)
  if (!profile) {
    return NextResponse.json({ error: "not_found", message: "Sender profile not found." }, { status: 404 })
  }
  return NextResponse.json({ ok: true, profile })
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireGrowthCommunicationsSettingsAccess(request)
  if (!access.ok) return access.response

  if (!(await isGrowthSenderProfilesSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const parsed = PatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid sender profile update." }, { status: 400 })
  }

  const { id } = await context.params

  try {
    const profile = await updateSenderProfile(access.admin, id, {
      mailbox_connection_id: parsed.data.mailboxConnectionId,
      sender_account_id: parsed.data.senderAccountId,
      display_name: parsed.data.displayName,
      title: parsed.data.title,
      email: parsed.data.email,
      phone: parsed.data.phone,
      ...mapSignatureProfileApiFields(parsed.data),
      active: parsed.data.active,
      notes: parsed.data.notes,
    })
    return NextResponse.json({ ok: true, profile })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update sender profile."
    const status = message === "sender_profile_not_found" ? 404 : 500
    return NextResponse.json({ error: "sender_profile_update_failed", message }, { status })
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireGrowthCommunicationsSettingsAccess(request)
  if (!access.ok) return access.response

  if (!(await isGrowthSenderProfilesSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const { id } = await context.params

  try {
    const result = await softDeleteSenderProfile(access.admin, id)
    return NextResponse.json({ ok: true, id: result.id })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete sender profile."
    const status = message === "sender_profile_not_found" ? 404 : 500
    return NextResponse.json({ error: "sender_profile_delete_failed", message }, { status })
  }
}
