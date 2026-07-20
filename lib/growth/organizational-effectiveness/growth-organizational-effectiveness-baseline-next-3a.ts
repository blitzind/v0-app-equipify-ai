/** GE-AIOS-NEXT-3A — Organizational effectiveness baseline projection (client-safe read-model). */

import {
  GROWTH_AIOS_NEXT_3A_ARCHITECTURAL_RULE,
  GROWTH_AIOS_NEXT_3A_ORGANIZATIONAL_EFFECTIVENESS_PRINCIPLE,
  GROWTH_AIOS_NEXT_3A_ORGANIZATIONAL_EFFECTIVENESS_QA_MARKER,
  type GrowthOrganizationalEffectivenessBottleneckCandidate,
  type GrowthOrganizationalEffectivenessConfidence,
  type GrowthOrganizationalEffectivenessDataAvailability,
  type GrowthOrganizationalEffectivenessDimension,
  type GrowthOrganizationalEffectivenessEvidenceInput,
  type GrowthOrganizationalEffectivenessMetric,
  type GrowthOrganizationalEffectivenessSnapshot,
  type GrowthOrganizationalEffectivenessTrend,
} from "./growth-organizational-effectiveness-baseline-next-3a-types"

export const GROWTH_AIOS_NEXT_3A_CANONICAL_OPERATIONAL_DEFINITIONS: Record<string, string> = {
  discovered:
    "Provider import run completed with audience records returned (growth.datamoon_audience_import_runs).",
  admitted: "Lead persisted to growth.leads after admission gate acceptance.",
  researched:
    "Research evidence attached to lead or draft-factory state progressed past waiting_for_research.",
  qualified:
    "Lead or draft-factory qualification stage completed with qualified disposition (not accuracy — yield only).",
  decision_maker_verified:
    "Decision-maker contact verified via draft-factory decision_maker / contact_verification stages.",
  package_prepared: "Draft-factory state reached draft_ready.",
  package_approved: "Draft-factory state reached approved.",
  outreach_ready:
    "Package approved, draft complete, contactable, and policy clearance satisfied — send may still be disabled.",
  sent: "Outbound message recorded in growth.outbound_messages (transport execution).",
  replied: "Inbound reply linked to outbound thread (sales outcomes projection when available).",
  meeting_booked: "Meeting outcome recorded in sales outcomes projection.",
  opportunity_created: "Opportunity opened in CRM-linked sales outcomes projection.",
  objective_advanced: "Organization objective progress event in growth.organization_objectives.",
}

function metric(
  id: string,
  label: string,
  value: number | string | null,
  options: {
    unit?: string | null
    delta?: number | null
    deltaLabel?: string | null
    availability?: GrowthOrganizationalEffectivenessDataAvailability
    qualificationNote?: string | null
    evidenceRef?: string | null
  } = {},
): GrowthOrganizationalEffectivenessMetric {
  return {
    id,
    label,
    value,
    unit: options.unit ?? null,
    delta: options.delta ?? null,
    deltaLabel: options.deltaLabel ?? null,
    availability: options.availability ?? (value === null ? "unavailable" : "available"),
    qualificationNote: options.qualificationNote ?? null,
    evidenceRef: options.evidenceRef ?? null,
  }
}

function safeDelta(current: number | null, prior: number | null): number | null {
  if (current === null || prior === null) return null
  return current - prior
}

function safeRate(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator === 0) return null
  return Math.round((numerator / denominator) * 1000) / 10
}

function dimensionAvailability(
  metrics: GrowthOrganizationalEffectivenessMetric[],
): GrowthOrganizationalEffectivenessDataAvailability {
  const statuses = metrics.map((m) => m.availability)
  if (statuses.every((s) => s === "unavailable")) return "unavailable"
  if (statuses.some((s) => s === "unavailable" || s === "unreliable")) return "partially_available"
  if (statuses.some((s) => s === "partially_available")) return "partially_available"
  return "available"
}

