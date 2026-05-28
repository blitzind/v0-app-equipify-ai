import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  fetchOperatorAssistPreferences,
  upsertOperatorAssistPreferences,
} from "@/lib/growth/operator-assist/operator-assist-preferences-repository"
import { VOICE_UNIFIED_OPERATOR_ASSIST_QA_MARKER } from "@/lib/growth/operator-assist/types"
import { resolveVoiceInfrastructureOrganizationId } from "@/lib/voice/repository/voice-repository"

export const runtime = "nodejs"

const PatchSchema = z.object({
  quietMode: z.boolean().optional(),
  minimumPriorityLabel: z.enum(["Critical", "High", "Medium", "Low"]).optional(),
  enabledCategories: z
    .object({
      objection: z.boolean().optional(),
      buying_signal: z.boolean().optional(),
      risk: z.boolean().optional(),
      guidance: z.boolean().optional(),
      coaching: z.boolean().optional(),
      interruption: z.boolean().optional(),
      conversation: z.boolean().optional(),
    })
    .optional(),
})

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const organizationId = resolveVoiceInfrastructureOrganizationId()
  if (!organizationId) {
    return NextResponse.json(
      { error: "org_not_configured", message: "Set GROWTH_ENGINE_AI_ORG_ID to scope operator assist preferences." },
      { status: 400 },
    )
  }

  try {
    const preferences = await fetchOperatorAssistPreferences(access.admin, {
      organizationId,
      userId: access.userId,
    })
    return NextResponse.json({ ok: true, qaMarker: VOICE_UNIFIED_OPERATOR_ASSIST_QA_MARKER, preferences })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const organizationId = resolveVoiceInfrastructureOrganizationId()
  if (!organizationId) {
    return NextResponse.json(
      { error: "org_not_configured", message: "Set GROWTH_ENGINE_AI_ORG_ID to scope operator assist preferences." },
      { status: 400 },
    )
  }

  const parsed = PatchSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid preferences payload." }, { status: 400 })
  }

  try {
    const preferences = await upsertOperatorAssistPreferences(access.admin, {
      organizationId,
      userId: access.userId,
      quietMode: parsed.data.quietMode,
      minimumPriorityLabel: parsed.data.minimumPriorityLabel,
      enabledCategories: parsed.data.enabledCategories,
    })
    return NextResponse.json({ ok: true, qaMarker: VOICE_UNIFIED_OPERATOR_ASSIST_QA_MARKER, preferences })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "update_failed", message }, { status: 500 })
  }
}
