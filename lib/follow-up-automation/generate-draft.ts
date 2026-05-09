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

/** Review-only drafts — intents steer tone without inventing dates or dollar amounts. */
const RULE_INTENT: Partial<Record<string, string>> = {
  invoice_due_soon:
    "Friendly reminder that an invoice due date is approaching — professional, helpful tone; no payment links or dollar amounts unless supplied in context.",
  invoice_overdue:
    "Polite first reminder that an invoice appears unpaid past its due date — operational tone; no legal threats, collections language, or invented balances.",
  invoice_overdue_7_days:
    "Second courteous follow-up on an overdue invoice — emphasize coordination and resolving billing questions; stay neutral and customer-friendly.",
  invoice_overdue_14_days:
    "Further follow-up on an overdue invoice — remain professional; invite the customer to reach out if something looks wrong on their side.",
  invoice_overdue_30_days:
    "Stronger but still respectful overdue invoice follow-up — focus on closing the loop administratively; avoid intimidation or legal consequences.",
  invoice_final_notice_candidate:
    "Escalated administrative follow-up before internal escalation — clearly NOT a legal demand or collections notice unless configured elsewhere; no invented totals or due dates.",
  maintenance_plan_due_soon:
    "Customer-facing preventive maintenance reminder — offer to schedule or confirm the upcoming plan visit.",
  maintenance_plan_overdue:
    "Polite overdue notice for a missed planned maintenance — focus on safety and scheduling next steps.",
  equipment_service_due_soon:
    "Service interval reminder tied to equipment — suggest coordinating service before the due window closes.",
  equipment_service_overdue:
    "Service is past due — emphasize reliability and scheduling without blame.",
  equipment_calibration_due_soon:
    "Calibration due reminder — compliance-focused, ask to schedule calibration.",
  equipment_warranty_expiring_soon:
    "Warranty or coverage window ending soon — informational, no pricing unless provided in context.",
}

function buildUserPrompt(params: {
  organizationName: string | null
  ruleKey: string
  entityType: string
  metadata: Record<string, unknown>
  preferredChannel: "email" | "sms"
}): string {
  const intent = RULE_INTENT[params.ruleKey]
  const lines: string[] = [
    params.organizationName ? `Organization: ${params.organizationName}` : "Organization: (name unavailable)",
    `Automation rule: ${params.ruleKey}`,
    `Entity type: ${params.entityType}`,
    `Preferred channel hint: ${params.preferredChannel}`,
    ...(intent ? [`Draft intent: ${intent}`] : []),
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