function inferTrend(
  deltas: Array<number | null>,
  comparisonSufficient: boolean,
): GrowthOrganizationalEffectivenessTrend {
  if (!comparisonSufficient) return "establishing_baseline"
  const valid = deltas.filter((d): d is number => d !== null)
  if (valid.length === 0) return "unknown"
  const positive = valid.filter((d) => d > 0).length
  const negative = valid.filter((d) => d < 0).length
  if (positive > negative && positive >= valid.length / 2) return "improving"
  if (negative > positive && negative >= valid.length / 2) return "declining"
  if (valid.every((d) => d === 0)) return "stable"
  return "unknown"
}

function buildPipelineCreationDimension(
  input: GrowthOrganizationalEffectivenessEvidenceInput,
  comparisonSufficient: boolean,
): GrowthOrganizationalEffectivenessDimension {
  const { pipeline } = input
  const metrics = [
    metric("discovery_runs", "Discovery runs", pipeline.discoveryRuns, {
      delta: safeDelta(pipeline.discoveryRuns, pipeline.comparisonDiscoveryRuns),
      deltaLabel: comparisonSufficient ? "vs prior period" : null,
      evidenceRef: "growth.datamoon_audience_import_runs",
    }),
    metric("provider_records", "Provider records returned", pipeline.providerRecords, {
      evidenceRef: "growth.datamoon_audience_import_runs",
    }),
    metric("leads_admitted", "Leads admitted", pipeline.leadsAdmitted, {
      delta: safeDelta(pipeline.leadsAdmitted, pipeline.comparisonLeadsAdmitted),
      deltaLabel: comparisonSufficient ? "vs prior period" : null,
      evidenceRef: "growth.leads",
    }),
    metric("leads_rejected", "Leads rejected (admission gate)", pipeline.leadsRejected, {
      evidenceRef: "growth-lead-admission-production-analysis",
    }),
    metric("admission_yield_pct", "Discovery-to-admission yield", pipeline.admissionYield, {
      unit: "%",
      qualificationNote: "Yield — not qualification accuracy.",
      evidenceRef: "pipeline-scaling-funnel-metrics-1c",
    }),
    metric("duplicates_prevented", "Duplicates prevented", pipeline.duplicatesPrevented, {
      availability: pipeline.duplicatesPrevented === null ? "partially_available" : "available",
      qualificationNote:
        pipeline.duplicatesPrevented === null ? "Duplicate counts not yet unified across providers." : null,
    }),
  ]

  let summaryLine: string | null = null
  if (pipeline.discoveryRuns > 0 && pipeline.admissionYield !== null && pipeline.admissionYield < 20) {
    summaryLine =
      "Discovery volume is active, but admission yield is low — review ICP exclusion reasons before treating as an engineering defect."
  } else if (pipeline.discoveryRuns > 0 && pipeline.leadsAdmitted > 0) {
    summaryLine = "Pipeline creation is producing admitted leads from discovery activity."
  }

  return {
    id: "pipeline_creation",
    label: "Pipeline Creation",
    availability: dimensionAvailability(metrics),
    metrics,
    summaryLine,
    confidence: pipeline.admissionYield !== null ? "moderate" : "low",
  }
}

function buildResearchEffectivenessDimension(
  input: GrowthOrganizationalEffectivenessEvidenceInput,
): GrowthOrganizationalEffectivenessDimension {
  const { research } = input
  const completionRate = safeRate(research.researchCompleted, research.researchRuns)
  const metrics = [
    metric("research_runs", "Research runs", research.researchRuns, {
      delta: safeDelta(research.researchRuns, research.comparisonResearchRuns),
      evidenceRef: "growth.research_runs / draft_factory_lead_states",
    }),
    metric("research_completed", "Research completed", research.researchCompleted, {
      evidenceRef: "draft_factory_lead_states",
    }),
    metric("completion_rate_pct", "Research completion rate", completionRate, {
      unit: "%",
      qualificationNote: "Volume and quality are separate — high run count is not automatic success.",
    }),
    metric("median_completion_hours", "Median completion time", research.medianCompletionHours, {
      unit: "hours",
      availability: research.medianCompletionHours === null ? "partially_available" : "available",
    }),
    metric("stalled_research", "Stalled research", research.stalledResearch, {
      evidenceRef: "draft_factory waiting_for_research",
    }),
  ]

  return {
    id: "research_effectiveness",
    label: "Research Effectiveness",
    availability: dimensionAvailability(metrics),
    metrics,
    summaryLine:
      research.stalledResearch !== null && research.stalledResearch > 0
        ? "Some research work is stalled — throughput may be constrained before qualification."
        : null,
    confidence: completionRate !== null ? "moderate" : "low",
  }
}

