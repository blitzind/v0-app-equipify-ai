"use client"

import { useEffect } from "react"
import { useSearchParams } from "next/navigation"

const ATTR = "data-equipify-shot"

/**
 * When the app is loaded with `?equipifyShot=1`, sets a root attribute so global CSS can
 * hide floating chrome (billing strip, AIden launcher, etc.) for deterministic marketing captures.
 */
export function ScreenshotModeGate() {
  const searchParams = useSearchParams()
  const enabled = searchParams.get("equipifyShot") === "1"

  useEffect(() => {
    const root = document.documentElement
    if (enabled) {
      root.setAttribute(ATTR, "1")
    } else {
      root.removeAttribute(ATTR)
    }
    return () => {
      root.removeAttribute(ATTR)
    }
  }, [enabled])

  return null
}
