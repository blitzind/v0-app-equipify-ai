"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  GROWTH_SHELL_NAV_GROUPS,
  isGrowthShellNavItemActive,
} from "@/components/growth/shell/growth-shell-navigation"

type GrowthSidebarNavContentProps = {
  onNavigate?: () => void
  className?: string
}

export function GrowthSidebarNavContent({ onNavigate, className }: GrowthSidebarNavContentProps) {
  const pathname = usePathname()

  return (
    <nav className={cn("flex-1 overflow-y-auto px-2 py-3", className)} aria-label="Growth Engine navigation">
      {GROWTH_SHELL_NAV_GROUPS.map((group, groupIndex) => (
        <div key={group.id} className={cn(groupIndex > 0 && "mt-4")}>
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            {group.label}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon
              const active = isGrowthShellNavItemActive(pathname, item)
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-[#13233F] text-[#6EA8FF] shadow-[0_0_20px_-8px_rgba(41,108,255,0.45)]"
                        : "text-slate-300 hover:bg-white/5 hover:text-white",
                    )}
                  >
                    <Icon className={cn("size-4 shrink-0", active ? "text-[#6EA8FF]" : "text-slate-400")} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
