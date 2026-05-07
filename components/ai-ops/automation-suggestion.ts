/**
 * AI Ops Phase 2 — map a rule to a workflow-builder suggestion.
 *
 * The "Create automation" action on a recommendation deep-links into
 * `/settings/automations?aiops=1&...` with a name/description/trigger
 * the workflow builder reads on mount. Phase 2 ships **deep-link only**
 * — the manager still has to confirm and save the automation; nothing
 * is auto-enabled.
 */

import type { Recommendation, RecommendationCategory } from "@/lib/ai-ops/types"

export type AutomationSuggestion = {
  trigger: string
  name: string
  description: string
}

export function buildAutomationSuggestion(rec: Recommendation): AutomationSuggestion | null {
  const base = SUGGESTION_BY_CATEGORY[rec.category]
  if (!base) return null
  return {
    trigger: base.trigger,
    name: base.name,
    description: rec.entity?.label
      ? `${base.description} (suggested from "${rec.entity.label}")`
      : base.description,
  }
}

export function suggestionUrl(orgId: string | null | undefined, suggestion: AutomationSuggestion): string {
  const params = new URLSearchParams({
    aiops: "1",
    trigger: suggestion.trigger,
    name: suggestion.name,
    description: suggestion.description,
  })
  return `/settings/automations?${params.toString()}`
}

const SUGGESTION_BY_CATEGORY: Partial<Record<RecommendationCategory, AutomationSuggestion>> = {
  prospect: {
    trigger: "prospect_status_changed",
    name: "Auto follow-up after status change",
    description:
      "When a prospect status changes (e.g. quoted), schedule a follow-up reminder so deals don't go cold.",
  },
  financial: {
    trigger: "invoice_overdue",
    name: "Overdue invoice reminder",
    description:
      "When an invoice is overdue, draft a polite reminder email and notify dispatch / billing.",
  },
  maintenance: {
    trigger: "maintenance_due",
    name: "Maintenance due reminder",
    description:
      "When equipment is due for service, create a work-order reminder and notify the assigned technician.",
  },
  certificate: {
    trigger: "certificate_released",
    name: "Certificate release notification",
    description:
      "When a calibration certificate is released to the portal, notify the customer and log the activity.",
  },
  dispatch: {
    trigger: "work_order_created",
    name: "Triage new work orders",
    description:
      "When a work order is created with high or critical priority, notify dispatch immediately.",
  },
  equipment: {
    trigger: "work_order_completed",
    name: "Repeat-repair watcher",
    description:
      "When a work order completes on equipment with frequent repairs, draft a replacement quote suggestion.",
  },
}
