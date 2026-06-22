import "server-only"

import { resolveBundleAnswer } from "@/lib/growth/demo-assistant/equipify-demo-knowledge-bundle-v1"
import { detectDemoAssistantIntent } from "@/lib/growth/demo-assistant/ge-v1-4-demo-intent-service"
import { buildRetellDemoSystemPrompt } from "@/lib/growth/demo-assistant/ge-v1-4-prospect-context"
import {
  getGrowthRetellDemoProviderState,
  sendRetellDemoChatMessage,
} from "@/lib/growth/demo-assistant/ge-v1-4-retell-demo-provider"
import type {
  GeV14DemoAssistantAnswer,
  GeV14ProspectContext,
} from "@/lib/growth/demo-assistant/ge-v1-4-types"

const BLOCKED_CLAIM_PATTERNS = [
  /\$\d+/,
  /guaranteed integration/i,
  /we always integrate with/i,
  /free forever/i,
]

function sanitizeAnswer(text: string, context: GeV14ProspectContext): string {
  let answer = text.trim()
  for (const pattern of BLOCKED_CLAIM_PATTERNS) {
    if (pattern.test(answer)) {
      return resolveBundleAnswer("pricing", context).answer
    }
  }
  if (answer.length > 1200) {
    answer = `${answer.slice(0, 1197)}...`
  }
  return answer
}

function appendBookingOffer(
  answer: string,
  context: GeV14ProspectContext,
  suggestDemo: boolean,
): { answer: string; bookingOffered: boolean } {
  if (!suggestDemo || !context.bookingUrl) {
    return { answer, bookingOffered: false }
  }

  const alreadyMentioned =
    answer.toLowerCase().includes("book") ||
    answer.toLowerCase().includes("demo") ||
    answer.includes(context.bookingUrl)

  if (alreadyMentioned) {
    return { answer, bookingOffered: true }
  }

  return {
    answer: `${answer}\n\nIf you'd like, you can book a short demo to see how this fits ${context.company?.trim() || "your team"}.`,
    bookingOffered: true,
  }
}

export async function answerGeV14DemoAssistantQuestion(input: {
  question: string
  context: GeV14ProspectContext
  retellChatId?: string | null
}): Promise<GeV14DemoAssistantAnswer> {
  const question = input.question.trim()
  const intent = detectDemoAssistantIntent(question)
  const providerState = getGrowthRetellDemoProviderState()

  let answer = ""
  let topicId: string | null = null
  let provider: GeV14DemoAssistantAnswer["provider"] = "bundle"
  let usedFallback = false

  if (providerState.enabled && providerState.agentId && input.retellChatId) {
    try {
      const systemPrefix = buildRetellDemoSystemPrompt(input.context)
      const retellAnswer = await sendRetellDemoChatMessage({
        chatId: input.retellChatId,
        content: `${systemPrefix}\n\nProspect question: ${question}`,
      })
      answer = sanitizeAnswer(retellAnswer, input.context)
      provider = "retell"
      const bundleMatch = resolveBundleAnswer(question, input.context)
      topicId = bundleMatch.topicId
    } catch {
      usedFallback = true
    }
  }

  if (!answer) {
    const bundle = resolveBundleAnswer(question, input.context)
    answer = sanitizeAnswer(bundle.answer, input.context)
    topicId = bundle.topicId
    provider = "bundle"
    usedFallback = providerState.enabled
  }

  const withBooking = appendBookingOffer(answer, input.context, intent.suggestDemo)

  return {
    answer: withBooking.answer,
    intent,
    bookingOffered: withBooking.bookingOffered,
    bookingUrl: intent.suggestDemo ? input.context.bookingUrl ?? null : null,
    knowledgeTopicId: topicId,
    provider,
    usedFallback,
  }
}
