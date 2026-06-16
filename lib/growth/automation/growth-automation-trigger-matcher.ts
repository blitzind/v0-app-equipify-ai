import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getFlowGraph } from "@/lib/growth/automation/growth-automation-repository"
import type {
  GrowthAutomationTriggerMatchInput,
  GrowthAutomationTriggerMatchResult,
} from "@/lib/growth/automation/growth-automation-enrollment-types"
import {
  buildAutomationRuntimeMatch,
  enrollmentIssue,
  isSupportedAutomationEnrollmentTrigger,
  normalizeAutomationTriggerInput,
  resolvePublishedTriggerFromGraph,
  triggerMatchesRuntimePattern,
} from "@/lib/growth/automation/growth-automation-enrollment-utils"
import type { GrowthAutomationValidationIssue } from "@/lib/growth/automation/growth-automation-types"
import { extractRuntimeMetadata } from "@/lib/growth/automation/growth-automation-runtime-publisher-utils"
import { isRuntimeKillSwitchEnabled } from "@/lib/growth/automation/growth-automation-observability-utils"

export async function matchAutomationRuntimeTriggers(
  admin: SupabaseClient,
  input: GrowthAutomationTriggerMatchInput,
): Promise<GrowthAutomationTriggerMatchResult> {
  const warnings: GrowthAutomationValidationIssue[] = []
  const errors: GrowthAutomationValidationIssue[] = []
  const { triggerSource, triggerEvent } = normalizeAutomationTriggerInput(input)

  if (!isSupportedAutomationEnrollmentTrigger(triggerSource)) {
    errors.push(
      enrollmentIssue("error", "unsupported_trigger", `Unsupported trigger source: ${triggerSource}`),
    )
    return { ok: false, matches: [], warnings, errors }
  }

  const { data: flows, error: flowError } = await admin
    .schema("growth")
    .from("automation_flows")
    .select("id, name, organization_id, status, published_version_id")
    .eq("organization_id", input.organizationId)
    .not("published_version_id", "is", null)

  if (flowError) throw new Error(flowError.message)

  const matches = []

  for (const row of flows ?? []) {
    const flowId = String(row.id)
    const publishedVersionId = String(row.published_version_id)
    const graph = await getFlowGraph(admin, {
      flowId,
      organizationId: input.organizationId,
      versionId: publishedVersionId,
    })

    const metadata = extractRuntimeMetadata(graph.version.canvasLayoutJson)
    if (!graph.version.compiledPatternId) continue
    if (metadata?.activationStatus !== "active") continue
    if (isRuntimeKillSwitchEnabled(metadata)) continue

    const pattern = await admin
      .schema("growth")
      .from("sequence_patterns")
      .select("id, key, is_active, metadata")
      .eq("id", graph.version.compiledPatternId)
      .maybeSingle()

    if (!pattern.data?.id || !pattern.data.is_active) continue

    const publishedTrigger = resolvePublishedTriggerFromGraph({ nodes: graph.nodes })
    const patternTriggerKey =
      typeof (pattern.data.metadata as Record<string, unknown> | null)?.entry_trigger_key === "string"
        ? String((pattern.data.metadata as Record<string, unknown>).entry_trigger_key)
        : publishedTrigger.triggerSource

    if (
      !triggerMatchesRuntimePattern({
        patternTriggerKey,
        requestedTriggerSource: triggerSource,
        requestedTriggerEvent: triggerEvent,
      })
    ) {
      continue
    }

    const match = buildAutomationRuntimeMatch({
      flow: graph.flow,
      version: graph.version,
      patternKey: String(pattern.data.key),
      patternActive: Boolean(pattern.data.is_active),
      triggerSource: publishedTrigger.triggerSource,
      triggerEvent: publishedTrigger.triggerEvent,
    })

    if (match) matches.push(match)
  }

  if (matches.length === 0) {
    warnings.push(
      enrollmentIssue(
        "warning",
        "no_runtime_matches",
        `No active automation runtimes matched trigger ${triggerSource}.`,
      ),
    )
  }

  return { ok: matches.length > 0, matches, warnings, errors }
}

export async function findMatchingAutomationRuntimes(
  admin: SupabaseClient,
  input: GrowthAutomationTriggerMatchInput,
): Promise<GrowthAutomationTriggerMatchResult> {
  return matchAutomationRuntimeTriggers(admin, input)
}
