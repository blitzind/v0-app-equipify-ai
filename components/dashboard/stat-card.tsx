import Link from "next/link"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  iconColor?: string
  iconBg?: string
  trend?: { value: string; positive?: boolean }
  urgent?: boolean
  href?: string
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = "text-primary",
  iconBg = "bg-primary/10",
  trend,
  urgent,
  href,
}: StatCardProps) {
  const inner = (
    <div className={cn(
      "group bg-card rounded-xl border border-border p-4 sm:p-5 flex flex-col h-full min-h-[160px]",
      "shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]",
      "hover:shadow-[0_4px_12px_rgba(0,0,0,0.08),0_2px_4px_rgba(0,0,0,0.04)] hover:-translate-y-px",
      "transition-all duration-200 select-none",
      href ? "cursor-pointer" : "cursor-default",
      urgent && "border-destructive/40",
      href && "hover:border-primary/30",
    )}>
      {/* Title row — fixed min-height so wrapping titles don't shift content below */}
      <div className="flex items-start justify-between gap-2 min-h-[2rem]">
        <p className="text-[11px] font-semibold text-muted-foreground leading-snug tracking-wider uppercase">{title}</p>
        <div className={cn(
          "flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg shrink-0",
          "ring-2 ring-transparent ring-offset-1 ring-offset-card",
          "group-hover:ring-primary/20 transition-all duration-200",
          iconBg
        )}>
          <Icon className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-200 group-hover:scale-110", iconColor)} />
        </div>
      </div>
      {/* Value + subtitle — anchored below the title row */}
      <div className="mt-3">
        <p className={cn(
          "text-2xl sm:text-3xl font-bold tracking-tight ds-tabular",
          urgent ? "text-destructive" : "text-foreground"
        )}>
          {value}
        </p>
        {subtitle && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{subtitle}</p>}
      </div>
      {/* Trend text — always pinned to the bottom */}
      {trend && (
        <p className={cn("text-xs font-semibold mt-auto pt-3", trend.positive ? "text-[oklch(0.42_0.17_145)]" : "text-destructive")}>
          {trend.value}
        </p>
      )}
    </div>
  )

  if (href) {
    return <Link href={href} className="block h-full">{inner}</Link>
  }
  return inner
}
