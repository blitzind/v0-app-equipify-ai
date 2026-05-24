"use client"

import { useCallback, useEffect, useReducer, useRef, useState } from "react"
import { GROWTH_CALL_AUDIO_CAPTURE_ENABLED } from "@/lib/growth/call-workflow-copy"
import { evaluateBrowserAudioCaptureEnvironment } from "@/lib/growth/realtime/browser-audio/browser-audio-browser-compat"
import { browserAudioCaptureReducer } from "@/lib/growth/realtime/browser-audio/browser-audio-capture-reducer"
import {
  canStartBrowserAudioCaptureGuard,
} from "@/lib/growth/realtime/browser-audio/browser-audio-capture-guards"
import type { GrowthBrowserAudioCaptureCapability } from "@/lib/growth/realtime/browser-audio/browser-audio-capture-types"
import { initialBrowserAudioCaptureState } from "@/lib/growth/realtime/browser-audio/browser-audio-capture-types"
import type { GrowthBrowserAudioStreamState } from "@/lib/growth/realtime/browser-audio/browser-audio-stream-types"
import {
  BROWSER_AUDIO_TROUBLESHOOTING,
  resolveMicrophonePermissionError,
} from "@/lib/growth/realtime/browser-audio/browser-audio-troubleshooting"
import type { GrowthRealtimeCallSession } from "@/lib/growth/realtime/realtime-call-types"

type UseGrowthBrowserAudioCaptureInput = {
  leadId: string
  session: GrowthRealtimeCallSession | null
  capability: GrowthBrowserAudioCaptureCapability | null
  onSessionUpdated?: (session: GrowthRealtimeCallSession) => void
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
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const sequenceRef = useRef(0)
  const mutedRef = useRef(false)
  const startingRef = useRef(false)
  const boundSessionIdRef = useRef<string | null>(null)

  const cleanupCapture = useCallback(() => {
    recorderRef.current?.stop()
    recorderRef.current = null
    stopMediaTracks(streamRef.current)
    streamRef.current = null
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
        void syncStatus("stop").catch(() => undefined)
      }
    }
  }, [session?.id, session?.status, cleanupCapture])

  async function syncStatus(action: "request" | "start" | "pause" | "stop" | "fail" | "retry", error?: string) {
    if (!session) return null
    const res = await fetch(
      `/api/platform/growth/leads/${leadId}/realtime-call/sessions/${session.id}/browser-audio-capture`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, error: error ?? null }),
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
      throw new Error(data.message ?? data.error ?? "Could not update mic capture status.")
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
    } catch (e) {
      dispatch({ type: "chunk_failed" })
      throw e
    }
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

    startingRef.current = true
    dispatch({ type: "request_permission" })
    try {
      await syncStatus("request")
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = environment.preferredMimeType ?? "audio/webm"
      const recorder = new MediaRecorder(stream, { mimeType })
      recorderRef.current = recorder
      sequenceRef.current = 0
      boundSessionIdRef.current = session.id

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          void sendChunk(event.data, mimeType).catch(() => undefined)
        }
      }

      recorder.onerror = () => {
        dispatch({ type: "capture_failed", error: "Microphone capture failed." })
        void syncStatus("fail", "Microphone capture failed.").catch(() => undefined)
        cleanupCapture()
      }

      recorder.start(250)
      await syncStatus("start")
      dispatch({ type: "capture_active" })
    } catch (e) {
      cleanupCapture()
      const message = resolveMicrophonePermissionError(
        e instanceof Error ? e.message : BROWSER_AUDIO_TROUBLESHOOTING.microphonePermissionDenied,
      )
      dispatch({ type: "capture_failed", error: message })
      await syncStatus("fail", message).catch(() => undefined)
    } finally {
      startingRef.current = false
    }
  }, [capability?.canStart, cleanupCapture, session, state.status, leadId])

  const pauseCapture = useCallback(async () => {
    if (!session) return
    recorderRef.current?.pause()
    stopMediaTracks(streamRef.current)
    streamRef.current = null
    await syncStatus("pause")
    dispatch({ type: "capture_paused" })
  }, [session, leadId])

  const stopCapture = useCallback(async () => {
    if (!session) return
    cleanupCapture()
    await syncStatus("stop")
    dispatch({ type: "capture_stopped" })
  }, [cleanupCapture, session, leadId])

  const toggleMute = useCallback(() => {
    dispatch({ type: "set_muted", muted: !state.muted })
  }, [state.muted])

  const retryStream = useCallback(async () => {
    if (!session || !streamState?.metrics.canRetry) return
    try {
      await syncStatus("retry")
      dispatch({ type: "capture_active" })
    } catch (e) {
      dispatch({
        type: "capture_failed",
        error: e instanceof Error ? e.message : "Could not reconnect provider stream.",
      })
    }
  }, [session, streamState?.metrics.canRetry, leadId])

  return {
    state,
    streamState,
    startCapture,
    pauseCapture,
    stopCapture,
    toggleMute,
    retryStream,
    isMicActive: state.status === "active",
  }
}
