import { z } from "zod"

function stringList(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined
  return v.filter((x): x is string => typeof x === "string")
}

/** Accept camelCase or snake_case keys from model JSON. */
function normalizeTechnicianAssistRaw(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw
  const o = raw as Record<string, unknown>
  return {
    troubleshootingSteps:
      stringList(o.troubleshootingSteps) ?? stringList(o.troubleshooting_steps) ?? [],
    customerQuestions: stringList(o.customerQuestions) ?? stringList(o.customer_questions) ?? [],
    partsAndToolsChecklist:
      stringList(o.partsAndToolsChecklist) ?? stringList(o.parts_and_tools_checklist) ?? [],
    safetyAndEscalation: stringList(o.safetyAndEscalation) ?? stringList(o.safety_and_escalation) ?? [],
    customerSafeWording:
      typeof o.customerSafeWording === "string" ?
        o.customerSafeWording
      : typeof o.customer_safe_wording === "string" ? o.customer_safe_wording
      : "",
  }
}

const technicianAssistShape = z.object({
  troubleshootingSteps: z.array(z.string().max(700)).max(18),
  customerQuestions: z.array(z.string().max(550)).max(18),
  partsAndToolsChecklist: z.array(z.string().max(450)).max(28),
  safetyAndEscalation: z.array(z.string().max(550)).max(14),
  customerSafeWording: z.string().max(2800),
})

/** Structured output for `work_order_technician_assist` — review-only technician guidance. */
export const WorkOrderTechnicianAssistAiSchema = z.preprocess(normalizeTechnicianAssistRaw, technicianAssistShape)

export type WorkOrderTechnicianAssistAi = z.infer<typeof WorkOrderTechnicianAssistAiSchema>

export function formatTechnicianGuidancePlainText(a: WorkOrderTechnicianAssistAi): string {
  const lines: string[] = []
  lines.push("=== Troubleshooting ===", ...a.troubleshootingSteps.map((s) => `• ${s}`), "")
  lines.push("=== Questions for customer ===", ...a.customerQuestions.map((s) => `• ${s}`), "")
  lines.push("=== Parts / tools checklist ===", ...a.partsAndToolsChecklist.map((s) => `• ${s}`), "")
  lines.push("=== Safety & escalation ===", ...a.safetyAndEscalation.map((s) => `• ${s}`), "")
  lines.push("=== Customer-safe wording (draft) ===", a.customerSafeWording.trim())
  return lines.join("\n").trim()
}
