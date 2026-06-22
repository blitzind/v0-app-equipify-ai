import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { answerGeV14DemoAssistantQuestion } from "@/lib/growth/demo-assistant/ge-v1-4-demo-assistant-answer-service"
import {
  buildConversationOutcome,
  detectDemoAssistantIntent,
} from "@/lib/growth/demo-assistant/ge-v1-4-demo-intent-service"
import { resolveGeV14ProspectContext } from "@/lib/growth/demo-assistant/ge-v1-4-prospect-context"
import {
  createRetellDemoChat,
  endRetellDemoChat,
  getGrowthRetellDemoProviderState,
} from "@/lib/growth/demo-assistant/ge-v1-4-retell-demo-provider"
import {
  completeGeV14DemoAssistantSession,
  createGeV14DemoAssistantSession,
  getGeV14DemoAssistantSession,
} from "@/lib/growth/demo-assistant/ge-v1-4-demo-session-repository"
import { recordGeV14DemoAssistantEngagementEvents } from "@/lib/growth/demo-assistant/ge-v1-4-demo-analytics"
import type {
  GeV14ConversationOutcome,
  GeV14DemoAssistantSession,
  GeV14DemoIntentKind,
} from "@/lib/growth/demo-assistant/ge-v1-4-types"
import type { GrowthSendrPublicPagePayload } from "@/lib/growth/sendr/growth-sendr-types"
import type { SendrVisitorRenderContext } from "@/lib/growth/sendr/growth-sendr-visitor-render-context"
import { isRuntimeKillSwitchEnabled } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"

type SessionMemory = {
  questions: string[]
  intents: GeV14DemoIntentKind[]
  bookingOffered: boolean
  bookingStarted: boolean
  bookingCompleted: boolean
}

const sessionMemory = new Map<string, SessionMemory>()

function getMemory(sessionId: string): SessionMemory {
  const existing = sessionMemory.get(sessionId)
  if (existing) return existing
  const fresh: SessionMemory = {
    questions: [],
    intents: [],
    bookingOffered: false,
    bookingStarted: false,
    bookingCompleted: false,
  }
  sessionMemory.set(sessionId, fresh)
  return fresh
}

export async function assertGeV14DemoAssistantEnabled(
  admin: SupabaseClient,
): Promise<{ enabled: boolean; reason?: string }> {
  const killSwitch = await isRuntimeKillSwitchEnabled(admin, "demo_assistant_enabled")
  if (!killSwitch) {
    return { enabled: false, reason: "demo_assistant_disabled" }
  }
  const agentTracking = await isRuntimeKillSwitchEnabled(admin, "agent_tracking_enabled")
  if (!agentTracking) {
    return { enabled: false, reason: "agent_tracking_disabled" }
  }
  return { enabled: true }
}

export async function createGeV14DemoAssistantSessionForPage(
  admin: SupabaseClient,
  input: {
    slug: string
    publicSessionId: string
    payload?: GrowthSendrPublicPagePayload
    renderContext?: SendrVisitorRenderContext
  },
): Promise<
  | { ok: true; session: GeV14DemoAssistantSession; degraded: boolean }
  | { ok: false; status: number; error: string }
> {
  const gate = await assertGeV14DemoAssistantEnabled(admin)
  if (!gate.enabled) {
    return { ok: false, status: 503, error: gate.reason ?? "disabled" }
  }

  const prospect = await resolveGeV14ProspectContext(admin, input)
  if (!prospect.ok) {
    return { ok: false, status: 404, error: prospect.error }
  }

  const providerState = getGrowthRetellDemoProviderState()
  let retellChatId: string | null = null
  let degraded = providerState.dryRunOnly

  if (providerState.enabled && providerState.agentId) {
    try {
      const chat = await createRetellDemoChat({
        agentId: providerState.agentId,
        metadata: {
          slug: input.slug,
          public_session_id: input.publicSessionId,
        },
      })
      retellChatId = chat.chatId
      degraded = false
    } catch {
      degraded = true
    }
  }

  try {
    const session = await createGeV14DemoAssistantSession(admin, {
      organizationId: prospect.organizationId,
      landingPageId: prospect.landingPageId,
      leadId: prospect.leadId,
      publishedSlug: input.slug,
      publicSessionId: input.publicSessionId,
      prospectContext: prospect.context,
      retellChatId,
    })

    sessionMemory.set(session.id, {
      questions: [],
      intents: [],
      bookingOffered: false,
      bookingStarted: false,
      bookingCompleted: false,
    })

    await recordGeV14DemoAssistantEngagementEvents(admin, {
      slug: input.slug,
      publicSessionId: input.publicSessionId,
      demoSessionId: session.id,
      renderContext: input.renderContext,
      events: [{ eventType: "agent_opened", eventValue: { degraded } }],
    })

    return { ok: true, session, degraded }
  } catch {
    return { ok: false, status: 503, error: "session_create_failed" }
  }
}

