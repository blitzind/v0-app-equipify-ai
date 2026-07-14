/**
 * GE-AIOS-DECISION-ENGINE-1D — Load latest operator override for HAC projection (server-only).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  parseCanonicalDecisionOperatorOverrideMetadata,
  selectLatestCanonicalDecisionOperatorOverride,
} from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1d-override-loader-map"
import type { CanonicalDecisionOperatorOverrideRecord } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1d-types"
import { listGrowthLeadTimelineEvents } from "@/lib/growth/timeline-repository"
import { listSequenceExecutionJobEvents } from "@/lib/growth/sequences/execution/sequence-job-repository"

const CANONICAL_OVERRIDE_TIMELINE_EVENT = "canonical_decision_operator_override" as const
const CANONICAL_OVERRIDE_JOB_EVENT = "canonical_decision_operator_override" as const

function parseTimelineOverridePayload(
  payload: Record<string, unknown> | null | undefined,
): CanonicalDecisionOperatorOverrideRecord | null {
  return parseCanonicalDecisionOperatorOverrideMetadata({
    qa_marker: payload?.qa_marker,
    scope: payload?.scope,
    operator_id: payload?.operator_id ?? payload?.actor_user_id,
    operator_email: payload?.operator_email,
    reason: payload?.reason ?? payload?.summary,
    decision_fingerprint: payload?.decision_fingerprint,
    suppression_code: payload?.suppression_code,
    enforcement_fingerprint: payload?.enforcement_fingerprint,
    recorded_at: payload?.recorded_at,
  })
}

export async function loadLatestCanonicalDecisionOperatorOverrideForLead(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    packageId?: string | null
    decisionFingerprint: string | null
    sequenceJobId?: string | null
  },
): Promise<CanonicalDecisionOperatorOverrideRecord | null> {
  const records: CanonicalDecisionOperatorOverrideRecord[] = []

  const timelineEvents = await listGrowthLeadTimelineEvents(admin, {
    leadId: input.leadId,
    limit: 100,
  }).catch(() => [])

  for (const event of timelineEvents) {
    if (event.eventType !== CANONICAL_OVERRIDE_TIMELINE_EVENT) continue
    const packageId = event.payload?.package_id
    if (
      input.packageId &&
      typeof packageId === "string" &&
      packageId.length > 0 &&
      packageId !== input.packageId
    ) {
      continue
    }
    const parsed = parseTimelineOverridePayload(event.payload)
    if (parsed) records.push(parsed)
  }

  if (input.sequenceJobId) {
    const jobEvents = await listSequenceExecutionJobEvents(admin, input.sequenceJobId, 50).catch(
      () => [],
    )
    for (const event of jobEvents) {
      if (event.eventType !== CANONICAL_OVERRIDE_JOB_EVENT) continue
      const parsed = parseCanonicalDecisionOperatorOverrideMetadata({
        ...event.metadata,
        reason: event.description ?? event.metadata?.reason,
      })
      if (parsed) records.push(parsed)
    }
  }

  return selectLatestCanonicalDecisionOperatorOverride(records, {
    decisionFingerprint: input.decisionFingerprint,
    packageId: input.packageId,
  })
}
