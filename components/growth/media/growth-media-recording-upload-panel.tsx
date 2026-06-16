"use client"

import { useCallback, useState } from "react"
import { Button } from "@/components/ui/button"
import { GrowthMediaWebcamRecorder, type GrowthMediaWebcamRecorderResult } from "@/components/growth/media/growth-media-webcam-recorder"
import {
  type GrowthMediaWebcamRecordingPhase,
} from "@/lib/growth/media/media-webcam-recording-types"
import type { GrowthMediaVideoAssetSummary } from "@/lib/growth/media/media-video-upload-types"
import { uploadRecordedVideoBlob } from "@/lib/growth/media/media-webcam-recording-utils"

export function GrowthMediaRecordingUploadPanel({
  disabled,
  title,
  onUploadComplete,
}: {
  disabled?: boolean
  title?: string
  onUploadComplete: (
    assetId: string,
    asset: GrowthMediaVideoAssetSummary,
    sourceBlob?: Blob | null,
  ) => void
}) {
  const [phase, setPhase] = useState<GrowthMediaWebcamRecordingPhase>("idle")
  const [recording, setRecording] = useState<GrowthMediaWebcamRecorderResult | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [successAsset, setSuccessAsset] = useState<GrowthMediaVideoAssetSummary | null>(null)

  const handleRecorded = useCallback((result: GrowthMediaWebcamRecorderResult) => {
    setRecording(result)
    setError(null)
    setSuccessAsset(null)
  }, [])

  const uploadRecording = useCallback(async () => {
    if (!recording || disabled) return
    setPhase("uploading")
    setError(null)
    setUploadProgress(0)

    try {
      const result = await uploadRecordedVideoBlob({
        blob: recording.blob,
        mimeType: recording.mimeType,
        durationSeconds: recording.durationSeconds,
        width: recording.width,
        height: recording.height,
        title,
        onProgress: setUploadProgress,
      })
      setSuccessAsset(result.asset)
      setPhase("success")
      onUploadComplete(result.assetId, result.asset, recording.blob)
    } catch (caught) {
      setPhase("failure")
      setError(caught instanceof Error ? caught.message : "Upload failed.")
    }
  }, [disabled, onUploadComplete, recording, title])

  const resetAll = useCallback(() => {
    setRecording(null)
    setUploadProgress(0)
    setError(null)
    setSuccessAsset(null)
    setPhase("idle")
  }, [])

  return (
    <div className="space-y-3">
      <GrowthMediaWebcamRecorder
        disabled={disabled || phase === "uploading" || phase === "success"}
        onRecorded={handleRecorded}
        onRecordingReset={() => {
          setRecording(null)
          setError(null)
          setSuccessAsset(null)
        }}
        onPhaseChange={setPhase}
      />

      {recording && phase === "recorded" ? (
        <Button type="button" size="sm" disabled={disabled} onClick={() => void uploadRecording()}>
          Upload recording
        </Button>
      ) : null}

      {phase === "uploading" ? (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Uploading via signed URL… {uploadProgress}%</p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      ) : null}

      {phase === "success" && successAsset ? (
        <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Upload complete</p>
          <p>Asset id: {successAsset.id}</p>
          <p>
            {successAsset.originalFilename ?? successAsset.title} · {successAsset.mimeType ?? "video"} ·{" "}
            {successAsset.fileSizeBytes != null ? `${successAsset.fileSizeBytes} bytes` : "size pending"}
          </p>
          {successAsset.durationSeconds != null ? (
            <p>Duration: {successAsset.durationSeconds}s</p>
          ) : null}
          <Button type="button" size="sm" variant="outline" className="mt-2" onClick={resetAll}>
            Record another
          </Button>
        </div>
      ) : null}

      {phase === "failure" && error ? (
        <div className="space-y-2">
          <p className="text-xs text-destructive">{error}</p>
          {recording ? (
            <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => void uploadRecording()}>
              Retry upload
            </Button>
          ) : null}
        </div>
      ) : null}

      <p className="text-[11px] text-muted-foreground">
        Upload uses the S2-A signed-upload pipeline — thumbnail generation is available after upload (S2-C).
      </p>
    </div>
  )
}
