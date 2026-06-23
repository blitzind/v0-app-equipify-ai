/** GE-AUTO-1F — Deterministic objective planner (client-safe). */

import {
  GROWTH_OBJECTIVE_QA_MARKER,
  GROWTH_OBJECTIVE_STAGE_IDS,
  type GrowthObjective,
  type GrowthObjectiveExecutionPlan,
  type GrowthObjectiveIcpStrategy,
  type GrowthObjectivePlanStage,
  type GrowthObjectiveStageId,
} from "@/lib/growth/objectives/growth-objective-types"
import { buildGrowthObjectiveForecast } from "@/lib/growth/objectives/growth-objective-forecast"

const STAGE_LABELS: Record<GrowthObjectiveStageId, string> = {
  discover: "Discover",
  research: "Research",
  enrich: "Enrich",
  buying_committee: "Buying Committee",
  generate_assets: "Generate Assets",
  launch: "Launch",
  monitor: "Monitor",
  adapt: "Adapt",
  book: "Book",
  complete: "Complete",
}

function extractKeywords(text: string): string[] {
  const normalized = text.toLowerCase()
  const tokens = normalized.match(/[a-z][a-z0-9-]{2,}/g) ?? []
  const stop = new Set([
    "book",
    "with",
    "the",
    "and",
    "for",
    "from",
    "that",
    "this",
    "companies",
    "company",
  ])
  return [...new Set(tokens.filter((token) => !stop.has(token)))]
}

function inferIcpStrategy(objective: GrowthObjective): GrowthObjectiveIcpStrategy {
  const corpus = `${objective.title} ${objective.description ?? ""}`.toLowerCase()
  const keywords = extractKeywords(corpus)
  const industries: string[] = []

  if (/medical|healthcare|hospital|clinical|htm|biomed/.test(corpus)) {
    industries.push("Healthcare / Medical Equipment")
  }
  if (/equipment|machinery|device|instrument/.test(corpus)) {
    industries.push("Equipment & Devices")
  }
  if (/saas|software|platform/.test(corpus)) {
    industries.push("Software")
  }
  if (industries.length === 0) {
    industries.push("General B2B")
  }

  const companySize = /enterprise|large/.test(corpus)
    ? "500+ employees"
    : /mid[- ]market|midmarket/.test(corpus)
      ? "50–500 employees"
      : "50–500 employees"

  const geography = /north america|usa|united states|emea|europe|global/.exec(corpus)?.[0] ?? null

  const persona =
    objective.objectiveType === "demos_booked" || objective.objectiveType === "meetings_booked"
      ? "Operations / clinical engineering / procurement stakeholders"
      : "Revenue leadership and pipeline owners"

  return {
    industries,
    companySize,
    geography: geography ? geography.toUpperCase() : null,
    keywords,
    persona,
    summary: `Target ${industries.join(" & ")} accounts${geography ? ` in ${geography.toUpperCase()}` : ""} matching ${keywords.slice(0, 4).join(", ") || "ICP keywords"}.`,
  }
}

function buildInitialStages(objective: GrowthObjective): GrowthObjectivePlanStage[] {
  const activeIndex =
    objective.status === "active"
      ? 2
      : objective.status === "planning"
        ? 1
        : objective.currentValue > 0
          ? 7
          : 0

  return GROWTH_OBJECTIVE_STAGE_IDS.map((id, index) => {
    let status: GrowthObjectivePlanStage["status"] = "pending"
    let progress = 0
    if (index < activeIndex) {
      status = "complete"
      progress = 100
    } else if (index === activeIndex) {
      status = "in_progress"
      progress = objective.currentValue > 0 ? Math.min(95, Math.round((objective.currentValue / Math.max(objective.targetValue, 1)) * 100)) : 15
    }

    const blockers: string[] = []
    const recommendations: string[] = []
    if (id === "discover" && status !== "complete") {
      recommendations.push("Run prospect search with ICP filters and save the search.")
    }
    if (id === "research" && status === "in_progress") {
      recommendations.push("Enrich top accounts and capture pain points before outreach.")
    }
    if (id === "launch" && objective.safetyMode === "strict") {
      blockers.push("Campaign launch requires operator approval in strict safety mode.")
    }
    if (id === "book" && objective.currentValue < objective.targetValue) {
      recommendations.push("Prioritize high-intent leads with booking CTAs.")
    }

    return {
      id,
      label: STAGE_LABELS[id],
      status,
      progress,
      blockers,
      recommendations,
      confidence: status === "complete" ? 92 : status === "in_progress" ? 78 : 55,
    }
  })
}

