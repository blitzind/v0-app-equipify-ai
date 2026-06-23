/** GE-AUTO-2F — Attach launch resources from execution context (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { listObjectiveArtifacts } from "@/lib/growth/objectives/growth-objective-execution-context"
import { dispatchGrowthObjectiveSourceEvent } from "@/lib/growth/objectives/growth-objective-event-bridge"
import { updateGrowthObjective } from "@/lib/growth/objectives/growth-objective-repository"
import {
  buildGrowthObjectiveEventSubscriptions,
  mergeObjectiveResourceSubscriptions,
} from "@/lib/growth/objectives/growth-objective-subscriptions"
import type { GrowthObjective } from "@/lib/growth/objectives/growth-objective-types"

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export async function wireObjectiveLaunchResources(
  admin: SupabaseClient,
  input: { organizationId: string; objective: GrowthObjective },
): Promise<GrowthObjective> {
  const plan = input.objective.plan
  if (!plan) return input.objective

  const contextArtifacts = listObjectiveArtifacts(input.objective.executionContext)
  const resources: Array<{
    resourceType: "campaign" | "audience" | "landing_page" | "video_page" | "sequence" | "booking_page"
    resourceKey: string
    resourceId: string
    label: string
  }> = []

  if (contextArtifacts.length > 0) {
    for (const artifact of contextArtifacts) {
      if (!["campaign", "audience", "landing_page", "video_page", "sequence", "booking_page"].includes(artifact.resourceType)) {
        continue
      }
      resources.push({
        resourceType: artifact.resourceType as (typeof resources)[number]["resourceType"],
        resourceKey: artifact.resourceKey,
        resourceId: artifact.resourceId,
        label: artifact.label,
      })
    }
  }

  if (resources.length === 0 && !input.objective.executionContext?.stages?.launch) {
    for (const playbook of plan.automationPlaybooks ?? []) {
      const key = slugify(playbook.name)
      resources.push({
        resourceType: "campaign",
        resourceKey: key,
        resourceId: `${input.objective.id}:campaign:${key}`,
        label: playbook.name,
      })
    }

    for (const audience of plan.audiences ?? []) {
      const key = slugify(audience.name)
      resources.push({
        resourceType: "audience",
        resourceKey: key,
        resourceId: `${input.objective.id}:audience:${key}`,
        label: audience.name,
      })
    }

    for (const asset of plan.assetsRequired ?? []) {
      const key = slugify(asset.name)
      const resourceType =
        asset.type === "video"
          ? "video_page"
          : asset.type === "demo_assistant"
            ? "booking_page"
            : asset.type === "sequence"
              ? "sequence"
              : "landing_page"
      resources.push({
        resourceType,
        resourceKey: key,
        resourceId: `${input.objective.id}:${resourceType}:${key}`,
        label: asset.name,
      })
    }
  }

  const baseSubscriptions =
    input.objective.eventSubscriptions ?? buildGrowthObjectiveEventSubscriptions(input.objective)
  const eventSubscriptions = mergeObjectiveResourceSubscriptions(baseSubscriptions, resources)

  const updated = await updateGrowthObjective(admin, input.organizationId, input.objective.id, {
    eventSubscriptions,
  })

  const launchKey = `launch:${input.objective.id}:${updated.runtime?.stageStates?.launch?.completedAt ?? Date.now()}`
  await dispatchGrowthObjectiveSourceEvent(admin, {
    organizationId: input.organizationId,
    source: "automation",
    signalType: "campaign_launched",
    resourceType: "campaign",
    resourceKey: resources[0]?.resourceKey ?? null,
    resourceId: resources[0]?.resourceId ?? null,
    payload: {
      objectiveId: input.objective.id,
      resources,
      executionContextBound: contextArtifacts.length > 0,
    },
    idempotencyKey: launchKey,
  })

  return updated
}
