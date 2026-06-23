/** GE-AUTO-2D — Bind real production resource UUIDs to objective subscriptions (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getGrowthObjective,
  listGrowthObjectivesForOrganizationEvent,
  updateGrowthObjective,
} from "@/lib/growth/objectives/growth-objective-repository"
import {
  mergeObjectiveResourceSubscriptions,
  type ObjectiveResourceSubscriptionInput,
} from "@/lib/growth/objectives/growth-objective-subscriptions"
import { buildGrowthObjectiveEventSubscriptions } from "@/lib/growth/objectives/growth-objective-subscriptions"
import type { GrowthObjectiveSourceEventResourceType } from "@/lib/growth/objectives/growth-objective-types"

export type BindGrowthObjectiveResourceInput = {
  organizationId: string
  resourceType: GrowthObjectiveSourceEventResourceType
  resourceId: string
  resourceKey?: string | null
  label?: string | null
  objectiveId?: string | null
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function subscriptionNeedsBinding(
  item: { resourceType: string; resourceKey: string; resourceId?: string | null },
  input: BindGrowthObjectiveResourceInput,
): boolean {
  if (item.resourceType !== input.resourceType) return false
  if (item.resourceId === input.resourceId) return false
  if (input.resourceKey && item.resourceKey === input.resourceKey) return true
  if (!input.resourceKey && !item.resourceId) return true
  if (input.resourceKey && slugify(input.resourceKey) === item.resourceKey) return true
  return false
}

export async function bindGrowthObjectiveResource(
  admin: SupabaseClient,
  input: BindGrowthObjectiveResourceInput,
): Promise<number> {
  try {
    const resourceKey = input.resourceKey?.trim()
      ? slugify(input.resourceKey.trim())
      : slugify(input.label?.trim() ?? input.resourceId)

    const resource: ObjectiveResourceSubscriptionInput = {
      resourceType: input.resourceType,
      resourceKey,
      resourceId: input.resourceId,
      label: input.label?.trim() || resourceKey,
    }

    const objectives = input.objectiveId
      ? [await getGrowthObjective(admin, input.organizationId, input.objectiveId)].filter(Boolean)
      : await listGrowthObjectivesForOrganizationEvent(admin, input.organizationId)

    let updatedCount = 0
    for (const objective of objectives) {
      if (!objective) continue
      const subscriptions = objective.eventSubscriptions ?? buildGrowthObjectiveEventSubscriptions(objective)
      const needsBinding = subscriptions.items.some((item) => subscriptionNeedsBinding(item, input))
      if (!needsBinding && !input.objectiveId) continue

      const merged = mergeObjectiveResourceSubscriptions(subscriptions, [resource])
      await updateGrowthObjective(admin, input.organizationId, objective.id, {
        eventSubscriptions: merged,
      })
      updatedCount += 1
    }

    return updatedCount
  } catch {
    return 0
  }
}

export async function bindGrowthObjectiveResources(
  admin: SupabaseClient,
  input: {
    organizationId: string
    objectiveId?: string | null
    resources: BindGrowthObjectiveResourceInput[]
  },
): Promise<number> {
  let total = 0
  for (const resource of input.resources) {
    total += await bindGrowthObjectiveResource(admin, {
      ...resource,
      organizationId: input.organizationId,
      objectiveId: input.objectiveId ?? resource.objectiveId ?? null,
    })
  }
  return total
}
