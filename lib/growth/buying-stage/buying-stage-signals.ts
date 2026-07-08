import type {
  GrowthBuyingStage,
  GrowthBuyingStageAttribution,
  GrowthBuyingStageInput,
  GrowthBuyingStageSignal,
  GrowthBuyingStageSignalType,
} from "@/lib/growth/buying-stage/buying-stage-types"

const HIGH_INTENT_PATHS = ["/pricing", "/demo", "/book", "/contact", "/service", "/quote"]
const COMPARISON_PATHS = ["/compare", "/vs", "/alternative", "/competitor"]

function attr(
  source: string,
  section: string,
  signal: string,
  evidence: string,
  confidence: number,
): GrowthBuyingStageAttribution {
  return { source, section, signal, evidence, confidence }
}

function pushSignal(
  list: GrowthBuyingStageSignal[],
  signal: GrowthBuyingStageSignal,
): void {
  if (!signal.evidence.trim()) return
  if (signal.source_attribution.length === 0) return
  list.push(signal)
}

function hasPath(paths: string[], segments: string[]): boolean {
  return paths.some((p) => {
    const normalized = p.toLowerCase().split("?")[0] ?? ""
    return segments.some((s) => normalized === s || normalized.startsWith(`${s}/`) || normalized.includes(s))
  })
}

