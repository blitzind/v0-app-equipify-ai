import "server-only"

import OpenAI from "openai"
import type {
  AiChatMessage,
  AiProviderAdapter,
  UnifiedCompletionRequest,
  UnifiedCompletionResponse,
} from "@/lib/ai/types"
import { getProviderApiKey } from "@/lib/ai/providers/credentials"

function toOpenAiMessages(messages: AiChatMessage[]): OpenAI.Chat.ChatCompletionMessageParam[] {
  return messages.map((m): OpenAI.Chat.ChatCompletionMessageParam => {
    if (typeof m.content === "string") {
      switch (m.role) {
        case "system":
          return { role: "system", content: m.content }
        case "assistant":
          return { role: "assistant", content: m.content }
        default:
          return { role: "user", content: m.content }
      }
    }
    const parts = m.content.map((part) => {
      if (part.type === "text") return { type: "text" as const, text: part.text }
      return { type: "image_url" as const, image_url: part.image_url }
    })
    if (m.role === "assistant") {
      return { role: "assistant", content: parts } as OpenAI.Chat.ChatCompletionMessageParam
    }
    return { role: "user", content: parts }
  })
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms))
}

export function createOpenAiAdapter(): AiProviderAdapter {
  return {
    id: "openai",
    supportsMultimodal: true,
    async complete(req: UnifiedCompletionRequest): Promise<UnifiedCompletionResponse> {
      const apiKey = getProviderApiKey("openai")
      if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.")

      const client = new OpenAI({ apiKey })
      const messages = toOpenAiMessages(req.messages)

      let lastErr: unknown
      for (let attempt = 0; attempt <= req.maxRetries; attempt++) {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), req.timeoutMs)
        try {
          const completion = await client.chat.completions.create(
            {
              model: req.model,
              messages,
              temperature: req.temperature,
              max_tokens: req.maxOutputTokens,
              ...(req.structuredMode === "json_object"
                ? { response_format: { type: "json_object" as const } }
                : {}),
            },
            { signal: controller.signal },
          )
          clearTimeout(timer)

          const choice = completion.choices[0]
          const text = choice?.message?.content ?? ""
          const usage = completion.usage
          return {
            text,
            promptTokens: usage?.prompt_tokens ?? 0,
            completionTokens: usage?.completion_tokens ?? 0,
            finishReason: choice?.finish_reason ?? null,
          }
        } catch (e) {
          clearTimeout(timer)
          lastErr = e
          const retriable =
            e instanceof OpenAI.APIError && (e.status === 429 || (e.status ?? 500) >= 500)
          if (!retriable || attempt >= req.maxRetries) throw e
          await sleep(400 * (attempt + 1))
        }
      }
      throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
    },
  }
}
