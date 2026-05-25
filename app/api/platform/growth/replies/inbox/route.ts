import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { listGrowthReplyInbox } from "@/lib/growth/outbound/reply-repository"
import {
  GROWTH_REPLY_INBOX_VIEWS,
  GROWTH_REPLY_INTENTS,
  GROWTH_REPLY_PRIORITIES,
} from "@/lib/growth/reply-intelligence/reply-intent-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const viewParam = url.searchParams.get("view")
  const view =
    viewParam && GROWTH_REPLY_INBOX_VIEWS.includes(viewParam as (typeof GROWTH_REPLY_INBOX_VIEWS)[number])
      ? (viewParam as (typeof GROWTH_REPLY_INBOX_VIEWS)[number])
      : "needs_action"

  const ownerUserIdParam = url.searchParams.get("ownerUserId")
  const ownerUserId =
    ownerUserIdParam === "me"
      ? access.userId
      : ownerUserIdParam && z.string().uuid().safeParse(ownerUserIdParam).success
        ? ownerUserIdParam
        : undefined

  const intentParam = url.searchParams.get("intent")
  const intent =
    intentParam && GROWTH_REPLY_INTENTS.includes(intentParam as (typeof GROWTH_REPLY_INTENTS)[number])
      ? (intentParam as (typeof GROWTH_REPLY_INTENTS)[number])
      : undefined

  const priorityParam = url.searchParams.get("priority")
  const priority =
    priorityParam && GROWTH_REPLY_PRIORITIES.includes(priorityParam as (typeof GROWTH_REPLY_PRIORITIES)[number])
      ? (priorityParam as (typeof GROWTH_REPLY_PRIORITIES)[number])
      : undefined

  const sinceDays = z.coerce.number().int().min(1).max(90).catch(30).parse(url.searchParams.get("sinceDays") ?? "30")
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString()
  const limit = z.coerce.number().int().min(1).max(100).catch(25).parse(url.searchParams.get("limit") ?? "25")
  const offset = z.coerce.number().int().min(0).catch(0).parse(url.searchParams.get("offset") ?? "0")

  try {
    const feed = await listGrowthReplyInbox(access.admin, {
      view,
      ownerUserId,
      intent,
      priority,
      unanswered: url.searchParams.get("unanswered") === "true" ? true : undefined,
      meetingRequested: url.searchParams.get("meetingRequested") === "true" ? true : undefined,
      competitorMention: url.searchParams.get("competitorMention") === "true" ? true : undefined,
      since,
      limit,
      offset,
    })
    return NextResponse.json({ ok: true, feed, view })
  } catch {
    return NextResponse.json({ error: "fetch_failed", message: "Could not load reply inbox." }, { status: 500 })
  }
}
