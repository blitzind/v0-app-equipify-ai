export const OPERATIONAL_ASSISTANT_IDS = [
  "dispatch",
  "maintenance",
  "quote",
  "inventory",
  "service_insights",
] as const

export type OperationalAssistantId = (typeof OPERATIONAL_ASSISTANT_IDS)[number]

export function isOperationalAssistantId(v: string): v is OperationalAssistantId {
  return (OPERATIONAL_ASSISTANT_IDS as readonly string[]).includes(v)
}
