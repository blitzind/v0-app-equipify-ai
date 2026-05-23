import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  fetchGrowthCopilotSettings,
  listGrowthAiCopilotRules,
  updateGrowthAiCopilotRule,
  updateGrowthCopilotSettings,
} from "@/lib/growth/ai-copilot-repository"
import { GROWTH_AI_COPILOT_PROMPT_VARIANTS } from "@/lib/growth/ai-copilot-types"
import { getGrowthAiProvider } from "@/lib/growth/ai-copilot-provider"

export const runtime = "nodejs"

const PatchSettingsSchema = z.object({
  aiCopilotEnabled: z.boolean().optional(),
  aiCopilotStoreGenerations: z.boolean().optional(),
  aiCopilotGenerationRetentionDays: z.number().int().min(1).max(3650).optional(),
  aiCopilotDefaultPromptVariant: z.enum(GROWTH_AI_COPILOT_PROMPT_VARIANTS).optional(),
})

const PatchRuleSchema = z.object({
  ruleKey: z.string().min(1),
  enabled: z.boolean().optional(),
  ruleConfig: z.record(z.string(), z.unknown()).optional(),
})

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const [settings, rules, providerHealth] = await Promise.all([
      fetchGrowthCopilotSettings(access.admin),
      listGrowthAiCopilotRules(access.admin),
      getGrowthAiProvider().health(),
    ])
    return NextResponse.json({ ok: true, settings, rules, providerHealth })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const rawBody = await request.json().catch(() => null)
  const settingsParsed = PatchSettingsSchema.safeParse(rawBody)
  if (settingsParsed.success) {
    try {
      const settings = await updateGrowthCopilotSettings(access.admin, {
        ...settingsParsed.data,
        updatedBy: access.userId,
      })
      return NextResponse.json({ ok: true, settings })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return NextResponse.json({ error: "update_failed", message }, { status: 500 })
    }
  }

  const ruleParsed = PatchRuleSchema.safeParse(rawBody)
  if (ruleParsed.success) {
    try {
      const rule = await updateGrowthAiCopilotRule(access.admin, ruleParsed.data.ruleKey, {
        enabled: ruleParsed.data.enabled,
        ruleConfig: ruleParsed.data.ruleConfig,
      })
      return NextResponse.json({ ok: true, rule })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return NextResponse.json({ error: "update_failed", message }, { status: 500 })
    }
  }

  return NextResponse.json({ error: "invalid_body", message: "Invalid copilot settings payload." }, { status: 400 })
}
