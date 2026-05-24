import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  fetchGrowthLiveCoachingSettings,
  updateGrowthLiveCoachingSettings,
} from "@/lib/growth/realtime/providers/live-coaching-settings-repository"

export const runtime = "nodejs"

const PatchSchema = z.object({
  activeProviderConnectionId: z.string().uuid().nullable().optional(),
  fallbackProvider: z.enum(["stub", "deepgram", "assemblyai", "openai_realtime", "custom"]).optional(),
  speakerSeparationEnabled: z.boolean().optional(),
  keywordEventsEnabled: z.boolean().optional(),
  transcriptConfidenceThreshold: z.number().int().min(0).max(100).optional(),
  customKeywords: z.array(z.string().trim().min(1).max(80)).optional(),
  industryProfile: z.record(z.unknown()).optional(),
  criticalGuidanceThreshold: z.number().int().min(0).max(100).optional(),
  normalGuidanceThreshold: z.number().int().min(0).max(100).optional(),
})

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const settings = await fetchGrowthLiveCoachingSettings(access.admin)
    return NextResponse.json({ ok: true, settings })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = PatchSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid settings payload." }, { status: 400 })
  }

  try {
    const settings = await updateGrowthLiveCoachingSettings(access.admin, {
      ...parsed.data,
      updatedBy: access.userId,
    })
    return NextResponse.json({ ok: true, settings })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "update_failed", message }, { status: 500 })
  }
}
