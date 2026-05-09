import type { SafeActionPrepareAnswer } from "@/lib/aiden/safe-actions/schema"

/** Stable ids for audit / UI — derived from validated payload (not free-form AI lists). */
export function affectedRecordIdsForProposal(parsed: SafeActionPrepareAnswer): string[] {
  switch (parsed.action_type) {
    case "create_follow_up_task":
      return [parsed.proposed_payload.work_order_id]
    case "create_internal_note":
      if (parsed.proposed_payload.target === "work_order") {
        return [parsed.proposed_payload.work_order_id]
      }
      return [parsed.proposed_payload.customer_id]
    case "create_reminder": {
      const p = parsed.proposed_payload
      if (p.related_entity_type === "work_order" || p.related_entity_type === "customer") {
        return p.related_entity_id ? [p.related_entity_id] : []
      }
      return []
    }
    case "create_communication_draft": {
      const p = parsed.proposed_payload
      const ids: string[] = []
      if (p.related_entity_id) ids.push(p.related_entity_id)
      if (p.recipient_customer_id) ids.push(p.recipient_customer_id)
      return [...new Set(ids)]
    }
    default:
      return []
  }
}
