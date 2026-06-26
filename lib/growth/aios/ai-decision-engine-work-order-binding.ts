/** GE-AIOS-2H — Work Order type → decision key bindings (client-safe). */

import type { AiDecisionEngineWorkOrderBinding } from "@/lib/growth/aios/ai-decision-engine-types"
import type { AiWorkOrderType } from "@/lib/growth/aios/ai-work-order-types"

export const AI_DECISION_ENGINE_WORK_ORDER_BINDINGS: readonly AiDecisionEngineWorkOrderBinding[] = [
  { workOrderType: "research_company", decisionKey: "enrich_company", defaultActionKey: "enrich" },
  { workOrderType: "generate_buying_committee", decisionKey: "build_buying_committee", defaultActionKey: "build_committee" },
  { workOrderType: "verify_email", decisionKey: "verify_email", defaultActionKey: "verify" },
  { workOrderType: "generate_email", decisionKey: "change_messaging", defaultActionKey: "generate_content" },
  { workOrderType: "generate_video", decisionKey: "change_messaging", defaultActionKey: "generate_video" },
  { workOrderType: "enroll_sequence", decisionKey: "launch_sequence", defaultActionKey: "launch" },
  { workOrderType: "pause_sequence", decisionKey: "pause_outreach", defaultActionKey: "pause" },
  { workOrderType: "analyze_reply", decisionKey: "work_order_execute", defaultActionKey: "analyze" },
  { workOrderType: "prepare_meeting", decisionKey: "schedule_meeting", defaultActionKey: "schedule" },
  { workOrderType: "create_opportunity", decisionKey: "create_opportunity", defaultActionKey: "create" },
  { workOrderType: "update_memory", decisionKey: "work_order_execute", defaultActionKey: "update_memory" },
  { workOrderType: "run_learning_cycle", decisionKey: "work_order_execute", defaultActionKey: "learn" },
  { workOrderType: "custom", decisionKey: "work_order_execute", defaultActionKey: "execute" },
] as const

const BINDING_INDEX = new Map(
  AI_DECISION_ENGINE_WORK_ORDER_BINDINGS.map((entry) => [entry.workOrderType, entry]),
)

export function lookupDecisionEngineWorkOrderBinding(
  workOrderType: AiWorkOrderType,
): AiDecisionEngineWorkOrderBinding {
  return (
    BINDING_INDEX.get(workOrderType) ?? {
      workOrderType: "custom",
      decisionKey: "work_order_execute",
      defaultActionKey: "execute",
    }
  )
}

export function resolveDecisionKeyForWorkOrderType(workOrderType: AiWorkOrderType): string {
  return lookupDecisionEngineWorkOrderBinding(workOrderType).decisionKey
}
