import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  getMailboxConnection,
  softDeleteMailboxConnection,
  updateMailboxConnection,
} from "@/lib/growth/mailboxes/mailbox-repository"
import { isGrowthMailboxConnectionSchemaReady } from "@/lib/growth/mailboxes/mailbox-schema-health"
import { GROWTH_MAILBOX_CONNECTION_STATUSES } from "@/lib/growth/mailboxes/mailbox-types"

export const runtime = "nodejs"

const UpdateMailboxSchema = z.object({
  displayName: z.string().trim().min(1).max(120).optional(),
  status: z.enum(GROWTH_MAILBOX_CONNECTION_STATUSES).optional(),
  tokenExpiresAt: z.string().datetime().nullable().optional(),
})

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  const mailbox = await getMailboxConnection(access.admin, id)
  if (!mailbox) {
    return NextResponse.json({ error: "mailbox_not_found", message: "Mailbox not found." }, { status: 404 })
  }
  return NextResponse.json({ ok: true, mailbox })
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthMailboxConnectionSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const { id } = await context.params
  const parsed = UpdateMailboxSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid mailbox update payload." }, { status: 400 })
  }

  try {
    const mailbox = await updateMailboxConnection(access.admin, id, {
      display_name: parsed.data.displayName,
      status: parsed.data.status,
      token_expires_at: parsed.data.tokenExpiresAt,
      actorUserId: access.userId,
      actorEmail: access.userEmail,
    })
    return NextResponse.json({ ok: true, mailbox })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed."
    const status = message === "mailbox_not_found" ? 404 : 500
    return NextResponse.json({ error: "mailbox_update_failed", message }, { status })
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthMailboxConnectionSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const { id } = await context.params

  try {
    const deleted = await softDeleteMailboxConnection(access.admin, {
      mailboxId: id,
      actorUserId: access.userId,
      actorEmail: access.userEmail,
    })
    return NextResponse.json({ ok: true, deleted })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed."
    const status = message === "mailbox_not_found" ? 404 : 500
    return NextResponse.json({ error: "mailbox_delete_failed", message }, { status })
  }
}