function buildQualificationEffectivenessDimension(
  input: GrowthOrganizationalEffectivenessEvidenceInput,
): GrowthOrganizationalEffectivenessDimension {
  const { qualification } = input
  const metrics = [
    metric("qualified_count", "Qualified accounts", qualification.qualifiedCount, {
      evidenceRef: "draft_factory / qualification pilot",
    }),
    metric("rejected_count", "Rejected accounts", qualification.rejectedCount),
    metric("unresolved_count", "Unresolved accounts", qualification.unresolvedCount),
    metric("qualification_yield_pct", "Qualification yield", qualification.qualificationYield, {
      unit: "%",
      qualificationNote:
        "Labeled as yield — not accuracy. Downstream validation required before accuracy claims.",
    }),
    metric("operator_agreement_rate_pct", "Operator agreement rate", qualification.operatorAgreementRate, {
      unit: "%",
      availability:
        qualification.operatorAgreementRate === null ? "partially_available" : "available",
      qualificationNote:
        qualification.operatorAgreementRate === null
          ? "Operator reversal history is not yet durably stored server-side."
          : null,
    }),
  ]

  return {
    id: "qualification_effectiveness",
    label: "Qualification Effectiveness",
    availability: dimensionAvailability(metrics),
    metrics,
    summaryLine:
      qualification.qualificationYield !== null
        ? "Qualification yield is measurable; accuracy requires downstream outcome validation."
        : "Qualification evidence is fragmented — yield may be partially unavailable.",
    confidence: qualification.qualificationYield !== null ? "moderate" : "low",
  }
}

function buildDecisionMakerReadinessDimension(
  input: GrowthOrganizationalEffectivenessEvidenceInput,
): GrowthOrganizationalEffectivenessDimension {
  const { decisionMakers } = input
  const metrics = [
    metric("verified", "Verified decision makers", decisionMakers.verified, {
      evidenceRef: "draft_factory decision_maker stage",
    }),
    metric("contactable", "Contactable decision makers", decisionMakers.contactable),
    metric("unresolved", "Unresolved decision makers", decisionMakers.unresolved),
    metric("verification_rate_pct", "Verification rate", decisionMakers.verificationRate, {
      unit: "%",
    }),
    metric("waiting_for_dm", "Leads waiting for decision maker", decisionMakers.waitingForDecisionMaker, {
      evidenceRef: "draft_factory waiting_for_dm",
    }),
  ]

  const limiting =
    decisionMakers.waitingForDecisionMaker !== null &&
    decisionMakers.waitingForDecisionMaker > 0 &&
    (decisionMakers.verificationRate === null || decisionMakers.verificationRate < 50)

  return {
    id: "decision_maker_readiness",
    label: "Decision-Maker Readiness",
    availability: dimensionAvailability(metrics),
    metrics,
    summaryLine: limiting
      ? "Decision-maker research may be limiting package throughput."
      : null,
    confidence: decisionMakers.verified !== null ? "moderate" : "low",
  }
}

function buildPackageThroughputDimension(
  input: GrowthOrganizationalEffectivenessEvidenceInput,
  comparisonSufficient: boolean,
): GrowthOrganizationalEffectivenessDimension {
  const { packages } = input
  const metrics = [
    metric("draft_factory_active", "Active draft-factory leads", packages.draftFactoryActive, {
      evidenceRef: "growth.draft_factory_lead_states",
    }),
    metric("draft_ready", "Packages review-ready (draft_ready)", packages.draftReady, {
      delta: safeDelta(packages.draftReady, packages.comparisonDraftReady),
      deltaLabel: comparisonSufficient ? "vs prior period" : null,
    }),
    metric("waiting_for_approval", "Waiting for operator approval", packages.waitingForApproval, {
      evidenceRef: "draft_factory waiting_for_approval",
    }),
    metric("packages_blocked", "Packages blocked", packages.packagesBlocked),
    metric("packages_approved", "Packages approved", packages.packagesApproved),
  ]

  return {
    id: "opportunity_package_throughput",
    label: "Opportunity Package Throughput",
    availability: dimensionAvailability(metrics),
    metrics,
    summaryLine:
      packages.waitingForApproval !== null && packages.waitingForApproval > 0
        ? "Autonomous preparation capacity currently exceeds review capacity for some packages."
        : null,
    confidence: packages.draftReady !== null ? "moderate" : "low",
  }
}

