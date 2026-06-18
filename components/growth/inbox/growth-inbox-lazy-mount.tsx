"use client"

import { useEffect, useState, type ReactNode } from "react"

/** Mount children only after `enabled` becomes true (stays mounted once activated). */
export function GrowthInboxLazyMount({
  enabled,
  children,
}: {
  enabled: boolean
  children: ReactNode
}) {
  const [mounted, setMounted] = useState(enabled)

  useEffect(() => {
    if (enabled) setMounted(true)
  }, [enabled])

  if (!mounted) return null
  return <>{children}</>
}
