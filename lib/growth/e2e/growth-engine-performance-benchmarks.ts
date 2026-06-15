/** Phase GE-HARDEN-2 — Engine performance benchmarks (client-safe). */

import { generateGrowthAgentPlan } from "@/lib/growth/agent-orchestration/agent-orchestration-engine"
import {
  buildGrowthCommandCenterMetrics,
  buildGrowthCommandCenterTimeline,
  buildGrowthCommandCenterWorkspace,
  buildGrowthLeadWorkspace,
} from "@/lib/growth/command-center-unification/command-center-unification-engine"
import {
  agentPlanInputFromAggregationContext,
  apolloTierCounts,
  simulateAggregationContext,
} from "@/lib/growth/e2e/growth-engine-performance-simulation"
import { PERFORMANCE_THRESHOLDS, apolloMemoryThreshold, apolloWorkspaceThreshold } from "@/lib/growth/e2e/growth-engine-performance-thresholds"
import type {
  ApolloScaleSimulationResult,
  ApolloScaleTier,
  PerformanceLatencyMetric,
  PerformanceMemoryMetric,
  PerformanceThroughputMetric,
} from "@/lib/growth/e2e/growth-engine-performance-types"
import { parseProspectSearchIntent } from "@/lib/growth/prospect-discovery/prospect-search-parser"
import { buildProspectSearchPlan } from "@/lib/growth/prospect-discovery/prospect-search-plan-builder"
import { generateCampaignBuilderWizard } from "@/lib/growth/campaign-builder/campaign-builder-engine"
import { generateSequencePreview } from "@/lib/growth/sequence-preview/sequence-preview-engine"
import { normalizeGrowthRealtimeEvent } from "@/lib/growth/realtime-events/realtime-events-normalizer"
import { routeGrowthRealtimeEvent } from "@/lib/growth/realtime-events/realtime-events-router"
import { REALTIME_EVENTS_QA_MARKER } from "@/lib/growth/realtime-events/realtime-events-types"
import { SIGNAL_FEED_QA_MARKER } from "@/lib/growth/signal-intelligence/signal-feed-types"
import { CAMPAIGN_READINESS_QA_MARKER } from "@/lib/growth/campaign-readiness/campaign-readiness-types"
import type { GrowthSequencePattern } from "@/lib/growth/sequence-types"

function measureMs<T>(fn: () => T): { result: T; duration_ms: number } {
  const start = performance.now()
  const result = fn()
  return { result, duration_ms: Math.round(performance.now() - start) }
}

function heapUsedMb(): number {
  return Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 10) / 10
}

function certPattern(): GrowthSequencePattern {
  return {
    id: "perf-pattern-1",
    key: "perf_pattern",
    label: "Performance Pattern",
    description: null,
    patternKind: "catalog",
    sequenceVersion: 1,
    isActive: true,
    minTouches: 2,
    maxObservationDays: 21,
    attemptCount: 5,
    replyRate: 0.1,
    positiveReplyRate: 0.04,
    meetingSignalRate: 0.02,
    followUpCompletionRate: 0.35,
    sequenceAbandonmentRate: 0.08,
    opportunityLift: 0.05,
    revenueProbabilityLift: 0.04,
    conversationHealthLift: 0.03,
    averageTimeToReplyHours: 36,
    averageTouchesToPositiveSignal: 2,
    sequenceQualityScore: 70,
    sequenceFatigueRisk: "low",
    confidenceScore: 62,
    computedAt: new Date().toISOString(),
    steps: [
      {
        id: "perf-step-1",
        patternId: "perf-pattern-1",
        stepOrder: 1,
        channel: "email",
        delayDaysMin: 0,
        delayDaysMax: 0,
        generationType: "personalized",
        playbookCategory: "value_prop",
        voiceDropCampaignId: null,
        requiredHumanApproval: true,
        expectedSignal: "reply",
      },
    ],
  }
}

function certReadiness() {
  return {
    qa_marker: CAMPAIGN_READINESS_QA_MARKER,
    assessment_id: "perf-readiness",
    subject_type: "prospect" as const,
    subject_ref: "perf-lead",
    lead_id: "perf-lead",
    company_name: "Perf Co",
    execution_run_id: null,
    generated_at: new Date().toISOString(),
    readiness_score: 70,
    readiness_status: "partially_ready" as const,
    dimensions: [],
    blockers: [],
    recommendations: [],
    missing_assets: [],
    missing_channels: [],
    required_approvals: ["Human review"],
    required_human_actions: [],
    review_status: "pending" as const,
    requires_human_review: true as const,
    autonomous_execution_enabled: false as const,
  }
}

