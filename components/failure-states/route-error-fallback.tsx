"use client"

import Link from "next/link"
import { AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { FAILURE_COPY } from "@/lib/failure-states/copy"
import { cn } from "@/lib/utils"

export type RouteErrorScope = "app" | "dashboard" | "portal" | "admin" | "global"

function copyForScope(scope: RouteErrorScope): { title: string; description: string } {
  switch (scope) {
    case "dashboard":
      return {
        title: FAILURE_COPY.routeDashboardTitle,
        description: FAILURE_COPY.routeDashboardDescription,
      }
    case "portal":
      return {
        title: FAILURE_COPY.routePortalTitle,
        description: FAILURE_COPY.routePortalDescription,
      }
    case "admin":
      return {
        title: FAILURE_COPY.routeAdminTitle,
        description: FAILURE_COPY.routeAdminDescription,
      }
    case "global":
      return {
        title: FAILURE_COPY.routeGlobalTitle,
        description: FAILURE_COPY.routeGlobalDescription,
      }
    default:
      return {
        title: FAILURE_COPY.routeAppTitle,
        description: FAILURE_COPY.routeAppDescription,
      }
  }
}

function homeHref(scope: RouteErrorScope): string {
  if (scope === "portal") return "/portal"
  if (scope === "admin") return "/admin"
  return "/"
}

/**
 * Used by Next.js `error.tsx` segments. Never renders raw `error.stack`.
 * In production, user-facing text stays generic; development may show a short diagnostic line (no stack).
 */
export function RouteErrorFallback({
  error,
  reset,
  scope = "app",
  className,
}: {
  error: Error & { digest?: string }
  reset: () => void
  scope?: RouteErrorScope
  className?: string
}) {
  const { title, description } = copyForScope(scope)
  const devHint =
    process.env.NODE_ENV === "development"
      ? error.message?.trim() || error.digest
      : null

  return (
    <div
      className={cn(
        "flex min-h-[50vh] w-full flex-col items-center justify-center gap-6 px-4 py-12 text-center",
        className,
      )}
    >
      <div className="flex max-w-md flex-col items-center gap-3 rounded-xl border border-border bg-card px-6 py-8 shadow-sm">
        <div className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-5 shrink-0" aria-hidden />
        </div>
        <div className="space-y-2">
          <h1 className="text-lg font-semibold tracking-tight text-balance">{title}</h1>
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
            {description}
          </p>
          {devHint ? (
            <p className="rounded-md border border-dashed border-border bg-muted/40 px-2 py-1.5 font-mono text-[11px] leading-snug text-muted-foreground break-words">
              {devHint}
            </p>
          ) : null}
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          <Button type="button" onClick={() => reset()}>
            {FAILURE_COPY.retryAction}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href={homeHref(scope)}>
              {scope === "global"
                ? FAILURE_COPY.goHome
                : scope === "portal" || scope === "admin"
                  ? FAILURE_COPY.goHome
                  : FAILURE_COPY.goDashboard}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
