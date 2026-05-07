"use client"

/**
 * Customer Hierarchy — Phase 2
 *
 * Compact "Parent account" card mounted at the top of a sub-account's detail
 * page so operators always know the parent context without scrolling. The
 * lookup uses `resolveCustomerRollupRoot` so the displayed parent is the
 * *top-most* ancestor (typical multi-tier accounts only have 1-2 levels, but
 * the helper is safe up to MAX_DEPTH).
 *
 * Strict rules:
 *   - never expose raw UUIDs in rendered text
 *   - non-throwing: hides itself when no parent can be resolved
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import { Building2, ChevronRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { resolveCustomerRollupRoot } from "@/lib/customers/consolidated-rollup"

type Props = {
  organizationId: string
  customerId: string
  /** Used to suppress this card if `customerId` *is* its own root. */
  parentId?: string | null
  className?: string
}

type ResolvedRoot = { id: string; companyName: string }

export function ParentAccountCard({
  organizationId,
  customerId,
  parentId,
  className,
}: Props) {
  const [root, setRoot] = useState<ResolvedRoot | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!parentId) {
      setRoot(null)
      setLoaded(true)
      return
    }
    void (async () => {
      const supabase = createBrowserSupabaseClient()
      const r = await resolveCustomerRollupRoot(supabase, {
        organizationId,
        customerId,
      }).catch(() => null)
      if (cancelled) return
      // Only show when there is a *different* ancestor — i.e. this customer
      // is not its own root.
      if (r && r.id !== customerId) {
        setRoot(r)
      } else {
        setRoot(null)
      }
      setLoaded(true)
    })()
    return () => {
      cancelled = true
    }
  }, [organizationId, customerId, parentId])

  if (!loaded || !root) return null

  return (
    <Card className={cn("border-[color:var(--status-info)]/30 bg-[color:var(--status-info)]/5", className)}>
      <CardContent className="flex items-center gap-3 px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[color:var(--status-info)]/15 text-[color:var(--status-info)]">
          <Building2 className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Parent account
          </p>
          <Link
            href={`/customers/${root.id}`}
            className="inline-flex items-center gap-1 truncate text-sm font-semibold text-foreground hover:text-primary"
          >
            {root.companyName}
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </div>
        <Link
          href={`/customers/${root.id}`}
          className="rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted"
        >
          View parent
        </Link>
      </CardContent>
    </Card>
  )
}
