"use client"

import { useEffect, useRef } from "react"

/**
 * Opens the browser print dialog once after mount (print route: data is already rendered).
 */
export function InvoicePrintAutoTrigger() {
  const fired = useRef(false)
  useEffect(() => {
    if (fired.current) return
    fired.current = true
    const id = window.setTimeout(() => {
      window.print()
    }, 400)
    return () => window.clearTimeout(id)
  }, [])
  return null
}
