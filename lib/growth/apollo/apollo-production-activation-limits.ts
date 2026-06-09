/** Apollo AI-5 controlled production limits — Week 1–3 + ongoing. Client-safe. */

import type { ApolloLivePilotEvidence } from "@/lib/growth/apollo/apollo-live-pilot-evidence-types"
import type { ApolloContactQualityScore } from "@/lib/growth/apollo/apollo-contact-quality-score"
import type { ApolloQualityBenchmarkReport } from "@/lib/growth/apollo/apollo-quality-benchmark-report"

export const APOLLO_PRODUCTION_ACTIVATION_LIMITS_QA_MARKER = "apollo-production-activation-limits-ai-5-v1" as const

export type ApolloProductionWeekLimits = {
  week: "week_1" | "week_2" | "week_3" | "ongoing"
  label: string
  companies_per_day: { min: number; max: number }
  contacts_per_day: { min: number; max: number }
  enrollments_per_day: { min: number; max: number }
  approval_requirements: string[]
  monitoring: string[]
}

export type ApolloProductionActivationLimits = {
  qa_marker: typeof APOLLO_PRODUCTION_ACTIVATION_LIMITS_QA_MARKER
  based_on_live_evidence: boolean
  pilot_baseline: {
    contacts_per_company: number
    sequence_ready_per_company: number
    api_calls_per_company: number
  }
  weeks: ApolloProductionWeekLimits[]
  bulk_enrollment_permitted: false
  operator_notes: string[]
}

export function buildApolloProductionActivationLimits(input: {
  evidence: ApolloLivePilotEvidence
  quality: ApolloContactQualityScore
  benchmark: ApolloQualityBenchmarkReport
}): ApolloProductionActivationLimits {
  const live = !input.evidence.mock
  const mapped = Math.max(input.evidence.discovery.contacts_mapped, 1)
  const seqReady = input.evidence.readiness_funnel.sequence_ready
  const contactsPerCompany = input.evidence.discovery.contacts_mapped
  const seqPerCompany = seqReady
  const apiPerCompany = Math.max(input.evidence.runtime.api_calls, 1)

  const qualityStrong = input.quality.composite_score >= 65
  const qualityAcceptable = input.quality.composite_score >= 45
  const hasSequenceReady = seqReady >= 1

  const week1CompaniesMax = live && hasSequenceReady ? (qualityStrong ? 5 : 3) : 1
  const week2CompaniesMax = live && qualityStrong && hasSequenceReady ? 15 : 5
  const week3CompaniesMax = live && qualityStrong && input.benchmark.benchmark_grade === "strong" ? 50 : 15
  const ongoingCompaniesMax = live && input.quality.composite_score >= 80 ? 100 : 25

  const contactsPerDay = (companies: number) => ({
    min: Math.max(1, Math.round(companies * contactsPerCompany * 0.5)),
    max: Math.max(companies * contactsPerCompany, contactsPerCompany),
  })

  const enrollmentsPerDay = (companies: number) => ({
    min: hasSequenceReady ? Math.max(1, Math.round(companies * seqPerCompany * 0.5)) : 0,
    max: Math.max(seqPerCompany * companies, hasSequenceReady ? 1 : 0),
  })

  const sharedApproval = [
    "Human approval on every sequence execution job",
    "No bulk auto-enrollment",
    "Platform admin approves Apollo discovery run per company",
  ]

  const sharedMonitoring = [
    "Daily review of readiness funnel fallout",
    "Apollo API error rate and guardrail snapshots",
    "Canonical linkage rate after each run",
  ]

  return {
    qa_marker: APOLLO_PRODUCTION_ACTIVATION_LIMITS_QA_MARKER,
    based_on_live_evidence: live,
    pilot_baseline: {
      contacts_per_company: contactsPerCompany,
      sequence_ready_per_company: seqPerCompany,
      api_calls_per_company: apiPerCompany,
    },
    weeks: [
      {
        week: "week_1",
        label: "First controlled production week",
        companies_per_day: { min: 1, max: week1CompaniesMax },
        contacts_per_day: contactsPerDay(week1CompaniesMax),
        enrollments_per_day: enrollmentsPerDay(week1CompaniesMax),
        approval_requirements: [...sharedApproval, "Ops review after each company processed"],
        monitoring: [...sharedMonitoring, "Compare pilot benchmark vs daily metrics"],
      },
      {
        week: "week_2",
        label: "Limited expansion",
        companies_per_day: { min: 3, max: week2CompaniesMax },
        contacts_per_day: contactsPerDay(week2CompaniesMax),
        enrollments_per_day: enrollmentsPerDay(week2CompaniesMax),
        approval_requirements: [
          ...sharedApproval,
          qualityAcceptable ? "Daily ops sign-off for volume above Week 1 max" : "Hold at Week 1 limits until quality improves",
        ],
        monitoring: [...sharedMonitoring, "Weekly quality spot-check (10% sample)"],
      },
      {
        week: "week_3",
        label: "Scaled controlled rollout",
        companies_per_day: { min: 5, max: week3CompaniesMax },
        contacts_per_day: contactsPerDay(week3CompaniesMax),
        enrollments_per_day: enrollmentsPerDay(week3CompaniesMax),
        approval_requirements: [
          ...sharedApproval,
          "VD-4 certification required before Voice Drop enrollment",
          "Pre-approved sequence patterns only",
        ],
        monitoring: [...sharedMonitoring, "Engagement metrics by Apollo source vs baseline"],
      },
      {
        week: "ongoing",
        label: "Steady-state controlled production",
        companies_per_day: { min: 10, max: ongoingCompaniesMax },
        contacts_per_day: contactsPerDay(ongoingCompaniesMax),
        enrollments_per_day: enrollmentsPerDay(ongoingCompaniesMax),
        approval_requirements: [
          ...sharedApproval,
          "Ops lead sign-off for daily volume above Week 3 max",
          "Weekly compliance audit on Apollo-sourced outreach",
        ],
        monitoring: [
          ...sharedMonitoring,
          "Monthly cost projection vs actual credits",
          "Quarterly ICP title bucket review",
        ],
      },
    ],
    bulk_enrollment_permitted: false,
    operator_notes: live
      ? [
          `Pilot: ${contactsPerCompany} contacts/company, ${seqPerCompany} sequence-ready/company`,
          `Quality: ${input.quality.grade} (${input.quality.composite_score}/100)`,
          `Benchmark grade: ${input.benchmark.benchmark_grade}`,
        ]
      : ["Limits use conservative defaults until live pilot evidence is loaded."],
  }
}
