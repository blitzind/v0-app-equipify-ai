"use client"

import Link from "next/link"
import { HardHat, ChevronRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

/**
 * Mobile-first entry to field workflows — hidden at lg+ so desktop dashboard stays unchanged.
 */
export function TechnicianTodayMobileCard() {
  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.06] to-transparent lg:hidden">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <HardHat className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-sm font-semibold text-foreground leading-tight">Technician — today</p>
          <p className="text-xs text-muted-foreground leading-snug">
            Open jobs assigned to you, call customers, and capture photos & signatures faster on mobile.
          </p>
        </div>
        <Link
          href="/technicians/today"
          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-sm touch-manipulation active:opacity-90"
        >
          Open
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </CardContent>
    </Card>
  )
}
