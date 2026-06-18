/** Client-side platform Growth API fetch with timeout guards (Phase 8F). */

import { auditGrowthInboxFetch } from "@/lib/growth/inbox/growth-inbox-fetch-audit"

export const PLATFORM_GROWTH_CLIENT_FETCH_TIMEOUT_MS = 9_000

export const PLATFORM_GROWTH_INBOX_MAX_CONCURRENT_FETCHES = 2

export class PlatformGrowthClientFetchTimeoutError extends Error {
  constructor(message = "Platform Growth request timed out") {
    super(message)
    this.name = "PlatformGrowthClientFetchTimeoutError"
  }
}

let inboxConcurrentFetches = 0
const inboxFetchWaiters: Array<() => void> = []

async function acquireInboxFetchSlot(): Promise<void> {
  if (inboxConcurrentFetches < PLATFORM_GROWTH_INBOX_MAX_CONCURRENT_FETCHES) {
    inboxConcurrentFetches += 1
    return
  }

  await new Promise<void>((resolve) => {
    inboxFetchWaiters.push(resolve)
  })
  inboxConcurrentFetches += 1
}

function releaseInboxFetchSlot(): void {
  inboxConcurrentFetches = Math.max(0, inboxConcurrentFetches - 1)
  const next = inboxFetchWaiters.shift()
  if (next) next()
}

export async function fetchPlatformGrowthClient(
  input: RequestInfo | URL,
  init?: RequestInit & { timeoutMs?: number; useInboxConcurrencyLimit?: boolean },
): Promise<Response> {
  const timeoutMs = init?.timeoutMs ?? PLATFORM_GROWTH_CLIENT_FETCH_TIMEOUT_MS
  const useInboxConcurrencyLimit = init?.useInboxConcurrencyLimit ?? false
  const { timeoutMs: _t, useInboxConcurrencyLimit: _u, ...fetchInit } = init ?? {}

  if (useInboxConcurrencyLimit) {
    await acquireInboxFetchSlot()
  }

  auditGrowthInboxFetch(input, init)

  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(input, {
      ...fetchInit,
      signal: fetchInit.signal ?? controller.signal,
    })
    return response
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new PlatformGrowthClientFetchTimeoutError()
    }
    throw error
  } finally {
    window.clearTimeout(timeoutId)
    if (useInboxConcurrencyLimit) {
      releaseInboxFetchSlot()
    }
  }
}
