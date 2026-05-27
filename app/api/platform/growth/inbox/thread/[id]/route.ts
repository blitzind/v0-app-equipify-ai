import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { archiveInboxThread, getInboxThread, updateInboxThread } from "@/lib/growth/inbox/thread-repository"
import { isGrowthUnifiedInboxSchemaReady } from "@/lib/growth/inbox/inbox-schema-health"
import { fetchInboxThreadSyncDetail } from "@/lib/growth/inbox-sync/inbox-sync-repository"
import { isGrowthInboxSyncSchemaReady } from "@/lib/growth/inbox-sync/inbox-sync-schema-health"
import { listInboxThreadOwnerHistory } from "@/lib/growth/inbox-team-ownership/inbox-owner-history-repository"
import { suggestInboxThreadOwner } from "@/lib/growth/inbox-team-ownership/inbox-owner-suggestion"
import { isGrowthInboxTeamOwnershipSchemaReady } from "@/lib/growth/inbox-team-ownership/inbox-team-ownership-schema-health"
import { GROWTH_INBOX_THREAD_STATUSES } from "@/lib/growth/inbox/inbox-types"

export const runtime = "nodejs"

const PatchThreadSchema = z.object({
  threadStatus: z.enum(GROWTH_INBOX_THREAD_STATUSES).optional(),
  subject: z.string().trim().max(500).optional(),
  requiresHumanReview: z.boolean().optional(),
  archive: z.boolean().optional(),
})

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthUnifiedInboxSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const { id } = await context.params
  try {
    const thread = await getInboxThread(access.admin, id, true)
    if (!thread) {
      return NextResponse.json({ error: "inbox_thread_not_found", message: "Inbox thread not found." }, { status: 404 })
    }
    const syncDetail =
      (await isGrowthInboxSyncSchemaReady(access.admin)) ? await fetchInboxThreadSyncDetail(access.admin, id) : null
    const teamOwnershipReady = await isGrowthInboxTeamOwnershipSchemaReady(access.admin)
    const [ownerHistory, ownerSuggestion] = teamOwnershipReady
      ? await Promise.all([
          listInboxThreadOwnerHistory(access.admin, id),
          suggestInboxThreadOwner(access.admin, id),
        ])
      : [[], null]
    return NextResponse.json({ ok: true, thread, syncDetail, ownerHistory, ownerSuggestion })
  } catch (error) {
    return NextResponse.json(
      {
        error: "inbox_thread_load_failed",
        message: error instanceof Error ? error.message : "Could not load inbox thread.",
      },
      { status: 500 },
    )
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthUnifiedInboxSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const parsed = PatchThreadSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid inbox thread update." }, { status: 400 })
  }

  const { id } = await context.params
  try {
    if (parsed.data.archive) {
      const thread = await archiveInboxThread(access.admin, id)
      return NextResponse.json({ ok: true, thread })
    }

    const thread = await updateInboxThread(access.admin, id, {
      thread_status: parsed.data.threadStatus,
      subject: parsed.data.subject,
      requires_human_review: parsed.data.requiresHumanReview,
    })
    return NextResponse.json({ ok: true, thread })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update inbox thread."
    const status = message === "inbox_thread_not_found" ? 404 : 500
    return NextResponse.json({ error: "inbox_thread_update_failed", message }, { status })
  }
}