function buildOperatorThroughputDimension(
  input: GrowthOrganizationalEffectivenessEvidenceInput,
): GrowthOrganizationalEffectivenessDimension {
  const { operator } = input
  const metrics = [
    metric("pending_approvals", "Packages awaiting operator decision", operator.pendingApprovals, {
      evidenceRef: "draft_factory waiting_for_approval",
    }),
    metric("recommendations_accepted", "Recommendations accepted", operator.recommendationsAccepted, {
      availability: operator.recommendationsAccepted === null ? "partially_available" : "available",
      qualificationNote:
        operator.recommendationsAccepted === null
          ? "Recommendation acceptance is tracked client-side for some flows."
          : null,
    }),
    metric("recommendations_skipped", "Recommendations skipped", operator.recommendationsSkipped, {
      availability: "partially_available",
    }),
    metric("strategic_overrides", "Strategic overrides recorded", operator.strategicOverrideCount, {
      availability: "partially_available",
      qualificationNote: "Override history is browser-local — not durable server evidence.",
    }),
  ]

  return {
    id: "operator_decision_throughput",
    label: "Operator Decision Throughput",
    availability: dimensionAvailability(metrics),
    metrics,
    summaryLine:
      operator.pendingApprovals !== null && operator.pendingApprovals > 0
        ? "Review queue depth indicates autonomous work is waiting on operator acknowledgment."
        : null,
    confidence: operator.pendingApprovals !== null ? "moderate" : "low",
  }
}

function buildOutreachReadinessDimension(
  input: GrowthOrganizationalEffectivenessEvidenceInput,
): GrowthOrganizationalEffectivenessDimension {
  const { outreach } = input
  const metrics = [
    metric("outbound_disabled", "Outbound send execution", outreach.outboundDisabled ? "disabled" : "enabled", {
      availability: "available",
      qualificationNote: outreach.outboundDisabled
        ? "Readiness measured separately from sending — safeguards intact."
        : null,
      evidenceRef: "outbound_send_execution_enabled flag",
    }),
    metric("approved_packages", "Approved packages", outreach.approvedPackages),
    metric("drafts_ready", "Drafts ready", outreach.draftsReady),
    metric("send_window_eligible", "Send-window eligible", outreach.sendWindowEligible, {
      availability: outreach.sendWindowEligible === null ? "partially_available" : "available",
    }),
    metric("outbound_messages", "Messages sent in period", outreach.outboundMessagesInPeriod, {
      qualificationNote: outreach.outboundDisabled
        ? "Zero sends expected while outbound execution is disabled."
        : null,
    }),
  ]

  return {
    id: "outreach_readiness",
    label: "Outreach Readiness",
    availability: dimensionAvailability(metrics),
    metrics,
    summaryLine: outreach.outboundDisabled
      ? "Outreach readiness is measurable; performance penalties for zero sends do not apply while transport is disabled."
      : null,
    confidence: "high",
  }
}

