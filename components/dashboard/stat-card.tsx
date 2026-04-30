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
}: StatCardProps) {
  return (
    <div className={cn("bg-card rounded-xl border border-border p-4 sm:p-5 flex flex-col gap-3 sm:gap-4", urgent && "border-destructive/40")}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs sm:text-sm font-medium text-muted-foreground leading-snug">{title}</p>
        <div className={cn("flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg shrink-0", iconBg)}>
          <Icon className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4", iconColor)} />
        </div>
      </div>
      <div>
        <p className={cn("text-2xl sm:text-3xl font-bold tracking-tight", urgent ? "text-destructive" : "text-foreground")}>
          {value}
        </p>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {trend && (
        <p className={cn("text-xs font-medium", trend.positive ? "text-[oklch(0.62_0.17_145)]" : "text-destructive")}>
          {trend.value}
        </p>
      )}
    </div>
  )
}
