import "server-only"

import { logVoiceInfrastructure } from "@/lib/voice/telemetry"

export type VoiceRouteTimingStep = {
  step: string
  durationMs: number
}

export class VoiceRouteTimer {
  private readonly route: string
  private readonly startedAt = Date.now()
  private readonly steps: VoiceRouteTimingStep[] = []

  constructor(route: string) {
    this.route = route
  }

  async measure<T>(step: string, fn: () => Promise<T>): Promise<T> {
    const stepStartedAt = Date.now()
    try {
      return await fn()
    } finally {
      this.steps.push({ step, durationMs: Date.now() - stepStartedAt })
    }
  }

  finish(extra?: Record<string, unknown>): void {
    logVoiceInfrastructure("voice_provider_health", {
      route: this.route,
      totalDurationMs: Date.now() - this.startedAt,
      steps: this.steps,
      ...extra,
    })
  }
}

export async function withVoiceTimeout<T>(
  label: string,
  timeoutMs: number,
  fn: () => Promise<T>,
  fallback: T,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  try {
    return await Promise.race([
      fn(),
      new Promise<T>((resolve) => {
        timeoutId = setTimeout(() => {
          logVoiceInfrastructure("voice_provider_health", {
            route: label,
            timedOut: true,
            timeoutMs,
          })
          resolve(fallback)
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}
