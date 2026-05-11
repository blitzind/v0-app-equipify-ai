"use client"

import { RouteErrorFallback } from "@/components/failure-states/route-error-fallback"

export default function PortalSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <RouteErrorFallback error={error} reset={reset} scope="portal" />
}
