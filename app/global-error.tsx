"use client"

import "./globals.css"

import { RouteErrorFallback } from "@/components/failure-states/route-error-fallback"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased min-h-dvh bg-background text-foreground">
        <RouteErrorFallback error={error} reset={reset} scope="global" />
      </body>
    </html>
  )
}
