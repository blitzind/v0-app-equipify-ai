import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { parseUuid, requireOrganizationMember } from "@/lib/email/route-auth"
import { syncCommunicationReminders } from "@/lib/notifications/sync-reminders"

export const runtime = "nodejs"

export async function GET(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId: rawOrg } = await context.params
  const organizationId = parseUuid(rawOrg)
  if (!organizationId) {
    return NextResponse.json({ error: "invalid_organization", message: "Invalid organization id." }, { status: 400 })
  }

  const url = new URL(request.url)
  const sync = url.searchParams.get("sync") === "1"
  const rawCustomer = url.searchParams.get("customerId")
  const customerId = rawCustomer ? parseUuid(rawCustomer) : null
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? "40")))
  const channel = url.searchParams.get("channel")?.trim()

  const deliveryParam = url.searchParams.get("deliveryStatus")?.trim()
  const deliveryStatuses = deliveryParam
    ? deliveryParam
        .split(",")
        .map((s) => s.trim())
        .filter((s) =>
          ["pending", "queued", "sent", "delivered", "failed", "bounced", "skipped"].includes(s),
        )
    : []

  const dateFrom = url.searchParams.get("dateFrom")?.trim()
  const dateTo = url.searchParams.get("dateTo")?.trim()
  const searchRaw = url.searchParams.get("search")?.trim() ?? ""

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in required." }, { status: 401 })
  }

  const allowed = await requireOrganizationMember(supabase, user.id, organizationId)
  if (!allowed) {
    return NextResponse.json({ error: "forbidden", message: "No access to this organization." }, { status: 403 })
  }

  if (sync) {
    await syncCommunicationReminders(supabase, organizationId)
  }

  let q = supabase
    .from("communication_events")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (customerId) {
    q = q
      .in("audience", ["customer_timeline", "both"])
      .or(
        `recipient_customer_id.eq.${customerId},and(related_entity_type.eq.customer,related_entity_id.eq.${customerId})`,
      )
  } else {
    q = q.in("audience", ["organization", "both"])
  }

  if (channel && ["email", "sms", "in_app", "push", "system"].includes(channel)) {
    q = q.eq("channel", channel)
  }

  if (deliveryStatuses.length > 0) {
    q = q.in("delivery_status", deliveryStatuses)
  }

  if (dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
    q = q.gte("created_at", `${dateFrom}T00:00:00.000Z`)
  }
  if (dateTo && /^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
    q = q.lte("created_at", `${dateTo}T23:59:59.999Z`)
  }

  if (searchRaw.length >= 2) {
    const safe = searchRaw.replace(/,/g, " ").slice(0, 80)
    q = q.or(`title.ilike.%${safe}%,summary.ilike.%${safe}%`)
  }

  const { data: rawEvents, error: listErr } = await q

  if (listErr) {
    return NextResponse.json(
      { error: "query_failed", message: listErr.message },
      { status: 500 },
    )
  }

  const events = rawEvents ?? []
  const eventIds = events.map((e) => (e as { id: string }).id)
  let readSet = new Set<string>()
  if (eventIds.length > 0) {
    const { data: readRows } = await supabase
      .from("communication_event_reads")
      .select("communication_event_id")
      .eq("user_id", user.id)
      .in("communication_event_id", eventIds)
    readSet = new Set(
      ((readRows as { communication_event_id: string }[] | null) ?? []).map((r) => r.communication_event_id),
    )
  }

  const enriched = events.map((row) => {
    const r = row as Record<string, unknown> & { id: string; counts_toward_unread?: boolean }
    const counts = Boolean(r.counts_toward_unread)
    const isRead = !counts || readSet.has(r.id)
    return { ...r, is_read: isRead }
  })

  const custIds = [
    ...new Set(
      enriched
        .map((row) => row.recipient_customer_id as string | null | undefined)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ]

  let customerNameMap = new Map<string, string>()
  if (custIds.length > 0) {
    const { data: custRows } = await supabase
      .from("customers")
      .select("id, company_name")
      .eq("organization_id", organizationId)
      .in("id", custIds)
    customerNameMap = new Map(
      ((custRows ?? []) as { id: string; company_name: string }[]).map((c) => [c.id, c.company_name]),
    )
  }

  const withCustomers = enriched.map((row) => {
    const cid = row.recipient_customer_id as string | null | undefined
    return {
      ...row,
      customer_display_name:
        cid && customerNameMap.has(cid) ? customerNameMap.get(cid) ?? null : null,
    }
  })

  const { data: unreadRow, error: rpcErr } = await supabase.rpc("communication_unread_count_for_user", {
    p_organization_id: organizationId,
  })

  if (rpcErr) {
    return NextResponse.json({ error: "rpc_failed", message: rpcErr.message }, { status: 500 })
  }

  const unreadCount = typeof unreadRow === "number" ? unreadRow : Number(unreadRow ?? 0)

  return NextResponse.json({
    events: withCustomers,
    unreadCount,
  })
}

/** Mark many notifications read (or all org-feed unread). */
export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId: rawOrg } = await context.params
  const organizationId = parseUuid(rawOrg)
  if (!organizationId) {
    return NextResponse.json({ error: "invalid_organization", message: "Invalid organization id." }, { status: 400 })
  }

  let body: { eventIds?: string[]; markAllRead?: boolean }
  try {
    body = (await request.json()) as { eventIds?: string[]; markAllRead?: boolean }
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Invalid JSON body." }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in required." }, { status: 401 })
  }

  const allowed = await requireOrganizationMember(supabase, user.id, organizationId)
  if (!allowed) {
    return NextResponse.json({ error: "forbidden", message: "No access to this organization." }, { status: 403 })
  }

  const now = new Date().toISOString()

  if (body.markAllRead) {
    const { data: feedRows, error: feedErr } = await supabase
      .from("communication_events")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("counts_toward_unread", true)
      .in("audience", ["organization", "both"])
      .limit(500)

    if (feedErr) {
      return NextResponse.json({ error: "query_failed", message: feedErr.message }, { status: 500 })
    }

    const ids = (feedRows as { id: string }[]).map((r) => r.id)
    if (ids.length === 0) {
      return NextResponse.json({ ok: true, marked: 0 })
    }

    const { data: already } = await supabase
      .from("communication_event_reads")
      .select("communication_event_id")
      .eq("user_id", user.id)
      .in("communication_event_id", ids)

    const have = new Set((already as { communication_event_id: string }[]).map((r) => r.communication_event_id))
    const missing = ids.filter((id) => !have.has(id))
    if (missing.length === 0) {
      return NextResponse.json({ ok: true, marked: 0 })
    }

    const rows = missing.map((communication_event_id) => ({
      communication_event_id,
      user_id: user.id,
      read_at: now,
    }))

    const { error: insErr } = await supabase.from("communication_event_reads").insert(rows)
    if (insErr) {
      return NextResponse.json({ error: "insert_failed", message: insErr.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, marked: missing.length })
  }

  const eventIds = Array.isArray(body.eventIds) ? body.eventIds.map((id) => parseUuid(id)).filter(Boolean) as string[] : []
  if (eventIds.length === 0) {
    return NextResponse.json({ error: "invalid_payload", message: "eventIds or markAllRead required." }, { status: 400 })
  }

  const rows = eventIds.map((communication_event_id) => ({
    communication_event_id,
    user_id: user.id,
    read_at: now,
  }))

  const { error: insErr } = await supabase.from("communication_event_reads").upsert(rows, {
    onConflict: "communication_event_id,user_id",
  })

  if (insErr) {
    return NextResponse.json({ error: "insert_failed", message: insErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, marked: eventIds.length })
}