function buildMeetingProgressionDimension(
  input: GrowthOrganizationalEffectivenessEvidenceInput,
): GrowthOrganizationalEffectivenessDimension {
  const { meetings, outreach } = input
  const metrics = [
    metric("replies", "Replies", meetings.replies, {
      availability: meetings.replies === null ? "unavailable" : "available",
      qualificationNote: meetings.outboundDisabledNote,
    }),
    metric("meetings_booked", "Meetings booked", meetings.meetingsBooked, {
      availability: outreach.outboundDisabled ? "unavailable" : meetings.meetingsBooked === null ? "partially_available" : "available",
      qualificationNote: outreach.outboundDisabled
        ? "No meetings expected while outbound is disabled — not a negative judgment."
        : null,
    }),
    metric("opportunities_opened", "Opportunities opened", meetings.opportunitiesOpened, {
      availability: input.salesOutcomesAvailable ? "partially_available" : "unavailable",
      qualificationNote: input.salesOutcomesAvailable
        ? "Sales outcomes are projection-based, not durable history."
        : "Sales outcomes projection unavailable.",
    }),
    metric("package_to_meeting_rate_pct", "Package-to-meeting rate", meetings.packageToMeetingRate, {
      unit: "%",
      availability: "unavailable",
      qualificationNote: "Requires sufficient outbound and meeting history — not established yet.",
    }),
  ]

  return {
    id: "meeting_opportunity_progression",
    label: "Meeting and Opportunity Progression",
    availability: outreach.outboundDisabled ? "partially_available" : dimensionAvailability(metrics),
    metrics,
    summaryLine: outreach.outboundDisabled
      ? "Meeting progression baseline deferred — outbound transport is not authorized."
      : null,
    confidence: outreach.outboundDisabled ? "high" : "low",
  }
}

function buildRuntimeEfficiencyDimension(
  input: GrowthOrganizationalEffectivenessEvidenceInput,
  comparisonSufficient: boolean,
): GrowthOrganizationalEffectivenessDimension {
  const { runtime } = input
  const metrics = [
    metric("scheduler_runs", "Scheduler runs", runtime.schedulerRuns, {
      delta: safeDelta(runtime.schedulerRuns, runtime.comparisonSchedulerRuns),
      deltaLabel: comparisonSufficient ? "vs prior period" : null,
      evidenceRef: "growth.cron_execution_runs",
    }),
    metric("scheduler_success_rate_pct", "Scheduler success rate", runtime.schedulerSuccessRate, {
      unit: "%",
    }),
    metric("scheduler_failures", "Scheduler failures", runtime.schedulerFailures),
    metric("draft_factory_updates", "Draft-factory updates in period", runtime.draftFactoryUpdates, {
      evidenceRef: "growth.draft_factory_lead_states updated_at",
    }),
    metric("queue_depth", "Draft-factory queue depth", runtime.queueDepth, {
      evidenceRef: "draft_factory active states",
    }),
  ]

  return {
    id: "runtime_efficiency",
    label: "Runtime Efficiency",
    availability: dimensionAvailability(metrics),
    metrics,
    summaryLine:
      runtime.schedulerSuccessRate !== null && runtime.schedulerSuccessRate >= 95
        ? "Runtime capacity is being utilized with high scheduler reliability."
        : null,
    confidence: runtime.schedulerSuccessRate !== null ? "high" : "moderate",
  }
}

function buildStrategicLearningDimension(
  input: GrowthOrganizationalEffectivenessEvidenceInput,
): GrowthOrganizationalEffectivenessDimension {
  const { strategicLearning } = input
  const metrics = [
    metric("knowledge_items", "Organizational knowledge items", strategicLearning.organizationalKnowledgeItems, {
      evidenceRef: "growth.organization_knowledge",
    }),
    metric("validated_findings", "Validated findings", strategicLearning.validatedFindings, {
      availability: "partially_available",
      qualificationNote: "Hypotheses are separated from validated learning where possible.",
    }),
    metric("override_patterns", "Override patterns observed", strategicLearning.overridePatterns, {
      availability: "partially_available",
      qualificationNote: "Browser-local override history limits server-side validation.",
    }),
    metric("segment_samples", "Segment comparison sample size", strategicLearning.segmentSamples, {
      availability: input.segmentAnalyticsAvailable ? "partially_available" : "unavailable",
      qualificationNote:
        strategicLearning.segmentSamples !== null && strategicLearning.segmentSamples < 10
          ? "Insufficient sample for vertical comparison — observation only."
          : null,
    }),
  ]

  return {
    id: "strategic_learning",
    label: "Strategic Learning",
    availability: dimensionAvailability(metrics),
    metrics,
    summaryLine:
      "Strategic learning baseline separates observation from hypothesis until downstream validation exists.",
    confidence: "low",
  }
}

