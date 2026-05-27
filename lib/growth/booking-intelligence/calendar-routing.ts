import type {
  GrowthCalendarRoutingRule,
  GrowthCalendarRoutingRuleType,
} from "@/lib/growth/booking-intelligence/booking-types"

export type RoutingContext = {
  hasLeadOwner: boolean
  hasThreadOwner: boolean
  territory?: string | null
  industry?: string | null
  accountPriority?: "low" | "medium" | "high" | null
}

export function selectCalendarRoutingRule(
  rules: GrowthCalendarRoutingRule[],
  context: RoutingContext,
): GrowthCalendarRoutingRule | null {
  const active = rules.filter((rule) => rule.isActive).sort((a, b) => a.priority - b.priority)

  for (const rule of active) {
    if (rule.ruleType === "owner") {
      const scope = String(rule.matchCriteria.scope ?? "")
      if (scope === "lead_owner" && context.hasLeadOwner) return rule
      if (scope === "thread_owner" && context.hasThreadOwner) return rule
    }
    if (rule.ruleType === "territory" && context.territory) return rule
    if (rule.ruleType === "industry" && context.industry) return rule
    if (rule.ruleType === "account_priority" && context.accountPriority === "high") return rule
    if (rule.ruleType === "round_robin") return rule
  }

  return active.find((rule) => rule.ruleType === "manual") ?? null
}

export function resolveRoutingRuleType(
  rules: GrowthCalendarRoutingRule[],
  context: RoutingContext,
): GrowthCalendarRoutingRuleType {
  return selectCalendarRoutingRule(rules, context)?.ruleType ?? "manual"
}

export function suggestedOwnerLabelFromRule(rule: GrowthCalendarRoutingRule | null): string | null {
  if (!rule) return "Manual review"
  return rule.targetOwnerLabel ?? routingRuleTypeLabel(rule.ruleType)
}

function routingRuleTypeLabel(type: GrowthCalendarRoutingRuleType): string {
  return type.replace(/_/g, " ")
}
