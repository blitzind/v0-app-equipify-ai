import "server-only"

import type {
  AiChatMessage,
  AiProviderAdapter,
  UnifiedCompletionRequest,
  UnifiedCompletionResponse,
} from "@/lib/ai/types"
import { getProviderApiKey } from "@/lib/ai/providers/credentials"

function toGeminiContents(messages: AiChatMessage[]): Array<{ role: string; parts: { text: string }[] }> {
  const out: Array<{ role: string; parts: { text: string }[] }> = []
  for (const m of messages) {
    const text =
      typeof m.content === "string"
        ? m.content
        : m.content
            .filter((p): p is { type: "text"; text: string } => p.type === "text")
            .map((p) => p.text)
            .join("\n")
    const role = m.role === "assistant" ? "model" : "user"
    if (m.role === "system") {
      out.push({ role: "user", parts: [{ text: `[system]\n${text}` }] })
    } else {
      out.push({ role, parts: [{ text }] })
    }
  }
  return out
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms))
}

export function createGoogleAdapter(): AiProviderAdapter {
  return {
    id: "google",
    supportsMultimodal: false,
    async complete(req: UnifiedCompletionRequest): Promise<UnifiedCompletionResponse> {
      const apiKey = getProviderApiKey("google")
      if (!apiKey) throw new Error("GOOGLE_AI_API_KEY or GEMINI_API_KEY is not configured.")

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(req.model)}:generateContent?key=${encodeURIComponent(apiKey)}`

      let lastErr: unknown
      for (let attempt = 0; attempt <= req.maxRetries; attempt++) {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), req.timeoutMs)
        try {
          const body: Record<string, unknown> = {
            contents: toGeminiContents(req.messages),
            generationConfig: {
              temperature: req.temperature,
              maxOutputTokens: req.maxOutputTokens,
            },
          }
          if (req.structuredMode === "json_object") {
            body.generationConfig = {
              ...(body.generationConfig as object),
              responseMimeType: "application/json",
            }
          }

          const res = await fetch(url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
            signal: controller.signal,
          })
          clearTimeout(timer)

          if (!res.ok) {
            const t = await res.text()
            throw new Error(`Gemini HTTP ${res.status}: ${t.slice(0, 500)}`)
          }

          const json = (await res.json()) as {
            usageMetadata?: {
              promptTokenCount?: number
              candidatesTokenCount?: number
            }
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
          }

          const text =
            json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? ""

          return {
            text,
            promptTokens: json.usageMetadata?.promptTokenCount ?? 0,
            completionTokens: json.usageMetadata?.candidatesTokenCount ?? 0,
            finishReason: null,
          }
        } catch (e) {
          clearTimeout(timer)
          lastErr = e
          const msg = e instanceof Error ? e.message : String(e)
          const retriable = msg.includes("429") || msg.includes("500") || msg.includes("503")
          if (!retriable || attempt >= req.maxRetries) throw e
          await sleep(400 * (attempt + 1))
        }
      }
      throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
    },
  }
}
