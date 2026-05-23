import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { resolveGrowthPlatformAdminDialPreferencesForUser } from "@/lib/growth/communication/resolve-dial-preferences"
import { fetchGrowthPlatformCommunicationSettings } from "@/lib/growth/communication/settings-repository"
import {
  fetchGrowthPlatformAdminCommunicationPreferences,
  upsertGrowthPlatformAdminCommunicationPreferences,
} from "@/lib/growth/communication/user-preferences-repository"
import { GROWTH_CALL_DIAL_MODES } from "@/lib/growth/communication/types"

/** Platform-admin internal only. Future org add-ons resolve prefs under org scope + membership gates. */

export const runtime = "nodejs"

const PatchSchema = z.object({
  callDialMode: z.enum(GROWTH_CALL_DIAL_MODES).nullable().optional(),
  customUrlTemplate: z.string().trim().max(2000).nullable().optional(),
  showAlternateDialers: z.boolean().nullable().optional(),
  preferredEmailConnectionId: z.string().uuid().nullable().optional(),
})

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const [platform, user, resolved] = await Promise.all([
      fetchGrowthPlatformCommunicationSettings(access.admin),
      fetchGrowthPlatformAdminCommunicationPreferences(access.admin, access.userId),
      resolveGrowthPlatformAdminDialPreferencesForUser(access.admin, access.userId),
    ])

    return NextResponse.json({
      ok: true,
      platform,
      user,
      resolved,
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
    return NextResponse.json({ error: "invalid_body", message: "Invalid communication preferences payload." }, { status: 400 })
  }

  try {
    const user = await upsertGrowthPlatformAdminCommunicationPreferences(access.admin, {
      userId: access.userId,
      callDialMode: parsed.data.callDialMode,
      customUrlTemplate: parsed.data.customUrlTemplate,
      showAlternateDialers: parsed.data.showAlternateDialers,
      preferredEmailConnectionId: parsed.data.preferredEmailConnectionId,
    })
    const resolved = await resolveGrowthPlatformAdminDialPreferencesForUser(access.admin, access.userId)

    return NextResponse.json({ ok: true, user, resolved })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "update_failed", message }, { status: 500 })
  }
}
