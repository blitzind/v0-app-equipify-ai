import "server-only"

import { logVoiceInfrastructure } from "@/lib/voice/telemetry"

export type InboundRoutingBundleTimingStep = {
  step: string
  durationMs: number
}

export class InboundRoutingBundleTimer {
  private readonly startedAt = Date.now()
  private readonly steps: InboundRoutingBundleTimingStep[] = []
  private readonly context: Record<string, unknown>

  constructor(context: Record<string, unknown> = {}) {
    this.context = context
  }

  async measure<T>(step: string, fn: () => Promise<T>): Promise<T> {
    const stepStartedAt = Date.now()
    try {
      return await fn()
    } finally {
      const durationMs = Date.now() - stepStartedAt
      this.steps.push({ step, durationMs })
      logVoiceInfrastructure("voice_inbound_routing_bundle_step", {
        step,
        durationMs,
        elapsedMs: Date.now() - this.startedAt,
        ...this.context,
      })
    }
  }

  finish(outcome: string, extra?: Record<string, unknown>): void {
    logVoiceInfrastructure("voice_inbound_routing_bundle_timing", {
      outcome,
      totalDurationMs: Date.now() - this.startedAt,
      steps: this.steps,
      ...this.context,
      ...extra,
    })
  }

  snapshot(): InboundRoutingBundleTimingStep[] {
    return [...this.steps]
  }
}
