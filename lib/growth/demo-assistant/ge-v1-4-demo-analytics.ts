import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GE_V1_4_DEMO_ASSISTANT_QA_MARKER,
  type GeV14DemoAssistantEventType,
} from "@/lib/growth/demo-assistant/ge-v1-4-types"
import { ingestSendrPublicEngagementEvents } from "@/lib/growth/sendr/growth-sendr-public-engagement-service"
import { resolveSendrPublicPageContext } from "@/lib/growth/sendr/growth-sendr-public-page-service"
import type { SendrVisitorRenderContext } from "@/lib/growth/sendr/growth-sendr-visitor-render-context"
import { syncGeV14DemoAssistantRecommendations } from "@/lib/growth/demo-assistant/ge-v1-4-demo-recommendations"

export async function recordGeV14DemoAssistantEngagementEvents(
  admin: SupabaseClient,
  input: {
    slug: string
    publicSessionId: string
    demoSessionId: string
    renderContext?: SendrVisitorRenderContext
    events: Array<{
      eventType: GeV14DemoAssistantEventType
      eventValue?: Record<string, unknown>
    }>
  },
): Promise<void> {
  const enriched = input.events.map((event) => ({
    eventType: event.eventType,
    eventValue: {
      ...(event.eventValue ?? {}),
      demo_session_id: input.demoSessionId,
      qa_marker: GE_V1_4_DEMO_ASSISTANT_QA_MARKER,
    },
  }))

  await ingestSendrPublicEngagementEvents(admin, {
    slug: input.slug,
    sessionId: input.publicSessionId,
    events: enriched,
    renderContext: input.renderContext,
  })

  const intentEvents = enriched.filter(
    (e) =>
      e.eventType === "question_asked" ||
      e.eventType === "booking_offered" ||
      e.eventType === "conversation_completed",
  )

  if (intentEvents.length > 0) {
    await syncGeV14DemoAssistantRecommendations(admin, {
      slug: input.slug,
      renderContext: input.renderContext,
      events: intentEvents,
    })

    const ctx = await resolveSendrPublicPageContext(admin, input.slug, input.renderContext)
    if (ctx?.leadId) {
      try {
        const { ingestGeV15AutomationRuntimeFromSendrEvents } = await import(
          "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-signal-processor"
        )
        await ingestGeV15AutomationRuntimeFromSendrEvents(admin, {
          organizationId: ctx.organizationId,
          leadId: ctx.leadId,
          events: intentEvents.map((e) => ({
            eventType: e.eventType,
            eventValue: e.eventValue,
          })),
        })
      } catch {
        // automation runtime is best-effort
      }
    }
  }
}
