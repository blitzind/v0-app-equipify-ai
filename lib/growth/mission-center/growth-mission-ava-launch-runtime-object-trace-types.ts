/** GE-AVA-RUNTIME-OBJECT-TRACE-1 — Runtime object trace contract (client-safe). */

import type { AvaLaunchStage } from "@/lib/growth/mission-center/growth-mission-ava-launch-run-trace-types"

export const GROWTH_AVA_RUNTIME_OBJECT_TRACE_1_QA_MARKER = "ge-ava-runtime-object-trace-1-v1" as const

export type AvaRuntimeTraceSite = {
  file: string
  function: string
}

export type AvaRuntimeTraceRecord = {
  qa_marker: typeof GROWTH_AVA_RUNTIME_OBJECT_TRACE_1_QA_MARKER
  stage: AvaLaunchStage | "datamoon_import_service"
  function: string
  file: string
  object: unknown
  objectHash: string
  objectIdentity: string
  label?: string
  constructedBy?: AvaRuntimeTraceSite
  priorObject?: unknown
  priorObjectHash?: string
  priorObjectIdentity?: string
  mutationDetected?: boolean
  launchSessionId?: string
}

export type AvaRuntimeObjectConstructionRecord = {
  qa_marker: typeof GROWTH_AVA_RUNTIME_OBJECT_TRACE_1_QA_MARKER
  label: string
  objectIdentity: string
  objectHash: string
  constructedBy: AvaRuntimeTraceSite
  sourceLabel?: string
  sourceObjectIdentity?: string
  sourceObjectHash?: string
  stage: AvaLaunchStage | "datamoon_import_service"
  launchSessionId?: string
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(",")}]`
  }
  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(",")}}`
}

export function hashAvaRuntimeTraceObject(value: unknown): string {
  let hash = 5381
  const serialized = stableSerialize(value)
  for (let index = 0; index < serialized.length; index += 1) {
    hash = (hash * 33) ^ serialized.charCodeAt(index)
  }
  return `h${(hash >>> 0).toString(16).padStart(8, "0")}`
}

export function summarizeAvaRuntimeTraceObject(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value
  if (Array.isArray(value)) return value.map((entry) => summarizeAvaRuntimeTraceObject(entry))
  const record = value as Record<string, unknown>
  if ("audienceType" in record || "audienceName" in record) {
    return {
      audienceName: record.audienceName,
      audienceType: record.audienceType,
      providerMode: record.providerMode,
      recordLimit: record.recordLimit,
      lookbackDays: record.lookbackDays,
      intentLevels: record.intentLevels,
      geography: record.geography,
      topics: record.topics,
      customTopic: record.customTopic,
      jobTitles: record.jobTitles,
      customJobTitle: record.customJobTitle,
      companySize: record.companySize,
      onlyNewSinceLastRefresh: record.onlyNewSinceLastRefresh,
    }
  }
  if ("audience_type" in record || "run_name" in record) {
    return {
      run_name: record.run_name,
      audience_type: record.audience_type,
      provider_mode: record.provider_mode,
      topic_ids: record.topic_ids,
      topic_ids_length: Array.isArray(record.topic_ids) ? record.topic_ids.length : 0,
      limit: record.limit,
      name: record.name,
      filters_count: Array.isArray(record.filters) ? record.filters.length : 0,
      filters: record.filters,
    }
  }
  return value
}

export function buildAvaRuntimeTraceRecord(input: {
  stage: AvaLaunchStage | "datamoon_import_service"
  function: string
  file: string
  object: unknown
  label?: string
  constructedBy?: AvaRuntimeTraceSite
  priorObject?: unknown
  launchSessionId?: string
}): AvaRuntimeTraceRecord {
  const objectHash = hashAvaRuntimeTraceObject(input.object)
  const priorObjectHash =
    input.priorObject === undefined ? undefined : hashAvaRuntimeTraceObject(input.priorObject)
  return {
    qa_marker: GROWTH_AVA_RUNTIME_OBJECT_TRACE_1_QA_MARKER,
    stage: input.stage,
    function: input.function,
    file: input.file,
    object: summarizeAvaRuntimeTraceObject(input.object),
    objectHash,
    objectIdentity: objectHash,
    label: input.label,
    constructedBy: input.constructedBy,
    priorObject:
      input.priorObject === undefined ? undefined : summarizeAvaRuntimeTraceObject(input.priorObject),
    priorObjectHash,
    priorObjectIdentity: priorObjectHash,
    mutationDetected:
      priorObjectHash !== undefined ? priorObjectHash !== objectHash : undefined,
    launchSessionId: input.launchSessionId,
  }
}
