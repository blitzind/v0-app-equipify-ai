"use client"

import { useEffect, useState } from "react"

/**
 * Browser online/offline (Phase 53B). Does not guarantee API reachability.
 */
export function useNetworkStatus(): { online: boolean } {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  )

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener("online", on)
    window.addEventListener("offline", off)
    return () => {
      window.removeEventListener("online", on)
      window.removeEventListener("offline", off)
    }
  }, [])

  return { online }
}
