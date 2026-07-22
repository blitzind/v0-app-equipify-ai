/** GE-AIOS-DRAFT-FACTORY-OBSERVABILITY-1A — Runtime instance identity (client-safe). */

import { randomUUID } from "node:crypto"

let isolateInstanceId: string | null = null

export function resolveGrowthRuntimeInstanceId(): string {
  if (isolateInstanceId) return isolateInstanceId
  const deployment =
    process.env.VERCEL_DEPLOYMENT_ID ??
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ??
    process.env.AWS_LAMBDA_LOG_STREAM_NAME ??
    "local"
  isolateInstanceId = `${deployment}:${randomUUID().slice(0, 8)}`
  return isolateInstanceId
}

export function captureFailureLocation(error: unknown): {
  failureType: string
  failureFunction: string | null
  failureFile: string | null
  failureLine: number | null
} {
  const failureType = error instanceof Error ? error.name : typeof error
  if (!(error instanceof Error) || !error.stack) {
    return { failureType, failureFunction: null, failureFile: null, failureLine: null }
  }
  const frame = error.stack.split("\n")[1]?.trim() ?? ""
  const named = frame.match(/^at (?:async )?(.+?) \((.+):(\d+):\d+\)$/)
  if (named) {
    return {
      failureType,
      failureFunction: named[1] ?? null,
      failureFile: named[2] ?? null,
      failureLine: Number.parseInt(named[3] ?? "", 10) || null,
    }
  }
  const plain = frame.match(/^at (.+):(\d+):\d+$/)
  if (plain) {
    return {
      failureType,
      failureFunction: null,
      failureFile: plain[1] ?? null,
      failureLine: Number.parseInt(plain[2] ?? "", 10) || null,
    }
  }
  return { failureType, failureFunction: null, failureFile: null, failureLine: null }
}
