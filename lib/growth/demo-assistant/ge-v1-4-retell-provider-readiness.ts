import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GE_V1_4_DEMO_ASSISTANT_QA_MARKER,
  GE_V1_4_DEMO_ASSISTANT_SCHEMA_MIGRATION,
} from "@/lib/growth/demo-assistant/ge-v1-4-types"
import { probeGeV14DemoAssistantSchemaReady } from "@/lib/growth/demo-assistant/ge-v1-4-demo-session-schema-health"
import {
  getGrowthRetellDemoProviderState,
  isGrowthRetellDemoAssistantEnabled,
} from "@/lib/growth/demo-assistant/ge-v1-4-retell-demo-provider"
import { EQUIPIFY_DEMO_KNOWLEDGE_BUNDLE_V1 } from "@/lib/growth/demo-assistant/equipify-demo-knowledge-bundle-v1"

export type GeV14RetellProviderReadinessReport = {
  qaMarker: typeof GE_V1_4_DEMO_ASSISTANT_QA_MARKER
  ready: boolean
  dryRunOnly: boolean
  provider: ReturnType<typeof getGrowthRetellDemoProviderState>
  schema: {
    demoAssistantSessionsReady: boolean
    engagementEventsExtended: boolean
  }
  knowledgeBundle: {
    version: string
    topicCount: number
    updatedAt: string
  }
  warnings: string[]
  blockers: string[]
  diagnostics: {
    env: {
      RETELL_API_KEY: boolean
      GROWTH_RETELL_DEMO_ASSISTANT_ENABLED: boolean
      RETELL_DEMO_ASSISTANT_AGENT_ID: boolean
    }
    gracefulDegradation: string
    humanApprovalGatesEnabled: true
    autonomousSendingEnabled: false
  }
}

export async function buildGeV14RetellProviderReadinessReport(
  admin: SupabaseClient | null,
): Promise<GeV14RetellProviderReadinessReport> {
  const provider = getGrowthRetellDemoProviderState()
  const schemaReady = admin ? await probeGeV14DemoAssistantSchemaReady(admin) : false

  const warnings: string[] = []
  const blockers: string[] = []

  if (!process.env.RETELL_API_KEY?.trim()) {
    warnings.push(
      "RETELL_API_KEY is not configured — demo assistant uses the static Equipify knowledge bundle.",
    )
  }
  if (!isGrowthRetellDemoAssistantEnabled() && process.env.RETELL_API_KEY?.trim()) {
    warnings.push(
      "Set GROWTH_RETELL_DEMO_ASSISTANT_ENABLED=true to enable live Retell chat for the demo assistant.",
    )
  }
  if (provider.enabled && !provider.agentIdConfigured) {
    warnings.push(
      "RETELL_DEMO_ASSISTANT_AGENT_ID is unset — Retell chat sessions cannot start; bundle fallback remains active.",
    )
  }
  if (provider.dryRunOnly) {
    warnings.push(
      "Demo assistant runs in bundle mode — deterministic answers from equipify-demo-knowledge-v1.",
    )
  }
  if (admin && !schemaReady) {
    blockers.push(
      `Apply migration ${GE_V1_4_DEMO_ASSISTANT_SCHEMA_MIGRATION} before production demo assistant sessions.`,
    )
  }

  const ready = blockers.length === 0

  return {
    qaMarker: GE_V1_4_DEMO_ASSISTANT_QA_MARKER,
    ready,
    dryRunOnly: provider.dryRunOnly || !provider.agentIdConfigured,
    provider,
    schema: {
      demoAssistantSessionsReady: schemaReady,
      engagementEventsExtended: schemaReady,
    },
    knowledgeBundle: {
      version: EQUIPIFY_DEMO_KNOWLEDGE_BUNDLE_V1.version,
      topicCount: EQUIPIFY_DEMO_KNOWLEDGE_BUNDLE_V1.topics.length,
      updatedAt: EQUIPIFY_DEMO_KNOWLEDGE_BUNDLE_V1.updatedAt,
    },
    warnings,
    blockers,
    diagnostics: {
      env: {
        RETELL_API_KEY: Boolean(process.env.RETELL_API_KEY?.trim()),
        GROWTH_RETELL_DEMO_ASSISTANT_ENABLED: isGrowthRetellDemoAssistantEnabled(),
        RETELL_DEMO_ASSISTANT_AGENT_ID: Boolean(process.env.RETELL_DEMO_ASSISTANT_AGENT_ID?.trim()),
      },
      gracefulDegradation:
        "When Retell is disabled or unavailable, the demo assistant answers from the static knowledge bundle without storing full transcripts.",
      humanApprovalGatesEnabled: true,
      autonomousSendingEnabled: false,
    },
  }
}
