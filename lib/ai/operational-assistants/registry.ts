import type { AiTaskId } from "@/lib/ai/types"
import type { OperationalAssistantId } from "./types"

export const ASSISTANT_TASK_MAP: Record<OperationalAssistantId, AiTaskId> = {
  dispatch: "dispatch_recommendation",
  maintenance: "maintenance_prediction",
  quote: "quote_generation",
  inventory: "inventory_operations",
  service_insights: "insights_generation",
}

export const ASSISTANT_UI: Record<
  OperationalAssistantId,
  { title: string; description: string; accent: string }
> = {
  dispatch: {
    title: "Dispatch Assistant",
    description: "Prioritize the board—overdue routes, scheduling pressure, and SLA risk.",
    accent: "#0ea5e9",
  },
  maintenance: {
    title: "Maintenance Assistant",
    description: "PM due dates, plans, repeat failures, and preventive priorities.",
    accent: "#f59e0b",
  },
  quote: {
    title: "Quote Assistant",
    description: "Stalled quotes, follow-ups, and approval bottlenecks.",
    accent: "#06b6d4",
  },
  inventory: {
    title: "Inventory Assistant",
    description: "Low stock, reorder signals, and replenishment suggestions.",
    accent: "#78716c",
  },
  service_insights: {
    title: "Service Insights Assistant",
    description: "Cross-cutting operational risks and opportunities from live metrics.",
    accent: "#7c3aed",
  },
}

const JSON_CONTRACT = `You must output ONE JSON object only (no markdown). Shape:
{
  "summary": string (2–5 sentences),
  "confidence": number between 0 and 1 (your confidence in this briefing given the data),
  "alerts": [ { "severity"?: "info"|"warning"|"critical", "title": string, "detail"?: string } ],
  "recommendations": [ { "title": string, "rationale"?: string, "priority"?: "high"|"medium"|"low" } ],
  "actions": [ { "label": string, "href"?: string, "kind"?: "navigate"|"create"|"review" } ]
}
Use only facts supported by CONTEXT. Prefer internal paths for href: /dispatch, /work-orders, /service-schedule, /inventory, /quotes, /equipment, /maintenance-plans, /insights.`

const ROLE: Record<OperationalAssistantId, string> = {
  dispatch:
    "Role: Dispatch operations. Emphasize overdue scheduled work, scheduling priorities, crew risk, and what to pull forward.",
  maintenance:
    "Role: Maintenance & reliability. Emphasize PM overdue, maintenance plans due, repeat repairs / recurring failures, and inspection cadence.",
  quote:
    "Role: Sales quotes. Emphasize quotes stuck in draft/sent/pending approval, aging, and follow-up urgency.",
  inventory:
    "Role: Parts & stock. Emphasize SKUs at/below reorder, projected stockouts, replenishment orders, and criticality.",
  service_insights:
    "Role: Executive-style field-service snapshot. Synthesize cross-cutting risks (overdue work, billing, maintenance, inventory) with clear priorities.",
}

export function buildOperationalAssistantSystemPrompt(id: OperationalAssistantId): string {
  return [`You are an operational AI assistant for Equipify (field service / equipment businesses).`, ROLE[id], JSON_CONTRACT].join(
    "\n\n",
  )
}
