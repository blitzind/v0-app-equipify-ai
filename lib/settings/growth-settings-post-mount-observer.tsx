"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"

export const GROWTH_SETTINGS_POST_MOUNT_OBSERVER_QA_MARKER =
  "growth-settings-post-mount-observer-v1" as const

const LOG_PREFIX = "[growth-settings-post-mount-error]"

export type GrowthSettingsPostMountErrorPayload = {
  kind: "error" | "unhandledrejection"
  message: string
  stack?: string
  componentStack?: string
  pathname: string
  sectionId: string | null
  digest?: string
}

function resolveGrowthEngineSectionId(pathname: string): string | null {
  const prefix = "/settings/growth-engine/"
  if (!pathname.startsWith(prefix)) return null
  const rest = pathname.slice(prefix.length).split("/")[0]?.trim()
  return rest || null
}

function logGrowthSettingsPostMountError(payload: GrowthSettingsPostMountErrorPayload) {
  console.error(LOG_PREFIX, payload)
}

export function GrowthSettingsPostMountObserver() {
  const pathname = usePathname() ?? ""
  const pathnameRef = useRef(pathname)
  pathnameRef.current = pathname

  useEffect(() => {
    if (!pathname.startsWith("/settings/growth-engine")) return

    const sectionId = resolveGrowthEngineSectionId(pathnameRef.current)

    function onError(event: ErrorEvent) {
      const err = event.error
      logGrowthSettingsPostMountError({
        kind: "error",
        message: err instanceof Error ? err.message : event.message,
        stack: err instanceof Error ? err.stack : undefined,
        pathname: pathnameRef.current,
        sectionId: resolveGrowthEngineSectionId(pathnameRef.current),
        digest: typeof (err as { digest?: string } | null)?.digest === "string"
          ? (err as { digest?: string }).digest
          : undefined,
      })
    }

    function onUnhandledRejection(event: PromiseRejectionEvent) {
      const reason = event.reason
      logGrowthSettingsPostMountError({
        kind: "unhandledrejection",
        message: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
        pathname: pathnameRef.current,
        sectionId: resolveGrowthEngineSectionId(pathnameRef.current),
      })
    }

    window.addEventListener("error", onError)
    window.addEventListener("unhandledrejection", onUnhandledRejection)

    console.info("[growth-settings-post-mount]", {
      event: "observer_attached",
      pathname: pathnameRef.current,
      sectionId,
      marker: GROWTH_SETTINGS_POST_MOUNT_OBSERVER_QA_MARKER,
    })

    return () => {
      window.removeEventListener("error", onError)
      window.removeEventListener("unhandledrejection", onUnhandledRejection)
    }
  }, [pathname])

  return (
    <span
      hidden
      data-qa-marker={GROWTH_SETTINGS_POST_MOUNT_OBSERVER_QA_MARKER}
      data-growth-settings-post-mount-observer="v1"
    />
  )
}