function identifyBottleneckCandidates(
  input: GrowthOrganizationalEffectivenessEvidenceInput,
  dimensions: GrowthOrganizationalEffectivenessDimension[],
): GrowthOrganizationalEffectivenessBottleneckCandidate[] {
  const candidates: GrowthOrganizationalEffectivenessBottleneckCandidate[] = []

  if (
    input.pipeline.admissionYield !== null &&
    input.pipeline.admissionYield < 15 &&
    input.pipeline.discoveryRuns > 0
  ) {
    candidates.push({
      stage: "pipeline_creation",
      evidence: [
        `Admission yield ${input.pipeline.admissionYield}% with ${input.pipeline.discoveryRuns} discovery runs`,
        `${input.pipeline.leadsRejected} leads rejected at admission gate`,
      ],
      affectedVolume: input.pipeline.leadsRejected,
      durationNote: null,
      downstreamImpact: "Reduces qualified pipeline entering research",
      classification: "configuration",
      confidence: "moderate",
    })
  }

  if (input.research.stalledResearch !== null && input.research.stalledResearch > 0) {
    candidates.push({
      stage: "research_effectiveness",
      evidence: [`${input.research.stalledResearch} leads stalled in research`],
      affectedVolume: input.research.stalledResearch,
      durationNote:
        input.research.medianCompletionHours !== null
          ? `Median completion ${input.research.medianCompletionHours}h`
          : null,
      downstreamImpact: "Delays qualification and package preparation",
      classification: "unknown",
      confidence: "moderate",
    })
  }

  if (
    input.decisionMakers.waitingForDecisionMaker !== null &&
    input.decisionMakers.waitingForDecisionMaker > 0
  ) {
    candidates.push({
      stage: "decision_maker_readiness",
      evidence: [
        `${input.decisionMakers.waitingForDecisionMaker} leads waiting for decision maker`,
      ],
      affectedVolume: input.decisionMakers.waitingForDecisionMaker,
      durationNote: null,
      downstreamImpact: "Blocks package readiness",
      classification: "unknown",
      confidence: "moderate",
    })
  }

  if (input.packages.waitingForApproval !== null && input.packages.waitingForApproval > 0) {
    candidates.push({
      stage: "operator_decision_throughput",
      evidence: [
        `${input.packages.waitingForApproval} packages waiting for operator approval`,
      ],
      affectedVolume: input.packages.waitingForApproval,
      durationNote: null,
      downstreamImpact: "Autonomous preparation exceeds review capacity",
      classification: "expected",
      confidence: "high",
    })
  }

  if (input.outreach.outboundDisabled) {
    candidates.push({
      stage: "outreach_readiness",
      evidence: ["Outbound send execution disabled by policy"],
      affectedVolume: input.outreach.approvedPackages,
      durationNote: null,
      downstreamImpact: "Approved work waiting solely on outbound authorization",
      classification: "policy_based",
      confidence: "high",
    })
  }

  if (input.runtime.queueDepth !== null && input.runtime.queueDepth > 10) {
    candidates.push({
      stage: "runtime_efficiency",
      evidence: [`Draft-factory queue depth ${input.runtime.queueDepth}`],
      affectedVolume: input.runtime.queueDepth,
      durationNote: null,
      downstreamImpact: "Stage throughput may be constrained",
      classification: "unknown",
      confidence: "low",
    })
  }

  // Sort by confidence then volume
  const confidenceOrder = { high: 0, moderate: 1, low: 2 }
  candidates.sort(
    (a, b) =>
      confidenceOrder[a.confidence] - confidenceOrder[b.confidence] ||
      (b.affectedVolume ?? 0) - (a.affectedVolume ?? 0),
  )

  return candidates
}

function pickHighestConfidenceBottleneck(
  candidates: GrowthOrganizationalEffectivenessBottleneckCandidate[],
): GrowthOrganizationalEffectivenessBottleneckCandidate | null {
  if (candidates.length === 0) return null
  const high = candidates.filter((c) => c.confidence === "high")
  if (high.length > 0) {
    return high.sort((a, b) => (b.affectedVolume ?? 0) - (a.affectedVolume ?? 0))[0] ?? null
  }
  return candidates[0] ?? null
}

