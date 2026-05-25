/** Client-safe browser mic compatibility checks (Growth Engine slice 6.12F). */

export type BrowserAudioCaptureEnvironment = {
  supported: boolean
  hasMediaDevices: boolean
  hasGetUserMedia: boolean
  hasGetDisplayMedia: boolean
  hasMediaRecorder: boolean
  preferredMimeType: string | null
  blockedReason: string | null
  meetingCaptureSupported: boolean
  meetingCaptureBlockedReason: string | null
}

export function evaluateBrowserAudioCaptureEnvironment(): BrowserAudioCaptureEnvironment {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      supported: false,
      hasMediaDevices: false,
      hasGetUserMedia: false,
      hasGetDisplayMedia: false,
      hasMediaRecorder: false,
      preferredMimeType: null,
      blockedReason: "Browser microphone capture is not available in this environment.",
      meetingCaptureSupported: false,
      meetingCaptureBlockedReason: "Meeting capture is not available in this environment.",
    }
  }

  const hasMediaDevices = Boolean(navigator.mediaDevices)
  const hasGetUserMedia = Boolean(navigator.mediaDevices?.getUserMedia)
  const hasGetDisplayMedia = Boolean(navigator.mediaDevices?.getDisplayMedia)
  const hasMediaRecorder = typeof MediaRecorder !== "undefined"

  if (!hasMediaDevices || !hasGetUserMedia) {
    return {
      supported: false,
      hasMediaDevices,
      hasGetUserMedia,
      hasGetDisplayMedia,
      hasMediaRecorder,
      preferredMimeType: null,
      blockedReason: "This browser does not expose microphone capture APIs.",
      meetingCaptureSupported: hasGetDisplayMedia,
      meetingCaptureBlockedReason: hasGetDisplayMedia
        ? null
        : "This browser does not expose tab or system audio capture.",
    }
  }

  if (!hasMediaRecorder) {
    return {
      supported: false,
      hasMediaDevices,
      hasGetUserMedia,
      hasGetDisplayMedia,
      hasMediaRecorder,
      preferredMimeType: null,
      blockedReason: "This browser does not support live audio chunk recording.",
      meetingCaptureSupported: false,
      meetingCaptureBlockedReason: "This browser does not support live audio chunk recording.",
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
      hasGetDisplayMedia,
      hasMediaRecorder,
      preferredMimeType: null,
      blockedReason: "This browser does not support a compatible live audio format.",
      meetingCaptureSupported: hasGetDisplayMedia,
      meetingCaptureBlockedReason: hasGetDisplayMedia
        ? "This browser does not support a compatible live audio format."
        : "This browser does not expose tab or system audio capture.",
    }
  }

  return {
    supported: true,
    hasMediaDevices,
    hasGetUserMedia,
    hasGetDisplayMedia,
    hasMediaRecorder,
    preferredMimeType,
    blockedReason: null,
    meetingCaptureSupported: hasGetDisplayMedia,
    meetingCaptureBlockedReason: hasGetDisplayMedia
      ? null
      : "This browser does not expose tab or system audio capture.",
  }
}
