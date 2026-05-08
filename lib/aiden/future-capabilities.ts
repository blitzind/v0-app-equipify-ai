export type AidenFutureCapabilityId =
  | "voice_assistant"
  | "screenshot_understanding"
  | "workflow_execution"
  | "ai_generated_sops"
  | "customer_facing_support_agent"

export type AidenFutureCapability = {
  id: AidenFutureCapabilityId
  label: string
  status: "planned"
  note: string
}

export const AIDEN_FUTURE_CAPABILITIES: AidenFutureCapability[] = [
  {
    id: "voice_assistant",
    label: "Voice Assistant",
    status: "planned",
    note: "Reserved for future voice input/output without changing the chat context contract.",
  },
  {
    id: "screenshot_understanding",
    label: "Screenshot Understanding",
    status: "planned",
    note: "Reserved for future multimodal page or screenshot help.",
  },
  {
    id: "workflow_execution",
    label: "Workflow Execution",
    status: "planned",
    note: "Reserved for future governed actions; Phase 2 only returns guidance and links.",
  },
  {
    id: "ai_generated_sops",
    label: "AI-Generated SOPs",
    status: "planned",
    note: "Reserved for future SOP drafts generated from Equipify workflows.",
  },
  {
    id: "customer_facing_support_agent",
    label: "Customer-Facing Support Agent",
    status: "planned",
    note: "Reserved for future portal support experiences separated from internal AIden.",
  },
]