function collectUnavailableMeasurements(
  dimensions: GrowthOrganizationalEffectivenessDimension[],
): string[] {
  const unavailable: string[] = []
  for (const dim of dimensions) {
    for (const m of dim.metrics) {
      if (m.availability === "unavailable" || m.availability === "unreliable") {
        unavailable.push(`${dim.label}: ${m.label} — ${m.qualificationNote ?? m.availability}`)
      }
    }
  }
  return unavailable
}

export function buildGrowthOrganizationalEffectivenessBaselineSnapshot(
  input: GrowthOrganizationalEffectivenessEvidenceInput,
): GrowthOrganizationalEffectivenessSnapshot {
  const comparisonSufficient = input.comparisonPeriod?.sufficientForComparison ?? false

  const dimensions = [
    buildPipelineCreationDimension(input, comparisonSufficient),
    buildResearchEffectivenessDimension(input),
    buildQualificationEffectivenessDimension(input),
    buildDecisionMakerReadinessDimension(input),
    buildPackageThroughputDimension(input, comparisonSufficient),
    buildOperatorThroughputDimension(input),
    buildOutreachReadinessDimension(input),
    buildMeetingProgressionDimension(input),
    buildRuntimeEfficiencyDimension(input, comparisonSufficient),
    buildStrategicLearningDimension(input),
  ]

  const bottleneckCandidates = identifyBottleneckCandidates(input, dimensions)
  const highestConfidenceBottleneck = pickHighestConfidenceBottleneck(bottleneckCandidates)
  const unavailableMeasurements = collectUnavailableMeasurements(dimensions)

  const keyDeltas = [
    safeDelta(input.pipeline.leadsAdmitted, input.pipeline.comparisonLeadsAdmitted),
    safeDelta(input.runtime.schedulerRuns, input.runtime.comparisonSchedulerRuns),
  ]
  const improvementTrend = inferTrend(keyDeltas, comparisonSufficient)

  const availableCount = dimensions.filter((d) => d.availability === "available").length
  const partialCount = dimensions.filter((d) => d.availability === "partially_available").length

  let baselineStatus: GrowthOrganizationalEffectivenessSnapshot["baselineStatus"] = "establishing"
  if (availableCount >= 6) baselineStatus = "comparable"
  if (availableCount < 3 && partialCount === 0) baselineStatus = "insufficient_data"

  return {
    qaMarker: GROWTH_AIOS_NEXT_3A_ORGANIZATIONAL_EFFECTIVENESS_QA_MARKER,
    principle: GROWTH_AIOS_NEXT_3A_ORGANIZATIONAL_EFFECTIVENESS_PRINCIPLE,
    architecturalRule: GROWTH_AIOS_NEXT_3A_ARCHITECTURAL_RULE,
    organizationId: input.organizationId,
    generatedAt: input.generatedAt,
    measurementPeriod: input.measurementPeriod,
    comparisonPeriod: input.comparisonPeriod,
    baselineStatus,
    improvementTrend,
    dimensions,
    bottleneckCandidates,
    highestConfidenceBottleneck,
    unavailableMeasurements,
    dataCompletenessSummary: `${availableCount}/10 dimensions fully available; ${partialCount} partially available; ${unavailableMeasurements.length} metric gaps documented.`,
    canonicalDefinitions: GROWTH_AIOS_NEXT_3A_CANONICAL_OPERATIONAL_DEFINITIONS,
  }
}

export function assertGrowthOrganizationalEffectivenessProjectionOnly(
  snapshot: GrowthOrganizationalEffectivenessSnapshot,
): { ok: true; projectionMarker: string } {
  if (snapshot.qaMarker !== GROWTH_AIOS_NEXT_3A_ORGANIZATIONAL_EFFECTIVENESS_QA_MARKER) {
    throw new Error("Invalid organizational effectiveness QA marker — not a projection read-model.")
  }
  return { ok: true, projectionMarker: snapshot.qaMarker }
}
