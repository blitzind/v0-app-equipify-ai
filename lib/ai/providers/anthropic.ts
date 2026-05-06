import "server-only"

import type {
  AiChatMessage,
  AiProviderAdapter,
  UnifiedCompletionRequest,
  UnifiedCompletionResponse,
} from "@/lib/ai/types"
import { getProviderApiKey } from "@/lib/ai/providers/credentials"

function splitSystem(messages: AiChatMessage[]): { system: string | undefined; rest: AiChatMessage[] } {
  const sys = messages.filter((m) => m.role === "system")
  const rest = messages.filter((m) => m.role !== "system")
  const system =
    sys.length > 0
      ? sys
          .map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content)))
          .join("\n\n")
      : undefined
  return { system, rest }
}

function onlyTextContent(m: AiChatMessage): string {
  if (typeof m.content === "string") return m.content
  return m.content
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("\n")
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms))
}

export function createAnthropicAdapter(): AiProviderAdapter {
  return {
    id: "anthropic",
    supportsMultimodal: false,
    async complete(req: UnifiedCompletionRequest): Promise<UnifiedCompletionResponse> {
      const apiKey = getProviderApiKey("anthropic")
      if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured.")

      const { system, rest } = splitSystem(req.messages)
      const anthropicMessages = rest
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: [{ type: "text" as const, text: onlyTextContent(m) }],
        }))

      let lastErr: unknown
      for (let attempt = 0; attempt <= req.maxRetries; attempt++) {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), req.timeoutMs)
        try {
          const body: Record<string, unknown> = {
            model: req.model,
            max_tokens: req.maxOutputTokens,
            messages: anthropicMessages,
          }
          if (system) body.system = system

          const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify(body),
            signal: controller.signal,
          })
          clearTimeout(timer)

          if (!res.ok) {
            const t = await res.text()
            throw new Error(`Anthropic HTTP ${res.status}: ${t.slice(0, 500)}`)
          }

          const json = (await res.json()) as {
            content?: Array<{ type: string; text?: string }>
            usage?: { input_tokens?: number; output_tokens?: number }
          }

          const text =
            json.content
              ?.filter((c) => c.type === "text")
              .map((c) => c.text ?? "")
              .join("") ?? ""

          return {
            text,
            promptTokens: json.usage?.input_tokens ?? 0,
            completionTokens: json.usage?.output_tokens ?? 0,
            finishReason: null,
          }
        } catch (e) {
          clearTimeout(timer)
          lastErr = e
          const msg = e instanceof Error ? e.message : String(e)
          const retriable = msg.includes("429") || msg.includes("529") || msg.includes("500")
          if (!retriable || attempt >= req.maxRetries) throw e
          await sleep(400 * (attempt + 1))
        }
      }
      throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
    },
  }
}
