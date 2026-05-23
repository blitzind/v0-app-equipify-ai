import "server-only"

import { runAiTask } from "@/lib/ai/server"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import {
  buildGrowthAiCopilotPlaybookExtractionSystemPrompt,
  buildGrowthAiCopilotPlaybookExtractionUserPrompt,
} from "@/lib/growth/ai-copilot-playbook-prompts"
import { growthAiCopilotPlaybookExtractionSchema } from "@/lib/growth/ai-copilot-playbook-schema"

export async function runGrowthAiCopilotPlaybookExtractionTask(input: {
  source: Parameters<typeof buildGrowthAiCopilotPlaybookExtractionUserPrompt>[0]["source"]
  content: string
}) {
  const orgId = getGrowthEngineAiOrgId()
  if (!orgId) {
    throw new Error("AI playbook extraction is not configured (missing GROWTH_ENGINE_AI_ORG_ID).")
  }

  const result = await runAiTask({
    task: "growth_copilot_playbook_extraction",
    organizationId: orgId,
    input: {
      system: buildGrowthAiCopilotPlaybookExtractionSystemPrompt(),
      user: buildGrowthAiCopilotPlaybookExtractionUserPrompt(input),
    },
    schema: growthAiCopilotPlaybookExtractionSchema,
    cacheSchemaVersion: "growth_copilot_playbook_extraction_v1",
    skipPlanGateCheck: true,
    skipBudgetCheck: true,
    forceLiveAi: true,
    taskOverrides: { structuredMode: "json_object" },
  })

  if (!result.ok) {
    throw new Error(result.error.message ?? "AI playbook extraction failed.")
  }

  return {
    output: result.output,
    provider: result.meta.provider,
    model: result.meta.model,
  }
}
