/** Interruption detection and recovery — Phase 4A. */

export type InterruptionAnalysis = {
  interrupted: boolean
  cancelPendingResponse: boolean
  evidenceText: string
}

export function analyzeInterruption(input: {
  callerSpeaking: boolean
  aiSpeaking: boolean
  lastCallerSegmentMs: number
  overlapThresholdMs?: number
}): InterruptionAnalysis {
  const threshold = input.overlapThresholdMs ?? 300
  const interrupted = input.callerSpeaking && input.aiSpeaking
  const recentCaller = input.lastCallerSegmentMs < threshold

  if (interrupted || recentCaller) {
    return {
      interrupted: true,
      cancelPendingResponse: true,
      evidenceText: interrupted
        ? "Caller speech overlapped AI response — cancel pending TTS."
        : "Recent caller segment during AI turn — yield to caller.",
    }
  }

  return { interrupted: false, cancelPendingResponse: false, evidenceText: "" }
}

export function buildInterruptionRecoveryPrompt(): string {
  return "Sorry, go ahead — I'm listening."
}
