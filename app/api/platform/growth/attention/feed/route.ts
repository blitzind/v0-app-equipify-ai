import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthAttentionDashboard, listGrowthAttentionFeed } from "@/lib/growth/notifications/notification-repository"
import { evaluateGrowthAttentionSignals } from "@/lib/growth/notifications/evaluate-growth-attention-signals"
import {
  GROWTH_ATTENTION_QUEUE_VIEWS,
  GROWTH_NOTIFICATION_SEVERITIES,
  GROWTH_NOTIFICATION_SOURCE_SYSTEMS,
  GROWTH_NOTIFICATION_TYPES,
} from "@/lib/growth/notifications/notification-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const viewParam = url.searchParams.get("view")
  const viewParsed =
    viewParam && GROWTH_ATTENTION_QUEUE_VIEWS.includes(viewParam as (typeof GROWTH_ATTENTION_QUEUE_VIEWS)[number])
      ? (viewParam as (typeof GROWTH_ATTENTION_QUEUE_VIEWS)[number])
      : undefined

  const severityParam = url.searchParams.get("severity")
  const severityParsed =
    severityParam &&
    GROWTH_NOTIFICATION_SEVERITIES.includes(severityParam as (typeof GROWTH_NOTIFICATION_SEVERITIES)[number])
      ? (severityParam as (typeof GROWTH_NOTIFICATION_SEVERITIES)[number])
      : undefined

  const typeParam = url.searchParams.get("notificationType")
  const typeParsed =
    typeParam && GROWTH_NOTIFICATION_TYPES.includes(typeParam as (typeof GROWTH_NOTIFICATION_TYPES)[number])
      ? (typeParam as (typeof GROWTH_NOTIFICATION_TYPES)[number])
      : undefined

  const sourceParam = url.searchParams.get("sourceSystem")
  const sourceParsed =
    sourceParam &&
    GROWTH_NOTIFICATION_SOURCE_SYSTEMS.includes(
      sourceParam as (typeof GROWTH_NOTIFICATION_SOURCE_SYSTEMS)[number],
    )
      ? (sourceParam as (typeof GROWTH_NOTIFICATION_SOURCE_SYSTEMS)[number])
      : undefined

  const statusParam = url.searchParams.get("status")
  const statusParsed =
    statusParam === "open" || statusParam === "acknowledged" || statusParam === "completed" || statusParam === "all"
      ? statusParam
      : "open"

  const ownerUserIdParam = url.searchParams.get("ownerUserId")
  const ownerUserId =
    ownerUserIdParam === "me"
      ? access.userId
      : ownerUserIdParam && z.string().uuid().safeParse(ownerUserIdParam).success
        ? ownerUserIdParam
        : undefined

  const limitParam = url.searchParams.get("limit")
  const offsetParam = url.searchParams.get("offset")
  const limit = limitParam ? z.coerce.number().int().min(1).max(100).parse(limitParam) : 25
  const offset = offsetParam ? z.coerce.number().int().min(0).parse(offsetParam) : 0

  const refresh = url.searchParams.get("refresh") === "true"

  try {
    if (refresh) await evaluateGrowthAttentionSignals(access.admin)

    const [feed, dashboard] = await Promise.all([
      listGrowthAttentionFeed(access.admin, {
        view: viewParsed,
        severity: severityParsed,
        notificationType: typeParsed,
        sourceSystem: sourceParsed,
        status: statusParsed,
        ownerUserId,
        limit,
        offset,
      }),
      fetchGrowthAttentionDashboard(access.admin, ownerUserId ?? access.userId),
    ])

    return NextResponse.json({ ok: true, feed, dashboard })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load attention feed."
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
