import type { GrowthLeadEngineOrchestratorStageResult } from "@/lib/growth/lead-engine/orchestrator/lead-engine-run-types"

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function pushString(lines: string[], value: unknown, prefix?: string) {
  if (typeof value !== "string" || !value.trim()) return
  lines.push(prefix ? `${prefix}: ${value.trim()}` : value.trim())
}

function pushList(lines: string[], label: string, value: unknown, limit = 4) {
  if (!Array.isArray(value) || !value.length) return
  const items = value
    .slice(0, limit)
    .map((row) => (typeof row === "string" ? row : JSON.stringify(row)))
  lines.push(`${label}: ${items.join(", ")}${value.length > limit ? "…" : ""}`)
}

/** Operator-facing bullets extracted from parsed stage output — no scoring changes. */
export function summarizeLeadEngineStage(stage: GrowthLeadEngineOrchestratorStageResult): string[] {
  if (stage.status === "pending") return ["Stage not run yet."]
  if (!stage.parsed) {
    return stage.parse_message ? [stage.parse_message] : ["No structured output available."]
  }

  const parsed = stage.parsed
  const root = asRecord(parsed)
  const lines: string[] = []

  switch (stage.stage_id) {
    case "icp_targeting": {
      pushString(lines, root?.icp_summary)
      const rules = asRecord(root?.qualification_rules)
      pushList(lines, "Must have", rules?.must_have)
      pushList(lines, "Target roles", asRecord(root?.target_roles)?.primary)
      break
    }
    case "company_discovery": {
      const profile = asRecord(root?.company_profile)
      pushString(lines, profile?.company_name, "Company")
      pushString(lines, profile?.industry, "Industry")
      pushString(lines, profile?.headquarters_location, "Location")
      const fit = asRecord(root?.fit_assessment)
      pushString(lines, fit?.fit_tier, "Fit tier")
      pushString(lines, fit?.fit_rationale)
      break
    }
    case "decision_maker_hypothesis": {
      pushList(lines, "Primary roles", root?.primary_buying_roles)
      pushList(lines, "Secondary roles", root?.secondary_buying_roles)
      pushString(lines, root?.buying_committee_summary)
      break
    }
    case "contact_research": {
      const contacts = Array.isArray(root?.contact_candidates) ? root.contact_candidates : []
      lines.push(`${contacts.length} contact candidate(s)`)
      for (const row of contacts.slice(0, 3)) {
        const contact = asRecord(row)
        if (!contact) continue
        const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ")
        pushString(lines, name || contact.full_name, "Contact")
        pushString(lines, contact.title, "Title")
      }
      break
    }
    case "verification_triage": {
      pushString(lines, root?.disposition, "Disposition")
      pushString(lines, root?.verification_summary)
      pushList(lines, "Open questions", root?.open_questions)
      break
    }
    case "account_brief": {
      pushString(lines, root?.executive_summary)
      pushList(lines, "Key signals", root?.key_signals)
      pushList(lines, "Recommended next steps", root?.recommended_next_steps)
      break
    }
    case "outreach_personalization": {
      pushList(lines, "Messaging angles", root?.messaging_angles)
      pushString(lines, root?.personalization_summary)
      break
    }
    case "lead_score": {
      pushString(lines, root?.score_band, "Score band")
      if (typeof root?.total_score === "number") lines.push(`Total score: ${root.total_score}`)
      pushString(lines, root?.score_rationale)
      break
    }
    case "human_approval": {
      pushString(lines, root?.approval_recommendation, "Recommendation")
      pushString(lines, root?.approval_rationale)
      pushList(lines, "Review flags", root?.review_flags)
      break
    }
    case "revenue_execution": {
      pushString(lines, root?.execution_recommendation, "Recommendation")
      pushList(lines, "Next actions", root?.recommended_actions)
      pushString(lines, root?.execution_summary)
      break
    }
    default:
      break
  }

  if (!lines.length) {
    if (stage.evidence?.summary) lines.push(stage.evidence.summary)
    else lines.push("Stage completed — expand Technical Details for full output.")
  }

  if (stage.human_review_required) {
    lines.push("Human review recommended before outreach.")
  }

  return lines
}
