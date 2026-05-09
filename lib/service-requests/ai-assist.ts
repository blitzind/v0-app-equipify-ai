import "server-only"

import { z } from "zod"
import { getAiEnvConfig } from "@/lib/ai/config"
import { listAvailableProvidersInPreferenceOrder } from "@/lib/ai/providers/index"
import { getProviderAdapter } from "@/lib/ai/providers/index"
import type { AiChatMessage } from "@/lib/ai/types"
import type { AiExecutionMode } from "@/lib/ai/execution-mode"

const AssistSchema = z.object({
  summary: z.string(),
  suggested_urgency: z.enum(["low", "normal", "high", "critical"]),
  suggested_work_order_title: z.string(),
  suggested_work_order_description: z.string(),
  missing_info_questions: z.array(z.string()),
  draft_customer_response: z.string(),
})

export type ServiceRequestAiAssist = z.infer<typeof AssistSchema>

export function mockServiceRequestAssist(input: {
  issue_summary: string
  description: string | null
}): ServiceRequestAiAssist {
  const blob = [input.issue_summary, input.description ?? ""].join("\n").slice(0, 400)
  return {
    summary: `Trial AI preview — ${blob.slice(0, 160)}${blob.length > 160 ? "…" : ""}`,
    suggested_urgency: "normal",
    suggested_work_order_title: `Service: ${input.issue_summary.slice(0, 80)}`,
    suggested_work_order_description:
      (input.description ?? input.issue_summary).slice(0, 500) ||
      "Describe equipment, symptoms, and error codes when known.",
    missing_info_questions: [
      "What is the equipment asset tag or serial number?",
      "When did the issue start, and is the device in use or shut down?",
      "Preferred visit window and on-site contact phone?",
    ],
    draft_customer_response:
      "Thanks for the details — our team is reviewing your request and will follow up shortly with any clarifying questions.",
  }
}

export async function runServiceRequestAiAssist(args: {
  mode: AiExecutionMode
  issue_summary: string
  description: string | null
  requester_name: string | null
  requester_email: string | null
}): Promise<ServiceRequestAiAssist> {
  if (args.mode === "disabled" || args.mode === "mock_trial") {
    return mockServiceRequestAssist(args)
  }
  // live_paid + internal_test use providers when configured.

  const providers = listAvailableProvidersInPreferenceOrder()
  const openaiFirst = providers.find((p) => p === "openai")
  if (!openaiFirst) {
    return mockServiceRequestAssist(args)
  }

  const adapter = getProviderAdapter("openai")
  const { globalModelOverride } = getAiEnvConfig()
  const model = globalModelOverride?.trim() || "gpt-4o-mini"

  const userBlock = [
    `Issue summary: ${args.issue_summary}`,
    args.description ? `Description:\n${args.description}` : "",
    args.requester_name ? `Requester: ${args.requester_name}` : "",
    args.requester_email ? `Email: ${args.requester_email}` : "",
  ]
    .filter(Boolean)
    .join("\n")

  const messages: AiChatMessage[] = [
    {
      role: "system",
      content: `You assist field-service dispatchers reviewing inbound service requests for Equipify.
Return JSON only with keys: summary (string), suggested_urgency (one of low, normal, high, critical),
suggested_work_order_title (string), suggested_work_order_description (string),
missing_info_questions (array of short strings), draft_customer_response (string, polite, does not promise a date).
Do not invent serial numbers or customer commitments. If unsure, use normal urgency.`,
    },
    { role: "user", content: userBlock.slice(0, 12000) },
  ]

  const res = await adapter.complete({
    model,
    messages,
    temperature: 0.2,
    maxOutputTokens: 900,
    structuredMode: "json_object",
    timeoutMs: 45_000,
    maxRetries: 1,
  })

  let parsed: unknown
  try {
    parsed = JSON.parse(res.text)
  } catch {
    return mockServiceRequestAssist(args)
  }

  const safe = AssistSchema.safeParse(parsed)
  if (!safe.success) {
    return mockServiceRequestAssist(args)
  }
  return safe.data
}
