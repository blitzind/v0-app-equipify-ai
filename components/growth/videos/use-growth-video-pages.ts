"use client"

import { useCallback, useState } from "react"
import type { GrowthVideoAsset, GrowthVideoPage } from "@/lib/growth/videos/growth-video-types"

const PAGES_API = "/api/growth/videos/pages"

export function useGrowthVideoPages() {
  const [items, setItems] = useState<GrowthVideoPage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (query?: { status?: string; search?: string }) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (query?.status) params.set("status", query.status)
      if (query?.search?.trim()) params.set("search", query.search.trim())
      const res = await fetch(`${PAGES_API}?${params.toString()}`)
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        items?: GrowthVideoPage[]
        message?: string
      }
      if (!res.ok || !data.ok || !data.items) {
        throw new Error(data.message ?? "Could not load video pages.")
      }
      setItems(data.items)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [])

  return { items, loading, error, load }
}

export function useGrowthVideoAssetsForPages() {
  const [assets, setAssets] = useState<GrowthVideoAsset[]>([])
  const [loading, setLoading] = useState(false)

  const loadAssets = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/growth/videos/assets?status=ready&limit=100")
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; items?: GrowthVideoAsset[] }
      if (res.ok && data.ok && data.items) setAssets(data.items)
    } finally {
      setLoading(false)
    }
  }, [])

  return { assets, loading, loadAssets }
}