export async function askGeV14DemoAssistantQuestion(
  admin: SupabaseClient,
  input: {
    slug: string
    demoSessionId: string
    publicSessionId: string
    question: string
    renderContext?: SendrVisitorRenderContext
  },
): Promise<
  | {
      ok: true
      answer: string
      bookingOffered: boolean
      bookingUrl: string | null
      intent: ReturnType<typeof detectDemoAssistantIntent>
      provider: "retell" | "bundle"
    }
  | { ok: false; status: number; error: string }
> {
  const gate = await assertGeV14DemoAssistantEnabled(admin)
  if (!gate.enabled) {
    return { ok: false, status: 503, error: gate.reason ?? "disabled" }
  }

  const session = await getGeV14DemoAssistantSession(admin, input.demoSessionId)
  if (!session || session.status !== "active" || session.publishedSlug !== input.slug) {
    return { ok: false, status: 404, error: "session_not_found" }
  }

  const question = input.question.trim()
  if (!question) {
    return { ok: false, status: 400, error: "empty_question" }
  }

  const memory = getMemory(session.id)
  memory.questions.push(question)

  await recordGeV14DemoAssistantEngagementEvents(admin, {
    slug: input.slug,
    publicSessionId: input.publicSessionId,
    demoSessionId: session.id,
    renderContext: input.renderContext,
    events: [
      {
        eventType: "question_asked",
        eventValue: { questionLength: question.length },
      },
    ],
  })

  const result = await answerGeV14DemoAssistantQuestion({
    question,
    context: session.prospectContext,
    retellChatId: session.retellChatId,
  })

  memory.intents.push(...result.intent.detectedIntents)
  if (result.bookingOffered) memory.bookingOffered = true

  await recordGeV14DemoAssistantEngagementEvents(admin, {
    slug: input.slug,
    publicSessionId: input.publicSessionId,
    demoSessionId: session.id,
    renderContext: input.renderContext,
    events: [
      {
        eventType: "response_generated",
        eventValue: {
          provider: result.provider,
          intent: result.intent.primaryIntent,
          knowledgeTopicId: result.knowledgeTopicId,
          usedFallback: result.usedFallback,
        },
      },
      ...(result.bookingOffered
        ? [
            {
              eventType: "booking_offered" as const,
              eventValue: {
                bookingUrl: result.bookingUrl,
                intent: result.intent.primaryIntent,
              },
            },
          ]
        : []),
    ],
  })

  return {
    ok: true,
    answer: result.answer,
    bookingOffered: result.bookingOffered,
    bookingUrl: result.bookingUrl,
    intent: result.intent,
    provider: result.provider,
  }
}

export async function completeGeV14DemoAssistantSessionForPage(
  admin: SupabaseClient,
  input: {
    slug: string
    demoSessionId: string
    publicSessionId: string
    bookingStarted?: boolean
    bookingCompleted?: boolean
    renderContext?: SendrVisitorRenderContext
  },
): Promise<
  | { ok: true; outcome: GeV14ConversationOutcome }
  | { ok: false; status: number; error: string }
> {
  const session = await getGeV14DemoAssistantSession(admin, input.demoSessionId)
  if (!session || session.publishedSlug !== input.slug) {
    return { ok: false, status: 404, error: "session_not_found" }
  }

  const memory = getMemory(session.id)
  if (input.bookingStarted) memory.bookingStarted = true
  if (input.bookingCompleted) memory.bookingCompleted = true

  const outcome = buildConversationOutcome({
    questions: memory.questions,
    intents: memory.intents,
    bookingOffered: memory.bookingOffered,
    bookingStarted: memory.bookingStarted,
    bookingCompleted: memory.bookingCompleted,
  })

  if (session.retellChatId) {
    await endRetellDemoChat(session.retellChatId)
  }

  await completeGeV14DemoAssistantSession(admin, {
    sessionId: session.id,
    status: "completed",
    conversationOutcome: outcome,
  })

  await recordGeV14DemoAssistantEngagementEvents(admin, {
    slug: input.slug,
    publicSessionId: input.publicSessionId,
    demoSessionId: session.id,
    renderContext: input.renderContext,
    events: [
      {
        eventType: "conversation_completed",
        eventValue: {
          keyTopics: outcome.keyTopics,
          bookingOutcome: outcome.bookingOutcome,
        },
      },
    ],
  })

  sessionMemory.delete(session.id)

  return { ok: true, outcome }
}
