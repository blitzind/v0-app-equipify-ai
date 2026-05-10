import type { WorkOrder } from "@/lib/mock-data"
import { getWorkOrderOfflineRecordForScope, putWorkOrderOfflineRecord } from "./idb-store"
import { mergeTechnicianOfflineBundle, type WorkOrderOfflineBundleMergePatch } from "./merge-bundle"
import { makeWorkOrderOfflineScopeKey } from "./types"

const MAX_MERGE_RETRIES = 4

export type PutOfflineBundleMergePatchResult =
  | { ok: true }
  | { ok: false; reason: "syncing" | "conflict" | "no_changes" }

export async function putOfflineBundleMergePatch(args: {
  organizationId: string
  userId: string
  workOrder: WorkOrder
  dbNotes: string
  patch: WorkOrderOfflineBundleMergePatch
}): Promise<PutOfflineBundleMergePatchResult> {
  const scopeKey = makeWorkOrderOfflineScopeKey(args.organizationId, args.userId, args.workOrder.id)
  let existing = await getWorkOrderOfflineRecordForScope(scopeKey)

  for (let attempt = 0; attempt < MAX_MERGE_RETRIES; attempt++) {
    if (existing?.status === "syncing") {
      return { ok: false, reason: "syncing" }
    }
    if (existing?.status === "conflict") {
      return { ok: false, reason: "conflict" }
    }

    const next = mergeTechnicianOfflineBundle({
      existing,
      organizationId: args.organizationId,
      userId: args.userId,
      workOrder: args.workOrder,
      dbNotes: args.dbNotes,
      patch: args.patch,
    })
    if (!next) {
      return { ok: false, reason: "no_changes" }
    }

    const verify = await getWorkOrderOfflineRecordForScope(scopeKey)
    if (verify?.status === "conflict") {
      return { ok: false, reason: "conflict" }
    }
    if (verify?.status === "syncing") {
      return { ok: false, reason: "syncing" }
    }
    if (verify && verify.updatedAtIso !== existing?.updatedAtIso) {
      existing = verify
      continue
    }

    await putWorkOrderOfflineRecord(next)
    return { ok: true }
  }

  return { ok: false, reason: "no_changes" }
}
