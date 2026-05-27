import "server-only"

import { z } from "zod"
import { runAiTask } from "@/lib/ai/server"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import {
  buildSignalCopilotCompanyEvidencePacket,
} from "@/lib/growth/signals/ai/signal-copilot-context-builder"
import {
  mapValidatedAiToNarrative,
  validateSignalCopilotAiOutput,
} from "@/lib/growth/signals/ai/signal-copilot-output-validator"
import {
  SIGNAL_COPILOT_SYSTEM_PROMPT,
  buildSignalCopilotUserPrompt,
} from "@/lib/growth/signals/ai/signal-copilot-prompt"
import {
  buildSignalCopilotInsightBundle,
  generateCompanySignalNarrative,
} from "@/lib/growth/signals/ai/signal-copilot-safe-summary"
import type {
  SignalCopilotCompanyNarrative,
  SignalCopilotInsightBundle,
} from "@/lib/growth/signals/ai/signal-copilot-types"
import { buildCompanySignalRollup } from "@/lib/growth/signals/company-signal-rollup"
import type { GrowthSignalRow } from "@/lib/growth/signals/signal-types"

const signalCopilotModelSchema = z.object({
  short_summary: z.string().min(1).max(320),
  detailed_summary: z.string().min(1).max(800),
  reasoning_bullets: z.array(z.string().min(1).max(240)).min(1).max(6),
  suggested_operator_focus: z.array(z.string().min(1).max(160)).max(6),
  confidence: z.enum(["low", "medium", "high"]),
})

export type RunSignalCopilotNarrativeInput = {
  domain?: string | null
  company_id?: string | null
  company_name?: string | null
  signals: GrowthSignalRow[]
  watchlist_matches?: Array<{ watchlist_id: string; watchlist_name: string; signal_id: string }>
  territory_alignment?: string | null
  prefer_ai?: boolean
}

export type RunSignalCopilotNarrativeResult = {
  ok: boolean
  bundle: SignalCopilotInsightBundle
  narrative_source: "deterministic" | "ai_validated" | "none"
  ai_error?: string
}

export async function runSignalCopilotNarrative(
  input: RunSignalCopilotNarrativeInput,
): Promise<RunSignalCopilotNarrativeResult> {
  const deterministic = buildSignalCopilotInsightBundle(input)
  const rollup = buildCompanySignalRollup({
    domain: input.domain,
    company_id: input.company_id,
    company_name: input.company_name,
    signals: input.signals,
    watchlist_matches: input.watchlist_matches,
  })

  if (rollup.total_signal_count === 0) {
    return { ok: true, bundle: deterministic, narrative_source: "none" }
  }

  if (input.prefer_ai === false) {
    return {
      ok: true,
      bundle: deterministic,
      narrative_source: deterministic.narrative?.source ?? "deterministic",
    }
  }

  const orgId = getGrowthEngineAiOrgId()
  if (!orgId) {
    return {
      ok: true,
      bundle: deterministic,
      narrative_source: deterministic.narrative?.source ?? "deterministic",
    }
  }

  const packet = buildSignalCopilotCompanyEvidencePacket(input)

  try {
    const aiResult = await runAiTask({
      task: "growth_signal_copilot_summary",
      organizationId: orgId,
      input: {
        system: SIGNAL_COPILOT_SYSTEM_PROMPT,
        user: buildSignalCopilotUserPrompt(packet),
      },
      schema: signalCopilotModelSchema,
      cacheSchemaVersion: "growth_signal_copilot_summary_v1",
      skipPlanGateCheck: true,
      skipBudgetCheck: true,
      forceLiveAi: true,
      taskOverrides: { structuredMode: "json_object" },
    })

    if (!aiResult.ok) {
      return {
        ok: true,
        bundle: deterministic,
        narrative_source: "deterministic",
        ai_error: aiResult.error.message ?? "AI summary unavailable",
      }
    }

    const validated = validateSignalCopilotAiOutput(aiResult.output)
    if (!validated.ok || !validated.sanitized) {
      return {
        ok: true,
        bundle: deterministic,
        narrative_source: "deterministic",
        ai_error: validated.errors.join("; "),
      }
    }

    const aiNarrative: SignalCopilotCompanyNarrative = mapValidatedAiToNarrative(validated.sanitized)

    return {
      ok: true,
      bundle: {
        ...deterministic,
        narrative: aiNarrative,
      },
      narrative_source: "ai_validated",
    }
  } catch (error) {
    return {
      ok: true,
      bundle: deterministic,
      narrative_source: "deterministic",
      ai_error: error instanceof Error ? error.message : "AI summary failed",
    }
  }
}

export async function generateCompanySignalNarrativeWithAi(
  input: RunSignalCopilotNarrativeInput,
): Promise<SignalCopilotCompanyNarrative | null> {
  const result = await runSignalCopilotNarrative(input)
  return result.bundle.narrative
}
