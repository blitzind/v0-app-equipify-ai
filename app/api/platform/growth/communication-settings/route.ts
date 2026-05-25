import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { GROWTH_CALL_DIAL_MODES } from "@/lib/growth/communication/types"
import {
  fetchGrowthPlatformCommunicationSettings,
  updateGrowthPlatformCommunicationSettings,
} from "@/lib/growth/communication/settings-repository"
import { fetchGrowthCalendarConnectionForUser } from "@/lib/growth/calendar/calendar-connection-repository"
import { GROWTH_MEETING_LOCATION_PROVIDERS } from "@/lib/growth/meeting-location/meeting-location-provider-types"
import { buildMeetingLocationProviderReadiness } from "@/lib/growth/meeting-location/meeting-location-provider-types"

/** Platform-admin internal only. Future org add-ons use org-scoped routes + membership gates. */

export const runtime = "nodejs"

const PatchSchema = z.object({
  activeEmailConnectionId: z.string().uuid().nullable().optional(),
  callDialMode: z.enum(GROWTH_CALL_DIAL_MODES).optional(),
  customUrlTemplate: z.string().trim().max(2000).nullable().optional(),
  showAlternateDialers: z.boolean().optional(),
  defaultMeetingProvider: z.enum(GROWTH_MEETING_LOCATION_PROVIDERS).optional(),
  autoCreateMeetingLink: z.boolean().optional(),
})

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const settings = await fetchGrowthPlatformCommunicationSettings(access.admin)
    const calendarConnected = Boolean(
      await fetchGrowthCalendarConnectionForUser(access.admin, access.userId),
    )
    return NextResponse.json({
      ok: true,
      settings,
      providerReadiness: buildMeetingLocationProviderReadiness({
        googleCalendarConnected: calendarConnected,
      }),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const rawBody = await request.json().catch(() => null)
  const parsed = PatchSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid communication settings payload." }, { status: 400 })
  }

  try {
    const settings = await updateGrowthPlatformCommunicationSettings(access.admin, {
      activeEmailConnectionId: parsed.data.activeEmailConnectionId,
      callDialMode: parsed.data.callDialMode,
      customUrlTemplate: parsed.data.customUrlTemplate,
      showAlternateDialers: parsed.data.showAlternateDialers,
      defaultMeetingProvider: parsed.data.defaultMeetingProvider,
      autoCreateMeetingLink: parsed.data.autoCreateMeetingLink,
      updatedBy: access.userId,
    })
    const calendarConnected = Boolean(
      await fetchGrowthCalendarConnectionForUser(access.admin, access.userId),
    )
    return NextResponse.json({
      ok: true,
      settings,
      providerReadiness: buildMeetingLocationProviderReadiness({
        googleCalendarConnected: calendarConnected,
      }),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "update_failed", message }, { status: 500 })
  }
}