function channelsForObjective(objective: GrowthObjective): Array<"email" | "sms" | "voice"> {
  switch (objective.objectiveType) {
    case "demos_booked":
    case "meetings_booked":
      return ["email", "sms", "voice"]
    case "opportunities_created":
    case "pipeline_value":
      return ["email", "voice"]
    default:
      return ["email"]
  }
}

export function planGrowthObjective(objective: GrowthObjective): GrowthObjectiveExecutionPlan {
  const icpStrategy = inferIcpStrategy(objective)
  const industryToken = icpStrategy.industries[0]?.split("/")[0]?.trim() ?? "B2B"
  const keywordQuery = icpStrategy.keywords.slice(0, 3).join(" ") || industryToken

  const savedSearches = [
    {
      name: `${industryToken} ICP — primary`,
      query: `${keywordQuery} ${icpStrategy.companySize ?? ""}`.trim(),
      rationale: "Primary discover stage saved search aligned to objective ICP.",
    },
    {
      name: `${industryToken} — engaged accounts`,
      query: `${keywordQuery} engagement:high`,
      rationale: "Monitor stage refresh for high-intent accounts.",
    },
  ]

  const audiences = [
    {
      name: `${objective.title} — core ICP`,
      criteria: icpStrategy.summary,
      rationale: "Audience for launch and monitor stages.",
    },
    {
      name: `${objective.title} — buying committee`,
      criteria: "Multi-stakeholder accounts with research completed",
      rationale: "Buying committee stage enrollment.",
    },
  ]

  const researchRequirements = [
    "Account pain points and workflow context",
    "Compliance / procurement constraints where relevant",
    "Competitive landscape summary",
  ]

  const buyingCommitteeRequirements = [
    "Identify economic buyer and technical evaluator",
    "Map stakeholders to personalized assets",
    "Confirm multi-thread outreach plan",
  ]

  const assetsRequired = [
    {
      type: "page" as const,
      name: `${industryToken} personalized landing page`,
      rationale: "Support evaluate-stage prospects with tailored proof.",
    },
    {
      type: "video" as const,
      name: `${objective.objectiveType === "demos_booked" ? "Demo walkthrough" : "Value overview"} video`,
      rationale: "Increase engagement before booking CTAs.",
    },
    {
      type: "sequence" as const,
      name: `${objective.objectiveType.replace(/_/g, " ")} nurture sequence`,
      rationale: "Orchestrate multi-touch outreach across channels.",
    },
  ]

  if (objective.objectiveType === "demos_booked") {
    assetsRequired.push({
      type: "demo_assistant",
      name: "Demo booking assistant",
      rationale: "Reduce friction for demo scheduling.",
    })
  }

  const automationPlaybooks = [
    {
      name: "High-intent follow-up",
      trigger: "video_completion OR pricing_intent",
      rationale: "Route to prepare/send when confidence threshold met.",
    },
    {
      name: "Booking abandonment reminder",
      trigger: "booking_started AND NOT booking_completed",
      rationale: "SMS reminder when policy permits autonomous send.",
    },
    {
      name: "Low engagement adaptation",
      trigger: "sequence_open_rate < 0.15",
      rationale: "Adapt channel mix — recommendations only.",
    },
  ]

  const successMetrics = [
    `${objective.objectiveType.replace(/_/g, " ")} progress (${objective.currentValue}/${objective.targetValue})`,
    "Audience coverage vs forecast",
    "Sequence reply rate",
    "Demo / meeting conversion rate",
    "Autonomous send vs approval queue ratio",
  ]

  const forecast = buildGrowthObjectiveForecast(objective, icpStrategy)

  return {
    objectiveId: objective.id,
    generatedAt: new Date().toISOString(),
    qa_marker: GROWTH_OBJECTIVE_QA_MARKER,
    icpStrategy,
    savedSearches,
    audiences,
    researchRequirements,
    buyingCommitteeRequirements,
    assetsRequired,
    channelsRequired: channelsForObjective(objective),
    automationPlaybooks,
    successMetrics,
    stages: buildInitialStages(objective),
    forecast,
  }
}

export const GrowthObjectivePlannerService = {
  planGrowthObjective,
} as const
