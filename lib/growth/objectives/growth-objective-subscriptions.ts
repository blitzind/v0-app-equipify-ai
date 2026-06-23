/** GE-AUTO-2C — Objective event subscription helpers (client-safe). */

import {
  GROWTH_OBJECTIVE_EVENT_SUBSCRIPTIONS_QA_MARKER,
  type GrowthObjective,
  type GrowthObjectiveEventSubscription,
  type GrowthObjectiveEventSubscriptions,
  type GrowthObjectiveSourceEventResourceType,
} from "@/lib/growth/objectives/growth-objective-types"
import type { GrowthObjectiveSourceEvent } from "@/lib/growth/objectives/growth-objective-signal-mapper"

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function buildGrowthObjectiveEventSubscriptions(
  objective: GrowthObjective,
): GrowthObjectiveEventSubscriptions {
  const plan = objective.plan
  const items: GrowthObjectiveEventSubscription[] = []

  for (const search of plan?.savedSearches ?? []) {
    items.push({
      id: `${objective.id}:saved_search:${slugify(search.name)}`,
      resourceType: "saved_search",
      resourceKey: slugify(search.name),
      label: search.name,
    })
  }

  for (const audience of plan?.audiences ?? []) {
    items.push({
      id: `${objective.id}:audience:${slugify(audience.name)}`,
      resourceType: "audience",
      resourceKey: slugify(audience.name),
      label: audience.name,
    })
  }

  for (const asset of plan?.assetsRequired ?? []) {
    const resourceType: GrowthObjectiveSourceEventResourceType =
      asset.type === "video"
        ? "video_page"
        : asset.type === "demo_assistant"
          ? "booking_page"
          : asset.type === "sequence"
            ? "sequence"
            : "landing_page"
    items.push({
      id: `${objective.id}:${resourceType}:${slugify(asset.name)}`,
      resourceType,
      resourceKey: slugify(asset.name),
      label: asset.name,
    })
  }

  for (const playbook of plan?.automationPlaybooks ?? []) {
    items.push({
      id: `${objective.id}:campaign:${slugify(playbook.name)}`,
      resourceType: "campaign",
      resourceKey: slugify(playbook.name),
      label: playbook.name,
    })
  }

  items.push({
    id: `${objective.id}:opportunity:pipeline`,
    resourceType: "opportunity",
    resourceKey: "pipeline",
    label: "Pipeline opportunities",
  })

  return {
    qa_marker: GROWTH_OBJECTIVE_EVENT_SUBSCRIPTIONS_QA_MARKER,
    items,
    subscribedAt: new Date().toISOString(),
  }
}

export type ObjectiveResourceSubscriptionInput = {
  resourceType: GrowthObjectiveSourceEventResourceType
  resourceKey: string
  resourceId: string
  label: string
}

export function mergeObjectiveResourceSubscriptions(
  subscriptions: GrowthObjectiveEventSubscriptions,
  resources: ObjectiveResourceSubscriptionInput[],
): GrowthObjectiveEventSubscriptions {
  const items = [...subscriptions.items]

  for (const resource of resources) {
    const existingIndex = items.findIndex(
      (entry) =>
        entry.resourceType === resource.resourceType &&
        (entry.resourceId === resource.resourceId || entry.resourceKey === resource.resourceKey),
    )

    if (existingIndex >= 0) {
      items[existingIndex] = {
        ...items[existingIndex],
        resourceId: resource.resourceId,
        resourceKey: resource.resourceKey,
        label: resource.label || items[existingIndex].label,
      }
      continue
    }

    items.push({
      id: `${resource.resourceType}:${resource.resourceId}`,
      resourceType: resource.resourceType,
      resourceKey: resource.resourceKey,
      resourceId: resource.resourceId,
      label: resource.label,
    })
  }

  return {
    ...subscriptions,
    qa_marker: GROWTH_OBJECTIVE_EVENT_SUBSCRIPTIONS_QA_MARKER,
    items,
    subscribedAt: new Date().toISOString(),
  }
}

function subscriptionMatchesEvent(
  subscription: GrowthObjectiveEventSubscription,
  event: GrowthObjectiveSourceEvent,
): boolean {
  if (event.resourceType && subscription.resourceType !== event.resourceType) return false
  if (event.resourceId && subscription.resourceId && subscription.resourceId === event.resourceId) {
    return true
  }
  if (event.resourceKey && subscription.resourceKey === event.resourceKey) return true
  if (event.resourceId && subscription.resourceKey === event.resourceId) return true
  return false
}

export function objectiveMatchesSourceEvent(
  objective: GrowthObjective,
  event: GrowthObjectiveSourceEvent,
): boolean {
  if (objective.organizationId !== event.organizationId) return false
  if (objective.status !== "active" || objective.emergencyStopActive) return false
  if (!objective.runtime?.running) return false

  const subscriptions = objective.eventSubscriptions?.items ?? []
  if (subscriptions.length === 0) return true

  if (!event.resourceType && !event.resourceKey && !event.resourceId) return true

  return subscriptions.some((subscription) => subscriptionMatchesEvent(subscription, event))
}
