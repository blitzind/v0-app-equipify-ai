import { createClient } from "@supabase/supabase-js"
import { z } from "zod"
import { runGrowthOutreachPreflight } from "./lib/growth/outreach/outreach-preflight"
import { fetchGrowthLeadById } from "./lib/growth/lead-repository"
import { getGrowthAiProvider } from "./lib/growth/ai-copilot-provider"
import { getGrowthEngineAiOrgId } from "./lib/growth/access"
import { runGrowthAiCopilotGeneration } from "./lib/growth/run-ai-copilot-generation"

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) throw new Error(`Missing supabase env url=${Boolean(url)} key=${Boolean(key)}`)

  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  const leadId = "d06ec481-d1ec-4281-bf88-e59a6893fcd9"
  const lead = await fetchGrowthLeadById(admin, leadId)
  if (!lead) throw new Error("lead not found")

  const preflight = await runGrowthOutreachPreflight(admin, {
    lead,
    channel: "email",
    toEmail: lead.contactEmail,
    generationType: null,
    generationApproved: true,
  })

  const provider = getGrowthAiProvider()
  const health = await provider.health()
  const rawOrg = process.env.GROWTH_ENGINE_AI_ORG_ID?.trim() ?? ""
  const orgParsed = z.string().uuid().safeParse(rawOrg)

  let generationResult: unknown = null
  let generationError: string | null = null
  try {
    generationResult = await runGrowthAiCopilotGeneration({
      admin,
      leadId,
      generationType: "cold_email",
      actingUserId: "00000000-0000-0000-0000-000000000001",
      actingUserEmail: "audit@equipify.ai",
    })
  } catch (e) {
    generationError = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
  }

  console.log(JSON.stringify({
    preflight,
    aiProvider: { id: provider.id, health },
    growthEngineAiOrgId: {
      present: Boolean(rawOrg),
      validUuid: orgParsed.success,
      resolved: getGrowthEngineAiOrgId(),
    },
    runGrowthAiCopilotGeneration: generationResult,
    runGrowthAiCopilotGenerationException: generationError,
  }, null, 2))
}

main().catch((e) => { console.error(e); process.exit(1) })