export function collectBuyingStageSignals(input: GrowthBuyingStageInput): GrowthBuyingStageSignal[] {
  const signals: GrowthBuyingStageSignal[] = []

  if (input.search_intent_signal_count > 0) {
    const category = input.search_intent_top_category ?? "unknown"
    const hints: Partial<Record<GrowthBuyingStage, number>> = {}
    if (category === "demo_intent" || category === "pricing_research") {
      hints.vendor_evaluation = 12
      hints.purchase_ready = category === "demo_intent" ? 8 : 6
    } else if (category === "vendor_comparison" || category === "competitor_research") {
      hints.comparison = 14
      hints.vendor_evaluation = 8
    } else if (category === "urgent_service_need" || category === "problem_aware") {
      hints.problem_identified = 12
      hints.purchase_ready = category === "urgent_service_need" ? 6 : 0
    } else if (category === "solution_aware") {
      hints.solution_research = 10
    } else {
      hints.awareness = 6
      hints.solution_research = 4
    }

    pushSignal(signals, {
      signal_type: "search_intent",
      label: `Search intent category: ${category}`,
      evidence: `Observable search intent (${input.search_intent_signal_count} signal(s)); top category ${category}.`,
      source_attribution: [
        attr(
          "growth.search_intent_signals",
          "search_intent",
          category,
          `Top category ${category} from captured search/referrer/UTM signals`,
          input.search_intent_max_confidence,
        ),
      ],
      weight: Math.min(20, 8 + input.search_intent_signal_count * 2),
      stage_hints: hints,
      metadata: { top_category: category },
    })
  }

  if (hasPath(input.high_intent_path_hits, HIGH_INTENT_PATHS)) {
    const paths = input.high_intent_path_hits.filter((p) =>
      HIGH_INTENT_PATHS.some((s) => p.toLowerCase().includes(s)),
    )
    pushSignal(signals, {
      signal_type: "pricing_demo_contact_pages",
      label: "High-intent page visits",
      evidence: `Visited high-intent paths: ${paths.join(", ")}.`,
      source_attribution: [
        attr(
          "growth.intent_pageview_events",
          "page_path",
          "high_intent_paths",
          paths.join(", "),
          0.82,
        ),
      ],
      weight: 14,
      stage_hints: {
        vendor_evaluation: 12,
        purchase_ready: paths.some((p) => p.includes("/demo") || p.includes("/book")) ? 10 : 6,
      },
    })
  }

  if (hasPath(input.high_intent_path_hits, COMPARISON_PATHS)) {
    pushSignal(signals, {
      signal_type: "comparison_behavior",
      label: "Comparison page behavior",
      evidence: "Comparison or competitor evaluation paths observed in session.",
      source_attribution: [
        attr(
          "growth.intent_pageview_events",
          "page_path",
          "comparison_paths",
          input.high_intent_path_hits.join(", "),
          0.78,
        ),
      ],
      weight: 12,
      stage_hints: { comparison: 14, vendor_evaluation: 6 },
    })
  }

  if (input.session_count > 1) {
    pushSignal(signals, {
      signal_type: "repeat_sessions",
      label: "Repeat sessions",
      evidence: `${input.session_count} sessions in visit history.`,
      source_attribution: [
        attr(
          "growth.intent_visitor_sessions",
          "visit_history",
          "session_count",
          String(input.session_count),
          0.8,
        ),
      ],
      weight: 10,
      stage_hints: {
        solution_research: 10,
        vendor_evaluation: 6,
        existing_customer_expansion: input.existing_customer_ids.length > 0 ? 8 : 0,
      },
    })
  }

  if (input.visit_count >= 2 && input.session_count === 1) {
    pushSignal(signals, {
      signal_type: "return_frequency",
      label: "Return visits within session",
      evidence: `${input.visit_count} pageviews in primary session.`,
      source_attribution: [
        attr(
          "growth.intent_pageview_events",
          "session",
          "visit_count",
          String(input.visit_count),
          0.72,
        ),
      ],
      weight: 6,
      stage_hints: { solution_research: 6, awareness: 2 },
    })
  }

  if (input.unique_page_count >= 3) {
    pushSignal(signals, {
      signal_type: "session_depth",
      label: "Session depth",
      evidence: `${input.unique_page_count} unique pages viewed.`,
      source_attribution: [
        attr(
          "growth.intent_pageview_events",
          "session",
          "unique_page_count",
          String(input.unique_page_count),
          0.75,
        ),
      ],
      weight: 8,
      stage_hints: { solution_research: 8, vendor_evaluation: 4 },
    })
  }

  if (input.existing_customer_ids.length > 0) {
    pushSignal(signals, {
      signal_type: "existing_account_relationship",
      label: "Existing CRM account",
      evidence: `Matched ${input.existing_customer_ids.length} existing customer record(s).`,
      source_attribution: [
        attr(
          "crm.accounts",
          "account_match",
          "existing_customer",
          input.existing_customer_ids.join(", "),
          0.88,
        ),
      ],
      weight: 16,
      stage_hints: {
        existing_customer_expansion: 14,
        active_opportunity: 8,
        retention_risk: input.intent_score < 6 ? 10 : 2,
      },
    })
  } else if (input.existing_lead_ids.length > 0) {
    pushSignal(signals, {
      signal_type: "existing_account_relationship",
      label: "Existing growth lead",
      evidence: `Matched ${input.existing_lead_ids.length} existing lead record(s).`,
      source_attribution: [
        attr(
          "growth.lead_inbox",
          "lead_match",
          "existing_lead",
          input.existing_lead_ids.join(", "),
          0.8,
        ),
      ],
      weight: 10,
      stage_hints: { vendor_evaluation: 8, solution_research: 6 },
    })
  }

  const highIntentConversions = input.conversion_types.filter((t) =>
    ["form_submit", "booking", "lead_capture"].includes(t),
  )
  if (highIntentConversions.length > 0) {
    pushSignal(signals, {
      signal_type: "high_intent_actions",
      label: "High-intent conversions",
      evidence: `Conversions observed: ${highIntentConversions.join(", ")}.`,
      source_attribution: [
        attr(
          "growth.intent_conversion_events",
          "conversion",
          highIntentConversions.join(","),
          highIntentConversions.join(", "),
          0.9,
        ),
      ],
      weight: 18,
      stage_hints: {
        active_opportunity: 16,
        purchase_ready: 14,
      },
    })
  }

  if (input.company_match_confidence > 0) {
    pushSignal(signals, {
      signal_type: "company_identification_confidence",
      label: "Company identification confidence",
      evidence: `Company match confidence ${(input.company_match_confidence * 100).toFixed(0)}% via ${input.company_matched_source ?? "observable signals"}.`,
      source_attribution: [
        attr(
          "growth.company_identification_matches",
          "company_match",
          input.company_matched_source ?? "unknown",
          `Confidence ${input.company_match_confidence}`,
          input.company_match_confidence,
        ),
      ],
      weight: Math.round(input.company_match_confidence * 12),
      stage_hints: {
        vendor_evaluation: input.company_match_confidence >= 0.75 ? 6 : 3,
        solution_research: 4,
      },
      metadata: { matched_source: input.company_matched_source },
    })
  }

  if (input.intent_score > 0) {
    const hints: Partial<Record<GrowthBuyingStage, number>> = {}
    if (input.intent_score >= 18) {
      hints.purchase_ready = 12
      hints.active_opportunity = 8
    } else if (input.intent_score >= 12) {
      hints.vendor_evaluation = 10
      hints.solution_research = 6
    } else if (input.intent_score >= 6) {
      hints.solution_research = 8
      hints.problem_identified = 4
    } else {
      hints.awareness = 8
    }

    pushSignal(signals, {
      signal_type: "intent_score",
      label: "Intent score band",
      evidence: `Aggregated intent score ${input.intent_score} from observable session behavior.`,
      source_attribution: [
        attr(
          "growth.intent_lead_bridge",
          "scoring",
          "intent_score",
          String(input.intent_score),
          Math.min(0.85, input.intent_score / 25),
        ),
      ],
      weight: Math.min(15, Math.round(input.intent_score / 2)),
      stage_hints: hints,
    })
  }

  if (input.has_identified_contact) {
    pushSignal(signals, {
      signal_type: "high_intent_actions",
      label: "Identified contact capture",
      evidence: "Explicit identified contact from form or capture — not inferred.",
      source_attribution: [
        attr(
          "growth.intent_identified_contacts",
          "identity",
          "explicit_capture",
          "Identified contact present",
          0.92,
        ),
      ],
      weight: 12,
      stage_hints: { active_opportunity: 10, purchase_ready: 8, vendor_evaluation: 6 },
    })
  }

  if (input.operator_activity_count > 0) {
    pushSignal(signals, {
      signal_type: "operator_activity",
      label: "Operator workspace activity",
      evidence: `${input.operator_activity_count} operator action(s) on Revenue Queue record.`,
      source_attribution: [
        attr(
          "growth.lead_inbox",
          "operator",
          "activity_count",
          String(input.operator_activity_count),
          0.7,
        ),
      ],
      weight: 8,
      stage_hints: {
        active_opportunity: 10,
        purchase_ready: 6,
        existing_customer_expansion: 4,
      },
    })
  }

  if (input.total_time_on_site_ms >= 90_000) {
    pushSignal(signals, {
      signal_type: "content_patterns",
      label: "Extended engagement time",
      evidence: `${Math.round(input.total_time_on_site_ms / 1000)}s total time on site.`,
      source_attribution: [
        attr(
          "growth.intent_visitor_sessions",
          "engagement",
          "time_on_site_ms",
          String(input.total_time_on_site_ms),
          0.7,
        ),
      ],
      weight: 6,
      stage_hints: { solution_research: 6, vendor_evaluation: 4 },
    })
  }

  return signals
}

export function summarizeSignalTypes(signals: GrowthBuyingStageSignal[]): GrowthBuyingStageSignalType[] {
  return [...new Set(signals.map((s) => s.signal_type))]
}
