"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  evaluateWebcamRecordingEnvironment,
  formatRecordingDuration,
  normalizeRecordedVideoMimeType,
} from "@/lib/growth/media/media-webcam-recording-utils"
import type { GrowthMediaWebcamRecordingPhase } from "@/lib/growth/media/media-webcam-recording-types"

export type GrowthMediaWebcamRecorderResult = {
  blob: Blob
  mimeType: string
  durationSeconds: number
  width: number | null
  height: number | null
}

export function GrowthMediaWebcamRecorder({
  disabled,
  onRecorded,
  onRecordingReset,
  onPhaseChange,
}: {
  disabled?: boolean
  onRecorded: (result: GrowthMediaWebcamRecorderResult) => void
  onRecordingReset?: () => void
  onPhaseChange?: (phase: GrowthMediaWebcamRecordingPhase) => void
}) {
  const env = evaluateWebcamRecordingEnvironment()
  const [phase, setPhase] = useState<GrowthMediaWebcamRecordingPhase>(
    env.supported ? "ready" : "unsupported",
  )
  const [error, setError] = useState<string | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [recordedSummary, setRecordedSummary] = useState<GrowthMediaWebcamRecorderResult | null>(null)

  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const previewRef = useRef<HTMLVideoElement | null>(null)
  const timerRef = useRef<number | null>(null)
  const startedAtRef = useRef<number | null>(null)

  const setPhaseSafe = useCallback(
    (next: GrowthMediaWebcamRecordingPhase) => {
      setPhase(next)
      onPhaseChange?.(next)
    },
    [onPhaseChange],
  )

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (previewRef.current) {
      previewRef.current.srcObject = null
    }
  }, [])

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      clearTimer()
      recorderRef.current?.stop()
      stopTracks()
    }
  }, [clearTimer, stopTracks])

  const ensureStream = useCallback(async (): Promise<MediaStream> => {
    if (streamRef.current) return streamRef.current
    setPhaseSafe("ready")
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: true,
      })
      streamRef.current = stream
      if (previewRef.current) {
        previewRef.current.srcObject = stream
        await previewRef.current.play().catch(() => undefined)
      }
      setPhaseSafe("ready")
      return stream
    } catch (caught) {
      const denied =
        caught instanceof DOMException &&
        (caught.name === "NotAllowedError" || caught.name === "PermissionDeniedError")
      setPhaseSafe(denied ? "permission_denied" : "failure")
      setError(
        denied
          ? "Camera/microphone permission was denied. Allow access in browser settings and retry."
          : "Could not access the webcam.",
      )
      stopTracks()
      throw caught
    }
  }, [setPhaseSafe, stopTracks])

  const startRecording = useCallback(async () => {
    if (disabled || !env.supported || !env.preferredMimeType) return
    setError(null)
    setRecordedSummary(null)
    chunksRef.current = []

    try {
      const stream = await ensureStream()
      const recorder = new MediaRecorder(stream, { mimeType: env.preferredMimeType })
      recorderRef.current = recorder

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }

      recorder.onstop = () => {
        clearTimer()
        const blob = new Blob(chunksRef.current, { type: env.preferredMimeType ?? "video/webm" })
        const trackSettings = stream.getVideoTracks()[0]?.getSettings()
        const durationSeconds = startedAtRef.current
          ? Math.max(0, (Date.now() - startedAtRef.current) / 1000)
          : elapsedSeconds
        const result: GrowthMediaWebcamRecorderResult = {
          blob,
          mimeType: env.preferredMimeType ?? blob.type,
          durationSeconds,
          width: trackSettings?.width ?? null,
          height: trackSettings?.height ?? null,
        }
        setRecordedSummary(result)
        setPhaseSafe("recorded")
        stopTracks()
        onRecorded(result)
      }

      recorder.onerror = () => {
        setPhaseSafe("failure")
        setError("Recording failed in this browser.")
        clearTimer()
        stopTracks()
      }

      startedAtRef.current = Date.now()
      setElapsedSeconds(0)
      timerRef.current = window.setInterval(() => {
        if (startedAtRef.current) {
          setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000))
        }
      }, 250)

      recorder.start(250)
      setPhaseSafe("recording")
    } catch {
      // error state already set in ensureStream
    }
  }, [
    clearTimer,
    disabled,
    elapsedSeconds,
    ensureStream,
    env.preferredMimeType,
    env.supported,
    onRecorded,
    setPhaseSafe,
    stopTracks,
  ])

  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop()
      recorderRef.current = null
    }
  }, [])

  const discardRecording = useCallback(() => {
    chunksRef.current = []
    setRecordedSummary(null)
    setElapsedSeconds(0)
    setError(null)
    stopTracks()
    onRecordingReset?.()
    setPhaseSafe(env.supported ? "ready" : "unsupported")
  }, [env.supported, onRecordingReset, setPhaseSafe, stopTracks])

  const retryRecording = useCallback(() => {
    discardRecording()
    void startRecording()
  }, [discardRecording, startRecording])

  if (!env.supported) {
    return (
      <div className="space-y-2 rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Webcam recording unavailable</p>
        <p>{env.blockedReason ?? "This browser cannot record video."}</p>
        <p>{env.browserSupportNote}</p>
      </div>
    )
  }

  const normalizedMime = env.normalizedMimeType
    ? normalizeRecordedVideoMimeType(env.normalizedMimeType)
    : null

  return (
    <div className="space-y-3 rounded-md border border-dashed border-border p-3">
      <div className="space-y-1">
        <p className="text-sm font-medium">Webcam recorder (S2-B)</p>
        <p className="text-xs text-muted-foreground">
          Live preview only while recording — no hosted playback, thumbnails, or AI generation.
        </p>
        <p className="text-xs text-muted-foreground">{env.browserSupportNote}</p>
        {normalizedMime ? (
          <p className="text-xs text-muted-foreground">
            Recording format: <span className="font-medium text-foreground">{normalizedMime}</span>
            {env.preferredMimeType && env.preferredMimeType !== normalizedMime
              ? ` (${env.preferredMimeType})`
              : null}
          </p>
        ) : null}
      </div>

      {phase === "permission_denied" ? (
        <p className="text-xs text-destructive">
          {error ?? "Camera/microphone permission was denied."}
        </p>
      ) : null}

      {phase === "recording" || phase === "ready" ? (
        <div className="overflow-hidden rounded-md border border-border bg-black/80">
          <video
            ref={previewRef}
            className="aspect-video w-full object-cover"
            muted
            playsInline
            autoPlay
          />
        </div>
      ) : null}

      {phase === "recording" ? (
        <p className="text-xs font-medium text-foreground">
          Recording… {formatRecordingDuration(elapsedSeconds)}
        </p>
      ) : null}

      {phase === "recorded" && recordedSummary ? (
        <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Captured:</span>{" "}
            {formatRecordingDuration(recordedSummary.durationSeconds)} ·{" "}
            {Math.round(recordedSummary.blob.size / 1024)} KB
          </p>
          {recordedSummary.width != null && recordedSummary.height != null ? (
            <p>
              <span className="font-medium text-foreground">Dimensions:</span>{" "}
              {recordedSummary.width}×{recordedSummary.height}
            </p>
          ) : null}
        </div>
      ) : null}

      {error && phase !== "permission_denied" ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {phase === "ready" || phase === "idle" ? (
          <Button type="button" size="sm" disabled={disabled} onClick={() => void startRecording()}>
            Start recording
          </Button>
        ) : null}
        {phase === "recording" ? (
          <Button type="button" size="sm" variant="destructive" disabled={disabled} onClick={stopRecording}>
            Stop recording
          </Button>
        ) : null}
        {phase === "recorded" ? (
          <>
            <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={discardRecording}>
              Discard
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={retryRecording}>
              Retry recording
            </Button>
          </>
        ) : null}
      </div>
    </div>
  )
}
