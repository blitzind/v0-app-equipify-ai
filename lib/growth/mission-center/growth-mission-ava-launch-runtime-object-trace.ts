/** GE-AVA-RUNTIME-OBJECT-TRACE-1 — Runtime object trace logging (server-only). */

import "server-only"

import { logGrowthEngine } from "@/lib/growth/access"
import type { AvaLaunchStage } from "@/lib/growth/mission-center/growth-mission-ava-launch-run-trace-types"
import {
  buildAvaRuntimeTraceRecord,
  GROWTH_AVA_RUNTIME_OBJECT_TRACE_1_QA_MARKER,
  hashAvaRuntimeTraceObject,
  type AvaRuntimeObjectConstructionRecord,
  type AvaRuntimeTraceSite,
} from "@/lib/growth/mission-center/growth-mission-ava-launch-runtime-object-trace-types"

export {
  buildAvaRuntimeTraceRecord,
  GROWTH_AVA_RUNTIME_OBJECT_TRACE_1_QA_MARKER,
  hashAvaRuntimeTraceObject,
  summarizeAvaRuntimeTraceObject,
} from "@/lib/growth/mission-center/growth-mission-ava-launch-runtime-object-trace-types"

const objectIdentityRegistry = new WeakMap<object, string>()
let objectIdentityCounter = 0
let activeLaunchSessionId: string | null = null
const launchSessionObjects = new Map<string, Array<{ label: string; objectIdentity: string; objectHash: string }>>()

function nextObjectIdentity(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return `value:${hashAvaRuntimeTraceObject(value)}`
  }
  const existing = objectIdentityRegistry.get(value)
  if (existing) return existing
  objectIdentityCounter += 1
  const identity = `obj-${objectIdentityCounter}`
  objectIdentityRegistry.set(value, identity)
  return identity
}

export function beginAvaLaunchRuntimeObjectTraceSession(input: {
  missionId: string
  organizationId: string
}): string {
  activeLaunchSessionId = `launch-${input.missionId}-${Date.now()}`
  launchSessionObjects.set(activeLaunchSessionId, [])
  logGrowthEngine("ava_launch_runtime_trace_session_started", {
    qa_marker: GROWTH_AVA_RUNTIME_OBJECT_TRACE_1_QA_MARKER,
    launchSessionId: activeLaunchSessionId,
    missionId: input.missionId,
    organizationId: input.organizationId,
  })
  return activeLaunchSessionId
}

export function endAvaLaunchRuntimeObjectTraceSession(): void {
  if (!activeLaunchSessionId) return
  const objects = launchSessionObjects.get(activeLaunchSessionId) ?? []
  logGrowthEngine("ava_launch_runtime_trace_session_completed", {
    qa_marker: GROWTH_AVA_RUNTIME_OBJECT_TRACE_1_QA_MARKER,
    launchSessionId: activeLaunchSessionId,
    objectInstances: objects,
  })
  launchSessionObjects.delete(activeLaunchSessionId)
  activeLaunchSessionId = null
}

function rememberLaunchObject(label: string, object: unknown, objectHash: string, objectIdentity: string): void {
  if (!activeLaunchSessionId) return
  const objects = launchSessionObjects.get(activeLaunchSessionId) ?? []
  objects.push({ label, objectIdentity, objectHash })
  launchSessionObjects.set(activeLaunchSessionId, objects)
}

export function logAvaRuntimeTrace(input: {
  stage: AvaLaunchStage | "datamoon_import_service"
  function: string
  file: string
  object: unknown
  label?: string
  constructedBy?: AvaRuntimeTraceSite
  priorObject?: unknown
}): AvaRuntimeTraceRecord {
  const record = buildAvaRuntimeTraceRecord({
    ...input,
    launchSessionId: activeLaunchSessionId ?? undefined,
  })
  record.objectIdentity = nextObjectIdentity(input.object)
  if (input.priorObject !== undefined) {
    record.priorObjectIdentity = nextObjectIdentity(input.priorObject)
  }
  rememberLaunchObject(input.label ?? input.function, input.object, record.objectHash, record.objectIdentity)
  console.warn("AVA_RUNTIME_TRACE", JSON.stringify(record, null, 2))
  logGrowthEngine("ava_runtime_trace", record)
  return record
}

export function logAvaRuntimeObjectConstruction(input: {
  label: string
  object: unknown
  constructedBy: AvaRuntimeTraceSite
  sourceLabel?: string
  sourceObject?: unknown
  stage: AvaLaunchStage | "datamoon_import_service"
}): AvaRuntimeObjectConstructionRecord {
  const objectHash = hashAvaRuntimeTraceObject(input.object)
  const objectIdentity = nextObjectIdentity(input.object)
  const record: AvaRuntimeObjectConstructionRecord = {
    qa_marker: GROWTH_AVA_RUNTIME_OBJECT_TRACE_1_QA_MARKER,
    label: input.label,
    objectIdentity,
    objectHash,
    constructedBy: input.constructedBy,
    sourceLabel: input.sourceLabel,
    sourceObjectIdentity:
      input.sourceObject === undefined ? undefined : nextObjectIdentity(input.sourceObject),
    sourceObjectHash:
      input.sourceObject === undefined ? undefined : hashAvaRuntimeTraceObject(input.sourceObject),
    stage: input.stage,
    launchSessionId: activeLaunchSessionId ?? undefined,
  }
  rememberLaunchObject(input.label, input.object, objectHash, objectIdentity)
  console.warn("AVA_RUNTIME_OBJECT_CONSTRUCTED", JSON.stringify(record, null, 2))
  logGrowthEngine("ava_runtime_object_constructed", record)
  return record
}

export function getActiveAvaLaunchRuntimeTraceSessionId(): string | null {
  return activeLaunchSessionId
}

export type AvaRuntimeTraceRecord = ReturnType<typeof logAvaRuntimeTrace>
