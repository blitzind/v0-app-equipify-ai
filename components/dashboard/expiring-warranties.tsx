import { ShieldAlert } from "lucide-react"
import { expiringWarranties } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

export function ExpiringWarranties() {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-[oklch(0.75_0.16_70)]" />
          <h2 className="text-sm font-semibold text-foreground">Expiring Warranties</h2>
        </div>
        <button className="text-xs font-medium text-primary hover:underline">Manage</button>
      </div>
      <ul className="divide-y divide-border">
        {expiringWarranties.map((item, i) => {
          const urgent = item.daysLeft <= 15
          return (
            <li key={i} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors cursor-pointer">
              <div className={cn(
                "flex items-center justify-center w-10 h-10 rounded-full text-xs font-bold shrink-0",
                urgent ? "bg-destructive/10 text-destructive" : "bg-[oklch(0.75_0.16_70)]/10 text-[oklch(0.50_0.12_70)]"
              )}>
                {item.daysLeft}d
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{item.equipment}</p>
                <p className="text-xs text-muted-foreground truncate">{item.customer}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground">Expires</p>
                <p className={cn("text-xs font-medium", urgent ? "text-destructive" : "text-foreground")}>{item.expires}</p>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
