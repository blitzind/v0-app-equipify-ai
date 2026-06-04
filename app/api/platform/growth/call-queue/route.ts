import { NextResponse } from "next/server"
import { z } from "zod"
import { logGrowthEngine, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { listGrowthCallQueue } from "@/lib/growth/call-queue-repository"
import { GROWTH_CALL_QUEUE_FILTERS } from "@/lib/growth/call-types"
import { GROWTH_EMAIL_DISCOVERY_PROSPECT_FILTERS } from "@/lib/growth/email-discovery/email-discovery-runtime-types"
import type { GrowthEmailDiscoveryProspectFilter } from "@/lib/growth/email-discovery/email-discovery-runtime-types"
import { GROWTH_PHONE_DISCOVERY_PROSPECT_FILTERS } from "@/lib/growth/phone-discovery/phone-discovery-runtime-types"
import type { GrowthPhoneDiscoveryProspectFilter } from "@/lib/growth/phone-discovery/phone-discovery-runtime-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const filterParam = url.searchParams.get("filter") ?? "call_ready"
  const filterParsed = GROWTH_CALL_QUEUE_FILTERS.includes(filterParam as (typeof GROWTH_CALL_QUEUE_FILTERS)[number])
    ? (filterParam as (typeof GROWTH_CALL_QUEUE_FILTERS)[number])
    : null

  if (!filterParsed) {
    return NextResponse.json(
      { error: "invalid_filter", message: `Filter must be one of: ${GROWTH_CALL_QUEUE_FILTERS.join(", ")}.` },
      { status: 400 },
    )
  }

  const limitParam = url.searchParams.get("limit")
  const offsetParam = url.searchParams.get("offset")
  const limitParsed = limitParam ? z.coerce.number().int().min(1).max(100).safeParse(limitParam) : { success: true, data: 50 }
  const offsetParsed = offsetParam ? z.coerce.number().int().min(0).safeParse(offsetParam) : { success: true, data: 0 }
  const assignedToParam = url.searchParams.get("assignedTo")
  const unassignedParam = url.searchParams.get("unassigned") === "true"
  const assignedToParsed =
    assignedToParam && z.string().uuid().safeParse(assignedToParam).success ? assignedToParam : undefined

  const emailDiscoveryParam = url.searchParams.get("email_discovery_filter") ?? ""
  const emailDiscoveryFilterParsed = GROWTH_EMAIL_DISCOVERY_PROSPECT_FILTERS.includes(
    emailDiscoveryParam as GrowthEmailDiscoveryProspectFilter,
  )
    ? (emailDiscoveryParam as GrowthEmailDiscoveryProspectFilter)
    : null
  if (emailDiscoveryParam && !emailDiscoveryFilterParsed) {
    return NextResponse.json(
      {
        error: "invalid_email_discovery_filter",
        message: `email_discovery_filter must be one of: ${GROWTH_EMAIL_DISCOVERY_PROSPECT_FILTERS.join(", ")}.`,
      },
      { status: 400 },
    )
  }

  const phoneDiscoveryParam = url.searchParams.get("phone_discovery_filter") ?? ""
  const phoneDiscoveryFilterParsed = GROWTH_PHONE_DISCOVERY_PROSPECT_FILTERS.includes(
    phoneDiscoveryParam as GrowthPhoneDiscoveryProspectFilter,
  )
    ? (phoneDiscoveryParam as GrowthPhoneDiscoveryProspectFilter)
    : null
  if (phoneDiscoveryParam && !phoneDiscoveryFilterParsed) {
    return NextResponse.json(
      {
        error: "invalid_phone_discovery_filter",
        message: `phone_discovery_filter must be one of: ${GROWTH_PHONE_DISCOVERY_PROSPECT_FILTERS.join(", ")}.`,
      },
      { status: 400 },
    )
  }

  if (!limitParsed.success || !offsetParsed.success) {
    return NextResponse.json({ error: "invalid_pagination", message: "Invalid limit or offset." }, { status: 400 })
  }

  try {
    const rows = await listGrowthCallQueue(access.admin, {
      filter: filterParsed,
      limit: limitParsed.data,
      offset: offsetParsed.data,
      assignedTo: assignedToParsed,
      unassigned: unassignedParam || undefined,
      emailDiscoveryFilter: emailDiscoveryFilterParsed,
      phoneDiscoveryFilter: phoneDiscoveryFilterParsed,
    })

    logGrowthEngine("call_queue_list_success", {
      filter: filterParsed,
      count: rows.length,
      actorEmail: access.userEmail,
    })

    return NextResponse.json({ ok: true, filter: filterParsed, rows })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "query_failed", message }, { status: 500 })
  }
}
