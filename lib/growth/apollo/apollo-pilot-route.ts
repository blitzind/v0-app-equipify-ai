/** Apollo pilot operations — server-only route handlers. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildApolloPilotChannelAttributionMetrics } from "@/lib/growth/apollo/apollo-pilot-channel-attribution-calculator"
import { buildApolloPilotContentPerformanceMetrics } from "@/lib/growth/apollo/apollo-pilot-content-performance-calculator"
import {
  assertApolloPilotCohortCompanyUnique,
  buildApolloPilotCohortTimestamps,
  isApolloPilotCohortAction,
  isApolloPilotCohortProcessingAllowed,
  isApolloPilotCohortSize,
  resolveApolloPilotCohortStatusAfterAction,
} from "@/lib/growth/apollo/apollo-pilot-cohort-state"
import { buildApolloPilotFunnelMetrics } from "@/lib/growth/apollo/apollo-pilot-funnel-calculator"
import { buildApolloPilotOperatorAnalytics } from "@/lib/growth/apollo/apollo-pilot-operator-analytics-calculator"
import { buildApolloPilotReadinessPayload } from "@/lib/growth/apollo/apollo-pilot-readiness"
import { buildApolloPilotRoiMetrics } from "@/lib/growth/apollo/apollo-pilot-roi-calculator"
import {
  APOLLO_PILOT_OPERATIONS_QA_MARKER,
  type ApolloPilotCohortCompanyRow,
  type ApolloPilotCohortRow,
  type ApolloPilotDashboardCounts,
} from "@/lib/growth/apollo/apollo-pilot-types"
import { mapApolloSequenceExecutionCandidateDbRow } from "@/lib/growth/apollo/apollo-sequence-execution-automation-evidence"

const COHORTS_TABLE = "apollo_pilot_cohorts"
const COMPANIES_TABLE = "apollo_pilot_cohort_companies"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function mapCohortRow(row: Record<string, unknown>): ApolloPilotCohortRow {
  return {
    id: asString(row.id),
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
    cohort_name: asString(row.cohort_name),
    target_company_count: asNumber(row.target_company_count) as ApolloPilotCohortRow["target_company_count"],
    company_count: asNumber(row.company_count),
    contact_count: asNumber(row.contact_count),
    created_by: asString(row.created_by) || null,
    created_by_email: asString(row.created_by_email) || null,
    status: asString(row.status) as ApolloPilotCohortRow["status"],
    started_at: asString(row.started_at) || null,
    paused_at: asString(row.paused_at) || null,
    completed_at: asString(row.completed_at) || null,
    cancelled_at: asString(row.cancelled_at) || null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  }
}

function mapCompanyRow(row: Record<string, unknown>): ApolloPilotCohortCompanyRow {
  return {
    id: asString(row.id),
    cohort_id: asString(row.cohort_id),
    company_candidate_id: asString(row.company_candidate_id),
    company_name: asString(row.company_name),
    domain: asString(row.domain) || null,
    qualification_status: asString(row.qualification_status) || "unknown",
    sequence_ready_count: asNumber(row.sequence_ready_count),
    enrollment_candidate_count: asNumber(row.enrollment_candidate_count),
    sequence_enrollment_count: asNumber(row.sequence_enrollment_count),
    status: asString(row.status) as ApolloPilotCohortCompanyRow["status"],
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
  }
}

export async function loadApolloPilotReadiness(admin: SupabaseClient) {
  const { error } = await admin.schema("growth").from(COHORTS_TABLE).select("id").limit(1)
  return buildApolloPilotReadinessPayload({
    migration_present: !error,
    blockers: error ? ["apollo_pilot_cohorts_table_unavailable"] : [],
  })
}

export async function listApolloPilotCohorts(admin: SupabaseClient): Promise<ApolloPilotCohortRow[]> {
  const { data, error } = await admin
    .schema("growth")
    .from(COHORTS_TABLE)
    .select("*")
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapCohortRow(row as Record<string, unknown>))
}

export async function loadApolloPilotCohort(
  admin: SupabaseClient,
  cohortId: string,
): Promise<{ cohort: ApolloPilotCohortRow; companies: ApolloPilotCohortCompanyRow[] } | null> {
  const { data: cohort, error } = await admin
    .schema("growth")
    .from(COHORTS_TABLE)
    .select("*")
    .eq("id", cohortId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!cohort) return null

  const { data: companies, error: companiesError } = await admin
    .schema("growth")
    .from(COMPANIES_TABLE)
    .select("*")
    .eq("cohort_id", cohortId)
    .order("created_at", { ascending: true })

  if (companiesError) throw new Error(companiesError.message)

  return {
    cohort: mapCohortRow(cohort as Record<string, unknown>),
    companies: (companies ?? []).map((row) => mapCompanyRow(row as Record<string, unknown>)),
  }
}

export async function createApolloPilotCohort(
  admin: SupabaseClient,
  input: {
    cohort_name: string
    target_company_count: number
    created_by: string
    created_by_email: string
    companies?: Array<{
      company_candidate_id: string
      company_name?: string
      domain?: string | null
      qualification_status?: string
      sequence_ready_count?: number
      enrollment_candidate_count?: number
      metadata?: Record<string, unknown>
    }>
    metadata?: Record<string, unknown>
  },
): Promise<{ cohort: ApolloPilotCohortRow; companies: ApolloPilotCohortCompanyRow[] }> {
  if (!input.cohort_name.trim()) throw new Error("cohort_name is required.")
  if (!isApolloPilotCohortSize(input.target_company_count)) {
    throw new Error("target_company_count must be 25, 50, or 100.")
  }

  const companiesInput = input.companies ?? []
  const seen = new Set<string>()
  for (const company of companiesInput) {
    const check = assertApolloPilotCohortCompanyUnique([...seen], company.company_candidate_id)
    if (!check.ok) throw new Error(check.reason)
    seen.add(company.company_candidate_id.trim())
  }

  const { data: cohortRow, error } = await admin
    .schema("growth")
    .from(COHORTS_TABLE)
    .insert({
      cohort_name: input.cohort_name.trim(),
      target_company_count: input.target_company_count,
      company_count: companiesInput.length,
      contact_count: 0,
      created_by: input.created_by,
      created_by_email: input.created_by_email,
      status: "draft",
      metadata: {
        ...input.metadata,
        qa_marker: APOLLO_PILOT_OPERATIONS_QA_MARKER,
        no_auto_outreach: true,
      },
    })
    .select("*")
    .single()

  if (error || !cohortRow) throw new Error(error?.message ?? "cohort_insert_failed")

  const cohort = mapCohortRow(cohortRow as Record<string, unknown>)
  const insertedCompanies: ApolloPilotCohortCompanyRow[] = []

  if (companiesInput.length > 0) {
    const { data: companyRows, error: companyError } = await admin
      .schema("growth")
      .from(COMPANIES_TABLE)
      .insert(
        companiesInput.map((company) => ({
          cohort_id: cohort.id,
          company_candidate_id: company.company_candidate_id.trim(),
          company_name: company.company_name?.trim() || "Unknown company",
          domain: company.domain?.trim() || null,
          qualification_status: company.qualification_status?.trim() || "unknown",
          sequence_ready_count: company.sequence_ready_count ?? 0,
          enrollment_candidate_count: company.enrollment_candidate_count ?? 0,
          status: "active",
          metadata: {
            ...(company.metadata ?? {}),
            snapshot_locked: true,
          },
        })),
      )
      .select("*")

    if (companyError) throw new Error(companyError.message)
    insertedCompanies.push(...(companyRows ?? []).map((row) => mapCompanyRow(row as Record<string, unknown>)))
  }

  return { cohort, companies: insertedCompanies }
}

export async function applyApolloPilotCohortAction(
  admin: SupabaseClient,
  input: {
    cohort_id: string
    action: string
  },
): Promise<ApolloPilotCohortRow> {
  const loaded = await loadApolloPilotCohort(admin, input.cohort_id)
  if (!loaded) throw new Error("Cohort not found.")

  if (!isApolloPilotCohortAction(input.action)) {
    throw new Error(`Unsupported cohort action: ${input.action}`)
  }
  const nextStatus = resolveApolloPilotCohortStatusAfterAction(loaded.cohort.status, input.action)
  if (!nextStatus) throw new Error(`Action ${input.action} is not allowed for status ${loaded.cohort.status}.`)

  const now = new Date().toISOString()
  const timestamps = buildApolloPilotCohortTimestamps(loaded.cohort.status, nextStatus, now)

  const { data, error } = await admin
    .schema("growth")
    .from(COHORTS_TABLE)
    .update({
      status: nextStatus,
      updated_at: now,
      ...timestamps,
      metadata: {
        ...loaded.cohort.metadata,
        last_action: input.action,
        last_action_at: now,
        pilot_processing_allowed: isApolloPilotCohortProcessingAllowed(nextStatus),
      },
    })
    .eq("id", input.cohort_id)
    .select("*")
    .single()

  if (error || !data) throw new Error(error?.message ?? "cohort_update_failed")
  return mapCohortRow(data as Record<string, unknown>)
}

type CohortAggregation = {
  companyIds: string[]
  leadIds: string[]
  counts: ApolloPilotDashboardCounts
  funnelCounts: {
    companies: number
    contacts: number
    qualified: number
    enrolled: number
    draft_approved: number
    job_approved: number
    sent: number
    replied: number
    meeting: number
    opportunity: number
    revenue: number
  }
  attributionEvents: Array<{
    channel: string
    event_type: "reply" | "meeting" | "opportunity"
    first_touch_channel?: string | null
    last_touch_channel?: string | null
    assisting_channels?: string[]
  }>
  contentSends: Array<{
    channel: string
    variant_key: string
    replied?: boolean
    meeting_booked?: boolean
  }>
  operatorReviews: Array<{
    review_type: "draft" | "job"
    outcome: "approved" | "rejected" | "regenerated"
    created_at: string
    resolved_at?: string | null
  }>
  verifiedEmails: number
  sequenceReadyContacts: number
  apolloCredits: number | null
  revenueAttributed: number | null
}

async function aggregateApolloPilotCohortData(
  admin: SupabaseClient,
  companyIds: string[],
): Promise<CohortAggregation> {
  if (companyIds.length === 0) {
    return {
      companyIds: [],
      leadIds: [],
      counts: emptyDashboardCounts(),
      funnelCounts: {
        companies: 0,
        contacts: 0,
        qualified: 0,
        enrolled: 0,
        draft_approved: 0,
        job_approved: 0,
        sent: 0,
        replied: 0,
        meeting: 0,
        opportunity: 0,
        revenue: 0,
      },
      attributionEvents: [],
      contentSends: [],
      operatorReviews: [],
      verifiedEmails: 0,
      sequenceReadyContacts: 0,
      apolloCredits: null,
      revenueAttributed: null,
    }
  }

  const [enrollmentRes, voiceDropRes, multichannelRes, executionRes, meetingRes] = await Promise.all([
    admin
      .schema("growth")
      .from("apollo_enrollment_candidates")
      .select("*")
      .in("company_candidate_id", companyIds),
    admin
      .schema("growth")
      .from("apollo_voice_drop_candidates")
      .select("*")
      .in("company_candidate_id", companyIds),
    admin
      .schema("growth")
      .from("apollo_multichannel_sequence_candidates")
      .select("*")
      .in("company_candidate_id", companyIds),
    admin
      .schema("growth")
      .from("apollo_sequence_execution_candidates")
      .select("*")
      .in("company_candidate_id", companyIds),
    admin
      .schema("growth")
      .from("meeting_candidates")
      .select("*")
      .in("company_candidate_id", companyIds),
  ])

  const enrollmentRows = enrollmentRes.data ?? []
  const voiceDropRows = voiceDropRes.data ?? []
  const multichannelRows = multichannelRes.data ?? []
  const executionRows = (executionRes.data ?? []).map((row) =>
    mapApolloSequenceExecutionCandidateDbRow(row as Record<string, unknown>),
  )
  const meetingRows = meetingRes.data ?? []

  const leadIds = [
    ...new Set(
      enrollmentRows
        .map((row) => asString((row as Record<string, unknown>).growth_lead_id))
        .filter(Boolean),
    ),
  ]

  let jobRows: Record<string, unknown>[] = []
  let replyCount = 0
  let opportunityRows: Record<string, unknown>[] = []

  if (leadIds.length > 0) {
    const [jobsRes, repliesRes, opportunityRes] = await Promise.all([
      admin.schema("growth").from("sequence_execution_jobs").select("*").in("lead_id", leadIds),
      admin
        .schema("growth")
        .from("outbound_replies")
        .select("id", { count: "exact", head: true })
        .in("lead_id", leadIds),
      admin.schema("growth").from("opportunity_drafts").select("*").in("lead_id", leadIds),
    ])
    jobRows = (jobsRes.data ?? []) as Record<string, unknown>[]
    replyCount = repliesRes.count ?? 0
    opportunityRows = (opportunityRes.data ?? []) as Record<string, unknown>[]
  }

  let draftApproved = 0
  let draftRejected = 0
  let draftRegenerated = 0
  const contentSends: CohortAggregation["contentSends"] = []
  const operatorReviews: CohortAggregation["operatorReviews"] = []

  for (const candidate of executionRows) {
    for (const draft of candidate.materialization.drafts) {
      const createdAt = candidate.created_at
      if (draft.approval_status === "draft_approved") draftApproved += 1
      if (draft.approval_status === "draft_rejected") draftRejected += 1
      operatorReviews.push({
        review_type: "draft",
        outcome:
          draft.approval_status === "draft_approved"
            ? "approved"
            : draft.approval_status === "draft_rejected"
              ? "rejected"
              : "regenerated",
        created_at: createdAt,
        resolved_at: candidate.updated_at,
      })

      const variantKey =
        draft.subject_placeholder?.trim() ||
        draft.content_summary?.trim() ||
        draft.draft_type
      contentSends.push({
        channel: draft.draft_type,
        variant_key: variantKey.slice(0, 80),
      })
    }
    if (candidate.status === "draft_regenerated") draftRegenerated += 1
  }

  const jobApproved = jobRows.filter((row) => asString(row.status) === "approved").length
  const sentJobs = jobRows.filter((row) => asString(row.status) === "sent")
  const emailsSent = sentJobs.filter((row) => asString(row.channel) === "email").length
  const smsSent = sentJobs.filter((row) => asString(row.channel) === "sms").length
  const voiceDropsSent = sentJobs.filter((row) =>
    ["voice_drop", "voicemail"].includes(asString(row.channel)),
  ).length
  const callsCompleted = sentJobs.filter((row) => asString(row.channel) === "call").length

  for (const job of jobRows) {
    operatorReviews.push({
      review_type: "job",
      outcome: asString(job.status) === "approved" || asString(job.status) === "sent" ? "approved" : "rejected",
      created_at: asString(job.created_at),
      resolved_at: asString(job.human_approved_at) || null,
    })
  }

  const qualified = enrollmentRows.filter(
    (row) => (row as Record<string, unknown>).qualified_for_enrollment === true,
  ).length
  const enrolled = enrollmentRows.filter(
    (row) => asString((row as Record<string, unknown>).status) === "enrollment_approved",
  ).length

  const meetingsBooked = meetingRows.filter(
    (row) => ["scheduled", "completed", "approved"].includes(asString((row as Record<string, unknown>).status)),
  ).length

  const opportunitiesCreated = opportunityRows.filter(
    (row) => asString((row as Record<string, unknown>).status) !== "rejected",
  ).length

  const attributionEvents: CohortAggregation["attributionEvents"] = []
  for (const meeting of meetingRows) {
    const trigger = (meeting as Record<string, unknown>).trigger_evidence as Record<string, unknown> | null
    const channel = asString(trigger?.channel) || "email"
    attributionEvents.push({
      channel,
      event_type: "meeting",
      first_touch_channel: asString(trigger?.first_touch_channel) || channel,
      last_touch_channel: asString(trigger?.last_touch_channel) || channel,
      assisting_channels: Array.isArray(trigger?.assisting_channels)
        ? (trigger.assisting_channels as string[])
        : [],
    })
  }
  for (let i = 0; i < replyCount; i += 1) {
    attributionEvents.push({ channel: "email", event_type: "reply" })
  }
  for (const opp of opportunityRows) {
    attributionEvents.push({ channel: "multi_touch", event_type: "opportunity" })
  }

  const counts: ApolloPilotDashboardCounts = {
    companies_processed: companyIds.length,
    contacts_found: enrollmentRows.length,
    qualified_contacts: qualified,
    enrollment_candidates: enrollmentRows.length,
    voice_drop_candidates: voiceDropRows.length,
    multichannel_candidates: multichannelRows.length,
    sequence_enrollments: executionRows.length,
    draft_approvals: draftApproved,
    job_approvals: jobApproved,
    emails_sent: emailsSent,
    sms_sent: smsSent,
    voice_drops_sent: voiceDropsSent,
    calls_completed: callsCompleted,
    replies_received: replyCount,
    meetings_booked: meetingsBooked,
    opportunities_created: opportunitiesCreated,
    revenue_attributed: 0,
  }

  return {
    companyIds,
    leadIds,
    counts,
    funnelCounts: {
      companies: companyIds.length,
      contacts: enrollmentRows.length,
      qualified,
      enrolled,
      draft_approved: draftApproved,
      job_approved: jobApproved,
      sent: sentJobs.length,
      replied: replyCount,
      meeting: meetingsBooked,
      opportunity: opportunitiesCreated,
      revenue: 0,
    },
    attributionEvents,
    contentSends,
    operatorReviews,
    verifiedEmails: enrollmentRows.length,
    sequenceReadyContacts: enrollmentRows.length,
    apolloCredits: null,
    revenueAttributed: null,
  }
}

function emptyDashboardCounts(): ApolloPilotDashboardCounts {
  return {
    companies_processed: 0,
    contacts_found: 0,
    qualified_contacts: 0,
    enrollment_candidates: 0,
    voice_drop_candidates: 0,
    multichannel_candidates: 0,
    sequence_enrollments: 0,
    draft_approvals: 0,
    job_approvals: 0,
    emails_sent: 0,
    sms_sent: 0,
    voice_drops_sent: 0,
    calls_completed: 0,
    replies_received: 0,
    meetings_booked: 0,
    opportunities_created: 0,
    revenue_attributed: 0,
  }
}

export async function loadApolloPilotCohortAnalytics(
  admin: SupabaseClient,
  cohortId: string,
) {
  const loaded = await loadApolloPilotCohort(admin, cohortId)
  if (!loaded) return null

  const companyIds = loaded.companies
    .filter((c) => c.status === "active")
    .map((c) => c.company_candidate_id)

  const aggregation = await aggregateApolloPilotCohortData(admin, companyIds)
  const computed_at = new Date().toISOString()

  return {
    qa_marker: APOLLO_PILOT_OPERATIONS_QA_MARKER,
    cohort: loaded.cohort,
    companies: loaded.companies,
    dashboard: aggregation.counts,
    funnel: buildApolloPilotFunnelMetrics({
      cohort_id: cohortId,
      counts: aggregation.funnelCounts,
      computed_at,
    }),
    channels: buildApolloPilotChannelAttributionMetrics({
      cohort_id: cohortId,
      events: aggregation.attributionEvents,
      computed_at,
    }),
    content: buildApolloPilotContentPerformanceMetrics({
      cohort_id: cohortId,
      sends: aggregation.contentSends,
      computed_at,
    }),
    operators: buildApolloPilotOperatorAnalytics({
      cohort_id: cohortId,
      reviews: aggregation.operatorReviews,
      computed_at,
    }),
    roi: buildApolloPilotRoiMetrics({
      cohort_id: cohortId,
      counts: {
        companies: aggregation.funnelCounts.companies,
        contacts: aggregation.funnelCounts.contacts,
        verified_emails: aggregation.verifiedEmails,
        sequence_ready_contacts: aggregation.sequenceReadyContacts,
        enrollments: aggregation.funnelCounts.enrolled,
        meetings: aggregation.funnelCounts.meeting,
        opportunities: aggregation.funnelCounts.opportunity,
        customers: 0,
        apollo_credits_consumed: aggregation.apolloCredits,
        estimated_credit_cost_usd: null,
        revenue_attributed: aggregation.revenueAttributed,
      },
      computed_at,
    }),
    processing_allowed: isApolloPilotCohortProcessingAllowed(loaded.cohort.status),
  }
}
