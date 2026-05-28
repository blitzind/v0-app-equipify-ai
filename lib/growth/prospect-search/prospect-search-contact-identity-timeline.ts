/** Contact identity timeline builder. Client-safe. */

import type {
  ProspectSearchContactCanonicalSnapshot,
  ProspectSearchContactIdentityConflict,
  ProspectSearchContactIdentitySourceRecord,
  ProspectSearchContactIdentityTimelineEvent,
} from "@/lib/growth/prospect-search/prospect-search-contact-identity-types"

export function buildProspectSearchContactIdentityTimeline(input: {
  source_records: ProspectSearchContactIdentitySourceRecord[]
  conflicts: ProspectSearchContactIdentityConflict[]
  canonical: ProspectSearchContactCanonicalSnapshot
}): ProspectSearchContactIdentityTimelineEvent[] {
  const events: ProspectSearchContactIdentityTimelineEvent[] = []

  for (const record of input.source_records) {
    events.push({
      id: `discovered-${record.contact_id}`,
      kind: "discovered",
      label: "Discovered from source",
      detail: `${record.full_name}${record.title ? ` · ${record.title}` : ""} via ${record.provider.replace(/_/g, " ")}`,
      occurred_at: record.discovered_at,
      source: record.provider,
    })
    if (record.email) {
      events.push({
        id: `email-${record.contact_id}`,
        kind: "email_observed",
        label: "Email observed",
        detail: record.email,
        occurred_at: record.discovered_at,
        source: record.provider,
      })
    }
    if (record.phone) {
      events.push({
        id: `phone-${record.contact_id}`,
        kind: "phone_observed",
        label: "Phone observed",
        detail: record.phone,
        occurred_at: record.discovered_at,
        source: record.provider,
      })
    }
    if (record.branch_city || record.branch_name) {
      events.push({
        id: `branch-${record.contact_id}`,
        kind: "branch_observed",
        label: "Branch/location observed",
        detail: [record.branch_name, record.branch_city, record.branch_state].filter(Boolean).join(" · "),
        occurred_at: record.discovered_at,
        source: record.provider,
      })
    }
  }

  if (input.source_records.length > 1) {
    events.push({
      id: `merged-${input.source_records.map((record) => record.contact_id).join("-")}`,
      kind: "merged_from_source",
      label: "Merged across sources",
      detail: `${input.source_records.length} source records fused into one identity`,
      occurred_at: input.source_records[0]?.discovered_at ?? null,
      source: "evidence_fusion",
    })
  }

  const titles = [...new Set(input.source_records.map((record) => record.title).filter(Boolean))]
  if (titles.length > 1) {
    events.push({
      id: `title-changed-${titles.join("-")}`,
      kind: "title_changed",
      label: "Title evidence changed across sources",
      detail: titles.join(" · "),
      occurred_at: null,
      source: "evidence_fusion",
    })
  }

  for (const conflict of input.conflicts) {
    events.push({
      id: `conflict-${conflict.label}`,
      kind: "conflict_detected",
      label: conflict.label,
      detail: conflict.detail,
      occurred_at: null,
      source: conflict.status,
    })
  }

  if (input.canonical.best_email.value) {
    events.push({
      id: "canonical-email",
      kind: "verification_refreshed",
      label: "Canonical email selected",
      detail: input.canonical.best_email.reasons.join(" · "),
      occurred_at: null,
      source: input.canonical.best_email.provider,
    })
  }

  return events.slice(0, 20)
}

export function appendProspectSearchContactIdentityTimelineEvent(
  timeline: ProspectSearchContactIdentityTimelineEvent[],
  event: ProspectSearchContactIdentityTimelineEvent,
): ProspectSearchContactIdentityTimelineEvent[] {
  return [...timeline, event].slice(-24)
}
