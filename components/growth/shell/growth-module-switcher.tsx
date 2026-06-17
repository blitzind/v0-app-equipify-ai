"use client"

import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { GROWTH_BRAND } from "@/components/growth/shell/growth-brand"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-registry"

type GrowthModuleSwitcherProps = {
  compact?: boolean
}

export function GrowthModuleSwitcher({ compact = false }: GrowthModuleSwitcherProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1",
        compact ? "text-[11px]" : "text-xs",
      )}
    >
      <Link
        href="/"
        className="rounded-md px-2.5 py-1.5 font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
      >
        Equipify Core
      </Link>
      <Link
        href={GROWTH_WORKSPACE_BASE_PATH}
        className="rounded-md bg-[#296cff]/20 px-2.5 py-1.5 font-medium text-[#6EA8FF]"
        aria-current="page"
      >
        {GROWTH_BRAND.name}
      </Link>
      <ChevronRight className="hidden size-3 text-slate-500 sm:inline" />
    </div>
  )
}
