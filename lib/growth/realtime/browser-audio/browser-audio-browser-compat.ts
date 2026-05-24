/** Client-safe browser mic compatibility checks (Growth Engine slice 6.12F). */

export type BrowserAudioCaptureEnvironment = {
  supported: boolean
  hasMediaDevices: boolean
  hasGetUserMedia: boolean
  hasMediaRecorder: boolean
  preferredMimeType: string | null
  blockedReason: string | null
}

export function evaluateBrowserAudioCaptureEnvironment(): BrowserAudioCaptureEnvironment {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      supported: false,
      hasMediaDevices: false,
      hasGetUserMedia: false,
      hasMediaRecorder: false,
      preferredMimeType: null,
      blockedReason: "Browser microphone capture is not available in this environment.",
    }
  }

  const hasMediaDevices = Boolean(navigator.mediaDevices)
  const hasGetUserMedia = Boolean(navigator.mediaDevices?.getUserMedia)
  const hasMediaRecorder = typeof MediaRecorder !== "undefined"

  if (!hasMediaDevices || !hasGetUserMedia) {
    return {
      supported: false,
      hasMediaDevices,
      hasGetUserMedia,
      hasMediaRecorder,
      preferredMimeType: null,
      blockedReason: "This browser does not expose microphone capture APIs.",
    }
  }

  if (!hasMediaRecorder) {
    return {
      supported: false,
      hasMediaDevices,
      hasGetUserMedia,
      hasMediaRecorder,
      preferredMimeType: null,
      blockedReason: "This browser does not support live audio chunk recording.",
    }
  }

  const preferredMimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
    ? "audio/webm;codecs=opus"
    : MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : null

  if (!preferredMimeType) {
    return {
      supported: false,
      hasMediaDevices,
      hasGetUserMedia,
      hasMediaRecorder,
      preferredMimeType: null,
      blockedReason: "This browser does not support a compatible live audio format.",
    }
  }

  return {
    supported: true,
    hasMediaDevices,
    hasGetUserMedia,
    hasMediaRecorder,
    preferredMimeType,
    blockedReason: null,
  }
}
