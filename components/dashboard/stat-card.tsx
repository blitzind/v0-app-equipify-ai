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
    <div className={cn("bg-card rounded-xl border border-border p-5 flex flex-col gap-4", urgent && "border-destructive/40")}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div className={cn("flex items-center justify-center w-9 h-9 rounded-lg", iconBg)}>
          <Icon className={cn("w-4 h-4", iconColor)} />
        </div>
      </div>
      <div>
        <p className={cn("text-3xl font-bold tracking-tight", urgent ? "text-destructive" : "text-foreground")}>
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
