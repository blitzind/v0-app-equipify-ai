import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { listMailboxProviderCapabilities } from "@/lib/growth/mailboxes/mailbox-provider-registry"
import { createMailboxConnection, listMailboxConnections } from "@/lib/growth/mailboxes/mailbox-repository"
import { isGrowthMailboxConnectionSchemaReady } from "@/lib/growth/mailboxes/mailbox-schema-health"
import {
  GROWTH_MAILBOX_CONNECTION_PRIVACY_NOTE,
  GROWTH_MAILBOX_CONNECTION_QA_MARKER,
} from "@/lib/growth/mailboxes/mailbox-types"
import { GROWTH_SENDER_PROVIDER_FAMILIES } from "@/lib/growth/sender/sender-types"
import { listSenderAccounts } from "@/lib/growth/sender/sender-repository"

export const runtime = "nodejs"

const CreateMailboxSchema = z.object({
  senderAccountId: z.string().uuid(),
  providerFamily: z.enum(GROWTH_SENDER_PROVIDER_FAMILIES),
  emailAddress: z.string().trim().email().max(320),
  displayName: z.string().trim().min(1).max(120),
  tokenExpiresAt: z.string().datetime().nullable().optional(),
  providerAccountId: z.string().trim().max(240).nullable().optional(),
})

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthMailboxConnectionSchemaReady(access.admin))) {
    return NextResponse.json(
      {
        error: "growth_schema_incomplete",
        message: "Apply migration 20270125120000_growth_mailbox_connections.sql, then reload.",
      },
      { status: 503 },
    )
  }

  try {
    const [mailboxes, senders] = await Promise.all([
      listMailboxConnections(access.admin),
      listSenderAccounts(access.admin),
    ])
    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_MAILBOX_CONNECTION_QA_MARKER,
      privacy_note: GROWTH_MAILBOX_CONNECTION_PRIVACY_NOTE,
      mailboxes,
      senders,
      providerCapabilities: listMailboxProviderCapabilities(),
    })
  } catch (error) {
    return NextResponse.json(
      { error: "mailbox_list_failed", message: error instanceof Error ? error.message : "Could not load mailboxes." },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthMailboxConnectionSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const parsed = CreateMailboxSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid mailbox payload." }, { status: 400 })
  }

  try {
    const mailbox = await createMailboxConnection(access.admin, {
      sender_account_id: parsed.data.senderAccountId,
      provider_family: parsed.data.providerFamily,
      email_address: parsed.data.emailAddress,
      display_name: parsed.data.displayName,
      token_expires_at: parsed.data.tokenExpiresAt ?? null,
      provider_account_id: parsed.data.providerAccountId ?? null,
      actorUserId: access.userId,
      actorEmail: access.userEmail,
    })
    return NextResponse.json({ ok: true, mailbox }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create mailbox."
    const status = message === "sender_not_found" ? 404 : 500
    return NextResponse.json({ error: "mailbox_create_failed", message }, { status })
  }
}
