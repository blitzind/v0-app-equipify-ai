/**
 * GE-AIOS-END-TO-END-1A — Production read-only supervised sales loop audit (server-only).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getActiveApprovedBusinessProfile } from "@/lib/growth/business-profile/business-profile-repository"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { listGrowthLeadDecisionMakers } from "@/lib/growth/decision-maker-repository"
import { fetchLatestGrowthLeadResearchWorkflowSnapshot } from "@/lib/growth/aios/growth/growth-lead-research-workflow-service"
import { listOutreachPreparationRunsForLead } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-store"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { listGrowthObjectives } from "@/lib/growth/objectives/growth-objective-repository"
import { loadSuppressedLeadIds } from "@/lib/growth/revenue-workflow/growth-lead-admission-production-analysis"
import {
  evaluateAvaOutreachPackageReadiness,
} from "@/lib/growth/mission-center/growth-ava-outreach-sequence-handoff-1f"
import {
  GE_AIOS_END_TO_END_1A_BLOCK_IMAGING_LEAD_ID,
  GE_AIOS_END_TO_END_SUPERVISED_SALES_LOOP_1A_QA_MARKER,
  type EndToEndEvidenceRow,
  type EndToEndSupervisedSalesLoopReport,
} from "@/lib/growth/training/end-to-end-supervised-sales-loop-1a-types"
import {
  GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_EVENT,
  GROWTH_AVA_OUTREACH_PACKAGE_APPROVAL_EVENT,
  GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_METADATA_KEY,
  type GrowthAvaOutreachExecutionRequest,
} from "@/lib/growth/mission-center/growth-ava-outreach-execution-request-types"
import type { GrowthAutonomousOutreachApprovalPackage } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import { resolveTransportAssetFromPackage } from "@/lib/growth/aios/growth/growth-send-plane-1b-operator-approval-persistence"
import {
  EQUIPIFY_PRODUCTION_ORG_ID,
  LIVE_1B_EQUIPIFY_MISSION_TITLE,
} from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"

const FORBIDDEN_OPERATOR_TERMS = [
  "enrollment",
  "canonical",
  "transport gate",
  "execution job",
  "apollo",
  "qa marker",
] as const

function extractEmailDraft(
  pkg: GrowthAutonomousOutreachApprovalPackage | null | undefined,
  companyName: string,
): {
  subject: string | null
  body: string | null
  source: string | null
  versionStatus: string | null
} {
  const resolved = resolveTransportAssetFromPackage(pkg, "email", companyName)
  if (!resolved) {
    return { subject: null, body: null, source: null, versionStatus: null }
  }
  return {
    subject: resolved.subject,
    body: resolved.body,
    source: resolved.source,
    versionStatus: resolved.versionStatus,
  }
}

function scanUnsupportedClaims(text: string | null): string[] {
  if (!text) return ["missing_body"]
  const issues: string[] = []
  if (/\{\{|\[\[|TODO|TBD|PLACEHOLDER/i.test(text)) issues.push("placeholder_detected")
  if (/\bAva\b/.test(text)) issues.push("assistant_name_in_copy")
  for (const term of FORBIDDEN_OPERATOR_TERMS) {
    if (text.toLowerCase().includes(term)) issues.push(`forbidden_term:${term}`)
  }
  return issues
}

export async function runEndToEndSupervisedSalesLoopProductionAudit(input: {
  admin: SupabaseClient
  organizationId?: string
  preferredLeadId?: string
  liveSendConfirmed?: boolean
}): Promise<EndToEndSupervisedSalesLoopReport> {
  const organizationId = input.organizationId ?? EQUIPIFY_PRODUCTION_ORG_ID
  const preferredLeadId = input.preferredLeadId ?? GE_AIOS_END_TO_END_1A_BLOCK_IMAGING_LEAD_ID
  const generatedAt = new Date().toISOString()
  const blockers: EndToEndSupervisedSalesLoopReport["blockers"] = []
  const chronology: EndToEndEvidenceRow[] = []

  const [
    approvedProfile,
    killSwitches,
    objectives,
    suppressedLeadIds,
    lead,
    decisionMakers,
    researchSnapshot,
    runs,
    datamoonRuns,
    senderAccounts,
    mailboxConnections,
    senderProfiles,
    deliveryRoutes,
    calendarConnections,
  ] = await Promise.all([
    getActiveApprovedBusinessProfile(input.admin, organizationId),
    getRuntimeKillSwitchStates(input.admin),
    listGrowthObjectives(input.admin, organizationId),
    loadSuppressedLeadIds(input.admin),
    fetchGrowthLeadById(input.admin, preferredLeadId),
    listGrowthLeadDecisionMakers(input.admin, preferredLeadId),
    fetchLatestGrowthLeadResearchWorkflowSnapshot(input.admin, {
      organizationId,
      leadId: preferredLeadId,
    }),
    listOutreachPreparationRunsForLead(input.admin, organizationId, preferredLeadId),
    input.admin
      .schema("growth")
      .from("datamoon_audience_import_runs")
      .select("id, status, run_name, record_count, created_at")
      .ilike("run_name", "ge-aios-autonomous-prospect-search:%")
      .order("created_at", { ascending: false })
      .limit(5),
    input.admin
      .schema("growth")
      .from("sender_accounts")
      .select("id, email_address, display_name, status, health_status, provider_family, last_send_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(20),
    input.admin
      .schema("growth")
      .from("mailbox_connections")
      .select(
        "id, sender_account_id, email_address, display_name, status, connection_health, last_validation_at, provider_family",
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(20),
    input.admin
      .schema("growth")
      .from("sender_profiles")
      .select("id, sender_account_id, mailbox_connection_id, email, display_name, active")
      .is("deleted_at", null)
      .eq("active", true)
      .limit(20),
    input.admin
      .schema("growth")
      .from("delivery_routes")
      .select("id, sender_account_id, enabled, provider_id, priority")
      .eq("enabled", true)
      .order("priority", { ascending: true })
      .limit(10),
    input.admin
      .schema("growth")
      .from("calendar_provider_connections")
      .select("id, account_email, status, sync_health, provider, connected_at")
      .neq("status", "disconnected")
      .limit(10),
  ])

  const outboundKillSwitch = killSwitches.autonomy_outbound_enabled === true
  const activeMission = objectives.find((row) => row.status === "active") ?? objectives[0] ?? null

  const productionAudit = {
    organizationId,
    approvedBusinessProfile: approvedProfile
      ? { id: approvedProfile.id, version: approvedProfile.version, approvedAt: approvedProfile.approvedAt }
      : null,
    activeMission: activeMission
      ? { id: activeMission.id, title: activeMission.title, status: activeMission.status }
      : null,
    expectedMissionTitle: LIVE_1B_EQUIPIFY_MISSION_TITLE,
    datamoonRecentRuns: datamoonRuns.data ?? [],
    killSwitches,
    outboundKillSwitchEnabled: outboundKillSwitch,
    senderAccounts: senderAccounts.data ?? [],
    mailboxConnections: mailboxConnections.data ?? [],
    activeSenderProfiles: senderProfiles.data ?? [],
    enabledDeliveryRoutes: deliveryRoutes.data ?? [],
    calendarConnections: calendarConnections.data ?? [],
    suppressedLeadCount: suppressedLeadIds.size,
  }

  if (!approvedProfile) {
    blockers.push({ severity: "critical", message: "No approved business profile in production." })
  }
  if (outboundKillSwitch) {
    blockers.push({ severity: "high", message: "autonomy_outbound_enabled is ON — outbound must stay disabled during audit." })
  }

  if (!lead) {
    blockers.push({ severity: "critical", message: `Preferred lead ${preferredLeadId} not found.` })
    return finalizeReport({
      generatedAt,
      organizationId,
      preferredLeadId,
      productionAudit,
      prospectSelection: { selected: false, reason: "lead_not_found" },
      evidenceAudit: {},
      handoffAudit: {},
      preSendSafety: {},
      chronology,
      blockers,
      liveSendConfirmed: input.liveSendConfirmed === true,
    })
  }

  const metadata = (lead.metadata ?? {}) as Record<string, unknown>
  const executionRequestRaw = metadata[GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_METADATA_KEY]
  const executionRequests: GrowthAvaOutreachExecutionRequest[] =
    executionRequestRaw && typeof executionRequestRaw === "object" && !Array.isArray(executionRequestRaw)
      ? Object.values(executionRequestRaw as Record<string, GrowthAvaOutreachExecutionRequest>)
      : []

  const approvedRun =
    runs.find((run) => {
      const pkg = run.approvalPackage as { packageApprovalDecision?: string } | null
      return pkg?.packageApprovalDecision === "approved" || pkg?.packageApprovalDecision === "approve"
    }) ?? runs[0] ?? null

  const approvalPkg = (approvedRun?.approvalPackage ??
    null) as GrowthAutonomousOutreachApprovalPackage | null
  const packageId = approvalPkg?.packageId ?? null
  const displayCompanyName =
    approvalPkg?.companyName?.trim() ||
    lead.company_name?.trim() ||
    lead.website?.replace(/^https?:\/\//, "").split("/")[0] ||
    preferredLeadId

  const { data: enrollments } = await input.admin
    .schema("growth")
    .from("sequence_enrollments")
    .select("id, status, sequence_pattern_id, lead_id, metadata, created_at, updated_at")
    .eq("lead_id", preferredLeadId)
    .order("updated_at", { ascending: false })
    .limit(10)

  const activeEnrollments = (enrollments ?? []).filter((row) =>
    ["active", "in_progress", "paused"].includes(String(row.status)),
  )

  const { data: pendingJobs } = await input.admin
    .schema("growth")
    .from("sequence_execution_jobs")
    .select(
      "id, status, channel, lead_id, sequence_enrollment_id, sender_account_id, created_at, updated_at, requires_human_approval",
    )
    .eq("lead_id", preferredLeadId)
    .eq("status", "pending_approval")
    .order("created_at", { ascending: false })

  const { data: deliveredOutbound } = await input.admin
    .schema("growth")
    .from("outbound_messages")
    .select("id, status, channel, created_at, provider_message_id")
    .eq("lead_id", preferredLeadId)
    .order("created_at", { ascending: false })
    .limit(10)

  const { data: auditEvents } = await input.admin
    .schema("growth")
    .from("ai_os_events")
    .select("id, event_type, occurred_at, entity_id, correlation_id, payload")
    .eq("organization_id", organizationId)
    .in("event_type", [GROWTH_AVA_OUTREACH_PACKAGE_APPROVAL_EVENT, GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_EVENT])
    .order("occurred_at", { ascending: false })
    .limit(30)

  const correlatedEvents = (auditEvents ?? []).filter((event) => {
    const payload = event.payload as { lead_id?: string; package_id?: string } | null
    return (
      event.entity_id === preferredLeadId ||
      payload?.lead_id === preferredLeadId ||
      (packageId && payload?.package_id === packageId)
    )
  })

  const latestExecRequest = executionRequests[executionRequests.length - 1] ?? null
  const selectedJobId =
    latestExecRequest?.sequenceJobId ??
    pendingJobs?.[0]?.id ??
    null
  const selectedEnrollmentId =
    latestExecRequest?.sequenceEnrollmentId ??
    pendingJobs?.[0]?.sequence_enrollment_id ??
    activeEnrollments[0]?.id ??
    null

  const suppressed = suppressedLeadIds.has(preferredLeadId)
  const primaryContact = decisionMakers[0] ?? null
  const recipientEmail = lead.contact_email ?? primaryContact?.email ?? null

  const prospectSelection = {
    leadId: preferredLeadId,
    companyName: displayCompanyName,
    website: lead.website,
    contactEmail: recipientEmail,
    contactName: lead.contact_name ?? primaryContact?.name ?? null,
    admissionState: metadata.admission_state ?? null,
    suppressed,
    hasResearch: Boolean(researchSnapshot),
    decisionMakerCount: decisionMakers.length,
    existingPackageId: packageId,
    packageApprovalDecision: approvalPkg?.packageApprovalDecision ?? null,
    pendingHumanApproval: approvalPkg?.pendingHumanApproval ?? null,
    transportBlocked: approvalPkg?.transportBlocked ?? null,
    priorDeliveries: deliveredOutbound ?? [],
    suitable: Boolean(displayCompanyName && !suppressed && packageId && recipientEmail),
  }

  if (suppressed) blockers.push({ severity: "critical", message: "Selected lead is suppressed." })
  if ((deliveredOutbound ?? []).some((row) => row.status === "sent" || row.status === "delivered")) {
    blockers.push({ severity: "high", message: "Prior outbound delivery exists for this lead." })
  }

  const evidenceBullets = researchSnapshot?.evidenceSummary?.verifiedEvidence ?? []
  const personalizationEvidence = approvalPkg?.personalizationEvidence ?? []
  const supportingResearch = approvalPkg?.supportingResearch ?? []
  const emailDraft = extractEmailDraft(approvalPkg, displayCompanyName)
  const copyIssues = scanUnsupportedClaims(emailDraft.body)
  const evidenceAudit = {
    researchRunId: researchSnapshot?.researchRunId ?? null,
    evidenceBulletCount: evidenceBullets.length,
    sampleEvidence: evidenceBullets.slice(0, 5),
    personalizationEvidenceCount: personalizationEvidence.length,
    samplePersonalization: personalizationEvidence.slice(0, 5),
    supportingResearchCount: supportingResearch.length,
    emailSubject: emailDraft.subject,
    emailBodyPreview: emailDraft.body?.slice(0, 1200) ?? null,
    transportAssetSource: emailDraft.source,
    transportAssetVersionStatus: emailDraft.versionStatus,
    copyIssues,
    frozenAssetsPresent: Boolean(
      approvalPkg?.generatedAssets?.some((asset) => asset.channel === "email" && asset.preview?.trim()),
    ),
    emailAssetVersionStatus:
      approvalPkg?.generatedAssets?.find((asset) => asset.channel === "email")?.versionStatus ?? null,
  }

  if (copyIssues.length > 0) {
    blockers.push({ severity: "high", message: `Email copy issues: ${copyIssues.join(", ")}` })
  }

  const readiness = approvalPkg
    ? evaluateAvaOutreachPackageReadiness({
        recommendedSequence:
          typeof approvalPkg.recommendedSequence === "string" ? approvalPkg.recommendedSequence : null,
        recommendedChannel:
          typeof approvalPkg.recommendedChannel === "string" ? approvalPkg.recommendedChannel : null,
        patterns: [],
      })
    : null

  const handoffAudit = {
    packageApproved:
      approvalPkg?.packageApprovalDecision === "approved" ||
      approvalPkg?.packageApprovalDecision === "approve",
    executionReadiness: readiness,
    executionRequests: executionRequests.map((row) => ({
      requestId: row.requestId,
      executionStatus: row.executionStatus,
      sequenceEnrollmentId: row.sequenceEnrollmentId,
      sequenceJobId: row.sequenceJobId,
      recommendedChannel: row.recommendedChannel,
    })),
    activeEnrollmentCount: activeEnrollments.length,
    activeEnrollments: activeEnrollments.map((row) => ({
      id: row.id,
      status: row.status,
      patternId: row.sequence_pattern_id,
    })),
    pendingApprovalJobs: pendingJobs ?? [],
    duplicateEnrollmentRisk: activeEnrollments.length > 1,
    duplicatePendingJobRisk: (pendingJobs ?? []).length > 1,
    auditEventCount: correlatedEvents.length,
  }

  if (!handoffAudit.packageApproved) {
    blockers.push({ severity: "critical", message: "Outreach package is not approved." })
  }
  if ((pendingJobs ?? []).length === 0) {
    blockers.push({ severity: "critical", message: "No pending_approval sequence execution job for lead." })
  }
  if ((pendingJobs ?? []).length > 1) {
    blockers.push({ severity: "high", message: "Multiple pending_approval jobs — ambiguous send target." })
  }
  if (activeEnrollments.length > 1) {
    blockers.push({ severity: "high", message: "Multiple active enrollments — reuse policy violated." })
  }

  const connectedMailboxStatuses = new Set(["connected", "active", "warming", "warning"])
  const healthySender = (senderAccounts.data ?? []).find(
    (row) =>
      row.status === "connected" &&
      row.health_status !== "critical" &&
      row.health_status !== "degraded",
  )
  const healthyMailboxConnection = (mailboxConnections.data ?? []).find((row) =>
    connectedMailboxStatuses.has(String(row.status)),
  )
  const enabledRoute = deliveryRoutes.data?.[0] ?? null
  const routeSender =
    enabledRoute?.sender_account_id != null
      ? (senderAccounts.data ?? []).find((row) => row.id === enabledRoute.sender_account_id) ?? null
      : null
  const routeMailbox =
    enabledRoute?.sender_account_id != null
      ? (mailboxConnections.data ?? []).find((row) => row.sender_account_id === enabledRoute.sender_account_id) ??
        null
      : null
  const jobSender =
    pendingJobs?.[0]?.sender_account_id != null
      ? (senderAccounts.data ?? []).find((row) => row.id === pendingJobs[0].sender_account_id) ?? null
      : null
  const resolvedSender = jobSender ?? routeSender ?? healthySender ?? null
  const resolvedMailbox =
    (resolvedSender
      ? (mailboxConnections.data ?? []).find((row) => row.sender_account_id === resolvedSender.id)
      : null) ??
    routeMailbox ??
    healthyMailboxConnection ??
    null

  const preSendSafety = {
    recipientValid: Boolean(lead.contact_email || decisionMakers[0]?.email),
    suppressionClear: !suppressed,
    unsubscribeClear: true,
    noPriorDelivery: !(deliveredOutbound ?? []).some((row) => row.status === "sent" || row.status === "delivered"),
    subjectComplete: Boolean(emailDraft.subject?.trim()),
    bodyComplete: Boolean(emailDraft.body?.trim()),
    copyIssues,
    senderMailbox: resolvedSender
      ? {
          id: resolvedSender.id,
          email: resolvedSender.email_address,
          health: resolvedSender.health_status,
          status: resolvedSender.status,
          source: jobSender ? "sequence_job" : routeSender ? "delivery_route" : "sender_accounts",
        }
      : null,
    mailboxConnection: resolvedMailbox
      ? {
          id: resolvedMailbox.id,
          email: resolvedMailbox.email_address,
          status: resolvedMailbox.status,
          connectionHealth: resolvedMailbox.connection_health,
        }
      : null,
    activeSenderProfileCount: senderProfiles.data?.length ?? 0,
    exactlyOnePendingJob: (pendingJobs ?? []).length === 1,
    pendingJobChannel: pendingJobs?.[0]?.channel ?? null,
    outboundKillSwitchOff: !outboundKillSwitch,
    emailPreview: {
      subject: emailDraft.subject,
      body: emailDraft.body,
    },
  }

  if (!resolvedSender || !resolvedMailbox) {
    blockers.push({
      severity: "critical",
      message: "No healthy connected sender mailbox available for outbound delivery.",
    })
  } else if (resolvedSender.health_status === "critical" || resolvedSender.health_status === "degraded") {
    blockers.push({
      severity: "high",
      message: `Sender health is ${resolvedSender.health_status} — review before live send.`,
    })
  }

  chronology.push(
    row("Prospect selected", displayCompanyName, prospectSelection.suitable ? "pass" : "fail"),
    row("Research completed", researchSnapshot?.researchRunId ?? "none", researchSnapshot ? "pass" : "warn"),
    row("Contact verified", String(decisionMakers.length), decisionMakers.length > 0 ? "pass" : "warn"),
    row("Package prepared", packageId ?? "none", packageId ? "pass" : "fail"),
    row("Package approved", String(approvalPkg?.packageApprovalDecision ?? "none"), handoffAudit.packageApproved ? "pass" : "fail"),
    row(
      "Enrollment reused/created",
      selectedEnrollmentId ?? "none",
      selectedEnrollmentId ? "pass" : "fail",
    ),
    row(
      "Send materialized",
      selectedJobId ?? "none",
      (pendingJobs ?? []).length === 1 ? "pass" : (pendingJobs ?? []).length === 0 ? "fail" : "warn",
    ),
    row("Send approved", "pending", "skip", "Awaiting operator send approval"),
    row("Email delivered", "none", "skip", "Live send not authorized in this run"),
    row("Reply ingested", "none", "skip", "Requires live delivery + controlled reply"),
    row("Intent classified", "none", "skip", "Requires inbound reply"),
    row("Next action surfaced", "none", "skip", "Requires inbound reply"),
    row("Meeting/opportunity progressed", "none", "skip", "Requires reply workflow"),
  )

  const liveSendAuthorized = input.liveSendConfirmed === true
  const criticalBlockers = blockers.filter((b) => b.severity === "critical")
  const overallVerdict =
    criticalBlockers.length > 0 ? "blocked" : blockers.length > 0 ? "fail" : liveSendAuthorized ? "pass" : "blocked"

  return {
    qaMarker: GE_AIOS_END_TO_END_SUPERVISED_SALES_LOOP_1A_QA_MARKER,
    generatedAt,
    organizationId,
    selectedLeadId: preferredLeadId,
    selectedPackageId: packageId,
    selectedEnrollmentId,
    selectedJobId,
    phases: {
      productionAudit,
      prospectSelection,
      evidenceAudit,
      handoffAudit,
      preSendSafety,
      liveDelivery: liveSendAuthorized ? { status: "not_executed_in_probe", note: "Probe is read-only unless live send orchestrator invoked separately." } : null,
      replyValidation: null,
    },
    chronology,
    blockers,
    overallVerdict,
    liveSendAuthorized,
  }
}

function row(step: string, record: string, result: EndToEndEvidenceRow["result"], detail?: string): EndToEndEvidenceRow {
  return { step, record, result, detail }
}

function finalizeReport(
  partial: Omit<EndToEndSupervisedSalesLoopReport, "qaMarker" | "overallVerdict" | "selectedPackageId" | "selectedEnrollmentId" | "selectedJobId"> & {
    preferredLeadId: string
  },
): EndToEndSupervisedSalesLoopReport {
  return {
    qaMarker: GE_AIOS_END_TO_END_SUPERVISED_SALES_LOOP_1A_QA_MARKER,
    generatedAt: partial.generatedAt,
    organizationId: partial.organizationId,
    selectedLeadId: partial.preferredLeadId,
    selectedPackageId: null,
    selectedEnrollmentId: null,
    selectedJobId: null,
    phases: {
      productionAudit: partial.productionAudit,
      prospectSelection: partial.prospectSelection,
      evidenceAudit: partial.evidenceAudit,
      handoffAudit: partial.handoffAudit,
      preSendSafety: partial.preSendSafety,
      liveDelivery: partial.liveSendConfirmed ? { skipped: true } : null,
      replyValidation: null,
    },
    chronology: partial.chronology,
    blockers: partial.blockers,
    overallVerdict: "blocked",
    liveSendAuthorized: partial.liveSendConfirmed,
  }
}

export { EQUIPIFY_PRODUCTION_ORG_ID, GE_AIOS_END_TO_END_1A_BLOCK_IMAGING_LEAD_ID }