export function runDashboardAggregationBenchmarks(): PerformanceLatencyMetric[] {
  const context = simulateAggregationContext({
    signal_count: 500,
    inbox_count: 100,
    intervention_count: 50,
    event_count: 200,
  })

  const workspace = measureMs(() => buildGrowthCommandCenterWorkspace(context))
  const lead = measureMs(() => buildGrowthLeadWorkspace(context))
  const metrics = measureMs(() => buildGrowthCommandCenterMetrics(context))
  const timeline = measureMs(() => buildGrowthCommandCenterTimeline(context))

  return [
    {
      metric_id: "command_center_workspace",
      label: "Command Center workspace aggregation",
      duration_ms: workspace.duration_ms,
      item_count: workspace.result.sections.length,
      pass: workspace.duration_ms <= PERFORMANCE_THRESHOLDS.command_center_workspace_ms,
      threshold_ms: PERFORMANCE_THRESHOLDS.command_center_workspace_ms,
    },
    {
      metric_id: "lead_workspace",
      label: "Lead workspace generation",
      duration_ms: lead.duration_ms,
      item_count: lead.result.sections.length,
      pass: lead.duration_ms <= PERFORMANCE_THRESHOLDS.lead_workspace_ms,
      threshold_ms: PERFORMANCE_THRESHOLDS.lead_workspace_ms,
    },
    {
      metric_id: "metrics_generation",
      label: "Metrics generation",
      duration_ms: metrics.duration_ms,
      item_count: Object.keys(metrics.result).length,
      pass: metrics.duration_ms <= PERFORMANCE_THRESHOLDS.metrics_generation_ms,
      threshold_ms: PERFORMANCE_THRESHOLDS.metrics_generation_ms,
    },
    {
      metric_id: "timeline_generation",
      label: "Timeline generation",
      duration_ms: timeline.duration_ms,
      item_count: timeline.result.length,
      pass: timeline.duration_ms <= PERFORMANCE_THRESHOLDS.timeline_generation_ms,
      threshold_ms: PERFORMANCE_THRESHOLDS.timeline_generation_ms,
    },
  ]
}

export function runRealtimeEventBenchmarks(): {
  latency: PerformanceLatencyMetric[]
  throughput: PerformanceThroughputMetric[]
} {
  const batchSize = 1000
  const rows = Array.from({ length: batchSize }, (_, i) => ({
    id: `row-${i}`,
    organization_id: "sim-org",
    event_type: "scored",
    event_payload: {
      qa_marker: REALTIME_EVENTS_QA_MARKER,
      event_name: "test_event",
      lead_id: `lead-${i % 100}`,
    },
    occurred_at: new Date().toISOString(),
  }))

  const normalize = measureMs(() => {
    for (const row of rows) {
      normalizeGrowthRealtimeEvent(row)
    }
  })

  const route = measureMs(() => {
    for (let i = 0; i < batchSize; i++) {
      routeGrowthRealtimeEvent({
        event_type: "signal_routed",
        source: "signal_feed",
        qa_marker: "growth-signal-feed-gs1d-v1",
        lead_id: `lead-${i}`,
      })
    }
  })

  const normalizeDuration = Math.max(normalize.duration_ms, 1)
  const routeDuration = Math.max(route.duration_ms, 1)
  const normalizeIps = (batchSize / normalizeDuration) * 1000
  const routeIps = (batchSize / routeDuration) * 1000

  return {
    latency: [
      {
        metric_id: "realtime_normalize_batch",
        label: "Realtime event normalization (batch)",
        duration_ms: normalize.duration_ms,
        item_count: batchSize,
        pass: normalize.duration_ms <= PERFORMANCE_THRESHOLDS.realtime_normalize_batch_ms,
        threshold_ms: PERFORMANCE_THRESHOLDS.realtime_normalize_batch_ms,
      },
      {
        metric_id: "realtime_route_batch",
        label: "Realtime event routing (batch)",
        duration_ms: route.duration_ms,
        item_count: batchSize,
        pass: route.duration_ms <= PERFORMANCE_THRESHOLDS.realtime_route_batch_ms,
        threshold_ms: PERFORMANCE_THRESHOLDS.realtime_route_batch_ms,
      },
    ],
    throughput: [
      {
        metric_id: "realtime_normalize_throughput",
        label: "Event normalization throughput",
        items_per_second: Math.round(normalizeIps),
        total_items: batchSize,
        duration_ms: normalize.duration_ms,
        pass: normalizeIps >= PERFORMANCE_THRESHOLDS.signal_normalize_per_second,
        threshold_items_per_second: PERFORMANCE_THRESHOLDS.signal_normalize_per_second,
      },
      {
        metric_id: "realtime_route_throughput",
        label: "Event routing throughput",
        items_per_second: Math.round(routeIps),
        total_items: batchSize,
        duration_ms: route.duration_ms,
        pass: routeIps >= PERFORMANCE_THRESHOLDS.realtime_events_per_second,
        threshold_items_per_second: PERFORMANCE_THRESHOLDS.realtime_events_per_second,
      },
    ],
  }
}

