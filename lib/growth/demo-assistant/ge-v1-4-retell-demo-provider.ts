import "server-only"

export const GE_V1_4_RETELL_DEMO_PROVIDER_QA_MARKER = "ge-v1-4-retell-demo-provider-v1" as const

export function isGrowthRetellDemoAssistantEnabled(): boolean {
  return process.env.GROWTH_RETELL_DEMO_ASSISTANT_ENABLED === "true"
}

export function getGrowthRetellDemoProviderState(): {
  enabled: boolean
  dryRunOnly: boolean
  apiKeyConfigured: boolean
  agentIdConfigured: boolean
  agentId: string | null
} {
  const apiKeyConfigured = Boolean(process.env.RETELL_API_KEY?.trim())
  const agentId = process.env.RETELL_DEMO_ASSISTANT_AGENT_ID?.trim() || null
  const enabled = isGrowthRetellDemoAssistantEnabled() && apiKeyConfigured
  const dryRunOnly = !enabled

  return {
    enabled,
    dryRunOnly,
    apiKeyConfigured,
    agentIdConfigured: Boolean(agentId),
    agentId,
  }
}

export async function createRetellDemoChat(input: {
  agentId: string
  metadata?: Record<string, string>
}): Promise<{ chatId: string }> {
  const apiKey = process.env.RETELL_API_KEY?.trim()
  if (!apiKey) throw new Error("retell_api_key_missing")

  const response = await fetch("https://api.retellai.com/create-chat", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      agent_id: input.agentId,
      metadata: input.metadata ?? {},
    }),
  })

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText)
    throw new Error(`retell_create_chat_failed:${response.status}:${message.slice(0, 240)}`)
  }

  const payload = (await response.json()) as { chat_id?: string }
  if (!payload.chat_id) throw new Error("retell_create_chat_missing_id")
  return { chatId: payload.chat_id }
}

export async function sendRetellDemoChatMessage(input: {
  chatId: string
  content: string
}): Promise<string> {
  const apiKey = process.env.RETELL_API_KEY?.trim()
  if (!apiKey) throw new Error("retell_api_key_missing")

  const response = await fetch("https://api.retellai.com/create-chat-completion", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: input.chatId,
      content: input.content,
    }),
  })

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText)
    throw new Error(`retell_chat_completion_failed:${response.status}:${message.slice(0, 240)}`)
  }

  const payload = (await response.json()) as {
    messages?: Array<{ role?: string; content?: string }>
    content?: string
  }

  if (typeof payload.content === "string" && payload.content.trim()) {
    return payload.content.trim()
  }

  const assistantMessage = [...(payload.messages ?? [])]
    .reverse()
    .find((m) => m.role === "agent" || m.role === "assistant")

  if (assistantMessage?.content?.trim()) {
    return assistantMessage.content.trim()
  }

  throw new Error("retell_chat_completion_empty")
}

export async function endRetellDemoChat(chatId: string): Promise<void> {
  const apiKey = process.env.RETELL_API_KEY?.trim()
  if (!apiKey) return

  await fetch("https://api.retellai.com/end-chat", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ chat_id: chatId }),
  }).catch(() => undefined)
}
