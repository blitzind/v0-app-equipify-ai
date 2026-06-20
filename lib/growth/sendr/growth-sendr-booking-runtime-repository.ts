import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { GROWTH_SENDR_QA_MARKER } from "@/lib/growth/sendr/growth-sendr-config"
import type { GrowthSendrBookingAsset } from "@/lib/growth/sendr/growth-sendr-types"

function bookingAssetsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("growth_booking_assets")
}

function bookingEventsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("growth_booking_events")
}

function mapBookingAsset(row: Record<string, unknown>): GrowthSendrBookingAsset {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    ownerUserId: String(row.owner_user_id),
    mediaAssetId: row.media_asset_id ? String(row.media_asset_id) : null,
    meetingLink: row.meeting_link ? String(row.meeting_link) : null,
    meetingType: row.meeting_type ? String(row.meeting_type) : null,
    durationMinutes: row.duration_minutes != null ? Number(row.duration_minutes) : null,
    timezone: row.timezone ? String(row.timezone) : null,
    calendarProvider: row.calendar_provider
      ? (String(row.calendar_provider) as GrowthSendrBookingAsset["calendarProvider"])
      : null,
    legacyBookingPageId: row.legacy_booking_page_id ? String(row.legacy_booking_page_id) : null,
    deletedAt: row.deleted_at ? String(row.deleted_at) : null,
    createdAt: String(row.created_at),
  }
}

export async function registerGrowthSendrBookingAsset(
  admin: SupabaseClient,
  input: {
    organizationId: string
    ownerUserId: string
    mediaAssetId?: string | null
    meetingLink?: string | null
    meetingType?: string | null
    durationMinutes?: number | null
    timezone?: string | null
    calendarProvider?: "google" | "outlook" | "manual" | null
    legacyBookingPageId?: string | null
  },
): Promise<GrowthSendrBookingAsset> {
  const { data, error } = await bookingAssetsTable(admin)
    .insert({
      organization_id: input.organizationId,
      owner_user_id: input.ownerUserId,
      media_asset_id: input.mediaAssetId ?? null,
      meeting_link: input.meetingLink ?? null,
      meeting_type: input.meetingType ?? null,
      duration_minutes: input.durationMinutes ?? null,
      timezone: input.timezone ?? null,
      calendar_provider: input.calendarProvider ?? null,
      legacy_booking_page_id: input.legacyBookingPageId ?? null,
      qa_marker: GROWTH_SENDR_QA_MARKER,
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapBookingAsset(data as Record<string, unknown>)
}

export async function getGrowthSendrBookingAsset(
  admin: SupabaseClient,
  bookingAssetId: string,
): Promise<GrowthSendrBookingAsset | null> {
  const { data, error } = await bookingAssetsTable(admin)
    .select("*")
    .eq("id", bookingAssetId)
    .is("deleted_at", null)
    .maybeSingle()
  if (error || !data) return null
  return mapBookingAsset(data as Record<string, unknown>)
}

export async function appendGrowthSendrBookingEvent(
  admin: SupabaseClient,
  input: {
    bookingAssetId: string
    organizationId: string
    sessionId: string
    eventType: "calendar_open" | "booking_started" | "booking_completed"
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  const { error } = await bookingEventsTable(admin).insert({
    booking_asset_id: input.bookingAssetId,
    organization_id: input.organizationId,
    session_id: input.sessionId,
    event_type: input.eventType,
    metadata: input.metadata ?? {},
    qa_marker: GROWTH_SENDR_QA_MARKER,
  })
  if (error) throw new Error(error.message)
}

export async function countGrowthSendrBookingsToday(
  admin: SupabaseClient,
  organizationId: string,
  dayStart: string,
): Promise<number> {
  const { count, error } = await bookingEventsTable(admin)
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("event_type", "booking_completed")
    .gte("created_at", dayStart)
  if (error) return 0
  return count ?? 0
}
