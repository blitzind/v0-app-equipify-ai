/** Client-safe request parsing for Growth reply-flow QA API. */

import { z } from "zod"
import type { GrowthReplyFlowHarnessStep } from "@/lib/growth/qa/reply-flow-harness-types"

export const GROWTH_REPLY_FLOW_API_QA_MARKER = "growth-reply-flow-api-v1" as const

export const GROWTH_REPLY_FLOW_HARNESS_STEPS = [
  "all",
  "create",
  "enroll",
  "scheduler",
  "approve",
  "execute",
  "inbox-sync",
  "inspect",
] as const satisfies readonly GrowthReplyFlowHarnessStep[]

export const growthReplyFlowApiRequestSchema = z
  .object({
    fresh: z.boolean().optional(),
    contactEmail: z.string().trim().email().max(320).optional(),
    step: z.enum(GROWTH_REPLY_FLOW_HARNESS_STEPS).optional(),
    pattern: z.string().trim().min(1).max(120).optional(),
    leadId: z.string().uuid().optional(),
    companyName: z.string().trim().min(1).max(200).optional(),
    skipExecute: z.boolean().optional(),
  })
  .strict()

export type GrowthReplyFlowApiRequest = z.infer<typeof growthReplyFlowApiRequestSchema>

export function parseGrowthReplyFlowApiRequest(body: unknown): GrowthReplyFlowApiRequest {
  return growthReplyFlowApiRequestSchema.parse(body)
}

const SENSITIVE_PATTERNS = [
  /Bearer\s+\S+/gi,
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  /api[_-]?key[^\s]*/gi,
  /password[^\s]*/gi,
  /client[_-]?secret[^\s]*/gi,
  /service[_-]?role[^\s]*/gi,
  /at\s+[^\s]+\.(ts|js|tsx):\d+:\d+/gi,
  /\n\s*at\s+.+/g,
]

/** Strip secrets and stack traces from API error messages. */
export function sanitizeGrowthReplyFlowApiErrorMessage(
  error: unknown,
  fallback = "Reply-flow QA harness failed.",
): string {
  const raw =
    error instanceof z.ZodError
      ? "Invalid request body."
      : error instanceof Error
        ? error.message
        : String(error)

  let message = raw.replace(/\n\s*at\s+.+/g, "").trim()
  for (const pattern of SENSITIVE_PATTERNS) {
    message = message.replace(pattern, "[redacted]")
  }

  message = message.replace(/\s+/g, " ").trim()
  if (!message) return fallback
  if (message.length > 280) return `${message.slice(0, 277)}…`
  return message
}

export function mapGrowthReplyFlowApiErrorStatus(message: string): number {
  if (message === "Invalid request body.") return 400
  if (/not found|no qa lead|no lead available|no active enrollment/i.test(message)) return 404
  if (/enrollment failed|enrollment blocked|required|invalid/i.test(message)) return 400
  return 400
}
