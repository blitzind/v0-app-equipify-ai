"use client"

/**
 * Communications Center Phase 1 — route shell.
 *
 * Switches between the new Phase 1 feed view (default) and the
 * pre-existing power-user center (templates / automations summary /
 * failed-deliveries retry / AI suggestions) via `?view=tools`. The
 * legacy view is preserved verbatim — Phase 1 was an additive
 * visibility layer, not a rewrite, so existing tooling stays
 * accessible without a separate route.
 */

import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CommunicationsFeedPage } from "./communications-feed-page"
import CommunicationsCenter from "./communications-center"

export function CommunicationsRouteShell() {
  const params = useSearchParams()
  const view = params?.get("view")

  if (view === "tools") {
    return (
      <div className="flex flex-col gap-4 min-w-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <Link href="/communications">
              <ArrowLeft className="w-4 h-4" aria-hidden />
              Back to Communications
            </Link>
          </Button>
          <p className="text-xs text-muted-foreground">
            Power-user view — templates, AI suggestions, retry queue.
          </p>
        </div>
        <CommunicationsCenter />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <CommunicationsFeedPage />
      <div className="flex items-center justify-end">
        <Button asChild variant="ghost" size="sm" className="gap-1.5 text-xs">
          <Link href="/communications?view=tools">
            <Settings2 className="w-3.5 h-3.5" aria-hidden />
            Templates & retry queue
          </Link>
        </Button>
      </div>
    </div>
  )
}
