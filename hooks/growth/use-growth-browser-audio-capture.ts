"use client"

import { useCallback, useEffect, useReducer, useRef, useState } from "react"
import { GROWTH_CALL_AUDIO_CAPTURE_ENABLED } from "@/lib/growth/call-workflow-copy"
import {
  createBrowserAudioMixer,
  extractAudioOnlyStream,
  type BrowserAudioMixerHandle,
} from "@/lib/growth/realtime/browser-audio/browser-audio-mixer"
import { evaluateBrowserAudioCaptureEnvironment } from "@/lib/growth/realtime/browser-audio/browser-audio-browser-compat"
import { browserAudioCaptureReducer } from "@/lib/growth/realtime/browser-audio/browser-audio-capture-reducer"
import { canStartBrowserAudioCaptureGuard } from "@/lib/growth/realtime/browser-audio/browser-audio-capture-guards"
import type { GrowthBrowserAudioCaptureCapability } from "@/lib/growth/realtime/browser-audio/browser-audio-capture-types"
import { initialBrowserAudioCaptureState } from "@/lib/growth/realtime/browser-audio/browser-audio-capture-types"
import type { GrowthBrowserAudioStreamState } from "@/lib/growth/realtime/browser-audio/browser-audio-stream-types"
import {
  detectMeetingProviderFromDisplayMedia,
} from "@/lib/growth/realtime/browser-audio/meeting-provider-detection"
import {
  resolveMeetingCaptureSourceMode,
  type GrowthMeetingProvider,
} from "@/lib/growth/realtime/browser-audio/meeting-capture-types"
import {
  BROWSER_AUDIO_TROUBLESHOOTING,
  resolveMeetingCapturePermissionError,
  resolveMicrophonePermissionError,
} from "@/lib/growth/realtime/browser-audio/browser-audio-troubleshooting"
import type { GrowthRealtimeCallSession } from "@/lib/growth/realtime/realtime-call-types"

type UseGrowthBrowserAudioCaptureInput = {
  leadId: string
  session: GrowthRealtimeCallSession | null
  capability: GrowthBrowserAudioCaptureCapability | null
  onSessionUpdated?: (session: GrowthRealtimeCallSession) => void
}

type CaptureUiMode = "microphone" | "meeting_mode"

type SyncPayload = {
  action: "request" | "start" | "pause" | "stop" | "fail" | "retry"
  error?: string
  captureSourceMode?: string
  meetingProvider?: GrowthMeetingProvider | null
  mixedAudioEnabled?: boolean
  meetingAudioActive?: boolean
  microphoneActive?: boolean
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result
      if (typeof result !== "string") {
        reject(new Error("Could not encode audio chunk."))
        return
      }
      const base64 = result.split(",")[1]
      if (!base64) {
        reject(new Error("Could not encode audio chunk."))
        return
      }
      resolve(base64)
    }
    reader.onerror = () => reject(new Error("Could not read audio chunk."))
    reader.readAsDataURL(blob)
  })
}

function stopMediaTracks(stream: MediaStream | null) {
  if (!stream) return
  for (const track of stream.getTracks()) {
    track.stop()
  }
}