export function runSubsystemEngineBenchmarks(): PerformanceLatencyMetric[] {
  const pattern = certPattern()
  const readiness = certReadiness()
  const ctx = simulateAggregationContext({
    signal_count: 200,
    inbox_count: 50,
    intervention_count: 30,
    event_count: 100,
  })

  const agent = measureMs(() => generateGrowthAgentPlan(agentPlanInputFromAggregationContext(ctx)))
  const prospect = measureMs(() => {
    const intent = parseProspectSearchIntent("Find HVAC companies in Texas with 20+ technicians")
    buildProspectSearchPlan(intent)
  })
  const preview = measureMs(() =>
    generateSequencePreview({ patterns: [pattern], campaign_readiness: readiness, limit: 10 }),
  )
  const builder = measureMs(() =>
    generateCampaignBuilderWizard({
      lead_id: "perf-lead",
      campaign_readiness: readiness,
      sequence_previews: preview.result.previews,
      patterns: [pattern],
    }),
  )

  return [
    {
      metric_id: "agent_orchestration",
      label: "Agent orchestration plan generation",
      duration_ms: agent.duration_ms,
      item_count: agent.result.plans[0]?.tasks.length ?? 0,
      pass: agent.duration_ms <= PERFORMANCE_THRESHOLDS.agent_orchestration_ms,
      threshold_ms: PERFORMANCE_THRESHOLDS.agent_orchestration_ms,
    },
    {
      metric_id: "prospect_discovery",
      label: "Prospect discovery plan generation",
      duration_ms: prospect.duration_ms,
      item_count: 1,
      pass: prospect.duration_ms <= PERFORMANCE_THRESHOLDS.prospect_discovery_plan_ms,
      threshold_ms: PERFORMANCE_THRESHOLDS.prospect_discovery_plan_ms,
    },
    {
      metric_id: "sequence_preview",
      label: "Sequence preview generation",
      duration_ms: preview.duration_ms,
      item_count: preview.result.previews.length,
      pass: preview.duration_ms <= PERFORMANCE_THRESHOLDS.sequence_preview_ms,
      threshold_ms: PERFORMANCE_THRESHOLDS.sequence_preview_ms,
    },
    {
      metric_id: "campaign_builder",
      label: "Campaign builder wizard generation",
      duration_ms: builder.duration_ms,
      item_count: builder.result.wizards.length,
      pass: builder.duration_ms <= PERFORMANCE_THRESHOLDS.campaign_builder_ms,
      threshold_ms: PERFORMANCE_THRESHOLDS.campaign_builder_ms,
    },
  ]
}

export function runApolloScaleSimulations(): {
  simulations: ApolloScaleSimulationResult[]
  memory: PerformanceMemoryMetric[]
} {
  const simulations: ApolloScaleSimulationResult[] = []
  const memory: PerformanceMemoryMetric[] = []

  for (const tier of [1000, 5000, 10000] as ApolloScaleTier[]) {
    const counts = apolloTierCounts(tier)
    const heapBefore = heapUsedMb()

    const ctx = simulateAggregationContext({
      signal_count: counts.signals,
      inbox_count: counts.inbox,
      intervention_count: counts.interventions,
      event_count: counts.events,
      lead_id: `apollo-lead-${tier}`,
    })

    const workspace = measureMs(() => buildGrowthCommandCenterWorkspace(ctx))
    const readiness = measureMs(() => buildGrowthCommandCenterMetrics(ctx))
    const preview = measureMs(() => {
      const pattern = certPattern()
      generateSequencePreview({
        patterns: [pattern],
        campaign_readiness: ctx.campaign_readiness!,
        lead_id: `apollo-lead-${tier}`,
        limit: 5,
      })
    })
    const agent = measureMs(() => generateGrowthAgentPlan(agentPlanInputFromAggregationContext(ctx)))

    const heapAfter = heapUsedMb()
    const threshold = apolloWorkspaceThreshold(tier)
    const memThreshold = apolloMemoryThreshold(tier)
    const heapDelta = Math.round((heapAfter - heapBefore) * 10) / 10

    simulations.push({
      tier,
      lead_count: tier,
      workspace_aggregation_ms: workspace.duration_ms,
      readiness_generation_ms: readiness.duration_ms,
      sequence_preview_ms: preview.duration_ms,
      agent_orchestration_ms: agent.duration_ms,
      event_volume: counts.events,
      memory_heap_mb: heapAfter,
      pass: workspace.duration_ms <= threshold && heapAfter <= memThreshold,
    })

    memory.push({
      metric_id: `apollo_memory_${tier}`,
      label: `Apollo ${tier} lead simulation heap`,
      heap_used_mb: heapAfter,
      heap_delta_mb: heapDelta,
      pass: heapAfter <= memThreshold,
      threshold_mb: memThreshold,
    })
  }

  return { simulations, memory }
}

