import "server-only"

import { z } from "zod"
import { runAiTask } from "@/lib/ai/server"
const draftSchema = z
  .object({
    subject: z.string(),
    body: z.string(),
  })
  .transform((d) => ({ subject: d.subject.trim(), body: d.body.trim() }))
  .superRefine((d, ctx) => {
    if (!d.subject) ctx.addIssue({ code: "custom", path: ["subject"], message: "subject required" })
    if (!d.body) ctx.addIssue({ code: "custom", path: ["body"], message: "body required" })
  })

const SYSTEM_PROMPT = `You draft concise, professional follow-up messages for a field-service organization.

Return a single JSON object (no markdown) with exactly:
{ "subject": string, "body": string }

Rules:
- Tone: calm, operational, helpful — never salesy or robotic.
- Do NOT invent dollar amounts, invoice numbers, dates, or warranty terms unless explicitly provided in the context below.
- If details are missing, write a neutral message that asks how you may help or offers to coordinate next steps.
- Body: plain text, short paragraphs, suitable for email or SMS-style brevity when channel is sms (still return one body field).
- No signature block.
- Output MUST be valid JSON.`

function buildUserPrompt(params: {
  organizationName: string | null
  ruleKey: string
  entityType: string
  metadata: Record<string, unknown>
  preferredChannel: "email" | "sms"
}): string {
  const lines: string[] = [
    params.organizationName ? `Organization: ${params.organizationName}` : "Organization: (name unavailable)",
    `Automation rule: ${params.ruleKey}`,
    `Entity type: ${params.entityType}`,
    `Preferred channel hint: ${params.preferredChannel}`,
    "",
    "Context (trust only these facts):",
    JSON.stringify(params.metadata, null, 2),
    "",
    "Write subject + body appropriate for human review before sending.",
  ]
  return lines.join("\n")
}

export async function generateFollowUpAutomationDraft(params: {
  organizationId: string
  ruleKey: string
  entityType: string
  metadata: Record<string, unknown>
  organizationName?: string | null
  preferredChannel?: "email" | "sms"
}): Promise<{ subject: string; body: string }> {
  const userPrompt = buildUserPrompt({
    organizationName: params.organizationName ?? null,
    ruleKey: params.ruleKey,
    entityType: params.entityType,
    metadata: params.metadata,
    preferredChannel: params.preferredChannel ?? "email",
  })

  const result = await runAiTask({
    task: "customer_email",
    organizationId: params.organizationId,
    input: {
      system: SYSTEM_PROMPT,
      user: userPrompt,
    },
    schema: draftSchema,
    taskOverrides: { structuredMode: "json_object" },
    cacheSchemaVersion: "follow_up_automation_draft_v1",
  })

  if (!result.ok) {
    throw new Error(result.error.message)
  }

  return result.output
}