export function useGrowthBrowserAudioCapture({
  leadId,
  session,
  capability,
  onSessionUpdated,
}: UseGrowthBrowserAudioCaptureInput) {
  const [state, dispatch] = useReducer(browserAudioCaptureReducer, undefined, initialBrowserAudioCaptureState)
  const [streamState, setStreamState] = useState<GrowthBrowserAudioStreamState | null>(null)
  const [captureUiMode, setCaptureUiMode] = useState<CaptureUiMode>("microphone")
  const [includeMicrophoneInMeeting, setIncludeMicrophoneInMeeting] = useState(true)

  const streamRef = useRef<MediaStream | null>(null)
  const displayStreamRef = useRef<MediaStream | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const mixerRef = useRef<BrowserAudioMixerHandle | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const sequenceRef = useRef(0)
  const mutedRef = useRef(false)
  const startingRef = useRef(false)
  const boundSessionIdRef = useRef<string | null>(null)

  const cleanupCapture = useCallback(() => {
    recorderRef.current?.stop()
    recorderRef.current = null
    mixerRef.current?.destroy()
    mixerRef.current = null
    stopMediaTracks(streamRef.current)
    stopMediaTracks(displayStreamRef.current)
    stopMediaTracks(micStreamRef.current)
    streamRef.current = null
    displayStreamRef.current = null
    micStreamRef.current = null
  }, [])

  useEffect(() => {
    mutedRef.current = state.muted
  }, [state.muted])

  useEffect(() => {
    return () => {
      cleanupCapture()
      dispatch({ type: "reset" })
    }
  }, [cleanupCapture])

  useEffect(() => {
    if (!session) {
      boundSessionIdRef.current = null
      return
    }

    if (boundSessionIdRef.current && boundSessionIdRef.current !== session.id) {
      cleanupCapture()
      dispatch({ type: "reset" })
      setStreamState(null)
      dispatch({
        type: "capture_failed",
        error: BROWSER_AUDIO_TROUBLESHOOTING.staleSession,
      })
    }

    boundSessionIdRef.current = session.id
  }, [session?.id, cleanupCapture])

  useEffect(() => {
    if (!session || session.status === "completed" || session.status === "discarded") {
      cleanupCapture()
      dispatch({ type: "capture_stopped" })
      setStreamState(null)
      if (session && (session.status === "completed" || session.status === "discarded")) {
        void syncStatus({ action: "stop" }).catch(() => undefined)
      }
    }
  }, [session?.id, session?.status, cleanupCapture])

  async function syncStatus(payload: SyncPayload) {
    if (!session) return null
    const res = await fetch(
      `/api/platform/growth/leads/${leadId}/realtime-call/sessions/${session.id}/browser-audio-capture`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    )
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      session?: GrowthRealtimeCallSession
      stream?: GrowthBrowserAudioStreamState
      message?: string
      error?: string
    }
    if (!res.ok || !data.ok || !data.session) {
      throw new Error(data.message ?? data.error ?? "Could not update capture status.")
    }
    if (data.stream) setStreamState(data.stream)
    onSessionUpdated?.(data.session)
    return data.session
  }

  async function sendChunk(blob: Blob, encoding: string) {
    if (!session || mutedRef.current || blob.size === 0) return
    if (boundSessionIdRef.current && boundSessionIdRef.current !== session.id) return
    const started = Date.now()
    try {
      const payloadBase64 = await blobToBase64(blob)
      const res = await fetch(
        `/api/platform/growth/leads/${leadId}/realtime-call/sessions/${session.id}/audio-chunk`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            encoding,
            payloadBase64,
            sequenceNumber: sequenceRef.current,
            timestampMs: Date.now(),
            durationMs: 250,
          }),
        },
      )
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string }
      if (!res.ok || !data.ok) {
        dispatch({ type: "chunk_failed" })
        throw new Error(data.message ?? data.error ?? "Could not send audio chunk.")
      }
      sequenceRef.current += 1
      dispatch({
        type: "chunk_sent",
        latencyMs: Date.now() - started,
      })
    } catch {
      dispatch({ type: "chunk_failed" })
    }
  }

  function startRecorder(stream: MediaStream, mimeType: string) {
    const recorder = new MediaRecorder(stream, { mimeType })
    recorderRef.current = recorder
    sequenceRef.current = 0
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        void sendChunk(event.data, mimeType).catch(() => undefined)
      }
    }
    recorder.onerror = () => {
      dispatch({ type: "capture_failed", error: "Audio capture failed." })
      void syncStatus({ action: "fail", error: "Audio capture failed." }).catch(() => undefined)
      cleanupCapture()
    }
    recorder.start(250)
  }

  const startCapture = useCallback(async () => {
    if (!GROWTH_CALL_AUDIO_CAPTURE_ENABLED || !session || !capability?.canStart) return

    const startGuard = canStartBrowserAudioCaptureGuard({
      captureStatus: state.status,
      starting: startingRef.current,
    })
    if (!startGuard.allowed) {
      dispatch({
        type: "capture_failed",
        error: BROWSER_AUDIO_TROUBLESHOOTING.doubleStartBlocked,
      })
      return
    }

    const environment = evaluateBrowserAudioCaptureEnvironment()
    if (!environment.supported) {
      dispatch({
        type: "capture_failed",
        error: environment.blockedReason ?? BROWSER_AUDIO_TROUBLESHOOTING.unsupportedBrowser,
      })
      return
    }

    const captureSourceMode = resolveMeetingCaptureSourceMode({
      uiMode: captureUiMode,
      includeMicrophone: includeMicrophoneInMeeting,
    })
    dispatch({
      type: "set_capture_source",
      captureSourceMode,
      mixedAudioEnabled: captureSourceMode === "mixed_audio",
    })

    if (captureUiMode === "meeting_mode" && !environment.meetingCaptureSupported) {
      dispatch({
        type: "capture_failed",
        error:
          environment.meetingCaptureBlockedReason ??
          BROWSER_AUDIO_TROUBLESHOOTING.meetingCaptureUnavailable,
      })
      return
    }

    startingRef.current = true
    dispatch({ type: "request_permission" })
    try {
      await syncStatus({
        action: "request",
        captureSourceMode,
        mixedAudioEnabled: captureSourceMode === "mixed_audio",
      })

      const mimeType = environment.preferredMimeType ?? "audio/webm"
      boundSessionIdRef.current = session.id

      if (captureUiMode === "microphone") {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        streamRef.current = stream
        startRecorder(stream, mimeType)
        await syncStatus({
          action: "start",
          captureSourceMode,
          microphoneActive: true,
          meetingAudioActive: false,
          mixedAudioEnabled: false,
        })
        dispatch({
          type: "meeting_context",
          meetingProvider: null,
          meetingAudioActive: false,
          microphoneActive: true,
          mixedAudioActive: false,
        })
      } else {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        })
        displayStreamRef.current = displayStream

        const meetingAudioStream = extractAudioOnlyStream(displayStream)
        if (!meetingAudioStream) {
          cleanupCapture()
          throw new Error(BROWSER_AUDIO_TROUBLESHOOTING.meetingCaptureFailed)
        }

        const audioTrack = meetingAudioStream.getAudioTracks()[0]
        const meetingProvider = detectMeetingProviderFromDisplayMedia({
          displaySurface: audioTrack?.getSettings().displaySurface ?? null,
          label: audioTrack?.label ?? displayStream.getVideoTracks()[0]?.label ?? null,
        })

        let outputStream = meetingAudioStream
        let microphoneActive = false
        let mixedAudioActive = false

        if (includeMicrophoneInMeeting) {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
          micStreamRef.current = micStream
          microphoneActive = true
          const mixer = createBrowserAudioMixer()
          mixerRef.current = mixer
          mixer.addMeetingSource(meetingAudioStream)
          mixer.addMicrophoneSource(micStream)
          outputStream = mixer.getMixedStream()
          mixedAudioActive = true
        }

        streamRef.current = outputStream
        startRecorder(outputStream, mimeType)

        await syncStatus({
          action: "start",
          captureSourceMode,
          meetingProvider,
          mixedAudioEnabled: mixedAudioActive,
          meetingAudioActive: true,
          microphoneActive,
        })
        dispatch({
          type: "meeting_context",
          meetingProvider,
          meetingAudioActive: true,
          microphoneActive,
          mixedAudioActive,
        })
      }

      dispatch({ type: "capture_active" })
    } catch (e) {
      cleanupCapture()
      const raw = e instanceof Error ? e.message : String(e)
      const message =
        captureUiMode === "meeting_mode"
          ? resolveMeetingCapturePermissionError(raw)
          : resolveMicrophonePermissionError(raw)
      dispatch({ type: "capture_failed", error: message })
      await syncStatus({
        action: "fail",
        error: message,
        captureSourceMode: resolveMeetingCaptureSourceMode({
          uiMode: captureUiMode,
          includeMicrophone: includeMicrophoneInMeeting,
        }),
      }).catch(() => undefined)
    } finally {
      startingRef.current = false
    }
  }, [
    capability?.canStart,
    captureUiMode,
    cleanupCapture,
    includeMicrophoneInMeeting,
    session,
    state.status,
    leadId,
  ])

  const pauseCapture = useCallback(async () => {
    if (!session) return
    recorderRef.current?.pause()
    cleanupCapture()
    await syncStatus({ action: "pause" })
    dispatch({ type: "capture_paused" })
  }, [cleanupCapture, session, leadId])

  const stopCapture = useCallback(async () => {
    if (!session) return
    cleanupCapture()
    await syncStatus({
      action: "stop",
      captureSourceMode: state.captureSourceMode,
    })
    dispatch({ type: "capture_stopped" })
  }, [cleanupCapture, session, state.captureSourceMode, leadId])

  const toggleMute = useCallback(() => {
    dispatch({ type: "set_muted", muted: !state.muted })
  }, [state.muted])

  const retryStream = useCallback(async () => {
    if (!session || !streamState?.metrics.canRetry) return
    try {
      await syncStatus({ action: "retry", captureSourceMode: state.captureSourceMode })
      dispatch({ type: "capture_active" })
    } catch (e) {
      dispatch({
        type: "capture_failed",
        error: e instanceof Error ? e.message : "Could not reconnect provider stream.",
      })
    }
  }, [session, state.captureSourceMode, streamState?.metrics.canRetry, leadId])

  return {
    state,
    streamState,
    captureUiMode,
    includeMicrophoneInMeeting,
    setCaptureUiMode,
    setIncludeMicrophoneInMeeting,
    startCapture,
    pauseCapture,
    stopCapture,
    toggleMute,
    retryStream,
    isMicActive: state.status === "active" && state.microphoneActive,
    isMeetingAudioActive: state.status === "active" && state.meetingAudioActive,
    isMixedAudioActive: state.status === "active" && state.mixedAudioActive,
    isCaptureActive: state.status === "active",
  }
}