export function runPollingFallbackBenchmark(): PerformanceLatencyMetric {
  const pollCycles = 20
  const eventsPerPoll = 50
  const rows = Array.from({ length: eventsPerPoll }, (_, i) => ({
    id: `poll-${i}`,
    organization_id: "sim-org",
    event_type: "scored",
    event_payload: { qa_marker: REALTIME_EVENTS_QA_MARKER, event_name: "poll_refresh", lead_id: `lead-${i}` },
    occurred_at: new Date().toISOString(),
  }))

  const { duration_ms } = measureMs(() => {
    for (let cycle = 0; cycle < pollCycles; cycle++) {
      for (const row of rows) {
        normalizeGrowthRealtimeEvent(row)
        routeGrowthRealtimeEvent({
          event_type: "signal_routed",
          source: "signal_feed",
          qa_marker: SIGNAL_FEED_QA_MARKER,
          lead_id: row.event_payload.lead_id,
        })
      }
    }
  })

  return {
    metric_id: "polling_fallback_refresh",
    label: "Polling fallback refresh (20 cycles × 50 events)",
    duration_ms,
    item_count: pollCycles * eventsPerPoll,
    pass: duration_ms <= PERFORMANCE_THRESHOLDS.realtime_route_batch_ms * 4,
    threshold_ms: PERFORMANCE_THRESHOLDS.realtime_route_batch_ms * 4,
  }
}

export function runLargeDatasetBenchmarks(): PerformanceLatencyMetric[] {
  const context = simulateAggregationContext({
    signal_count: 2000,
    inbox_count: 500,
    intervention_count: 200,
    event_count: 3000,
  })

  const workspace = measureMs(() => buildGrowthCommandCenterWorkspace(context))
  const timeline = measureMs(() => buildGrowthCommandCenterTimeline(context))

  return [
    {
      metric_id: "large_dataset_workspace",
      label: "Large dataset workspace aggregation",
      duration_ms: workspace.duration_ms,
      item_count: context.signal_feed!.items.length + context.operator_inbox!.items.length,
      pass: workspace.duration_ms <= PERFORMANCE_THRESHOLDS.apollo_workspace_ms[5000],
      threshold_ms: PERFORMANCE_THRESHOLDS.apollo_workspace_ms[5000],
    },
    {
      metric_id: "large_dataset_timeline",
      label: "Large dataset timeline generation",
      duration_ms: timeline.duration_ms,
      item_count: timeline.result.length,
      pass: timeline.duration_ms <= PERFORMANCE_THRESHOLDS.apollo_workspace_ms[5000],
      threshold_ms: PERFORMANCE_THRESHOLDS.apollo_workspace_ms[5000],
    },
  ]
}

export function verifyEngineSafetyInvariants(): boolean {
  const ctx = simulateAggregationContext({
    signal_count: 10,
    inbox_count: 5,
    intervention_count: 3,
    event_count: 5,
  })
  const workspace = buildGrowthCommandCenterWorkspace(ctx)
  const agent = generateGrowthAgentPlan(agentPlanInputFromAggregationContext(ctx))
  return (
    workspace.requires_human_review === true &&
    workspace.autonomous_execution_enabled === false &&
    workspace.outreach_execution === false &&
    workspace.enrollment_execution === false &&
    agent.requires_human_review === true &&
    agent.autonomous_execution_enabled === false &&
    agent.outreach_execution === false &&
    agent.enrollment_execution === false
  )
}
