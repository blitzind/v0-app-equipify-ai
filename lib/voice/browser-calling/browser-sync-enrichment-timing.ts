import "server-only"

import { logVoiceInfrastructure } from "@/lib/voice/telemetry"

export type BrowserSyncEnrichmentTimingStep = {
  step: string
  durationMs: number
  timedOut?: boolean
}

export class BrowserSyncEnrichmentTimer {
  private readonly startedAt = Date.now()
  private readonly steps: BrowserSyncEnrichmentTimingStep[] = []
  private readonly context: Record<string, unknown>

  constructor(context: Record<string, unknown> = {}) {
    this.context = context
  }

  async measure<T>(step: string, fn: () => Promise<T>, extra?: { timedOut?: boolean }): Promise<T> {
    const stepStartedAt = Date.now()
    try {
      return await fn()
    } finally {
      const durationMs = Date.now() - stepStartedAt
      const entry: BrowserSyncEnrichmentTimingStep = { step, durationMs, timedOut: extra?.timedOut }
      this.steps.push(entry)
      logVoiceInfrastructure("voice_browser_sync_enrichment_step", {
        step,
        durationMs,
        timedOut: extra?.timedOut ?? false,
        elapsedMs: Date.now() - this.startedAt,
        ...this.context,
      })
    }
  }

  finish(outcome: string, extra?: Record<string, unknown>): void {
    logVoiceInfrastructure("voice_browser_sync_enrichment_timing", {
      outcome,
      totalDurationMs: Date.now() - this.startedAt,
      steps: this.steps,
      ...this.context,
      ...extra,
    })
  }

  snapshot(): BrowserSyncEnrichmentTimingStep[] {
    return [...this.steps]
  }
}
