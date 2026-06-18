"use client"

import { useCallback, useState } from "react"
import type { GrowthVideoAsset, GrowthVideoAssetStatus } from "@/lib/growth/videos/growth-video-types"

const API_BASE = "/api/growth/videos/assets"

export function useGrowthVideoAssets() {
  const [items, setItems] = useState<GrowthVideoAsset[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (input?: { status?: GrowthVideoAssetStatus; search?: string }) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (input?.status) params.set("status", input.status)
      if (input?.search) params.set("search", input.search)
      const res = await fetch(`${API_BASE}?${params.toString()}`)
      const data = (await res.json()) as { ok?: boolean; items?: GrowthVideoAsset[]; error?: string }
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Failed to load videos")
        setItems([])
        return
      }
      setItems(data.items ?? [])
    } catch {
      setError("Failed to load videos")
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  return { items, loading, error, load, setItems }
}

export async function fetchGrowthVideoAsset(assetId: string): Promise<{
  ok: boolean
  asset?: GrowthVideoAsset
  playbackUrl?: string | null
  error?: string
}> {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(assetId)}`)
  const data = (await res.json()) as {
    ok?: boolean
    asset?: GrowthVideoAsset
    playbackUrl?: string | null
    error?: string
  }
  if (!res.ok || !data.ok || !data.asset) {
    return { ok: false, error: data.error ?? "not_found" }
  }
  return { ok: true, asset: data.asset, playbackUrl: data.playbackUrl }
}

export async function uploadGrowthVideoFile(input: {
  title: string
  description?: string
  file: File
  onProgress?: (state: string) => void
}): Promise<{ ok: boolean; asset?: GrowthVideoAsset; error?: string }> {
  input.onProgress?.("creating_asset")
  const createRes = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: input.title,
      description: input.description ?? null,
      original_filename: input.file.name,
      mime_type: input.file.type,
      file_size_bytes: input.file.size,
      source_type: "upload",
    }),
  })
  const created = (await createRes.json()) as { ok?: boolean; asset?: GrowthVideoAsset; error?: string }
  if (!createRes.ok || !created.ok || !created.asset) {
    return { ok: false, error: created.error ?? "create_failed" }
  }

  input.onProgress?.("requesting_upload_url")
  const urlRes = await fetch(`${API_BASE}/${created.asset.id}/upload-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mime_type: input.file.type,
      file_size_bytes: input.file.size,
    }),
  })
  const urlData = (await urlRes.json()) as { ok?: boolean; uploadUrl?: string; error?: string }
  if (!urlRes.ok || !urlData.ok || !urlData.uploadUrl) {
    return { ok: false, error: urlData.error ?? "upload_url_failed" }
  }

  input.onProgress?.("uploading")
  const uploadRes = await fetch(urlData.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": input.file.type },
    body: input.file,
  })
  if (!uploadRes.ok) {
    return { ok: false, error: "storage_upload_failed" }
  }

  input.onProgress?.("completing")
  const completeRes = await fetch(`${API_BASE}/${created.asset.id}/complete-upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_size_bytes: input.file.size }),
  })
  const completeData = (await completeRes.json()) as { ok?: boolean; asset?: GrowthVideoAsset; error?: string }
  if (!completeRes.ok || !completeData.ok || !completeData.asset) {
    return { ok: false, error: completeData.error ?? "complete_failed" }
  }

  input.onProgress?.("done")
  return { ok: true, asset: completeData.asset }
}
