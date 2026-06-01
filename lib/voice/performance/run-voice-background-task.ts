import "server-only"

import { after } from "next/server"
import { waitUntil } from "@vercel/functions"
import { logVoiceInfrastructure } from "@/lib/voice/telemetry"

export function runVoiceBackgroundTask(label: string, task: () => Promise<void>): void {
  const promise = task().catch((error) => {
    logVoiceInfrastructure("voice_provider_health", {
      backgroundTask: label,
      failed: true,
      message: error instanceof Error ? error.message : String(error),
    })
  })

  const scheduled = waitUntil(promise)
  if (!scheduled) {
    after(() => promise)
  }
}
