import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { generateGeV14DemoAssistantRecommendations } from "@/lib/growth/demo-assistant/ge-v1-4-demo-recommendation-rules"
import type { GeV14DemoAssistantEventType } from "@/lib/growth/demo-assistant/ge-v1-4-types"
import { resolveSendrPublicPageContext } from "@/lib/growth/sendr/growth-sendr-public-page-service"
import { syncSendrLeadTimelineIntelligence } from "@/lib/growth/sendr/growth-sendr-timeline-intelligence-service"
import type { SendrVisitorRenderContext } from "@/lib/growth/sendr/growth-sendr-visitor-render-context"
import { fetchGrowthLeadById, updateGrowthLead } from "@/lib/growth/lead-repository"
import { GE_V1_4_DEMO_ASSISTANT_QA_MARKER } from "@/lib/growth/demo-assistant/ge-v1-4-types"

export async function syncGeV14DemoAssistantRecommendations(
  admin: SupabaseClient,
  input: {
    slug: string
    renderContext?: SendrVisitorRenderContext
    events: Array<{
      eventType: GeV14DemoAssistantEventType
      eventValue?: Record<string, unknown>
    }>
  },
): Promise<void> {
  const ctx = await resolveSendrPublicPageContext(admin, input.slug, input.renderContext)
  if (!ctx?.leadId) return

  const recommendations = generateGeV14DemoAssistantRecommendations(input.events)
  if (recommendations.length === 0) return

  const lead = await fetchGrowthLeadById(admin, ctx.leadId)
  if (!lead) return

  const existingMetadata = lead.metadata ?? {}
  const existingDemoRecs =
    (existingMetadata.ge_v1_4_demo_assistant_recommendations as unknown[] | undefined) ?? []

  await updateGrowthLead(admin, ctx.leadId, {
    metadata: {
      ...existingMetadata,
      ge_v1_4_demo_assistant_recommendations: [
        ...recommendations.map((rec) => ({
          ...rec,
          generatedAt: new Date().toISOString(),
          qa_marker: GE_V1_4_DEMO_ASSISTANT_QA_MARKER,
        })),
        ...existingDemoRecs,
      ].slice(0, 10),
    },
  })

  await syncSendrLeadTimelineIntelligence(admin, {
    organizationId: ctx.organizationId,
    leadId: ctx.leadId,
  })
}
